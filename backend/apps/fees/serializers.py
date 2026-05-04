from rest_framework import serializers
from django.utils import timezone
from .models import FeeStructure, Payment


class FeeStructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeStructure
        fields = [
            "id",
            "school",
            "class_name",
            "amount",
            "academic_year",
            "due_date",
            "description",
            "created_at",
        ]
        read_only_fields = ["id", "school", "created_at"]


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    fee_structure_detail = FeeStructureSerializer(
        source="fee_structure", read_only=True
    )

    class Meta:
        model = Payment
        fields = [
            "id",
            "school",
            "student",
            "student_name",
            "class_name",
            "fee_structure",
            "fee_structure_detail",
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

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()

    def get_class_name(self, obj):
        return obj.student.class_name

    def validate_student(self, value):
        request = self.context["request"]
        if value.school != request.user.school:
            raise serializers.ValidationError("Student does not belong to your school.")
        return value


class PayFeeSerializer(serializers.Serializer):
    """Minimal serializer for the /pay/ action."""

    student_id = serializers.IntegerField()
    fee_structure_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=Payment.PaymentMethod.choices)
    transaction_id = serializers.CharField(required=False, allow_blank=True, default="")
    remarks = serializers.CharField(required=False, allow_blank=True, default="")
