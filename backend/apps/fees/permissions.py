"""
Fee-management access is need-based per staff designation — this is an
allowlist, not a blocklist, because financial record-keeping should only
be handed out on purpose:

  - Accountant gets full fee access (all categories, all students) plus
    the school-wide collection summary — tracking/updating every payment
    record is literally their job, alongside admin.
  - Librarian is scoped to the "library" fee category only — recording a
    book fine is part of managing library records, not general finance,
    so it stays narrow: they can never see or touch tuition, transport,
    hostel, etc.
  - Every other staff designation (Clerk, Administrative Staff, Support
    Staff, Lab Assistant, Principal, Vice Principal, and anything else
    typed into the designation field) gets NO fee access at all. Financial
    tasks are deliberately not a front-desk/general-staff duty here.

Admin and teacher access is handled separately via IsAdminOrTeacher and
is unaffected by this module.
"""

from rest_framework.permissions import BasePermission

# Full, unscoped fee access (all categories) — same tier as collection
# summary visibility, since both are "this person manages fees" duties.
FULL_FEE_ACCESS_DESIGNATIONS = {"Accountant"}

# Restricted to a single fee category.
SCOPED_FEE_DESIGNATIONS = {
    "Librarian": "library",
}

COLLECTION_SUMMARY_DESIGNATIONS = {"Accountant"}


def staff_designation(user):
    profile = getattr(user, "teacher_profile", None)
    return getattr(profile, "designation", "") if profile else ""


def has_fee_access(user):
    """Whether this user should reach the fee endpoints at all."""
    if user.role != "staff":
        return True
    designation = staff_designation(user)
    return designation in FULL_FEE_ACCESS_DESIGNATIONS or designation in SCOPED_FEE_DESIGNATIONS


def fee_category_scope(user):
    """
    The single fee category this user is restricted to, or None if they
    have unscoped (full) access. Only meaningful for role == 'staff'.
    """
    if user.role != "staff":
        return None
    return SCOPED_FEE_DESIGNATIONS.get(staff_designation(user))


class CanAccessFees(BasePermission):
    """Staff whose designation is allowed to touch fee endpoints at all."""

    message = "Your role does not include fee management access."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role == "staff"
            and has_fee_access(user)
        )


class CanViewCollectionSummary(BasePermission):
    """Staff designations that are allowed to see the collection dashboard."""

    message = "Your role does not include collection summary access."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role == "staff"
            and staff_designation(user) in COLLECTION_SUMMARY_DESIGNATIONS
        )
