from rest_framework import serializers
from .models import School


class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = [
            "id",
            "name",
            "address",
            "contact",
            "email",
            "logo",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
