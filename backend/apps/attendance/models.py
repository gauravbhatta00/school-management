"""
Attendance model.

Design: one record per student per date. The unique_together constraint
prevents double-marking. Bulk create is supported via the API to allow
a teacher to mark an entire class in one request.
"""

from django.db import models


class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = 'present', 'Present'
        ABSENT = 'absent', 'Absent'
        LEAVE = 'leave', 'Leave'

    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    student = models.ForeignKey(
        'students.Student',
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT)
    remarks = models.CharField(max_length=200, blank=True)
    marked_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='marked_attendance'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_attendance'
        unique_together = [('student', 'date')]
        indexes = [
            models.Index(fields=['school', 'date']),
            models.Index(fields=['student', 'date']),
        ]

    def __str__(self):
        return f"{self.student} — {self.date} — {self.status}"


class TeacherAttendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = 'present', 'Present'
        ABSENT = 'absent', 'Absent'
        LEAVE = 'leave', 'Leave'

    school = models.ForeignKey(
        'schools.School',
        on_delete=models.CASCADE,
        related_name='teacher_attendance_records'
    )
    teacher = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='teacher_attendance_entries'
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PRESENT)
    remarks = models.CharField(max_length=200, blank=True)
    marked_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='marked_teacher_attendance'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_teacherattendance'
        unique_together = [('teacher', 'date')]
        indexes = [
            models.Index(fields=['school', 'date']),
            models.Index(fields=['teacher', 'date']),
        ]

    def __str__(self):
        return f"{self.teacher.get_full_name()} — {self.date} — {self.status}"
