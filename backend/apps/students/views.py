"""
Student ViewSet — full CRUD with class/section filtering.
Scoped to the requesting user's school automatically.
"""

import csv
import io
import re
from datetime import datetime

from django.db import IntegrityError, transaction
from rest_framework import viewsets
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Student
from .serializers import StudentSerializer, StudentCreateSerializer
from apps.accounts.models import User
from apps.accounts.permissions import IsSchoolAdmin, IsAdminOrTeacher, IsStaff, AnyOf


def generate_student_password(first_name, last_name, class_name, section, roll_number):
    name_part = re.sub(r"[^A-Za-z0-9]", "", f"{first_name}{last_name}")[:8]
    if not name_part:
        name_part = "Student"
    name_part = name_part[:1].upper() + name_part[1:]

    class_part = re.sub(r"[^A-Za-z0-9]", "", class_name)
    section_part = re.sub(r"[^A-Za-z0-9]", "", section).upper()
    roll_part = re.sub(r"[^A-Za-z0-9]", "", roll_number)
    return f"{name_part}@{class_part}{section_part}{roll_part}"


class StudentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminOrTeacher]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["class_name", "section"]
    search_fields = ["user__first_name", "user__last_name", "roll_number"]
    ordering_fields = ["roll_number", "class_name", "user__first_name"]
    ordering = ["class_name", "section", "roll_number"]

    def get_queryset(self):
        return Student.objects.filter(school=self.request.user.school).select_related(
            "user", "user__school", "school"
        )

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return StudentCreateSerializer
        return StudentSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsSchoolAdmin()]
        # Staff (clerks, librarians, etc.) get read-only access — useful for
        # looking up a student's class/section/roll — but never manage records.
        return [IsAuthenticated(), AnyOf(IsAdminOrTeacher, IsStaff)]

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)

    @action(methods=["post"], detail=False, url_path="import-csv")
    def import_csv(self, request):
        csv_file = request.FILES.get("file")
        if not csv_file:
            return Response(
                {"detail": 'CSV file is required under "file".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not csv_file.name.lower().endswith(".csv"):
            return Response(
                {"detail": "Only .csv files are supported."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            decoded = csv_file.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return Response(
                {"detail": "Unable to decode CSV file. Use UTF-8 encoding."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reader = csv.DictReader(io.StringIO(decoded))
        required_columns = {
            "email",
            "first_name",
            "last_name",
            "class_name",
            "section",
            "roll_number",
        }
        missing = [c for c in required_columns if c not in (reader.fieldnames or [])]
        if missing:
            return Response(
                {
                    "detail": "Missing required CSV columns.",
                    "missing_columns": sorted(missing),
                    "required_columns": sorted(required_columns),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        default_password = (
            request.data.get("default_password") or request.data.get("password") or ""
        ).strip()

        created_count = 0
        failed_count = 0
        errors = []
        credentials = []

        for index, row in enumerate(reader, start=2):
            email = (row.get("email") or "").strip().lower()
            first_name = (row.get("first_name") or "").strip()
            last_name = (row.get("last_name") or "").strip()
            class_name = (row.get("class_name") or "").strip()
            section = (row.get("section") or "").strip()
            roll_number = (row.get("roll_number") or "").strip()
            parent_contact = (row.get("parent_contact") or "").strip()
            address = (row.get("address") or "").strip()
            row_password = (row.get("password") or "").strip()
            dob_raw = (row.get("date_of_birth") or "").strip()

            if not all(
                [email, first_name, last_name, class_name, section, roll_number]
            ):
                failed_count += 1
                errors.append({"row": index, "error": "Required fields are missing."})
                continue

            if User.objects.filter(email=email).exists():
                failed_count += 1
                errors.append(
                    {"row": index, "email": email, "error": "Email already exists."}
                )
                continue

            date_of_birth = None
            if dob_raw:
                try:
                    date_of_birth = datetime.strptime(dob_raw, "%Y-%m-%d").date()
                except ValueError:
                    failed_count += 1
                    errors.append(
                        {
                            "row": index,
                            "email": email,
                            "error": "Invalid date_of_birth. Use YYYY-MM-DD format.",
                        }
                    )
                    continue

            password = (
                row_password
                or default_password
                or generate_student_password(
                    first_name, last_name, class_name, section, roll_number
                )
            )

            try:
                with transaction.atomic():
                    user = User.objects.create_user(
                        email=email,
                        password=password,
                        first_name=first_name,
                        last_name=last_name,
                        role=User.Role.STUDENT,
                        school=request.user.school,
                    )
                    Student.objects.create(
                        school=request.user.school,
                        user=user,
                        class_name=class_name,
                        section=section,
                        roll_number=roll_number,
                        date_of_birth=date_of_birth,
                        address=address,
                        parent_contact=parent_contact,
                    )
                created_count += 1
                credentials.append(
                    {
                        "email": email,
                        "full_name": f"{first_name} {last_name}".strip(),
                        "password": password,
                        "source": (
                            "csv"
                            if row_password
                            else "default"
                            if default_password
                            else "generated"
                        ),
                    }
                )
            except IntegrityError:
                failed_count += 1
                errors.append(
                    {
                        "row": index,
                        "email": email,
                        "error": "Duplicate roll number for class/section or other integrity constraint.",
                    }
                )

        response_status = (
            status.HTTP_201_CREATED
            if failed_count == 0
            else status.HTTP_207_MULTI_STATUS
        )
        return Response(
            {
                "created_count": created_count,
                "failed_count": failed_count,
                "errors": errors,
                "credentials": credentials,
                "required_columns": sorted(required_columns),
                "optional_columns": [
                    "parent_contact",
                    "address",
                    "date_of_birth",
                    "password",
                ],
            },
            status=response_status,
        )
