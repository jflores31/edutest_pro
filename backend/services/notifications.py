"""EduTest Pro — Notification utility: create in-app notification records."""

import logging

logger = logging.getLogger("edutest.notifications")


def create_notification(organization_id, ntype, title, body=""):
    """Create a Notification row. Never raises — failures are logged and swallowed."""
    try:
        from apps.exams.models import Notification
        Notification.objects.create(
            organization_id=organization_id,
            type=ntype,
            title=title,
            body=body,
        )
    except Exception:
        logger.exception("Failed to create notification type=%s org=%s", ntype, organization_id)
