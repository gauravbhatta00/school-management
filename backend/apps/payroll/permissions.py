"""
Payroll (staff salary payments) is even more sensitive than student fees,
so it stays limited to Admin plus the one staff designation whose job is
literally to track and update payment records: Accountant. Every other
staff designation — including Librarian, whose fee access is deliberately
scoped to the library category — has no payroll access at all.
"""

from rest_framework.permissions import BasePermission
from apps.fees.permissions import staff_designation

FULL_PAYROLL_ACCESS_DESIGNATIONS = {"Accountant"}


class CanManagePayroll(BasePermission):
    """Staff whose designation is trusted with payroll records (Accountant only)."""

    message = "Your role does not include payroll management access."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role == "staff"
            and staff_designation(user) in FULL_PAYROLL_ACCESS_DESIGNATIONS
        )
