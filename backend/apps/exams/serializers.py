from rest_framework import serializers
from django.db.models import Sum, Count
from .models import Exam, Subject, Result


class ExamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exam
        fields = [
            "id",
            "school",
            "name",
            "description",
            "start_date",
            "end_date",
            "academic_year",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "school", "created_at"]


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "school", "name", "code", "class_name"]
        read_only_fields = ["id", "school"]


class ResultSerializer(serializers.ModelSerializer):
    percentage = serializers.ReadOnlyField()
    grade = serializers.ReadOnlyField()
    student_name = serializers.SerializerMethodField()
    subject_name = serializers.SerializerMethodField()
    exam_name = serializers.SerializerMethodField()

    class Meta:
        model = Result
        fields = [
            "id",
            "school",
            "student",
            "student_name",
            "exam",
            "exam_name",
            "subject",
            "subject_name",
            "marks_obtained",
            "max_marks",
            "percentage",
            "grade",
            "remarks",
            "created_at",
        ]
        read_only_fields = ["id", "school", "grade", "created_at"]

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()

    def get_subject_name(self, obj):
        return obj.subject.name

    def get_exam_name(self, obj):
        return obj.exam.name

    def validate(self, data):
        if data.get("marks_obtained", 0) > data.get("max_marks", 100):
            raise serializers.ValidationError("marks_obtained cannot exceed max_marks.")
        request = self.context["request"]
        school = request.user.school
        student = data.get("student")
        if student and student.school != school:
            raise serializers.ValidationError("Student does not belong to your school.")
        return data


class StudentResultSummarySerializer(serializers.Serializer):
    """Aggregated result card for one student in one exam."""

    student_id = serializers.IntegerField()
    student_name = serializers.CharField()
    exam_name = serializers.CharField()
    results = ResultSerializer(many=True)
    total_marks_obtained = serializers.DecimalField(max_digits=8, decimal_places=2)
    total_max_marks = serializers.DecimalField(max_digits=8, decimal_places=2)
    overall_percentage = serializers.FloatField()
    overall_grade = serializers.CharField()
