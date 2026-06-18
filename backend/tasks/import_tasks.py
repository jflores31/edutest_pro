"""EduTest Pro — Celery tasks for async import."""

import logging
from celery import shared_task

logger = logging.getLogger("edutest.tasks")


@shared_task(bind=True, max_retries=3, default_retry_delay=60, name="tasks.process_import_task")
def process_import_task(self, job_id):
    from services.import_service import ImportService
    from services.exceptions import ImportValidationError

    try:
        ImportService().process_from_job(job_id)
        logger.info("Import completed", extra={"job_id": job_id})
    except ImportValidationError:
        # Errores de validación son definitivos — no reintentar
        raise
    except Exception as exc:
        logger.exception("Import failed", extra={"job_id": job_id})
        raise self.retry(exc=exc)


@shared_task(name="tasks.detect_abandoned_attempts_task", ignore_result=True)
def detect_abandoned_attempts_task():
    from apps.exams.models import Organization
    from services.attempt_service import AttemptService

    service = AttemptService()
    total = 0
    for org in Organization.objects.filter(is_active=True):
        total += service.detect_and_mark_abandoned(str(org.id))
    logger.info("Abandoned detection done", extra={"total": total})
