"""
Accounts views — user management within a school tenant.
"""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
from django.db.models import Sum, Q
from django.utils import timezone

from .models import User
from .serializers import UserSerializer, UserUpdateSerializer, UserCreateSerializer, UserSelfUpdateSerializer
from .permissions import IsSchoolAdmin


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsSchoolAdmin]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['role', 'is_active']
    search_fields = ['first_name', 'last_name', 'email']

    def get_queryset(self):
        return User.objects.filter(
            school=self.request.user.school
        ).select_related('school').order_by('-date_joined')

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer

    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsAuthenticated])
    def me(self, request):
        if request.method == 'PATCH':
            serializer = UserSelfUpdateSerializer(request.user, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def dashboard_stats(self, request):
        school = request.user.school
        if not school and not request.user.is_superuser:
            return Response({'error': 'No school assigned'}, status=400)

        from apps.students.models import Student
        from apps.teachers.models import Teacher
        from apps.attendance.models import Attendance
        from apps.fees.models import Payment
        from django.utils import timezone

        today = timezone.now().date()

        # Superusers may not belong to a single school; show global stats in that case.
        if school:
            students_qs = Student.objects.filter(school=school)
            teachers_qs = User.objects.filter(school=school)
            attendance_qs = Attendance.objects.filter(school=school)
            payments_qs = Payment.objects.filter(school=school)
        else:
            students_qs = Student.objects.all()
            teachers_qs = User.objects.all()
            attendance_qs = Attendance.objects.all()
            payments_qs = Payment.objects.all()

        total_students = students_qs.count()
        total_teachers = teachers_qs.filter(
            Q(role=User.Role.TEACHER) | Q(teacher_profile__isnull=False)
        ).distinct().count()
        recent_teachers_qs = teachers_qs.filter(
            Q(role=User.Role.TEACHER) | Q(teacher_profile__isnull=False)
        ).select_related('teacher_profile').order_by('-date_joined')[:5]
        recent_teachers = [
            {
                'id': teacher.id,
                'full_name': teacher.get_full_name(),
                'email': teacher.email,
                'qualification': getattr(getattr(teacher, 'teacher_profile', None), 'qualification', ''),
                'experience_years': getattr(getattr(teacher, 'teacher_profile', None), 'experience_years', None),
            }
            for teacher in recent_teachers_qs
        ]

        today_att = attendance_qs.filter(date=today)
        present_today = today_att.filter(status='present').count()
        absent_today = today_att.filter(status='absent').count()
        total_marked = today_att.count()

        fee_agg = payments_qs.aggregate(
            total_collected=Sum('amount', filter=Q(status__in=['paid', 'partial'])),
            pending_amount=Sum('amount', filter=Q(status='pending')),
        )

        return Response({
            'total_students': total_students,
            'total_teachers': total_teachers,
            'attendance': {
                'present_today': present_today,
                'absent_today': absent_today,
                'total_marked': total_marked,
                'attendance_rate': (
                    round(present_today / total_marked * 100, 1)
                    if total_marked else 0
                ),
            },
            'fees': {
                'total_collected': float(fee_agg['total_collected'] or 0),
                'pending_amount': float(fee_agg['pending_amount'] or 0),
            },
            'recent_teachers': recent_teachers,
        })

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def student_portal(self, request):
        if request.user.role != User.Role.STUDENT:
            return Response({'error': 'Only students can access this endpoint.'}, status=403)

        from apps.students.models import Student
        from apps.attendance.models import Attendance
        from apps.exams.models import Result
        from apps.fees.models import Payment, FeeStructure

        try:
            student = Student.objects.select_related('user').get(
                user=request.user,
                school=request.user.school,
            )
        except Student.DoesNotExist:
            return Response({'error': 'Student profile not found.'}, status=404)

        attendance_qs = Attendance.objects.filter(
            school=request.user.school,
            student=student,
        )
        attendance_total = attendance_qs.count()
        attendance_present = attendance_qs.filter(status=Attendance.Status.PRESENT).count()
        attendance_absent = attendance_qs.filter(status=Attendance.Status.ABSENT).count()
        attendance_leave = attendance_qs.filter(status=Attendance.Status.LEAVE).count()

        recent_attendance = list(
            attendance_qs.order_by('-date').values('date', 'status', 'remarks')[:10]
        )

        results_qs = Result.objects.filter(
            school=request.user.school,
            student=student,
        ).select_related('exam', 'subject').order_by('-exam__start_date', '-created_at')

        exam_totals = {}
        for row in results_qs:
            exam_id = row.exam_id
            if exam_id not in exam_totals:
                exam_totals[exam_id] = {
                    'exam_id': exam_id,
                    'exam_name': row.exam.name,
                    'total_obtained': 0.0,
                    'total_max': 0.0,
                }
            exam_totals[exam_id]['total_obtained'] += float(row.marks_obtained)
            exam_totals[exam_id]['total_max'] += float(row.max_marks)

        exam_summaries = []
        for value in exam_totals.values():
            total_max = value['total_max'] or 1.0
            exam_summaries.append({
                **value,
                'percentage': round(value['total_obtained'] / total_max * 100, 2),
            })
        exam_summaries.sort(key=lambda x: x['percentage'], reverse=True)

        current_year = timezone.now().year
        academic_year = f'{current_year}-{str(current_year + 1)[-2:]}'
        fee_structure = FeeStructure.objects.filter(
            school=request.user.school,
            class_name=student.class_name,
            academic_year=academic_year,
        ).first()
        if not fee_structure:
            fee_structure = FeeStructure.objects.filter(
                school=request.user.school,
                class_name=student.class_name,
            ).order_by('-created_at').first()

        payments_qs = Payment.objects.filter(
            school=request.user.school,
            student=student,
        ).select_related('fee_structure').order_by('-payment_date', '-created_at')
        if fee_structure:
            payments_qs = payments_qs.filter(fee_structure=fee_structure)

        total_paid = float(
            payments_qs.filter(status__in=[Payment.Status.PAID, Payment.Status.PARTIAL]).aggregate(
                total=Sum('amount')
            )['total'] or 0
        )
        fee_required = float(fee_structure.amount) if fee_structure else 0
        fee_balance = max(0, fee_required - total_paid)

        recent_payments = list(
            payments_qs.values('id', 'amount', 'status', 'payment_date', 'payment_method')[:10]
        )

        return Response({
            'student': {
                'id': student.id,
                'name': student.user.get_full_name(),
                'class_name': student.class_name,
                'section': student.section,
                'roll_number': student.roll_number,
            },
            'attendance': {
                'total_days': attendance_total,
                'present': attendance_present,
                'absent': attendance_absent,
                'leave': attendance_leave,
                'attendance_rate': round(attendance_present / attendance_total * 100, 2) if attendance_total else 0,
                'recent': recent_attendance,
            },
            'exams': {
                'total_results': results_qs.count(),
                'exam_summaries': exam_summaries,
            },
            'fees': {
                'academic_year': fee_structure.academic_year if fee_structure else None,
                'required': fee_required,
                'paid': total_paid,
                'balance': fee_balance,
                'is_fully_paid': fee_balance == 0,
                'recent_payments': recent_payments,
            },
        })
