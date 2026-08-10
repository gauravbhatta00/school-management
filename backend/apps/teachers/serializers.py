from rest_framework import serializers
from .models import Teacher
from apps.accounts.serializers import UserSerializer
from apps.accounts.models import User
from apps.exams.models import Subject


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name", "code", "class_name"]


class TeacherSerializer(serializers.ModelSerializer):
    user_detail = UserSerializer(source="user", read_only=True)
    subjects_detail = SubjectSerializer(source="subjects", many=True, read_only=True)
    full_name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = [
            "id",
            "school",
            "user",
            "user_detail",
            "full_name",
            "email",
            "subjects",
            "subjects_detail",
            "designation",
            "qualification",
            "experience_years",
            "basic_salary",
            "joining_date",
            "created_at",
        ]
        read_only_fields = ["id", "school", "joining_date", "created_at"]

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    def get_email(self, obj):
        return obj.user.email


class TeacherCreateSerializer(serializers.ModelSerializer):
    subjects = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(), many=True, required=False
    )
    first_name = serializers.CharField(source="user.first_name", required=False)
    last_name = serializers.CharField(source="user.last_name", required=False)
    email = serializers.EmailField(source="user.email", required=False)
    profile_photo = serializers.ImageField(
        source="user.profile_photo", required=False, allow_null=True
    )

    class Meta:
        model = Teacher
        fields = [
            "user",
            "subjects",
            "designation",
            "qualification",
            "experience_years",
            "basic_salary",
            "first_name",
            "last_name",
            "email",
            "profile_photo",
        ]

    def validate_user(self, value):
        request = self.context["request"]
        if value.school is None and request.user.school is not None:
            value.school = request.user.school
            value.save(update_fields=["school"])

        if value.school != request.user.school:
            raise serializers.ValidationError("User does not belong to your school.")
        # Teacher records also represent non-teaching staff (librarians,
        # clerks, accountants, ...), whose accounts are created with
        # role="staff" so they don't inherit teacher-only permissions
        # (attendance, exams, application review). Only normalize the role
        # when it's neither of those — e.g. a stale/default value.
        if value.role not in ("teacher", "staff"):
            from apps.students.models import Student

            if Student.objects.filter(user=value).exists():
                raise serializers.ValidationError(
                    "User already has a student profile and cannot be registered as teacher."
                )
            value.role = "teacher"
            value.save(update_fields=["role"])
        return value

    def validate_subjects(self, value):
        request = self.context.get("request")
        if request and value:
            # Verify all subjects belong to the requester's school
            for subject in value:
                if subject.school != request.user.school:
                    raise serializers.ValidationError(
                        "One or more subjects do not belong to your school."
                    )
        return value

    def create(self, validated_data):
        subjects = validated_data.pop("subjects", [])
        teacher = super().create(validated_data)
        teacher.subjects.set(subjects)
        return teacher

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", None) or {}
        subjects = validated_data.pop("subjects", None)
        instance = super().update(instance, validated_data)

        if user_data:
            user = instance.user
            new_email = user_data.get("email")
            if new_email and new_email != user.email:
                if User.objects.filter(email=new_email).exclude(pk=user.pk).exists():
                    raise serializers.ValidationError(
                        {"email": "A user with this email already exists."}
                    )
            for attr, value in user_data.items():
                setattr(user, attr, value)
            user.save()

        if subjects is not None:
            instance.subjects.set(subjects)
        return instance
