from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse


def health_check(request):
    from django.db import connection
    try:
        connection.cursor().execute("SELECT 1")
        db_ok = True
    except Exception:
        db_ok = False
    status = 200 if db_ok else 503
    return JsonResponse({"status": "ok" if db_ok else "degraded"}, status=status)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check),
    path("api/v1/", include("apps.exams.urls")),
]