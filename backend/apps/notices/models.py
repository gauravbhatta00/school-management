from django.conf import settings
from django.db import models
from django.utils import timezone


class Notice(models.Model):
    school = models.ForeignKey(
        "schools.School", on_delete=models.CASCADE, related_name="notices"
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_published = models.BooleanField(default=True)
    published_at = models.DateTimeField(default=timezone.now)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_notices",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-published_at", "-created_at"]
        indexes = [
            models.Index(fields=["school", "is_published"]),
            models.Index(fields=["school", "published_at"]),
        ]

    def __str__(self):
        return self.title


class CalendarEvent(models.Model):
    class EventType(models.TextChoices):
        EXAM = "exam", "Exam"
        HOLIDAY = "holiday", "Holiday"
        MEETING = "meeting", "Meeting"
        ACTIVITY = "activity", "Activity"
        OTHER = "other", "Other"

    school = models.ForeignKey(
        "schools.School", on_delete=models.CASCADE, related_name="calendar_events"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    event_type = models.CharField(
        max_length=20, choices=EventType.choices, default=EventType.OTHER
    )
    start_date = models.DateField()
    end_date = models.DateField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_calendar_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start_date", "title"]
        indexes = [
            models.Index(fields=["school", "start_date"]),
            models.Index(fields=["school", "end_date"]),
            models.Index(fields=["school", "event_type"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.start_date})"
