import logging
from django.db import transaction
from django.db.models import F
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.exams.auth import StudentAttemptToken
from .mixins import IsSameOrganization, IsTeacherOrAdmin, _client_ip, _rate_limit, _revoke_student_token
from ..models import Attempt, Exam, ProctoringEvent, Student, User
from ..serializers import (
    AttemptDetailSerializer, AttemptSerializer, SubmitExamSerializer,
)
from services.attempt_service import AttemptService, sanitize_snapshot_for_student
from services.exam_engine import ExamEngine
from services.exceptions import (
    AttemptAlreadyCompletedError, AttemptNotFoundError, AttemptNotInProgressError,
    CrossTenantAccessError, ExamNotPublishedError, ExamTimeExpiredError,
    InvalidQuestionForAttemptError, UnauthorizedAttemptAccessError,
)

logger = logging.getLogger("edutest")


class AttemptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AttemptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "attempt_id"):
            return Attempt.objects.filter(id=user.attempt_id).select_related("exam", "user")
        qs = Attempt.objects.filter(organization_id=user.organization_id)
        if user.role == "STUDENT":
            qs = qs.filter(user=user)
        return qs.select_related("exam", "user")

    @action(detail=True, methods=["get"], url_path="state")
    def state(self, request, pk=None):
        """Get current attempt state including saved answers."""
        service = AttemptService()
        try:
            state = service.get_attempt_state(str(pk), request.user)
            return Response(state)
        except (AttemptNotFoundError, UnauthorizedAttemptAccessError) as e:
            return Response(e.to_dict(), status=status.HTTP_404_NOT_FOUND)
        except CrossTenantAccessError as e:
            return Response(e.to_dict(), status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        """Submit exam for scoring."""
        serializer = SubmitExamSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        engine = ExamEngine()
        try:
            result = engine.submit_exam(str(pk), serializer.validated_data["answers"], request.user)
            _revoke_student_token(request)
            return Response(result)
        except AttemptAlreadyCompletedError as e:
            return Response(e.to_dict(), status=status.HTTP_409_CONFLICT)
        except ExamTimeExpiredError as e:
            return Response(e.to_dict(), status=status.HTTP_410_GONE)
        except AttemptNotInProgressError as e:
            return Response(e.to_dict(), status=status.HTTP_409_CONFLICT)
        except (AttemptNotFoundError, UnauthorizedAttemptAccessError) as e:
            return Response(e.to_dict(), status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception("Error submitting exam", extra={"attempt_id": pk, "error": str(e)})
            return Response({"error": "An unexpected error occurred. Please try again later."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="heartbeat")
    def heartbeat(self, request, pk=None):
        """Update heartbeat to prevent abandonment detection."""
        try:
            key = f"edutest:rate:heartbeat:{pk}"
            val = cache.get(key, 0)
            if val >= 1:
                return Response({"error": "Demasiados heartbeats. Espera 5 segundos."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
            cache.set(key, 1, timeout=5)
        except Exception:
            logger.warning("Redis unavailable during heartbeat rate limiting; allowing request")
        service = AttemptService()
        try:
            result = service.heartbeat(str(pk), request.user)
            return Response(result)
        except (AttemptNotFoundError, UnauthorizedAttemptAccessError) as e:
            return Response(e.to_dict(), status=status.HTTP_404_NOT_FOUND)
        except CrossTenantAccessError as e:
            return Response(e.to_dict(), status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.exception("Error in heartbeat", extra={"attempt_id": str(pk), "error": str(e)})
            return Response({"error": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["put"], url_path="answers/(?P<question_id>[^/.]+)")
    def save_answer(self, request, pk=None, question_id=None):
        """Save a partial answer (auto-save)."""
        service = AttemptService()
        try:
            result = service.save_answer(
                str(pk), question_id, request.data.get("answer_data"), request.user
            )
            return Response(result)
        except (AttemptNotFoundError, UnauthorizedAttemptAccessError) as e:
            return Response(e.to_dict(), status=status.HTTP_404_NOT_FOUND)
        except CrossTenantAccessError as e:
            return Response(e.to_dict(), status=status.HTTP_403_FORBIDDEN)
        except InvalidQuestionForAttemptError as e:
            return Response(e.to_dict(), status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Error saving answer", extra={"attempt_id": str(pk), "error": str(e)})
            return Response({"error": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="answer")
    def answer(self, request, pk=None):
        """Save answer — POST {question_id, answer_data: {selected_key|selected_keys|value}}."""
        question_id = request.data.get("question_id")
        answer_data = request.data.get("answer_data") or request.data.get("value")
        if not question_id:
            return Response({"error": "question_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        service = AttemptService()
        try:
            result = service.save_answer(str(pk), str(question_id), answer_data, request.user)
            return Response(result)
        except (AttemptNotFoundError, UnauthorizedAttemptAccessError) as e:
            return Response(e.to_dict(), status=status.HTTP_404_NOT_FOUND)
        except CrossTenantAccessError as e:
            return Response(e.to_dict(), status=status.HTTP_403_FORBIDDEN)
        except InvalidQuestionForAttemptError as e:
            return Response(e.to_dict(), status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Error saving answer", extra={"attempt_id": str(pk), "error": str(e)})
            return Response({"error": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="finish")
    def finish(self, request, pk=None):
        """Finish exam using answers already saved in DB (no body required)."""
        engine = ExamEngine()
        try:
            result = engine.submit_exam(str(pk), None, request.user)
            _revoke_student_token(request)
            return Response(result)
        except AttemptAlreadyCompletedError as e:
            return Response(e.to_dict(), status=status.HTTP_409_CONFLICT)
        except ExamTimeExpiredError as e:
            return Response(e.to_dict(), status=status.HTTP_410_GONE)
        except AttemptNotInProgressError as e:
            return Response(e.to_dict(), status=status.HTTP_409_CONFLICT)
        except (AttemptNotFoundError, UnauthorizedAttemptAccessError) as e:
            return Response(e.to_dict(), status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception("Error finishing exam", extra={"attempt_id": pk, "error": str(e)})
            return Response({"error": "An unexpected error occurred. Please try again later."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="events")
    def report_event(self, request, pk=None):
        """Record anti-cheat event."""
        try:
            key = f"edutest:rate:event:{pk}"
            val = cache.get(key, 0)
            if val >= 10:
                return Response({"error": "Demasiados eventos. Intenta más tarde."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
            cache.set(key, val + 1, timeout=60)
        except Exception:
            logger.warning("Redis unavailable during event rate limiting; allowing request")
        event_type = request.data.get("event_type", "unknown")
        valid_types = [c[0] for c in ProctoringEvent.EventType.choices]
        if event_type not in valid_types:
            return Response({"error": "Tipo de evento no válido."}, status=status.HTTP_400_BAD_REQUEST)
        payload = request.data.get("payload", {})
        if payload and len(str(payload)) > 2048:
            return Response({"error": "Payload too large (max 2KB)."}, status=status.HTTP_400_BAD_REQUEST)
        service = AttemptService()
        try:
            attempt = service._get_validated(str(pk), request.user, require_in_progress=False)
        except (AttemptNotFoundError, UnauthorizedAttemptAccessError) as e:
            return Response(e.to_dict(), status=status.HTTP_404_NOT_FOUND)
        except CrossTenantAccessError as e:
            return Response(e.to_dict(), status=status.HTTP_403_FORBIDDEN)

        ProctoringEvent.objects.create(
            attempt=attempt,
            event_type=event_type,
            payload=request.data.get("payload", {}),
        )
        logger.warning(
            "Anti-cheat event",
            extra={"attempt_id": pk, "user_id": str(request.user.id), "event": event_type},
        )
        return Response({"recorded": True})

    @action(detail=True, methods=["get"], url_path="detail")
    def detail_view(self, request, pk=None):
        """Full attempt breakdown: per-question answers, correctness, explanations."""
        attempt = self.get_object()
        if attempt.status != Attempt.Status.COMPLETED:
            return Response(
                {"detail": "Los resultados no están disponibles hasta que el examen se haya completado."},
                status=status.HTTP_403_FORBIDDEN,
            )
        attempt = (
            Attempt.objects.select_related("user", "student", "exam", "snapshot")
            .prefetch_related("saved_answers")
            .get(pk=attempt.pk)
        )
        serializer = AttemptDetailSerializer(attempt, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="extend-time")
    def extend_time(self, request, pk=None):
        """Extend time for a single attempt."""
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        attempt = self.get_object()
        if attempt.organization_id != request.user.organization_id:
            return Response({"detail": "Cross-tenant access denied."}, status=status.HTTP_403_FORBIDDEN)
        extra_minutes = request.data.get("extra_minutes")
        if extra_minutes is None:
            return Response({"error": "extra_minutes is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            extra_minutes = int(extra_minutes)
            if extra_minutes < 0 or extra_minutes > 120:
                raise ValueError
        except (ValueError, TypeError):
            return Response({"error": "extra_minutes must be an integer between 0 and 120."}, status=status.HTTP_400_BAD_REQUEST)

        Attempt.objects.filter(pk=attempt.pk).update(extra_time_minutes=F("extra_time_minutes") + extra_minutes)
        attempt.refresh_from_db()

        serializer = AttemptSerializer(attempt, context={"request": request})
        return Response(serializer.data)


class StudentLookupView(APIView):
    """
    POST /api/v1/auth/student/lookup/
    Body: { exam_slug, code }
    Returns student name if registered, 404 if not.
    Rate-limited to 10 requests per minute per IP.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        exam_slug = request.data.get("exam_slug", "").strip()[:100]
        code = request.data.get("code", "").strip()[:50]

        if not all([exam_slug, code]):
            return Response(
                {"error": "exam_slug y code son requeridos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ip = self._client_ip(request)
        cache_key = f"edutest:rate:student_lookup:{ip}"
        try:
            attempts = cache.get(cache_key, 0)
            if attempts >= 10:
                return Response(
                    {"error": "Demasiados intentos. Intenta de nuevo en un minuto."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            cache.set(cache_key, attempts + 1, timeout=60)
        except Exception:
            logger.warning("Redis unavailable during student lookup rate limiting; allowing request")

        try:
            exam = Exam.objects.get(slug=exam_slug, is_published=True, archived=False)
        except Exam.DoesNotExist:
            return Response({"error": "Examen no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        student = Student.objects.filter(
            organization=exam.organization,
            code__iexact=code,
        ).first()

        if not student:
            return Response(
                {"error": "No estás registrado para este examen. Consulta con tu docente."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            "code": student.code,
            "first_name": student.first_name,
            "last_name": student.last_name,
        })

    @staticmethod
    def _client_ip(request):
        return _client_ip(request)


class StudentLoginView(APIView):
    """
    POST /api/v1/auth/student/login/
    Body: { exam_slug, code }
    Returns: { attempt_id, attempt_token, exam_snapshot }
    Rate-limited to 10 requests per minute per IP.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        from django.db import IntegrityError
        from django.db.models.functions import Lower, Trim

        try:
            ip = _client_ip(request)
            cache_key = f"edutest:rate:student_login:{ip}"
            attempts = cache.get(cache_key, 0)
            if attempts >= 10:
                return Response(
                    {"error": "Demasiados intentos. Intenta de nuevo en un minuto."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            cache.set(cache_key, attempts + 1, timeout=60)
        except Exception:
            logger.error("Redis unavailable during student login rate limit; denying request")
            return Response(
                {"error": "Servicio temporalmente no disponible. Intenta de nuevo."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        exam_slug = request.data.get("exam_slug", "").strip()
        code = request.data.get("code", "").strip()
        first_name = request.data.get("first_name", "").strip()
        last_name = request.data.get("last_name", "").strip()

        if not all([exam_slug, code]):
            return Response(
                {"error": "exam_slug y code son requeridos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve exam
        try:
            exam = Exam.objects.get(slug=exam_slug, is_published=True, archived=False)
        except Exam.DoesNotExist:
            return Response({"error": "Exam not found or not published."}, status=status.HTTP_404_NOT_FOUND)

        # Validate student: code match + name disambiguation when names are provided
        # Filter by course when exam has one, otherwise by org (broader)
        if exam.course_id:
            base_qs = Student.objects.filter(course=exam.course, code__iexact=code)
        else:
            base_qs = Student.objects.filter(organization=exam.organization, code__iexact=code)

        if first_name and last_name:
            student = (
                base_qs
                .annotate(
                    first_norm=Trim(Lower("first_name")),
                    last_norm=Trim(Lower("last_name")),
                )
                .filter(
                    first_norm=first_name.lower(),
                    last_norm=last_name.lower(),
                )
                .select_related("organization")
                .first()
            )
            if not student:
                if base_qs.exists():
                    return Response(
                        {"error": "Los datos proporcionados no coinciden. Verifica nombres y apellidos."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                return Response(
                    {"error": "No estás registrado para este examen. Consulta con tu docente."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        else:
            student = base_qs.select_related("organization").first()
            if not student:
                return Response(
                    {"error": "No estás registrado para este examen. Consulta con tu docente."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

        # System guest user for this organization (students share a placeholder User row)
        guest_user, _ = User.objects.get_or_create(
            username=f"__student_guest_{exam.organization_id}__",
            defaults={
                "email": f"student_guest_{exam.organization_id}@system.internal",
                "organization": exam.organization,
                "role": User.Role.STUDENT,
                "is_active": False,
            },
        )

        engine = ExamEngine()
        with transaction.atomic():
            existing = (
                Attempt.objects.select_for_update()
                .filter(student=student, exam=exam, status=Attempt.Status.IN_PROGRESS)
                .first()
            )
            if existing:
                attempt = existing
            else:
                # Check max_attempts inside the lock so concurrent requests can't both slip through
                if exam.max_attempts:
                    completed_count = Attempt.objects.filter(
                        student=student,
                        exam=exam,
                        status__in=[Attempt.Status.COMPLETED, Attempt.Status.ABANDONED]
                    ).count()
                    if completed_count >= exam.max_attempts:
                        return Response(
                            {"error": f"Has alcanzado el límite de {exam.max_attempts} intento{'s' if exam.max_attempts != 1 else ''} para este examen."},
                            status=status.HTTP_403_FORBIDDEN,
                        )
                snapshot = engine._get_or_create_snapshot(exam)
                try:
                    # Nested savepoint so a unique-constraint race only rolls back
                    # this insert, keeping the outer transaction usable for the
                    # follow-up lookup (avoids TransactionManagementError).
                    with transaction.atomic():
                        attempt = Attempt.objects.create(
                            organization=exam.organization,
                            user=guest_user,
                            student=student,
                            exam=exam,
                            snapshot=snapshot,
                            status=Attempt.Status.IN_PROGRESS,
                        )
                except IntegrityError:
                    attempt = (
                        Attempt.objects
                        .filter(student=student, exam=exam, status=Attempt.Status.IN_PROGRESS)
                        .first()
                    )
                    if not attempt:
                        raise

        if exam.duration_minutes:
            elapsed = (timezone.now() - attempt.started_at).total_seconds()
            total_minutes = exam.duration_minutes + (attempt.extra_time_minutes or 0)
            time_remaining_seconds = max(0, int(total_minutes * 60 - elapsed))
            ends_at = (attempt.started_at + timedelta(minutes=total_minutes)).isoformat()
        else:
            time_remaining_seconds = None
            ends_at = None

        token = StudentAttemptToken.for_attempt(attempt, student)
        return Response(
            {
                "attempt_id": str(attempt.id),
                "attempt_token": str(token),
                "exam_snapshot": sanitize_snapshot_for_student(attempt.snapshot.snapshot_data),
                "time_remaining_seconds": time_remaining_seconds,
                "ends_at": ends_at,
                "block_tab_switch": exam.block_tab_switch,
            },
            status=status.HTTP_200_OK,
        )