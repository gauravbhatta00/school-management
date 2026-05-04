from rest_framework import serializers
from .models import Student
from apps.accounts.serializers import UserSerializer
from apps.accounts.models import User


class StudentSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source='user', read_only=True)
    full_name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'school', 'user', 'user_detail', 'full_name', 'email',
            'class_name', 'section', 'roll_number',
            'date_of_birth', 'address', 'parent_contact',
            'admission_date', 'created_at'
        ]
        read_only_fields = ['id', 'school', 'admission_date', 'created_at']

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    def get_email(self, obj):
        return obj.user.email


class StudentCreateSerializer(serializers.ModelSerializer):
    """Used when creating a student record (user already exists)."""
    first_name = serializers.CharField(source='user.first_name', required=False)
    last_name = serializers.CharField(source='user.last_name', required=False)
    email = serializers.EmailField(source='user.email', required=False)
    profile_photo = serializers.ImageField(source='user.profile_photo', required=False, allow_null=True)

    class Meta:
        model = Student
        fields = [
            'user', 'class_name', 'section', 'roll_number',
            'date_of_birth', 'address', 'parent_contact',
            'first_name', 'last_name', 'email', 'profile_photo'
        ]

    def validate_user(self, value):
        request = self.context['request']
        # Recovery path: if a student user was created without a school,
        # bind it to the requesting admin's school before profile creation.
        if value.school is None and request.user.school is not None:
            value.school = request.user.school
            value.save(update_fields=['school'])

        if value.school != request.user.school:
            raise serializers.ValidationError("User does not belong to your school.")
        if value.role != 'student':
            from apps.teachers.models import Teacher
            if Teacher.objects.filter(user=value).exists():
                raise serializers.ValidationError("User already has a teacher profile and cannot be registered as student.")
            # If role was saved with a fallback/default, normalize it for this flow.
            value.role = 'student'
            value.save(update_fields=['role'])
        return value

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', None) or {}

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if user_data:
            user = instance.user
            new_email = user_data.get('email')
            if new_email and new_email != user.email:
                if User.objects.filter(email=new_email).exclude(pk=user.pk).exists():
                    raise serializers.ValidationError({'email': 'A user with this email already exists.'})
            for attr, value in user_data.items():
                setattr(user, attr, value)
            user.save()

        return instance
