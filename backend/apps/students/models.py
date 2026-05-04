"""
Student model — profile extending the User account.

OneToOne to User keeps auth separate from domain data.
The school FK (redundant with user.school) is added explicitly
so we can do efficient tenant-scoped queries without JOINing through User.
"""

from django.db import models


class Student(models.Model):
    school = models.ForeignKey(
        "schools.School", on_delete=models.CASCADE, related_name="students"
    )
    user = models.OneToOneField(
        "accounts.User", on_delete=models.CASCADE, related_name="student_profile"
    )
    class_name = models.CharField(max_length=20)  # e.g. "Grade 10"
    section = models.CharField(max_length=10)  # e.g. "A"
    roll_number = models.CharField(max_length=20)

    # Optional personal details
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    parent_contact = models.CharField(max_length=20, blank=True)
    admission_date = models.DateField(auto_now_add=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "students_student"
        unique_together = [("school", "class_name", "section", "roll_number")]
        indexes = [
            models.Index(fields=["school", "class_name", "section"]),
        ]

    def __str__(self):
        return f"{self.user.get_full_name()} | {self.class_name}-{self.section} Roll:{self.roll_number}"
