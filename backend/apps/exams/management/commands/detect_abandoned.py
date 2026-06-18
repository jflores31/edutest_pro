"""Mark IN_PROGRESS attempts whose heartbeat expired as ABANDONED.

Replaces the old Celery Beat task `detect_abandoned_attempts_task`. Run on a
schedule (Render Cron or the free GitHub Actions workflow in
.github/workflows/detect-abandoned.yml):

    python manage.py detect_abandoned
"""

import logging

from django.core.management.base import BaseCommand

from apps.exams.models import Organization
from services.attempt_service import AttemptService

logger = logging.getLogger("edutest")


class Command(BaseCommand):
    help = "Detect and mark abandoned in-progress attempts across all active organizations."

    def handle(self, *args, **options):
        service = AttemptService()
        total = 0
        for org in Organization.objects.filter(is_active=True):
            total += service.detect_and_mark_abandoned(str(org.id))
        logger.info("Abandoned detection done", extra={"total": total})
        self.stdout.write(self.style.SUCCESS(f"Marked {total} attempt(s) as abandoned."))
