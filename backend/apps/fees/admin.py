from django.contrib import admin
from .models import FeeStructure, Payment


@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = ['class_name', 'amount', 'academic_year', 'due_date', 'school']
    list_filter = ['academic_year', 'school']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['student', 'amount', 'status', 'payment_method', 'payment_date', 'school']
    list_filter = ['status', 'payment_method', 'school']
    search_fields = ['student__user__first_name', 'student__user__last_name', 'transaction_id']
    date_hierarchy = 'payment_date'
