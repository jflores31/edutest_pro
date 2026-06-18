import logging

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .mixins import IsTeacherOrAdmin
from ..models import UserIntegration

logger = logging.getLogger("edutest")


_INTEGRATION_CATALOG = [
    {"key": "google_classroom", "name": "Google Classroom", "desc": "Sincroniza alumnos y publica calificaciones"},
    {"key": "teams",            "name": "Microsoft Teams",  "desc": "Comparte exámenes en canales del equipo"},
    {"key": "zoom",             "name": "Zoom",             "desc": "Inicia sesiones de proctoring por video"},
    {"key": "excel",            "name": "Excel / CSV",      "desc": "Exporta resultados a hojas de cálculo"},
    {"key": "webhooks",         "name": "Webhooks",         "desc": "Recibe eventos en tu propio servidor"},
]


class IntegrationListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get(self, request):
        connected = set(
            UserIntegration.objects.filter(user=request.user, connected=True)
            .values_list("key", flat=True)
        )
        return Response([{**item, "connected": item["key"] in connected} for item in _INTEGRATION_CATALOG])


class IntegrationToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def post(self, request, key):
        valid_keys = {item["key"] for item in _INTEGRATION_CATALOG}
        if key not in valid_keys:
            return Response({"error": "Integración no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        integration, _ = UserIntegration.objects.get_or_create(user=request.user, key=key)
        integration.connected = not integration.connected
        integration.save(update_fields=["connected", "updated_at"])
        return Response({"key": key, "connected": integration.connected})