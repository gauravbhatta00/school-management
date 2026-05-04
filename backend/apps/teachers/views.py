from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Teacher
from .serializers import TeacherSerializer, TeacherCreateSerializer, SubjectSerializer
from apps.accounts.permissions import IsSchoolAdmin, IsAdminOrTeacher
from apps.exams.models import Subject


class TeacherViewSet(viewsets.ModelViewSet):
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["subjects"]
    search_fields = [
        "user__first_name",
        "user__last_name",
        "subjects__name",
        "subjects__code",
    ]
    ordering_fields = ["user__first_name", "experience_years", "joining_date"]

    def get_queryset(self):
        return (
            Teacher.objects.filter(school=self.request.user.school)
            .select_related("user", "school")
            .prefetch_related("subjects")
            .distinct()
        )

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return TeacherCreateSerializer
        return TeacherSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsSchoolAdmin()]
        return [IsAuthenticated(), IsAdminOrTeacher()]

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated()])
    def subjects(self, request):
        """
        Fetch subjects available for the school, optionally filtered by class_name.
        Query params:
        - class_name: Filter subjects by class (e.g., "10", "11", "12")
        """
        school = request.user.school
        if not school:
            return Response(
                {"error": "User not assigned to a school"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = Subject.objects.filter(school=school)
        class_name = request.query_params.get("class_name")
        if class_name:
            queryset = queryset.filter(class_name=class_name)

        serializer = SubjectSerializer(queryset, many=True)
        return Response(serializer.data)
