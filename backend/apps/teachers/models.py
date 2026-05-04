"""
Teacher model — profile linked to a User with teacher role.
Teachers can teach multiple subjects across multiple classes.
"""

from django.db import models


class Teacher(models.Model):
    school = models.ForeignKey(
        "schools.School", on_delete=models.CASCADE, related_name="teachers"
    )
    user = models.OneToOneField(
        "accounts.User", on_delete=models.CASCADE, related_name="teacher_profile"
    )
    subjects = models.ManyToManyField(
        "exams.Subject", blank=True, related_name="teachers"
    )
    qualification = models.CharField(max_length=200, blank=True)
    experience_years = models.PositiveSmallIntegerField(default=0)
    joining_date = models.DateField(auto_now_add=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "teachers_teacher"
        indexes = [models.Index(fields=["school"])]

    def __str__(self):
        subject_names = ", ".join([s.name for s in self.subjects.all()])
        return f"{self.user.get_full_name()} — {subject_names or 'No Subjects'}"
