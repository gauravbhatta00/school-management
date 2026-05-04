from django.contrib import admin

from .models import Notice, CalendarEvent


@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ("title", "school", "is_published", "published_at")
    list_filter = ("school", "is_published")
    search_fields = ("title", "message")


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ("title", "school", "event_type", "start_date", "end_date")
    list_filter = ("school", "event_type")
    search_fields = ("title", "description")
