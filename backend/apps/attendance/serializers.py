"""
Attendance serializers.
BulkAttendanceSerializer handles marking an entire class in one POST request.
"""

from rest_framework import serializers
from .models import Attendance, TeacherAttendance
from apps.students.models import Student
from apps.accounts.models import User


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    section = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = [
            'id', 'school', 'student', 'student_name', 'class_name',
            'section', 'date', 'status', 'remarks', 'marked_by', 'created_at'
        ]
        read_only_fields = ['id', 'school', 'marked_by', 'created_at']

    def get_student_name(self, obj):
        return obj.student.user.get_full_name()

    def get_class_name(self, obj):
        return obj.student.class_name

    def get_section(self, obj):
        return obj.student.section


class BulkAttendanceItemSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=Attendance.Status.choices)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')


class BulkAttendanceSerializer(serializers.Serializer):
    """
    Accept: { date: "2024-01-15", records: [{student_id, status, remarks}] }
    Validates all students belong to the requesting school, then upserts.
    """
    date = serializers.DateField()
    records = BulkAttendanceItemSerializer(many=True, min_length=1)

    def validate_records(self, records):
        request = self.context['request']
        student_ids = [r['student_id'] for r in records]
        existing = set(
            Student.objects.filter(
                school=request.user.school,
                id__in=student_ids
            ).values_list('id', flat=True)
        )
        invalid = set(student_ids) - existing
        if invalid:
            raise serializers.ValidationError(
                f"Students not found in your school: {list(invalid)}"
            )
        return records


class AttendanceReportSerializer(serializers.Serializer):
    """Read-only report summary per student."""
    student_id = serializers.IntegerField()
    student_name = serializers.CharField()
    class_name = serializers.CharField()
    section = serializers.CharField()
    total_days = serializers.IntegerField()
    present = serializers.IntegerField()
    absent = serializers.IntegerField()
    leave = serializers.IntegerField()
    attendance_percentage = serializers.FloatField()


class TeacherAttendanceSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = TeacherAttendance
        fields = [
            'id', 'school', 'teacher', 'teacher_name', 'date',
            'status', 'remarks', 'marked_by', 'created_at'
        ]
        read_only_fields = ['id', 'school', 'teacher', 'marked_by', 'created_at']

    def get_teacher_name(self, obj):
        return obj.teacher.get_full_name()


class TeacherSelfAttendanceSerializer(serializers.Serializer):
    date = serializers.DateField()
    status = serializers.ChoiceField(choices=TeacherAttendance.Status.choices)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        request = self.context['request']
        if request.user.role != 'teacher':
            raise serializers.ValidationError('Only teachers can mark teacher attendance.')
        if not request.user.school:
            raise serializers.ValidationError('Your account is not linked to a school.')
        return attrs


class TeacherAttendanceItemSerializer(serializers.Serializer):
    teacher_id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=TeacherAttendance.Status.choices)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')


class TeacherAttendanceBulkSerializer(serializers.Serializer):
    date = serializers.DateField()
    records = TeacherAttendanceItemSerializer(many=True, min_length=1)

    def validate_records(self, records):
        request = self.context['request']
        teacher_ids = [record['teacher_id'] for record in records]
        existing = set(
            User.objects.filter(
                school=request.user.school,
                role=User.Role.TEACHER,
                id__in=teacher_ids,
            ).values_list('id', flat=True)
        )
        invalid = set(teacher_ids) - existing
        if invalid:
            raise serializers.ValidationError(
                f"Teachers not found in your school: {list(invalid)}"
            )
        return records
