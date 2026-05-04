"""
Application views with role-based access and review workflows.

Workflow:
- Leave requests: Student → Teacher approves/rejects directly
- Other apps: Student → Teacher reviews → Admin decides
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from .models import Application
from .serializers import (
    ApplicationCreateSerializer,
    ApplicationListSerializer,
    ApplicationDetailSerializer,
    TeacherApplicationReviewSerializer,
    AdminApplicationReviewSerializer,
)
from apps.accounts.permissions import IsAdminOrTeacher, IsSchoolAdmin
from apps.students.models import Student


class ApplicationViewSet(viewsets.ModelViewSet):
    """
    Application CRUD with role-based access.
    - Students: Create own, view own
    - Teachers: View students' apps, review leave requests
    - Admins: View all, make final decisions
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ApplicationListSerializer

    def get_queryset(self):
        """Filter by role."""
        user = self.request.user
        school = user.school
        
        if user.role == 'admin':
            return Application.objects.filter(school=school)
        elif user.role == 'teacher':
            # Teachers see applications from students in their school
            return Application.objects.filter(school=school)
        else:  # student
            # Students see only their own
            student = Student.objects.get(user=user)
            return Application.objects.filter(student=student)

    def get_serializer_class(self):
        """Use appropriate serializer based on action."""
        if self.action == 'create':
            return ApplicationCreateSerializer
        elif self.action == 'retrieve':
            return ApplicationDetailSerializer
        return ApplicationListSerializer

    def create(self, request, *args, **kwargs):
        """Students create applications."""
        if request.user.role != 'student':
            return Response(
                {'detail': 'Only students can create applications.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_applications(self, request):
        """Get current student's applications."""
        if request.user.role != 'student':
            return Response(
                {'detail': 'This endpoint is for students only.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            student = Student.objects.get(user=request.user)
            applications = Application.objects.filter(student=student)
        except Student.DoesNotExist:
            return Response(
                {'detail': 'Student profile not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = ApplicationListSerializer(applications, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminOrTeacher])
    def pending_review(self, request):
        """
        Get applications pending teacher/admin review.
        - Teachers see: Pending leave requests and other apps not yet teacher-reviewed
        - Admins see: Apps pending admin decision
        """
        user = request.user
        school = user.school
        
        if user.role == 'admin':
            # Admins see non-leave apps that are teacher-reviewed but not admin-decided
            apps = Application.objects.filter(
                school=school,
                status=Application.Status.TEACHER_REVIEWED
            ).exclude(application_type=Application.Type.LEAVE_REQUEST)
        elif user.role == 'teacher':
            # Teachers see leave requests and other apps pending teacher review
            apps = Application.objects.filter(
                school=school
            ).filter(
                Q(application_type=Application.Type.LEAVE_REQUEST, status=Application.Status.PENDING) |
                Q(application_type__in=[
                    Application.Type.TRANSFER_REQUEST,
                    Application.Type.FEE_WAIVER,
                    Application.Type.SCHOLARSHIP,
                    Application.Type.OTHER,
                ], status=Application.Status.PENDING)
            )
        else:
            return Response(
                {'detail': 'Not authorized.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = ApplicationListSerializer(apps, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrTeacher])
    def teacher_response(self, request, pk=None):
        """
        Teachers respond to leave requests (approve/reject directly).
        Only for leave requests.
        """
        if request.user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can respond to applications.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        application = self.get_object()
        
        if application.application_type != Application.Type.LEAVE_REQUEST:
            return Response(
                {'detail': 'This endpoint is only for leave requests.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = TeacherApplicationReviewSerializer(
            application,
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(
            ApplicationDetailSerializer(application).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], permission_classes=[IsSchoolAdmin])
    def admin_review(self, request, pk=None):
        """
        Admins make final decision on applications.
        For non-leave applications that are teacher-reviewed.
        """
        application = self.get_object()
        
        if application.application_type == Application.Type.LEAVE_REQUEST:
            return Response(
                {'detail': 'Leave requests are decided by teachers. This is for other applications.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if application.status != Application.Status.TEACHER_REVIEWED:
            return Response(
                {'detail': 'Application must be teacher-reviewed before admin review.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = AdminApplicationReviewSerializer(
            application,
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(
            ApplicationDetailSerializer(application).data,
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'], permission_classes=[IsSchoolAdmin])
    def stats(self, request):
        """Get application statistics for admin dashboard."""
        school = request.user.school
        apps = Application.objects.filter(school=school)
        
        return Response({
            'total': apps.count(),
            'pending': apps.filter(status=Application.Status.PENDING).count(),
            'approved': apps.filter(status=Application.Status.APPROVED).count(),
            'rejected': apps.filter(status=Application.Status.REJECTED).count(),
            'by_type': {
                'leave_requests': apps.filter(application_type=Application.Type.LEAVE_REQUEST).count(),
                'transfer_requests': apps.filter(application_type=Application.Type.TRANSFER_REQUEST).count(),
                'fee_waivers': apps.filter(application_type=Application.Type.FEE_WAIVER).count(),
                'scholarships': apps.filter(application_type=Application.Type.SCHOLARSHIP).count(),
                'other': apps.filter(application_type=Application.Type.OTHER).count(),
            }
        })
