"""Admin configuration for applications."""

from django.contrib import admin
from .models import Application


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student",
        "application_type",
        "status",
        "teacher_decision",
        "admin_decision",
        "created_at",
    )
    list_filter = ("application_type", "status", "created_at")
    search_fields = ("student__user__email", "title", "description")
    readonly_fields = (
        "school",
        "student",
        "status",
        "created_at",
        "updated_at",
        "teacher_reviewed_by",
        "teacher_reviewed_at",
        "admin_reviewed_by",
        "admin_reviewed_at",
    )
    fieldsets = (
        (
            "Application Info",
            {
                "fields": (
                    "school",
                    "student",
                    "application_type",
                    "title",
                    "description",
                )
            },
        ),
        ("Dates", {"fields": ("start_date", "end_date"), "classes": ("collapse",)}),
        (
            "Teacher Review",
            {
                "fields": (
                    "teacher_review",
                    "teacher_decision",
                    "teacher_reviewed_by",
                    "teacher_reviewed_at",
                )
            },
        ),
        (
            "Admin Review",
            {
                "fields": (
                    "admin_review",
                    "admin_decision",
                    "admin_reviewed_by",
                    "admin_reviewed_at",
                )
            },
        ),
        (
            "Status & Timestamps",
            {
                "fields": ("status", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
