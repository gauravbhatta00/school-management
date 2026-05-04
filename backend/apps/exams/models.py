"""
Examination models.

  Exam     → a named assessment event (Midterm, Final, Unit Test)
  Subject  → a school-scoped subject (Math, Science, …)
  Result   → marks for one student, one exam, one subject

The percentage property is computed on the model, not stored,
keeping the DB normalised and always consistent.
"""

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Exam(models.Model):
    school = models.ForeignKey(
        'schools.School', on_delete=models.CASCADE, related_name='exams'
    )
    name = models.CharField(max_length=100)  # "Midterm 2024"
    description = models.TextField(blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    academic_year = models.CharField(max_length=20, default='2024-25')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exams_exam'
        unique_together = [('school', 'name', 'academic_year')]

    def __str__(self):
        return f"{self.name} ({self.academic_year})"


class Subject(models.Model):
    school = models.ForeignKey(
        'schools.School', on_delete=models.CASCADE, related_name='subjects'
    )
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, blank=True)
    class_name = models.CharField(max_length=20, blank=True)  # optional: subject per class

    class Meta:
        db_table = 'exams_subject'
        unique_together = [('school', 'name', 'class_name')]

    def __str__(self):
        return f"{self.code} - {self.name}"


class Result(models.Model):
    school = models.ForeignKey(
        'schools.School', on_delete=models.CASCADE, related_name='results'
    )
    student = models.ForeignKey(
        'students.Student', on_delete=models.CASCADE, related_name='results'
    )
    exam = models.ForeignKey(
        Exam, on_delete=models.CASCADE, related_name='results'
    )
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name='results'
    )
    marks_obtained = models.DecimalField(
        max_digits=6, decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    max_marks = models.DecimalField(
        max_digits=6, decimal_places=2, default=100,
        validators=[MinValueValidator(1)]
    )
    grade = models.CharField(max_length=5, blank=True)
    remarks = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'exams_result'
        unique_together = [('student', 'exam', 'subject')]
        indexes = [
            models.Index(fields=['school', 'exam', 'student']),
        ]

    def __str__(self):
        return f"{self.student} | {self.exam} | {self.subject} = {self.marks_obtained}"

    @property
    def percentage(self):
        if self.max_marks:
            return round(float(self.marks_obtained) / float(self.max_marks) * 100, 2)
        return 0.0

    def compute_grade(self):
        p = self.percentage
        if p >= 90:   return 'A+'
        elif p >= 80: return 'A'
        elif p >= 70: return 'B'
        elif p >= 60: return 'C'
        elif p >= 50: return 'D'
        else:         return 'F'

    def save(self, *args, **kwargs):
        self.grade = self.compute_grade()
        super().save(*args, **kwargs)
