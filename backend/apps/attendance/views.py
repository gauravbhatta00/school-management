"""
Attendance ViewSet.
  - Standard CRUD for individual records
  - /bulk_mark/  POST — mark entire class at once (idempotent upsert)
  - /report/     GET  — aggregated present/absent/leave per student
"""

import csv

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from django.db.models import Count, Q

from .models import Attendance
from .serializers import (
    AttendanceSerializer,
    BulkAttendanceSerializer,
    AttendanceReportSerializer,
    TeacherAttendanceSerializer,
    TeacherSelfAttendanceSerializer,
    TeacherAttendanceBulkSerializer,
)
from .models import TeacherAttendance
from apps.accounts.permissions import IsAdminOrTeacher, IsSchoolAdmin, IsStudent, IsTeacher
from apps.students.models import Student
from apps.accounts.models import User


class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {
        'date': ['exact', 'gte', 'lte'],
        'status': ['exact'],
        'student__class_name': ['exact'],
        'student__section': ['exact'],
        'student': ['exact'],
    }
    ordering = ['-date']

    def get_permissions(self):
        if self.action in ['destroy']:
            return [IsAuthenticated(), IsSchoolAdmin()]
        if self.action in ['create', 'update', 'partial_update', 'bulk_mark', 'report']:
            return [IsAuthenticated(), IsAdminOrTeacher()]
        return [IsAuthenticated(), IsAdminOrTeacher()]

    def get_queryset(self):
        queryset = Attendance.objects.filter(
            school=self.request.user.school
        ).select_related('student__user', 'marked_by')

        if self.request.user.role == 'student':
            queryset = queryset.filter(student__user=self.request.user)

        return queryset

    def perform_create(self, serializer):
        serializer.save(
            school=self.request.user.school,
            marked_by=self.request.user
        )

    @action(detail=False, methods=['get', 'post'], url_path='teacher-self')
    def teacher_self(self, request):
        if request.user.role != 'teacher':
            return Response({'error': 'Only teachers can access this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        if request.method.lower() == 'post':
            serializer = TeacherSelfAttendanceSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data

            record, _ = TeacherAttendance.objects.update_or_create(
                school=request.user.school,
                teacher=request.user,
                date=data['date'],
                defaults={
                    'status': data['status'],
                    'remarks': data.get('remarks', ''),
                    'marked_by': request.user,
                },
            )
            return Response(TeacherAttendanceSerializer(record).data, status=status.HTTP_200_OK)

        records = TeacherAttendance.objects.filter(
            school=request.user.school,
            teacher=request.user,
        ).order_by('-date')[:10]
        return Response(TeacherAttendanceSerializer(records, many=True).data)

    @action(detail=False, methods=['get', 'post'], url_path='teacher-records')
    def teacher_records(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Only school admins can manage teacher attendance.'}, status=status.HTTP_403_FORBIDDEN)

        if request.method.lower() == 'post':
            serializer = TeacherAttendanceBulkSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data

            created_count = 0
            updated_count = 0
            responses = []

            for record in data['records']:
                teacher = User.objects.get(id=record['teacher_id'], school=request.user.school, role=User.Role.TEACHER)
                obj, created = TeacherAttendance.objects.update_or_create(
                    school=request.user.school,
                    teacher=teacher,
                    date=data['date'],
                    defaults={
                        'status': record['status'],
                        'remarks': record.get('remarks', ''),
                        'marked_by': request.user,
                    },
                )
                responses.append(TeacherAttendanceSerializer(obj).data)
                if created:
                    created_count += 1
                else:
                    updated_count += 1

            return Response({
                'detail': 'Teacher attendance saved successfully.',
                'date': str(data['date']),
                'created': created_count,
                'updated': updated_count,
                'total': created_count + updated_count,
                'records': responses,
            }, status=status.HTTP_200_OK)

        date = request.query_params.get('date')
        month = request.query_params.get('month')
        teacher_id = request.query_params.get('teacher')
        qs = TeacherAttendance.objects.filter(school=request.user.school).select_related('teacher', 'marked_by').order_by('-date', 'teacher__first_name')

        if date:
            qs = qs.filter(date=date)
        if month:
            try:
                year, month_num = month.split('-')
                qs = qs.filter(date__year=int(year), date__month=int(month_num))
            except (ValueError, TypeError):
                return Response({'error': 'month must be in YYYY-MM format.'}, status=status.HTTP_400_BAD_REQUEST)
        if teacher_id:
            qs = qs.filter(teacher_id=teacher_id)

        return Response(TeacherAttendanceSerializer(qs[:100], many=True).data)

    @action(detail=False, methods=['post'], url_path='bulk-mark')
    def bulk_mark(self, request):
        """
        Mark attendance for multiple students in one shot.
        Uses update_or_create → fully idempotent (safe to call twice).

        POST /api/attendance/bulk-mark/
        {
            "date": "2024-01-15",
            "records": [
                {"student_id": 1, "status": "present"},
                {"student_id": 2, "status": "absent", "remarks": "sick"}
            ]
        }
        """
        serializer = BulkAttendanceSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        date = serializer.validated_data['date']
        records = serializer.validated_data['records']
        school = request.user.school

        created_count = 0
        updated_count = 0

        for record in records:
            obj, created = Attendance.objects.update_or_create(
                school=school,
                student_id=record['student_id'],
                date=date,
                defaults={
                    'status': record['status'],
                    'remarks': record.get('remarks', ''),
                    'marked_by': request.user,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        return Response({
            'detail': 'Attendance saved successfully.',
            'date': str(date),
            'created': created_count,
            'updated': updated_count,
            'total': created_count + updated_count,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='report')
    def report(self, request):
        """
        Attendance summary report.
        Supports filters: ?class_name=10&section=A&date_from=2024-01-01&date_to=2024-01-31

        Returns per-student aggregate with percentage.
        """
        school = request.user.school
        qs = Attendance.objects.filter(school=school)

        class_name = request.query_params.get('class_name')
        section = request.query_params.get('section')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        student_id = request.query_params.get('student')

        if class_name:
            qs = qs.filter(student__class_name=class_name)
        if section:
            qs = qs.filter(student__section=section)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        if student_id:
            qs = qs.filter(student_id=student_id)

        summary = (
            qs.values(
                'student__id',
                'student__user__first_name',
                'student__user__last_name',
                'student__class_name',
                'student__section',
            )
            .annotate(
                total_days=Count('id'),
                present=Count('id', filter=Q(status='present')),
                absent=Count('id', filter=Q(status='absent')),
                leave=Count('id', filter=Q(status='leave')),
            )
            .order_by('student__class_name', 'student__section')
        )

        data = []
        for row in summary:
            total = row['total_days'] or 1
            data.append({
                'student_id': row['student__id'],
                'student_name': (
                    f"{row['student__user__first_name']} "
                    f"{row['student__user__last_name']}"
                ).strip(),
                'class_name': row['student__class_name'],
                'section': row['student__section'],
                'total_days': row['total_days'],
                'present': row['present'],
                'absent': row['absent'],
                'leave': row['leave'],
                'attendance_percentage': round((row['present'] / total) * 100, 2),
            })

        export_format = request.query_params.get('export')
        if export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="attendance_report.csv"'

            writer = csv.writer(response)
            writer.writerow([
                'Student ID',
                'Student Name',
                'Class',
                'Section',
                'Total Days',
                'Present',
                'Absent',
                'Leave',
                'Attendance Percentage',
            ])

            for row in data:
                writer.writerow([
                    row['student_id'],
                    row['student_name'],
                    row['class_name'],
                    row['section'],
                    row['total_days'],
                    row['present'],
                    row['absent'],
                    row['leave'],
                    row['attendance_percentage'],
                ])
            return response

        return Response(data)
