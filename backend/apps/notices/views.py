from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsSchoolAdmin

from .models import Notice, CalendarEvent
from .serializers import NoticeSerializer, CalendarEventSerializer


class NoticeViewSet(viewsets.ModelViewSet):
    serializer_class = NoticeSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['is_published']
    search_fields = ['title', 'message']

    def get_queryset(self):
        queryset = Notice.objects.filter(school=self.request.user.school).select_related('created_by')

        if self.request.user.role != 'admin':
            queryset = queryset.filter(is_published=True)

        return queryset

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsSchoolAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school, created_by=self.request.user)


class CalendarEventViewSet(viewsets.ModelViewSet):
    serializer_class = CalendarEventSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['event_type', 'start_date', 'end_date']
    search_fields = ['title', 'description']

    def get_queryset(self):
        return (
            CalendarEvent.objects
            .filter(school=self.request.user.school)
            .select_related('created_by')
            .order_by('-created_at')
        )

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsSchoolAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school, created_by=self.request.user)
