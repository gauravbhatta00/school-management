"""
Turns a FeeStructure's per-period rate into "how much is actually due as
of today" — the standard school-fee convention: a monthly tuition fee
doesn't become fully owed on day one of the year, it accrues month by
month, same as how this project's payroll already tracks salary month by
month (SalaryPayment.salary_month).

Academic years here are written "2024-25", which by Indian school
convention runs April 2024 through March 2025 — that's the fixed
reference point elapsed-period math is computed from.
"""

from datetime import date

PERIODS_PER_YEAR = {
    "monthly": 12,
    "quarterly": 4,
    "half_yearly": 2,
}
MONTHS_PER_PERIOD = {
    "monthly": 1,
    "quarterly": 3,
    "half_yearly": 6,
}


def academic_year_start(academic_year: str) -> date:
    year_str = (academic_year or "").split("-")[0]
    try:
        year = int(year_str)
    except ValueError:
        year = date.today().year
    return date(year, 4, 1)


def elapsed_periods(academic_year: str, frequency: str, as_of: date = None) -> int:
    """How many billing periods have started, for a recurring frequency."""
    months_per_period = MONTHS_PER_PERIOD.get(frequency)
    if not months_per_period:
        return 1  # one_time / annual — the whole amount is due at once

    as_of = as_of or date.today()
    start = academic_year_start(academic_year)
    if as_of < start:
        return 0

    months_elapsed = (as_of.year - start.year) * 12 + (as_of.month - start.month) + 1
    periods = -(-months_elapsed // months_per_period)  # ceil division
    return max(0, min(periods, PERIODS_PER_YEAR[frequency]))


def amount_due_so_far(fee_structure, as_of: date = None) -> float:
    """The portion of a fee structure's total that has come due as of today."""
    periods = elapsed_periods(fee_structure.academic_year, fee_structure.frequency, as_of)
    return float(fee_structure.amount) * periods
