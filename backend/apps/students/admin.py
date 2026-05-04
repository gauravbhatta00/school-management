from django.contrib import admin
from .models import Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ["user", "class_name", "section", "roll_number", "school"]
    list_filter = ["class_name", "section", "school"]
    search_fields = ["user__first_name", "user__last_name", "roll_number"]
    raw_id_fields = ["user"]
