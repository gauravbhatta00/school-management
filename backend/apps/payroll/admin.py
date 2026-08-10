from django.contrib import admin
from .models import SalaryPayment


@admin.register(SalaryPayment)
class SalaryPaymentAdmin(admin.ModelAdmin):
    list_display = [
        "teacher",
        "salary_month",
        "amount",
        "status",
        "payment_method",
        "payment_date",
        "school",
    ]
    list_filter = ["status", "payment_method", "salary_month", "school"]
    search_fields = [
        "teacher__user__first_name",
        "teacher__user__last_name",
        "transaction_id",
    ]
    date_hierarchy = "payment_date"
