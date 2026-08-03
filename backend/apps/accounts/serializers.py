"""
Serializers for accounts app.
UserCreateSerializer overrides Djoser's default to handle school assignment.
"""

from rest_framework import serializers
from djoser.serializers import UserCreateSerializer as DjoserUserCreateSerializer
from djoser.serializers import (
    SendEmailResetSerializer as DjoserSendEmailResetSerializer,
    UserCreatePasswordRetypeSerializer as DjoserUserCreatePasswordRetypeSerializer,
)
from .models import User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    school_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "school",
            "school_name",
            "profile_photo",
            "is_active",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_school_name(self, obj):
        return obj.school.name if obj.school else None


class UserCreateSerializer(DjoserUserCreateSerializer):
    """
    Extends Djoser's create serializer to include role and school.
    Admins can create users for any school; non-admins default to their own school.
    """

    class Meta(DjoserUserCreateSerializer.Meta):
        fields = DjoserUserCreateSerializer.Meta.fields + ("role", "school")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            if request.user.is_superuser and not attrs.get("school"):
                raise serializers.ValidationError(
                    {"school": "School is required when creating users as a superuser."}
                )
            if not request.user.is_superuser and not request.user.school:
                raise serializers.ValidationError(
                    {
                        "school": "Your account is not linked to a school. Assign a school to this admin account first."
                    }
                )
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        # If requester is authenticated and non-superuser, force their school
        if request and request.user.is_authenticated and not request.user.is_superuser:
            validated_data["school"] = request.user.school
        return super().create(validated_data)


class UserCreatePasswordRetypeSerializer(DjoserUserCreatePasswordRetypeSerializer):
    """
    Djoser uses this serializer when USER_CREATE_PASSWORD_RETYPE=True.
    Keep role/school behavior consistent with UserCreateSerializer.
    """

    class Meta(DjoserUserCreatePasswordRetypeSerializer.Meta):
        fields = DjoserUserCreatePasswordRetypeSerializer.Meta.fields + (
            "role",
            "school",
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            if request.user.is_superuser and not attrs.get("school"):
                raise serializers.ValidationError(
                    {"school": "School is required when creating users as a superuser."}
                )
            if not request.user.is_superuser and not request.user.school:
                raise serializers.ValidationError(
                    {
                        "school": "Your account is not linked to a school. Assign a school to this admin account first."
                    }
                )
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated and not request.user.is_superuser:
            validated_data["school"] = request.user.school
        return super().create(validated_data)


class StudentTeacherPasswordResetSerializer(DjoserSendEmailResetSerializer):
    """
    Public reset requests are intentionally limited to student/teacher accounts.
    Unknown emails and admin emails both return the same 204 response from Djoser.
    """

    def get_user(self, is_active=True):
        user = super().get_user(is_active=is_active)
        if user and user.role in [User.Role.STUDENT, User.Role.TEACHER]:
            return user
        return None


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "email", "profile_photo", "is_active"]


class UserSelfUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["profile_photo"]
