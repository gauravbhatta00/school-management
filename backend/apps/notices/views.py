from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsSchoolAdmin

from .models import Notice, CalendarEvent, Notification
from .serializers import NoticeSerializer, CalendarEventSerializer, NotificationSerializer


class NoticeViewSet(viewsets.ModelViewSet):
    serializer_class = NoticeSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["is_published"]
    search_fields = ["title", "message"]

    def get_queryset(self):
        queryset = Notice.objects.filter(
            school=self.request.user.school
        ).select_related("created_by")

        if self.request.user.role != "admin":
            queryset = queryset.filter(is_published=True)

        return queryset

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsSchoolAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school, created_by=self.request.user)


class NotificationViewSet(viewsets.ModelViewSet):
    """Personal notifications for the logged-in user (e.g. application decisions)."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "post", "head", "options"]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CalendarEventViewSet(viewsets.ModelViewSet):
    serializer_class = CalendarEventSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["event_type", "start_date", "end_date"]
    search_fields = ["title", "description"]

    def get_queryset(self):
        return (
            CalendarEvent.objects.filter(school=self.request.user.school)
            .select_related("created_by")
            .order_by("-created_at")
        )

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsSchoolAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school, created_by=self.request.user)
