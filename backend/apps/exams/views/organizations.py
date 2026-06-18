from rest_framework import permissions, status, viewsets
from rest_framework.response import Response

from .mixins import IsTeacherOrAdmin
from ..models import Organization
from ..serializers import OrganizationSerializer


class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Organization.objects.all()
        return Organization.objects.filter(id=self.request.user.organization_id)

    def update(self, request, *args, **kwargs):
        # Only ADMIN (or superuser) may modify organization settings — a TEACHER
        # can read their org but not change it.
        if not (request.user.is_superuser or request.user.role == "ADMIN"):
            return Response(
                {"error": "Solo un administrador puede modificar la organización."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            return Response(
                {"error": "Solo un superusuario puede eliminar organizaciones."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)