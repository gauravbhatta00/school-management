"""
SchoolMiddleware attaches the current user's school to the request object.

Why middleware? It centralises tenant resolution so every ViewSet's
get_queryset() can safely do `.filter(school=request.school)` without
repeating the lookup logic. This is the "request-based tenancy" pattern —
simpler than schema-based tenancy, suitable for most school SaaS apps.
"""


class SchoolMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Attach school from authenticated user (if any).
        # JWTAuthentication runs later in DRF, so we do a lightweight check.
        request.school = None
        if hasattr(request, 'user') and request.user.is_authenticated:
            request.school = getattr(request.user, 'school', None)

        response = self.get_response(request)
        return response
