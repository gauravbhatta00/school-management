from rest_framework import serializers
from .models import SalaryPayment


class SalaryPaymentSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    designation = serializers.SerializerMethodField()

    class Meta:
        model = SalaryPayment
        fields = [
            "id",
            "school",
            "teacher",
            "teacher_name",
            "designation",
            "salary_month",
            "amount",
            "status",
            "payment_method",
            "payment_date",
            "transaction_id",
            "remarks",
            "created_by",
            "created_at",
        ]
        read_only_fields = ["id", "school", "created_by", "created_at"]

    def get_teacher_name(self, obj):
        return obj.teacher.user.get_full_name()

    def get_designation(self, obj):
        return obj.teacher.designation

    def validate_teacher(self, value):
        request = self.context["request"]
        if value.school != request.user.school:
            raise serializers.ValidationError("Teacher does not belong to your school.")
        return value


class PaySalarySerializer(serializers.Serializer):
    """Minimal serializer for the /pay/ action."""

    teacher_id = serializers.IntegerField()
    salary_month = serializers.RegexField(regex=r"^\d{4}-\d{2}$")
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=SalaryPayment.PaymentMethod.choices)
    transaction_id = serializers.CharField(required=False, allow_blank=True, default="")
    remarks = serializers.CharField(required=False, allow_blank=True, default="")
