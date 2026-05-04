from django.contrib import admin
from .models import Teacher


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ['user', 'qualification', 'experience_years', 'school']
    list_filter = ['school']
    search_fields = ['user__first_name', 'user__last_name', 'subjects__name']
    filter_horizontal = ['subjects']
