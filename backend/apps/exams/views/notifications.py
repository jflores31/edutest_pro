"""EduTest Pro — NotificationsView: list recent in-app notifications for the org."""

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .mixins import IsTeacherOrAdmin


class NotificationsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get(self, request):
        from apps.exams.models import Notification
        qs = (
            Notification.objects
            .filter(organization=request.user.organization)
            .order_by("-created_at")[:30]
        )
        data = [
            {
                "id": str(n.id),
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "created_at": n.created_at.isoformat(),
            }
            for n in qs
        ]
        return Response(data)
