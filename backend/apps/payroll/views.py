"""
Payroll ViewSet suite:
  SalaryPaymentViewSet — CRUD for teacher/staff salary payment records
    /pay/              — POST: record a salary payment (auto-determines status)
    /teacher-status/   — GET:  full salary status for one teacher/month
    /payroll-summary/  — GET:  school-wide payroll summary for a month
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Sum, Count, Q
from django.utils import timezone

from .models import SalaryPayment
from .serializers import SalaryPaymentSerializer, PaySalarySerializer
from .permissions import CanManagePayroll
from apps.accounts.permissions import IsSchoolAdmin, IsAdminOrTeacher, AnyOf
from apps.teachers.models import Teacher


class SalaryPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = SalaryPaymentSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        "status": ["exact"],
        "payment_method": ["exact"],
        "salary_month": ["exact"],
        "teacher": ["exact"],
    }
    search_fields = [
        "teacher__user__first_name",
        "teacher__user__last_name",
        "transaction_id",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = SalaryPayment.objects.filter(
            school=self.request.user.school
        ).select_related("teacher__user", "created_by")

        if self.request.user.role == "teacher":
            queryset = queryset.filter(teacher__user=self.request.user)

        return queryset

    def get_permissions(self):
        # Deleting a salary record stays admin-only regardless of designation.
        if self.action in ["destroy"]:
            return [IsAuthenticated(), IsSchoolAdmin()]
        # Accountant can track and update payroll the same way admin can —
        # every other staff designation (Librarian included) never reaches
        # payroll at all. See apps.payroll.permissions.CanManagePayroll.
        if self.action in ["create", "update", "partial_update", "pay", "payroll_summary"]:
            return [IsAuthenticated(), AnyOf(IsSchoolAdmin, CanManagePayroll)]
        return [IsAuthenticated(), AnyOf(IsAdminOrTeacher, CanManagePayroll)]

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school, created_by=self.request.user)

    @action(detail=False, methods=["post"], url_path="pay")
    def pay(self, request):
        """
        Record a salary payment and auto-compute status.

        POST /api/salary-payments/pay/
        {
            "teacher_id": 5,
            "salary_month": "2026-08",
            "amount": 30000,
            "payment_method": "online",
            "transaction_id": "TXN123"
        }
        """
        serializer = PaySalarySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        school = request.user.school

        try:
            teacher = Teacher.objects.get(id=d["teacher_id"], school=school)
        except Teacher.DoesNotExist:
            return Response(
                {"error": "Teacher not found."}, status=status.HTTP_404_NOT_FOUND
            )

        paid_so_far = (
            SalaryPayment.objects.filter(
                school=school,
                teacher=teacher,
                salary_month=d["salary_month"],
                status__in=["paid", "partial"],
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )

        new_total = float(paid_so_far) + float(d["amount"])
        required = float(teacher.basic_salary)

        if required > 0 and new_total >= required:
            pay_status = SalaryPayment.Status.PAID
        elif new_total > 0:
            pay_status = SalaryPayment.Status.PARTIAL
        else:
            pay_status = SalaryPayment.Status.PENDING

        payment = SalaryPayment.objects.create(
            school=school,
            teacher=teacher,
            salary_month=d["salary_month"],
            amount=d["amount"],
            status=pay_status,
            payment_method=d["payment_method"],
            payment_date=timezone.now().date(),
            transaction_id=d.get("transaction_id", ""),
            remarks=d.get("remarks", ""),
            created_by=request.user,
        )

        return Response(
            SalaryPaymentSerializer(payment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="teacher-status")
    def teacher_status(self, request):
        """
        Full salary status for one teacher for a given month.
        GET /api/salary-payments/teacher-status/?teacher=<id>&salary_month=2026-08
        """
        teacher_id = request.query_params.get("teacher")
        salary_month = request.query_params.get(
            "salary_month", timezone.now().strftime("%Y-%m")
        )
        school = request.user.school

        try:
            teacher = Teacher.objects.get(id=teacher_id, school=school)
        except Teacher.DoesNotExist:
            return Response({"error": "Teacher not found."}, status=404)

        if request.user.role == "teacher" and teacher.user_id != request.user.id:
            return Response(
                {"error": "You can only access your own salary status."}, status=403
            )

        payments = SalaryPayment.objects.filter(
            school=school, teacher=teacher, salary_month=salary_month
        )
        total_paid = (
            payments.filter(status__in=["paid", "partial"]).aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )

        required = float(teacher.basic_salary)
        balance = max(0, required - float(total_paid))

        return Response(
            {
                "teacher_id": teacher.id,
                "teacher_name": teacher.user.get_full_name(),
                "salary_month": salary_month,
                "basic_salary": required,
                "total_paid": float(total_paid),
                "balance": balance,
                "is_fully_paid": required > 0 and balance == 0,
                "payments": SalaryPaymentSerializer(
                    payments, many=True, context={"request": request}
                ).data,
            }
        )

    @action(detail=False, methods=["get"], url_path="payroll-summary")
    def payroll_summary(self, request):
        """
        School-wide payroll summary dashboard.
        GET /api/salary-payments/payroll-summary/?salary_month=2026-08
        """
        school = request.user.school
        salary_month = request.query_params.get(
            "salary_month", timezone.now().strftime("%Y-%m")
        )

        payments = SalaryPayment.objects.filter(
            school=school, salary_month=salary_month
        )
        agg = payments.aggregate(
            total_disbursed=Sum("amount", filter=Q(status__in=["paid", "partial"])),
            paid_count=Count("id", filter=Q(status="paid")),
            pending_count=Count("id", filter=Q(status="pending")),
            partial_count=Count("id", filter=Q(status="partial")),
            hold_count=Count("id", filter=Q(status="hold")),
        )

        total_payroll = (
            Teacher.objects.filter(school=school).aggregate(
                total=Sum("basic_salary")
            )["total"]
            or 0
        )

        return Response(
            {
                "salary_month": salary_month,
                "total_payroll": float(total_payroll),
                "total_disbursed": float(agg["total_disbursed"] or 0),
                "paid_count": agg["paid_count"],
                "pending_count": agg["pending_count"],
                "partial_count": agg["partial_count"],
                "hold_count": agg["hold_count"],
                "staff_count": Teacher.objects.filter(school=school).count(),
            }
        )
