from django.contrib import admin
from .models import Attendance, TeacherAttendance


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ["student", "date", "status", "marked_by", "school"]
    list_filter = ["status", "date", "school", "student__class_name"]
    search_fields = ["student__user__first_name", "student__user__last_name"]
    date_hierarchy = "date"


@admin.register(TeacherAttendance)
class TeacherAttendanceAdmin(admin.ModelAdmin):
    list_display = ["teacher", "date", "status", "marked_by", "school"]
    list_filter = ["status", "date", "school"]
    search_fields = ["teacher__first_name", "teacher__last_name", "teacher__email"]
    date_hierarchy = "date"
