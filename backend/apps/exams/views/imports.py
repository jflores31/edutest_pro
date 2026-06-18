import logging
import os

from django.core.cache import cache
from django.db import transaction
from rest_framework import parsers, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .mixins import IsTeacherOrAdmin
from ..models import ImportJob
from ..serializers import ImportJobSerializer

logger = logging.getLogger("edutest")


class ImportJobViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ImportJobSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get_queryset(self):
        return ImportJob.objects.filter(organization=self.request.user.organization)

    @action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request):
        """Upload a CSV/XLSX file and import it synchronously.

        Celery was removed; imports are bounded (≤10MB / ≤2000 rows) and run inline.
        Processing in-request also means the file only needs to survive the request,
        which is safe on platforms with ephemeral disks (Render).
        """
        import uuid as uuid_mod

        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        from django.conf import settings
        from tasks.import_tasks import process_import
        from services.exceptions import EduTestError

        upload_dir = os.path.join(settings.MEDIA_ROOT, "imports")
        os.makedirs(upload_dir, exist_ok=True)
        # Unique filename so concurrent uploads with the same name don't overwrite.
        safe_name = f"{uuid_mod.uuid4().hex}_{os.path.basename(file.name)}"
        file_path = os.path.join(upload_dir, safe_name)
        with open(file_path, "wb") as f:
            for chunk in file.chunks():
                f.write(chunk)

        job = ImportJob.objects.create(
            organization=request.user.organization,
            created_by=request.user,
            file_name=file.name,
            file_path=file_path,
        )

        try:
            process_import(str(job.id))
        except EduTestError as exc:
            job.refresh_from_db()
            return Response(
                {**exc.to_dict(), "job": ImportJobSerializer(job).data},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except Exception:
            logger.exception("Import failed", extra={"job_id": str(job.id)})
            job.refresh_from_db()
            return Response(
                {"error": "Error interno al importar. Intenta nuevamente.",
                 "job": ImportJobSerializer(job).data},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        job.refresh_from_db()
        return Response(ImportJobSerializer(job).data, status=status.HTTP_201_CREATED)


class ImportPreviewView(APIView):
    """
    POST /api/v1/imports/preview/
    Synchronous: parse & validate entire file without persisting.
    Saves draft rows to Redis with 1h TTL.
    Returns all rows + errors + draft_token.
    """
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]
    parser_classes = [parsers.MultiPartParser]

    def post(self, request):
        from services.import_service import ImportService
        from services.exceptions import ImportFileFormatError, ImportFileTooLargeError
        import uuid as uuid_mod

        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No se envió archivo."}, status=status.HTTP_400_BAD_REQUEST)

        service = ImportService()
        try:
            result = service.full_preview(file)
        except ImportFileFormatError as exc:
            return Response({"error": str(exc), "code": "FORMAT_ERROR"}, status=status.HTTP_400_BAD_REQUEST)
        except ImportFileTooLargeError as exc:
            return Response({"error": str(exc), "code": "FILE_TOO_LARGE"}, status=status.HTTP_400_BAD_REQUEST)

        draft_token = str(uuid_mod.uuid4())
        draft_key = f"edutest:import_draft:{request.user.organization_id}:{draft_token}"
        try:
            cache.set(draft_key, result.to_dict(), timeout=3600)
        except Exception:
            logger.warning("Redis unavailable; draft_token will not be validated on confirm")

        return Response({
            "draft_token": draft_token,
            "total_rows": result.total_rows,
            "error_count": len(result.errors),
            "rows": result.preview_rows,
            "errors": [e.to_dict() for e in result.errors],
        }, status=status.HTTP_200_OK)


class ImportConfirmView(APIView):
    """
    POST /api/v1/imports/confirm/
    Body: { draft_token: str, rows: DraftQuestion[] }
    Re-validates, persists atomically, returns job_id + question_ids.
    draft_token deleted atomically inside transaction to prevent double-submit.
    """
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def post(self, request):
        from services.import_service import ImportService

        draft_token = request.data.get("draft_token")
        rows = request.data.get("rows", [])

        if not rows:
            return Response({"error": "No hay preguntas para importar."}, status=status.HTTP_400_BAD_REQUEST)

        if len(rows) > 2000:
            return Response({"error": "Máximo 2,000 preguntas por importación."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate draft_token (anti-replay)
        if draft_token:
            draft_key = f"edutest:import_draft:{request.user.organization_id}:{draft_token}"
            try:
                if not cache.get(draft_key):
                    return Response(
                        {"error": "El draft expiró o ya fue importado. Sube el archivo nuevamente."},
                        status=status.HTTP_409_CONFLICT,
                    )
            except Exception:
                logger.warning("Redis unavailable; skipping draft_token validation")

        service = ImportService()
        validation_errors = service.validate_rows_payload(rows)
        error_ids = {e["row_id"] for e in validation_errors}
        valid_rows = [r for r in rows if r.get("_id") not in error_ids]

        if not valid_rows:
            return Response({
                "error": "No hay filas válidas para importar.",
                "validation_errors": validation_errors,
            }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        try:
            with transaction.atomic():
                result = service.persist_rows(
                    rows=valid_rows,
                    organization=request.user.organization,
                    created_by=request.user,
                )
                if draft_token:
                    try:
                        cache.delete(draft_key)
                    except Exception:
                        pass

                job = ImportJob.objects.create(
                    organization=request.user.organization,
                    created_by=request.user,
                    status=ImportJob.Status.COMPLETED,
                    file_name="manual_confirm",
                    file_path="",
                    total_rows=len(rows),
                    rows_created=result.questions_created,
                )

        except Exception as exc:
            logger.exception("Error en ImportConfirmView", extra={"user_id": str(request.user.id)})
            return Response({"error": "Error interno al importar. Intenta nuevamente."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            "job_id": str(job.id),
            "questions_created": result.questions_created,
            "question_ids": result.question_ids,
            "skipped_rows": len(rows) - len(valid_rows),
        }, status=status.HTTP_201_CREATED)