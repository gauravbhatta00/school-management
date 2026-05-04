from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from .models import School
from .serializers import SchoolSerializer
from apps.accounts.permissions import IsSchoolAdmin


class SchoolViewSet(viewsets.ModelViewSet):
    """
    Superusers see all schools; school admins see only their own.
    Only Django superusers can CREATE new schools (platform-level action).
    """
    serializer_class = SchoolSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return School.objects.all()
        if user.school:
            return School.objects.filter(id=user.school_id)
        return School.objects.none()
