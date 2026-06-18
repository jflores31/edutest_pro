"""EduTest Pro — import processing.

Celery has been removed in favour of free-tier-friendly synchronous processing.
Imports are bounded (≤10MB / ≤2000 rows) so they run safely inside the request.
Periodic abandonment detection now lives in the `detect_abandoned` management command.
"""

import logging

logger = logging.getLogger("edutest.tasks")


def process_import(job_id):
    """Process an ImportJob synchronously. Raises on failure so the caller can react."""
    from services.import_service import ImportService

    ImportService().process_from_job(job_id)
    logger.info("Import completed", extra={"job_id": job_id})
