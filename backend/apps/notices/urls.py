from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import NoticeViewSet, CalendarEventViewSet

router = DefaultRouter()
router.register("notices", NoticeViewSet, basename="notices")
router.register("calendar-events", CalendarEventViewSet, basename="calendar-events")

urlpatterns = [
    path("", include(router.urls)),
]
