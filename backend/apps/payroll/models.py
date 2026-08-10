"""
Payroll models — salary payments for teachers/staff.

Mirrors the fees app's Payment model: SalaryPayment references the
teacher's basic_salary as the target amount for a given month, so
partial/installment payments can be tracked the same way student fee
installments are.
"""

from django.db import models
from django.core.validators import MinValueValidator


class SalaryPayment(models.Model):
    class Status(models.TextChoices):
        PAID = "paid", "Paid"
        PENDING = "pending", "Pending"
        PARTIAL = "partial", "Partial"
        HOLD = "hold", "On Hold"

    class PaymentMethod(models.TextChoices):
        CASH = "cash", "Cash"
        ONLINE = "online", "Online Transfer"
        CHEQUE = "cheque", "Cheque"
        DD = "dd", "Demand Draft"

    school = models.ForeignKey(
        "schools.School", on_delete=models.CASCADE, related_name="salary_payments"
    )
    teacher = models.ForeignKey(
        "teachers.Teacher", on_delete=models.CASCADE, related_name="salary_payments"
    )
    # "YYYY-MM" — the salary period this payment applies to.
    salary_month = models.CharField(max_length=7)
    amount = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)]
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
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_salary_payments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payroll_salarypayment"
        indexes = [
            models.Index(fields=["school", "status"]),
            models.Index(fields=["teacher", "salary_month"]),
        ]

    def __str__(self):
        return f"{self.teacher} — {self.salary_month} — ₹{self.amount} ({self.status})"
