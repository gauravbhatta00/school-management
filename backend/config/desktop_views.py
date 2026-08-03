"""Local desktop readiness and packaged frontend views."""

from pathlib import Path

from django.conf import settings
from django.db import connection
from django.http import FileResponse, Http404, JsonResponse
from django.views.static import serve


def health(request):
    """Report readiness only after Django can access the local database.

    Deliberately excludes paths, versions, and any other environment detail.
    """
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        cursor.fetchone()
    return JsonResponse({"status": "ok", "service": "school-management-backend"})


def desktop_asset(request, path):
    if not getattr(settings, "DESKTOP_MODE", False):
        raise Http404
    return serve(request, path, document_root=settings.FRONTEND_DIST)


def desktop_media(request, path):
    if not getattr(settings, "DESKTOP_MODE", False):
        raise Http404
    return serve(request, path, document_root=settings.MEDIA_ROOT)


def desktop_spa(request, path=""):
    if not getattr(settings, "DESKTOP_MODE", False):
        raise Http404
    index_path = Path(settings.FRONTEND_DIST) / "index.html"
    if not index_path.is_file():
        raise Http404("Desktop frontend build is unavailable.")
    return FileResponse(index_path.open("rb"), content_type="text/html")
