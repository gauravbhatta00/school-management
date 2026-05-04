"""
Application model for student leave requests and other applications.

Design:
- Leave requests: Teachers approve directly
- Other applications: Teacher reviews → Admin decides
"""

from django.db import models
from django.core.exceptions import ValidationError
from datetime import timedelta

from apps.attendance.models import Attendance


class Application(models.Model):
    class Type(models.TextChoices):
        LEAVE_REQUEST = "leave_request", "Leave Request"
        TRANSFER_REQUEST = "transfer_request", "Transfer Request"
        FEE_WAIVER = "fee_waiver", "Fee Waiver"
        SCHOLARSHIP = "scholarship", "Scholarship"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        TEACHER_REVIEWED = "teacher_reviewed", "Teacher Reviewed"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    school = models.ForeignKey(
        "schools.School", on_delete=models.CASCADE, related_name="applications"
    )
    student = models.ForeignKey(
        "students.Student", on_delete=models.CASCADE, related_name="applications"
    )
    application_type = models.CharField(
        max_length=20, choices=Type.choices, default=Type.LEAVE_REQUEST
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )

    # Application content
    title = models.CharField(max_length=200)
    description = models.TextField()

    # For leave requests: start and end date
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    # Teacher review (for non-leave applications)
    teacher_review = models.TextField(blank=True, null=True)
    teacher_decision = models.CharField(
        max_length=20,
        choices=[
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("pending", "Pending"),
        ],
        default="pending",
        help_text="For leave requests, teacher makes final decision",
    )
    teacher_reviewed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="applications_reviewed_as_teacher",
    )
    teacher_reviewed_at = models.DateTimeField(null=True, blank=True)

    # Admin final decision (for non-leave applications)
    admin_review = models.TextField(blank=True, null=True)
    admin_decision = models.CharField(
        max_length=20,
        choices=[
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("pending", "Pending"),
        ],
        default="pending",
    )
    admin_reviewed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="applications_reviewed_as_admin",
    )
    admin_reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "applications_application"
        indexes = [
            models.Index(fields=["school", "created_at"]),
            models.Index(fields=["student", "status"]),
            models.Index(fields=["application_type", "status"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.student.user.get_full_name()} — {self.get_application_type_display()} — {self.get_status_display()}"

    def clean(self):
        """Validate date range for leave requests."""
        if self.application_type == self.Type.LEAVE_REQUEST:
            if not self.start_date or not self.end_date:
                raise ValidationError(
                    "Start and end dates are required for leave requests."
                )
            if self.end_date < self.start_date:
                raise ValidationError("End date must be after or equal to start date.")

    def apply_leave_attendance(self, marked_by=None):
        """Mark the student's attendance as leave for the approved leave range."""
        if self.application_type != self.Type.LEAVE_REQUEST:
            return

        current_date = self.start_date
        while current_date <= self.end_date:
            Attendance.objects.update_or_create(
                school=self.school,
                student=self.student,
                date=current_date,
                defaults={
                    "status": Attendance.Status.LEAVE,
                    "remarks": self.title,
                    "marked_by": marked_by,
                },
            )
            current_date += timedelta(days=1)

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
