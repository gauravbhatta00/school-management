"""
Exams ViewSet suite:
  ExamViewSet    — CRUD for exam events
  SubjectViewSet — CRUD for subjects
  ResultViewSet  — CRUD for individual marks + /student-card/ report
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from .models import Exam, Subject, Result
from .serializers import (
    ExamSerializer,
    SubjectSerializer,
    ResultSerializer,
)
from apps.accounts.permissions import IsAdminOrTeacher, IsSchoolAdmin, IsStudent


class ExamViewSet(viewsets.ModelViewSet):
    serializer_class = ExamSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["academic_year", "is_active"]
    search_fields = ["name"]

    def get_queryset(self):
        return Exam.objects.filter(school=self.request.user.school)

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsSchoolAdmin()]
        return [IsAuthenticated(), IsAdminOrTeacher()]

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)


class SubjectViewSet(viewsets.ModelViewSet):
    serializer_class = SubjectSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["class_name"]
    search_fields = ["name", "code"]

    def get_queryset(self):
        return Subject.objects.filter(school=self.request.user.school)

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsSchoolAdmin()]
        return [IsAuthenticated(), IsAdminOrTeacher()]

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)


class ResultViewSet(viewsets.ModelViewSet):
    serializer_class = ResultSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["exam", "subject", "student", "student__class_name"]
    search_fields = ["student__user__first_name", "student__user__last_name"]

    def get_queryset(self):
        queryset = Result.objects.filter(
            school=self.request.user.school
        ).select_related("student__user", "exam", "subject")

        if self.request.user.role == "student":
            queryset = queryset.filter(student__user=self.request.user)

        return queryset

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsAdminOrTeacher()]
        if self.action in ["class_summary"]:
            return [IsAuthenticated(), IsAdminOrTeacher()]
        # Allow either admin/teacher OR student to access student-card endpoints
        from apps.accounts.permissions import AnyOf

        return [IsAuthenticated(), AnyOf(IsAdminOrTeacher, IsStudent)]

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)

    @action(detail=False, methods=["get"], url_path="student-card")
    def student_card(self, request):
        """
        Full result card for one student in one exam.
        GET /api/results/student-card/?student=<id>&exam=<id>

        Returns per-subject marks + totals + overall percentage + grade.
        """
        student_id = request.query_params.get("student")
        exam_id = request.query_params.get("exam")

        if not student_id or not exam_id:
            return Response(
                {"error": "Both student and exam query params are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = Result.objects.filter(
            school=request.user.school, student_id=student_id, exam_id=exam_id
        ).select_related("student__user", "exam", "subject")

        if request.user.role == "student":
            results = results.filter(student__user=request.user)

        if not results.exists():
            return Response(
                {"error": "No results found."}, status=status.HTTP_404_NOT_FOUND
            )

        totals = results.aggregate(
            total_obtained=Sum("marks_obtained"), total_max=Sum("max_marks")
        )
        total_obtained = float(totals["total_obtained"] or 0)
        total_max = float(totals["total_max"] or 1)
        overall_pct = round(total_obtained / total_max * 100, 2)

        def overall_grade(p):
            if p >= 90:
                return "A+"
            elif p >= 80:
                return "A"
            elif p >= 70:
                return "B"
            elif p >= 60:
                return "C"
            elif p >= 50:
                return "D"
            return "F"

        first = results.first()
        return Response(
            {
                "student_id": int(student_id),
                "student_name": first.student.user.get_full_name(),
                "exam_name": first.exam.name,
                "results": ResultSerializer(results, many=True).data,
                "total_marks_obtained": total_obtained,
                "total_max_marks": total_max,
                "overall_percentage": overall_pct,
                "overall_grade": overall_grade(overall_pct),
            }
        )

    @action(detail=False, methods=["get"], url_path="class-summary")
    def class_summary(self, request):
        """
        Topper list for a class in a given exam.
        GET /api/results/class-summary/?class_name=10&exam=<id>
        """
        class_name = request.query_params.get("class_name")
        exam_id = request.query_params.get("exam")

        results = (
            Result.objects.filter(
                school=request.user.school,
                student__class_name=class_name,
                exam_id=exam_id,
            )
            .values(
                "student__id",
                "student__user__first_name",
                "student__user__last_name",
                "student__section",
            )
            .annotate(
                total_obtained=Sum("marks_obtained"),
                total_max=Sum("max_marks"),
            )
            .order_by("-total_obtained")
        )

        data = []
        for idx, row in enumerate(results, 1):
            total_max = float(row["total_max"] or 1)
            total_obtained = float(row["total_obtained"] or 0)
            data.append(
                {
                    "rank": idx,
                    "student_id": row["student__id"],
                    "student_name": (
                        f"{row['student__user__first_name']} "
                        f"{row['student__user__last_name']}"
                    ).strip(),
                    "section": row["student__section"],
                    "total_marks": total_obtained,
                    "percentage": round(total_obtained / total_max * 100, 2),
                }
            )

        return Response(data)
