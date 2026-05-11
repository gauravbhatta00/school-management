"""
Root URL configuration.
All app routers are registered here for a clean, modular API surface.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework.schemas import get_schema_view

urlpatterns = [
    path("admin/", admin.site.urls),
    # Auth endpoints
    path("api/auth/", include("djoser.urls")),
    path("api/auth/", include("djoser.urls.jwt")),
    path(
        "api/auth/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),
    # Basic OpenAPI schema for quick docs (JSON)
    path(
        "api/auth/docs/",
        get_schema_view(title="School Management API"),
        name="api_schema",
    ),
    # App routers
    path("api/", include("apps.schools.urls")),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.students.urls")),
    path("api/", include("apps.teachers.urls")),
    path("api/", include("apps.attendance.urls")),
    path("api/applications/", include("apps.applications.urls")),
    path("api/", include("apps.exams.urls")),
    path("api/", include("apps.fees.urls")),
    path("api/", include("apps.notices.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
