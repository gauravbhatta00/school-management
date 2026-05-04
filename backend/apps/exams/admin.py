from django.contrib import admin
from .models import Exam, Subject, Result


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "academic_year",
        "start_date",
        "end_date",
        "school",
        "is_active",
    ]
    list_filter = ["academic_year", "is_active", "school"]


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "class_name", "school"]
    list_filter = ["class_name", "school"]


@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    list_display = [
        "student",
        "exam",
        "subject",
        "marks_obtained",
        "max_marks",
        "grade",
    ]
    list_filter = ["exam", "subject", "grade", "school"]
    search_fields = ["student__user__first_name", "student__user__last_name"]
