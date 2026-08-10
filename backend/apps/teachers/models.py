"""
Teacher model — profile linked to a User with teacher role.
Teachers can teach multiple subjects across multiple classes.
"""

from django.db import models
from django.core.validators import MinValueValidator


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
    # This model represents any school staff member, not only classroom
    # teachers — designation distinguishes librarians, accountants, etc.
    # so non-teaching staff can still be tracked and paid through the
    # same records (subjects/qualification simply stay blank for them).
    designation = models.CharField(max_length=50, blank=True, default="Teacher")
    qualification = models.CharField(max_length=200, blank=True)
    experience_years = models.PositiveSmallIntegerField(default=0)
    joining_date = models.DateField(auto_now_add=True)
    # Monthly salary this teacher/staff member is owed — used as the
    # target amount when recording salary payments (mirrors how
    # FeeStructure.amount is the target for a student's fee payments).
    basic_salary = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "teachers_teacher"
        indexes = [models.Index(fields=["school"])]

    def __str__(self):
        subject_names = ", ".join([s.name for s in self.subjects.all()])
        return f"{self.user.get_full_name()} — {subject_names or 'No Subjects'}"
