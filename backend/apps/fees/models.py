"""
Fee Management models.

  FeeStructure — defines how much a particular class owes per academic year.
  Payment      — records each payment transaction made by/for a student.

Design decision: Payment references FeeStructure so we always know
what it was for, even if the structure later changes. status='partial'
allows installment payments.
"""

from django.db import models
from django.core.validators import MinValueValidator


class FeeStructure(models.Model):
    school = models.ForeignKey(
        'schools.School', on_delete=models.CASCADE, related_name='fee_structures'
    )
    class_name = models.CharField(max_length=20)
    amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    academic_year = models.CharField(max_length=20, default='2024-25')
    due_date = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fees_feestructure'
        unique_together = [('school', 'class_name', 'academic_year')]

    def __str__(self):
        return f"{self.class_name} — ₹{self.amount} ({self.academic_year})"


class Payment(models.Model):
    class Status(models.TextChoices):
        PAID = 'paid', 'Paid'
        PENDING = 'pending', 'Pending'
        PARTIAL = 'partial', 'Partial'
        WAIVED = 'waived', 'Waived'

    class PaymentMethod(models.TextChoices):
        CASH = 'cash', 'Cash'
        ONLINE = 'online', 'Online Transfer'
        CHEQUE = 'cheque', 'Cheque'
        DD = 'dd', 'Demand Draft'

    school = models.ForeignKey(
        'schools.School', on_delete=models.CASCADE, related_name='payments'
    )
    student = models.ForeignKey(
        'students.Student', on_delete=models.CASCADE, related_name='payments'
    )
    fee_structure = models.ForeignKey(
        FeeStructure, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='payments'
    )
    amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    payment_method = models.CharField(
        max_length=10, choices=PaymentMethod.choices, default=PaymentMethod.CASH
    )
    payment_date = models.DateField(null=True, blank=True)
    transaction_id = models.CharField(max_length=100, blank=True)
    remarks = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, related_name='created_payments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'fees_payment'
        indexes = [
            models.Index(fields=['school', 'status']),
            models.Index(fields=['student', 'status']),
        ]

    def __str__(self):
        return f"{self.student} — ₹{self.amount} ({self.status})"
