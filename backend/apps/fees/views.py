"""
Fees ViewSet suite:
  FeeStructureViewSet — CRUD for class-level fee definitions
  PaymentViewSet      — CRUD for payment records
    /pay/             — POST: record a payment (auto-determines status)
    /student-status/  — GET:  full fee status for one student
    /collection/      — GET:  school-wide collection summary
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.http import HttpResponse
import csv

from .models import FeeStructure, Payment
from .serializers import FeeStructureSerializer, PaymentSerializer, PayFeeSerializer
from .permissions import CanAccessFees, CanViewCollectionSummary, fee_category_scope
from .accrual import amount_due_so_far
from apps.accounts.permissions import (
    IsSchoolAdmin,
    IsAdminOrTeacher,
    IsStudent,
    AnyOf,
)
from apps.students.models import Student


class FeeStructureViewSet(viewsets.ModelViewSet):
    serializer_class = FeeStructureSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["class_name", "academic_year", "category"]

    def get_queryset(self):
        queryset = FeeStructure.objects.filter(school=self.request.user.school)
        scope = fee_category_scope(self.request.user)
        if scope:
            queryset = queryset.filter(category=scope)
        return queryset

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsSchoolAdmin()]
        return [IsAuthenticated(), AnyOf(IsAdminOrTeacher, CanAccessFees)]

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        "status": ["exact"],
        "payment_method": ["exact"],
        "student__class_name": ["exact"],
        "payment_date": ["exact", "gte", "lte"],
    }
    search_fields = [
        "student__user__first_name",
        "student__user__last_name",
        "transaction_id",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = Payment.objects.filter(
            school=self.request.user.school
        ).select_related("student__user", "fee_structure", "created_by")

        if self.request.user.role == "student":
            queryset = queryset.filter(student__user=self.request.user)

        scope = fee_category_scope(self.request.user)
        if scope:
            queryset = queryset.filter(fee_structure__category=scope)

        return queryset

    def get_permissions(self):
        if self.action in ["destroy"]:
            return [IsAuthenticated(), IsSchoolAdmin()]
        # Staff (e.g. front-desk/cashier) can record and look up payments,
        # same as teachers, but not the school-wide collection dashboard —
        # that stays limited to people who manage the fee program (plus
        # Accountant, see CanViewCollectionSummary). Which categories a
        # given staff member can actually record/see is narrowed further
        # in get_queryset()/pay() via fee_category_scope().
        if self.action in ["create", "update", "partial_update", "pay"]:
            return [IsAuthenticated(), AnyOf(IsAdminOrTeacher, CanAccessFees)]
        if self.action in ["collection_summary"]:
            return [IsAuthenticated(), AnyOf(IsAdminOrTeacher, CanViewCollectionSummary)]
        if getattr(self.request.user, "role", None) == "student":
            return [IsAuthenticated(), IsStudent()]
        return [IsAuthenticated(), AnyOf(IsAdminOrTeacher, CanAccessFees)]

    def perform_create(self, serializer):
        scope = fee_category_scope(self.request.user)
        fee_structure = serializer.validated_data.get("fee_structure")
        if scope and (fee_structure is None or fee_structure.category != scope):
            raise PermissionDenied(f"Your role can only record {scope} fee payments.")
        serializer.save(school=self.request.user.school, created_by=self.request.user)

    def perform_update(self, serializer):
        scope = fee_category_scope(self.request.user)
        fee_structure = serializer.validated_data.get(
            "fee_structure", serializer.instance.fee_structure
        )
        if scope and (fee_structure is None or fee_structure.category != scope):
            raise PermissionDenied(f"Your role can only record {scope} fee payments.")
        serializer.save()

    def _build_fee_report_rows(self, school, academic_year, class_name="", search=""):
        students_qs = (
            Student.objects.filter(school=school)
            .select_related("user")
            .order_by(
                "class_name",
                "section",
                "roll_number",
                "user__first_name",
                "user__last_name",
            )
        )

        if class_name:
            students_qs = students_qs.filter(class_name=class_name)

        if search:
            students_qs = students_qs.filter(
                Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(user__email__icontains=search)
                | Q(roll_number__icontains=search)
            )

        # A class's required fee is the SUM across every category (tuition,
        # transport, hostel, ...), not just one — a class can have several
        # FeeStructure rows (one per category) for the same year. For a
        # recurring (monthly/quarterly/...) row, only the portion accrued
        # so far counts — see apps.fees.accrual.
        fee_map = {}
        for f in FeeStructure.objects.filter(school=school, academic_year=academic_year):
            fee_map[f.class_name] = fee_map.get(f.class_name, 0.0) + amount_due_so_far(f)

        paid_qs = (
            Payment.objects.filter(
                school=school,
                student__in=students_qs,
                fee_structure__academic_year=academic_year,
                status__in=[Payment.Status.PAID, Payment.Status.PARTIAL],
            )
            .values("student_id")
            .annotate(total_paid=Sum("amount"))
        )
        paid_map = {p["student_id"]: float(p["total_paid"] or 0) for p in paid_qs}

        rows = []
        for student in students_qs:
            required = fee_map.get(student.class_name, 0.0)
            total_paid = paid_map.get(student.id, 0.0)
            balance = max(0.0, required - total_paid)

            if required == 0:
                fee_status = "no_structure"
            elif balance == 0:
                fee_status = "paid"
            elif total_paid > 0:
                fee_status = "partial"
            else:
                fee_status = "pending"

            rows.append(
                {
                    "student_id": student.id,
                    "student_name": student.user.get_full_name(),
                    "email": student.user.email,
                    "class_name": student.class_name,
                    "section": student.section,
                    "roll_number": student.roll_number,
                    "academic_year": academic_year,
                    "fee_required": required,
                    "total_paid": total_paid,
                    "balance": balance,
                    "fee_status": fee_status,
                }
            )

        return rows

    @action(detail=False, methods=["post"], url_path="pay")
    def pay(self, request):
        """
        Record a fee payment and auto-compute status.

        POST /api/payments/pay/
        {
            "student_id": 5,
            "fee_structure_id": 2,
            "amount": 5000,
            "payment_method": "online",
            "transaction_id": "TXN123"
        }
        """
        serializer = PayFeeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        school = request.user.school

        try:
            student = Student.objects.get(id=d["student_id"], school=school)
        except Student.DoesNotExist:
            return Response(
                {"error": "Student not found."}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            fee_structure = FeeStructure.objects.get(
                id=d["fee_structure_id"], school=school
            )
        except FeeStructure.DoesNotExist:
            return Response(
                {"error": "Fee structure not found."}, status=status.HTTP_404_NOT_FOUND
            )

        scope = fee_category_scope(request.user)
        if scope and fee_structure.category != scope:
            return Response(
                {"error": f"Your role can only record {scope} fee payments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        paid_so_far = (
            Payment.objects.filter(
                school=school,
                student=student,
                fee_structure=fee_structure,
                status__in=["paid", "partial"],
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )

        new_total = float(paid_so_far) + float(d["amount"])
        # For a recurring fee (monthly/quarterly/...), "required" is only
        # what has accrued so far, not the whole year — matches how the
        # payroll month-tracking already works.
        required = amount_due_so_far(fee_structure)

        if new_total >= required:
            pay_status = Payment.Status.PAID
        elif new_total > 0:
            pay_status = Payment.Status.PARTIAL
        else:
            pay_status = Payment.Status.PENDING

        payment = Payment.objects.create(
            school=school,
            student=student,
            fee_structure=fee_structure,
            amount=d["amount"],
            status=pay_status,
            payment_method=d["payment_method"],
            payment_date=timezone.now().date(),
            transaction_id=d.get("transaction_id", ""),
            remarks=d.get("remarks", ""),
            created_by=request.user,
        )

        return Response(
            PaymentSerializer(payment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="student-status")
    def student_status(self, request):
        """
        Full fee status for one student.
        GET /api/payments/student-status/?student=<id>&academic_year=2024-25
        """
        student_id = request.query_params.get("student")
        academic_year = request.query_params.get("academic_year", "2024-25")
        school = request.user.school

        try:
            student = Student.objects.get(id=student_id, school=school)
        except Student.DoesNotExist:
            return Response({"error": "Student not found."}, status=404)

        if request.user.role == "student" and student.user_id != request.user.id:
            return Response(
                {"error": "You can only access your own fee status."}, status=403
            )

        # A student can owe several fee categories at once (tuition,
        # transport, library, ...) — one FeeStructure row per category.
        structures = FeeStructure.objects.filter(
            school=school, class_name=student.class_name, academic_year=academic_year
        )

        payments = Payment.objects.filter(
            school=school, student=student, fee_structure__academic_year=academic_year
        )
        paid_by_structure = {
            row["fee_structure_id"]: float(row["total"] or 0)
            for row in payments.filter(status__in=["paid", "partial"])
            .values("fee_structure_id")
            .annotate(total=Sum("amount"))
        }

        by_category = []
        required = 0.0
        total_paid = 0.0
        for fs in structures:
            fs_required = amount_due_so_far(fs)  # accrued-to-date, not the full year
            fs_paid = paid_by_structure.get(fs.id, 0.0)
            required += fs_required
            total_paid += fs_paid
            by_category.append(
                {
                    "fee_structure_id": fs.id,
                    "category": fs.category,
                    "frequency": fs.frequency,
                    "rate": float(fs.amount),
                    "required": fs_required,
                    "paid": fs_paid,
                    "balance": max(0.0, fs_required - fs_paid),
                }
            )

        balance = max(0.0, required - total_paid)

        return Response(
            {
                "student_id": student.id,
                "student_name": student.user.get_full_name(),
                "class_name": student.class_name,
                "academic_year": academic_year,
                "fee_required": required,
                "total_paid": total_paid,
                "balance": balance,
                "is_fully_paid": balance == 0,
                "by_category": by_category,
                "payments": PaymentSerializer(
                    payments, many=True, context={"request": request}
                ).data,
            }
        )

    @action(detail=False, methods=["get"], url_path="collection-summary")
    def collection_summary(self, request):
        """
        School-wide fee collection dashboard.
        GET /api/payments/collection-summary/?academic_year=2024-25
        """
        school = request.user.school
        academic_year = request.query_params.get("academic_year", "2024-25")

        payments = Payment.objects.filter(
            school=school, fee_structure__academic_year=academic_year
        )
        agg = payments.aggregate(
            total_collected=Sum("amount", filter=Q(status__in=["paid", "partial"])),
            paid_count=Count("id", filter=Q(status="paid")),
            pending_count=Count("id", filter=Q(status="pending")),
            partial_count=Count("id", filter=Q(status="partial")),
        )

        return Response(
            {
                "academic_year": academic_year,
                "total_collected": float(agg["total_collected"] or 0),
                "paid_count": agg["paid_count"],
                "pending_count": agg["pending_count"],
                "partial_count": agg["partial_count"],
            }
        )

    @action(detail=False, methods=["get"], url_path="fee-report")
    def fee_report(self, request):
        """
        Student fee tracker and report endpoint.
        GET /api/payments/fee-report/?academic_year=2024-25&search=john&class_name=10&status=partial
        GET /api/payments/fee-report/?academic_year=2024-25&export=csv
        """
        school = request.user.school
        academic_year = request.query_params.get("academic_year", "2024-25")
        class_name = request.query_params.get("class_name", "")
        search = request.query_params.get("search", "").strip()
        status_filter = request.query_params.get("status", "")
        export = request.query_params.get("export", "")

        rows = self._build_fee_report_rows(
            school=school,
            academic_year=academic_year,
            class_name=class_name,
            search=search,
        )

        school_rows = self._build_fee_report_rows(
            school=school,
            academic_year=academic_year,
            class_name="",
            search="",
        )

        if status_filter:
            rows = [r for r in rows if r["fee_status"] == status_filter]

        summary = {
            "students": len(rows),
            "total_required": sum(r["fee_required"] for r in rows),
            "total_paid": sum(r["total_paid"] for r in rows),
            "total_balance": sum(r["balance"] for r in rows),
        }

        school_summary = {
            "students": len(school_rows),
            "total_required": sum(r["fee_required"] for r in school_rows),
            "total_paid": sum(r["total_paid"] for r in school_rows),
            "total_balance": sum(r["balance"] for r in school_rows),
            "paid_students": sum(1 for r in school_rows if r["fee_status"] == "paid"),
            "partial_students": sum(
                1 for r in school_rows if r["fee_status"] == "partial"
            ),
            "pending_students": sum(
                1 for r in school_rows if r["fee_status"] == "pending"
            ),
            "no_structure_students": sum(
                1 for r in school_rows if r["fee_status"] == "no_structure"
            ),
        }

        class_breakdown_map = {}
        for row in school_rows:
            key = row["class_name"]
            if key not in class_breakdown_map:
                class_breakdown_map[key] = {
                    "class_name": key,
                    "students": 0,
                    "total_required": 0.0,
                    "total_paid": 0.0,
                    "total_balance": 0.0,
                }
            class_breakdown_map[key]["students"] += 1
            class_breakdown_map[key]["total_required"] += row["fee_required"]
            class_breakdown_map[key]["total_paid"] += row["total_paid"]
            class_breakdown_map[key]["total_balance"] += row["balance"]

        class_breakdown = sorted(
            class_breakdown_map.values(), key=lambda x: str(x["class_name"])
        )

        if export == "csv":
            response = HttpResponse(content_type="text/csv")
            response[
                "Content-Disposition"
            ] = f'attachment; filename="fee_report_{academic_year}.csv"'

            writer = csv.writer(response)
            writer.writerow(
                [
                    "Student Name",
                    "Email",
                    "Class",
                    "Section",
                    "Roll Number",
                    "Academic Year",
                    "Fee Required",
                    "Total Paid",
                    "Balance",
                    "Status",
                ]
            )
            for row in rows:
                writer.writerow(
                    [
                        row["student_name"],
                        row["email"],
                        row["class_name"],
                        row["section"],
                        row["roll_number"],
                        row["academic_year"],
                        row["fee_required"],
                        row["total_paid"],
                        row["balance"],
                        row["fee_status"],
                    ]
                )
            return response

        return Response(
            {
                "academic_year": academic_year,
                "filters": {
                    "search": search,
                    "class_name": class_name,
                    "status": status_filter,
                },
                "summary": summary,
                "school_summary": school_summary,
                "class_breakdown": class_breakdown,
                "results": rows,
            }
        )
