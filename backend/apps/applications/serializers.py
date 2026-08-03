"""
Application serializers for validation and data transformation.
"""

from rest_framework import serializers
from django.utils import timezone
from django.db import transaction
from .models import Application
from apps.accounts.serializers import UserSerializer
from apps.students.models import Student
from apps.notices.models import Notification


def _notify_student(application, title, message):
    Notification.objects.create(
        school=application.school,
        recipient=application.student.user,
        title=title,
        message=message,
        link="/applications",
    )


class ApplicationListSerializer(serializers.ModelSerializer):
    """For listing applications."""

    student_name = serializers.CharField(
        source="student.user.get_full_name", read_only=True
    )
    student_id = serializers.IntegerField(source="student.id", read_only=True)
    application_type_display = serializers.CharField(
        source="get_application_type_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    teacher_name = serializers.CharField(
        source="teacher_reviewed_by.get_full_name", read_only=True, allow_null=True
    )
    admin_name = serializers.CharField(
        source="admin_reviewed_by.get_full_name", read_only=True, allow_null=True
    )

    class Meta:
        model = Application
        fields = [
            "id",
            "student_id",
            "student_name",
            "application_type",
            "application_type_display",
            "status",
            "status_display",
            "title",
            "description",
            "start_date",
            "end_date",
            "teacher_review",
            "teacher_decision",
            "teacher_reviewed_at",
            "teacher_name",
            "admin_review",
            "admin_decision",
            "admin_reviewed_at",
            "admin_name",
            "created_at",
        ]
        read_only_fields = fields


class ApplicationDetailSerializer(serializers.ModelSerializer):
    """For retrieving full application details."""

    student_name = serializers.CharField(
        source="student.user.get_full_name", read_only=True
    )
    student_email = serializers.CharField(source="student.user.email", read_only=True)
    application_type_display = serializers.CharField(
        source="get_application_type_display", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    teacher_reviewer = UserSerializer(source="teacher_reviewed_by", read_only=True)
    admin_reviewer = UserSerializer(source="admin_reviewed_by", read_only=True)

    class Meta:
        model = Application
        fields = [
            "id",
            "student_id",
            "student_name",
            "student_email",
            "application_type",
            "application_type_display",
            "status",
            "status_display",
            "title",
            "description",
            "start_date",
            "end_date",
            "teacher_review",
            "teacher_decision",
            "teacher_reviewed_at",
            "teacher_reviewer",
            "admin_review",
            "admin_decision",
            "admin_reviewed_at",
            "admin_reviewer",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ApplicationCreateSerializer(serializers.ModelSerializer):
    """For students creating applications."""

    class Meta:
        model = Application
        fields = ["application_type", "title", "description", "start_date", "end_date"]

    def validate(self, attrs):
        """Validate required fields based on application type."""
        app_type = attrs.get("application_type")

        if app_type == Application.Type.LEAVE_REQUEST:
            if not attrs.get("start_date") or not attrs.get("end_date"):
                raise serializers.ValidationError(
                    "Start and end dates are required for leave requests."
                )
            if attrs.get("end_date") < attrs.get("start_date"):
                raise serializers.ValidationError(
                    "End date must be after or equal to start date."
                )

        return attrs

    def create(self, validated_data):
        """Create application and link to current user's student profile."""
        request = self.context.get("request")
        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            raise serializers.ValidationError(
                {"detail": "Your student profile is not set up yet. Contact your school admin."}
            )
        school = request.user.school

        return Application.objects.create(
            school=school, student=student, **validated_data
        )


class TeacherApplicationReviewSerializer(serializers.ModelSerializer):
    """For teachers to review leave requests (approve/reject directly)."""

    class Meta:
        model = Application
        fields = ["teacher_review", "teacher_decision"]

    def validate_teacher_decision(self, value):
        if value not in ["approved", "rejected"]:
            raise serializers.ValidationError(
                "Decision must be 'approved' or 'rejected'."
            )
        return value

    def update(self, instance, validated_data):
        """Update with teacher review."""
        request = self.context.get("request")
        with transaction.atomic():
            instance.teacher_review = validated_data.get(
                "teacher_review", instance.teacher_review
            )
            instance.teacher_decision = validated_data.get(
                "teacher_decision", instance.teacher_decision
            )
            instance.teacher_reviewed_by = request.user
            instance.teacher_reviewed_at = timezone.now()

            # For leave requests, teacher decision is final and updates attendance.
            if instance.application_type == Application.Type.LEAVE_REQUEST:
                if instance.teacher_decision == "approved":
                    instance.status = Application.Status.APPROVED
                else:
                    instance.status = Application.Status.REJECTED
            else:
                # For other apps, mark as teacher reviewed for admin to see
                instance.status = Application.Status.TEACHER_REVIEWED

            instance.save()

            if (
                instance.application_type == Application.Type.LEAVE_REQUEST
                and instance.status == Application.Status.APPROVED
            ):
                instance.apply_leave_attendance(marked_by=request.user)

            if instance.application_type == Application.Type.LEAVE_REQUEST:
                decision_word = "approved" if instance.status == Application.Status.APPROVED else "rejected"
                _notify_student(
                    instance,
                    title=f"Leave request {decision_word}",
                    message=(
                        f'Your leave request "{instance.title}" was {decision_word} by '
                        f"{request.user.get_full_name()}."
                        + (f' Note: "{instance.teacher_review}"' if instance.teacher_review else "")
                    ),
                )
            else:
                _notify_student(
                    instance,
                    title="Application reviewed by teacher",
                    message=(
                        f'Your application "{instance.title}" was reviewed by '
                        f"{request.user.get_full_name()} and sent to the admin for a final decision."
                        + (f' Note: "{instance.teacher_review}"' if instance.teacher_review else "")
                    ),
                )

        return instance


class AdminApplicationReviewSerializer(serializers.ModelSerializer):
    """For admins to make final decision on applications."""

    class Meta:
        model = Application
        fields = ["admin_review", "admin_decision"]

    def validate_admin_decision(self, value):
        if value not in ["approved", "rejected"]:
            raise serializers.ValidationError(
                "Decision must be 'approved' or 'rejected'."
            )
        return value

    def update(self, instance, validated_data):
        """Update with admin decision."""
        request = self.context.get("request")
        instance.admin_review = validated_data.get(
            "admin_review", instance.admin_review
        )
        instance.admin_decision = validated_data.get(
            "admin_decision", instance.admin_decision
        )
        instance.admin_reviewed_by = request.user
        instance.admin_reviewed_at = timezone.now()

        # Set final status based on admin decision
        if instance.admin_decision == "approved":
            instance.status = Application.Status.APPROVED
        else:
            instance.status = Application.Status.REJECTED

        instance.save()

        decision_word = "approved" if instance.status == Application.Status.APPROVED else "rejected"
        _notify_student(
            instance,
            title=f"Application {decision_word}",
            message=(
                f'Your application "{instance.title}" was {decision_word} by '
                f"{request.user.get_full_name()}."
                + (f' Note: "{instance.admin_review}"' if instance.admin_review else "")
            ),
        )

        return instance
