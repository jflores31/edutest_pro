import logging
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Avg, Count, F, Max
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .mixins import IsTeacherOrAdmin, _revoke_student_token
from ..models import Attempt, Exam, ExamQuestion, ExamSnapshot, ExamTemplate, ProctoringEvent, Question
from ..serializers import (
    ExamDetailSerializer, ExamSerializer, ExamTemplateSerializer, ExamVisibilitySerializer,
    MonitoringAttemptSerializer,
)
from services.exam_engine import ExamEngine, PASS_THRESHOLD
from services.exceptions import (
    CrossTenantAccessError, ExamNotPublishedError,
)
from services.attempt_service import HEARTBEAT_PREFIX

logger = logging.getLogger("edutest")


class ExamViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ExamDetailSerializer
        return ExamSerializer

    def get_queryset(self):
        from django.db.models import Avg, Count, Max, Q as DjQ
        qs = Exam.objects.filter(organization=self.request.user.organization)
        if self.action == "list":
            if not self.request.query_params.get("include_archived"):
                qs = qs.filter(archived=False)
        if self.request.user.role == "STUDENT":
            qs = qs.filter(is_published=True)
        slug = self.request.query_params.get("slug")
        if slug:
            qs = qs.filter(slug=slug)
        completed_filter = DjQ(attempts__status="COMPLETED")
        qs = qs.annotate(
            attempts_count=Count("attempts", filter=completed_filter, distinct=True),
            pass_count=Count("attempts", filter=completed_filter & DjQ(attempts__score__gte=PASS_THRESHOLD), distinct=True),
            avg_score=Avg("attempts__score", filter=completed_filter),
            last_activity_at=Max("attempts__completed_at", filter=completed_filter),
        )
        return qs

    def _invalidate_dashboard_cache(self, org_id):
        from django.core.cache import cache
        for period in ("7d", "30d", "90d", "all"):
            cache.delete(f"dashboard_stats_{org_id}_all_{period}")
        if hasattr(cache, "delete_pattern"):
            try:
                cache.delete_pattern(f"dashboard_stats_{org_id}_*")
            except Exception:
                pass

    def perform_create(self, serializer):
        exam = serializer.save(
            organization=self.request.user.organization,
            created_by=self.request.user,
        )
        self._invalidate_dashboard_cache(self.request.user.organization_id)

    def update(self, request, *args, **kwargs):
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        exam = self.get_object()
        force = request.query_params.get("force", "").lower() in ("true", "1", "yes")

        if not force and (exam.attempts.exists() or exam.snapshots.exists()):
            return Response(
                {
                    "detail": "No se puede eliminar un examen con intentos registrados. "
                              "Archívalo, o elimínalo de todos modos (se perderán los intentos).",
                    "can_archive": True,
                },
                status=status.HTTP_409_CONFLICT,
            )

        from django.db import transaction
        with transaction.atomic():
            # force: borra dependientes en orden seguro. Attempt elimina en cascada
            # sus AttemptAnswer/ProctoringEvent; el Exam elimina sus ExamQuestion.
            exam.attempts.all().delete()
            exam.snapshots.all().delete()
            exam.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["patch"], url_path="visibility")
    def visibility(self, request, pk=None):
        """Update result visibility settings (teachers/admins only)."""
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        exam = self.get_object()
        serializer = ExamVisibilitySerializer(exam, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(ExamSerializer(exam, context={"request": request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="start", permission_classes=[permissions.IsAuthenticated])
    def start(self, request, pk=None):
        """Start an exam attempt (idempotent)."""
        try:
            exam = self.get_object()
            engine = ExamEngine()
            attempt_id = engine.start_exam(request.user, exam)
            attempt = Attempt.objects.select_related("snapshot").get(id=attempt_id)
            from django.utils import timezone
            if exam.duration_minutes:
                elapsed = (timezone.now() - attempt.started_at).total_seconds()
                total_minutes = exam.duration_minutes + (attempt.extra_time_minutes or 0)
                time_remaining = max(0, int(total_minutes * 60 - elapsed))
            else:
                time_remaining = None
            return Response({
                "attempt_id": attempt_id,
                "snapshot": attempt.snapshot.snapshot_data,
                "time_remaining_seconds": time_remaining,
            }, status=status.HTTP_201_CREATED)
        except ExamNotPublishedError as e:
            return Response(e.to_dict(), status=status.HTTP_400_BAD_REQUEST)
        except CrossTenantAccessError as e:
            return Response(e.to_dict(), status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.exception("Error starting exam", extra={"exam_id": pk, "error": str(e)})
            return Response({"error": "An unexpected error occurred. Please try again later."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="questions/add")
    def add_question(self, request, pk=None):
        """Add a question to the exam."""
        exam = self.get_object()
        if self.request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        question_id = request.data.get("question_id")
        try:
            import uuid as _uuid
            _uuid.UUID(str(question_id))
        except (ValueError, TypeError, AttributeError):
            return Response({"error": "question_id debe ser un UUID válido."}, status=status.HTTP_400_BAD_REQUEST)
        order = request.data.get("order", exam.exam_questions.count() + 1)
        points = request.data.get("points", 1.0)
        try:
            question = Question.objects.get(id=question_id, organization=request.user.organization)
            eq, created = ExamQuestion.objects.get_or_create(
                exam=exam, question=question,
                defaults={"order": order, "points": points},
            )
            return Response({"added": created, "order": eq.order, "points": float(eq.points)})
        except Question.DoesNotExist:
            return Response({"error": "Question not found."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=["post"], url_path="questions/reorder")
    def reorder_questions(self, request, pk=None):
        """Reorder questions in the exam. Body: [{question_id, order}, ...]"""
        exam = self.get_object()
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        items = request.data
        if not isinstance(items, list):
            return Response({"error": "Expected a list."}, status=status.HTTP_400_BAD_REQUEST)
        orders = [item.get("order") for item in items if isinstance(item, dict)]
        for o in orders:
            if not isinstance(o, int) or o < 1:
                return Response({"error": "El orden debe ser un entero positivo."}, status=status.HTTP_400_BAD_REQUEST)
        if len(orders) != len(set(orders)):
            return Response({"error": "Los valores de orden deben ser únicos."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            Exam.objects.select_for_update().get(pk=exam.pk)
            incoming_ids = {str(item.get("question_id")) for item in items if item.get("question_id")}
            existing_ids = set(
                ExamQuestion.objects.filter(exam=exam, question_id__in=incoming_ids)
                .values_list("question_id", flat=True)
            )
            invalid = incoming_ids - existing_ids
            if invalid:
                return Response(
                    {"error": f"Question IDs not in exam: {sorted(invalid)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            eq_objs = []
            eq_map = {
                str(eq.question_id): eq
                for eq in ExamQuestion.objects.filter(exam=exam, question_id__in=incoming_ids)
            }
            for item in items:
                qid = str(item.get("question_id"))
                eq = eq_map.get(qid)
                if eq:
                    eq.order = item.get("order")
                    eq_objs.append(eq)
            ExamQuestion.objects.bulk_update(eq_objs, ["order"])
        return Response({"reordered": len(items)})

    @action(detail=True, methods=["post"], url_path="questions/remove")
    def remove_question(self, request, pk=None):
        """Remove a question from this exam (deletes ExamQuestion row only)."""
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        exam = self.get_object()
        if exam.is_published and not request.query_params.get("force"):
            return Response(
                {"detail": "No se puede eliminar preguntas de un examen publicado. Despublica primero o usa ?force=true."},
                status=status.HTTP_409_CONFLICT,
            )
        question_id = request.data.get("question_id")
        if not question_id:
            return Response({"error": "question_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            import uuid as _uuid
            _uuid.UUID(str(question_id))
        except (ValueError, TypeError, AttributeError):
            return Response({"error": "question_id debe ser un UUID válido."}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = ExamQuestion.objects.filter(exam=exam, question_id=question_id).delete()
        if not deleted:
            return Response({"error": "Question not found in exam."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        """Publish the exam (teachers/admins only)."""
        exam = self.get_object()
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        with transaction.atomic():
            exam = Exam.objects.select_for_update().get(pk=exam.pk)
            if not exam.exam_questions.exists():
                return Response({"error": "Cannot publish exam with no questions."}, status=status.HTTP_400_BAD_REQUEST)
            exam.is_published = True
            exam.save(update_fields=["is_published"])
        self._invalidate_dashboard_cache(request.user.organization_id)
        return Response({"status": "published"})

    @action(detail=True, methods=["post"], url_path="unpublish")
    def unpublish(self, request, pk=None):
        """Unpublish the exam (teachers/admins only)."""
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        exam = self.get_object()
        in_progress_count = Attempt.objects.filter(exam=exam, status=Attempt.Status.IN_PROGRESS).count()
        if in_progress_count > 0 and not request.query_params.get("force"):
            return Response(
                {
                    "detail": f"Hay {in_progress_count} estudiante(s) rindiendo este examen. Usa ?force=true para despublicar de todos modos.",
                    "in_progress_count": in_progress_count,
                },
                status=status.HTTP_409_CONFLICT,
            )
        exam.is_published = False
        exam.save(update_fields=["is_published"])
        return Response({"status": "unpublished", "in_progress_count": in_progress_count})

    @action(detail=True, methods=["post"], url_path="extend-time")
    def extend_time(self, request, pk=None):
        """Extend time for all IN_PROGRESS attempts on this exam."""
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        exam = self.get_object()
        extra_minutes = request.data.get("extra_minutes")
        if extra_minutes is None:
            return Response({"error": "extra_minutes is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            extra_minutes = int(extra_minutes)
            if extra_minutes < 0 or extra_minutes > 120:
                raise ValueError
        except (ValueError, TypeError):
            return Response({"error": "extra_minutes must be an integer between 0 and 120."}, status=status.HTTP_400_BAD_REQUEST)

        count = Attempt.objects.filter(
            exam=exam, status=Attempt.Status.IN_PROGRESS
        ).update(extra_time_minutes=F("extra_time_minutes") + extra_minutes)

        logger.info("Extended exam time", extra={"exam_id": str(exam.id), "extra_minutes": extra_minutes, "extended": count})
        return Response({"extended": count})

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        """Archive the exam — hides it from lists and unpublishes it."""
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        exam = self.get_object()
        in_progress_count = Attempt.objects.filter(exam=exam, status=Attempt.Status.IN_PROGRESS).count()
        if in_progress_count > 0 and not request.query_params.get("force"):
            return Response(
                {
                    "detail": f"Hay {in_progress_count} estudiante(s) rindiendo este examen. Usa ?force=true para archivar de todos modos.",
                    "in_progress_count": in_progress_count,
                },
                status=status.HTTP_409_CONFLICT,
            )
        exam.archived = True
        exam.is_published = False
        exam.save(update_fields=["archived", "is_published"])
        self._invalidate_dashboard_cache(request.user.organization_id)
        return Response({"status": "archived", "in_progress_count": in_progress_count})

    @action(detail=True, methods=["post"], url_path="unarchive")
    def unarchive(self, request, pk=None):
        """Unarchive the exam."""
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        exam = self.get_object()
        exam.archived = False
        exam.save(update_fields=["archived"])
        return Response({"status": "unarchived"})

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        """Clone an exam (draft, same questions, no slug collision)."""
        if request.user.role not in ("TEACHER", "ADMIN"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        exam = self.get_object()
        new_exam = Exam.objects.create(
            organization=exam.organization,
            created_by=request.user,
            title=f"Copia de {exam.title}"[:255],
            description=exam.description,
            duration_minutes=exam.duration_minutes,
            show_score=exam.show_score,
            show_answers=exam.show_answers,
            show_explanations=exam.show_explanations,
            block_tab_switch=exam.block_tab_switch,
            course=exam.course,
            is_published=False,
        )
        eq_list = exam.exam_questions.select_related("question").order_by("order")
        ExamQuestion.objects.bulk_create([
            ExamQuestion(exam=new_exam, question=eq.question, order=eq.order, points=eq.points)
            for eq in eq_list
        ])
        self._invalidate_dashboard_cache(request.user.organization_id)
        return Response(
            ExamSerializer(new_exam, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="import",
            permission_classes=[permissions.IsAuthenticated, IsTeacherOrAdmin])
    def import_exam(self, request):
        """Import questions from CSV/XLSX and create an exam in one shot. ?dry_run=true for preview."""
        from services.import_service import ImportService
        from services.exceptions import ImportFileFormatError, ImportFileTooLargeError, ImportValidationError

        if not request.user.organization:
            return Response({"error": "No organization assigned."}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        import os
        allowed_exts = {".csv", ".xlsx"}
        ext = os.path.splitext(file.name)[1].lower()
        if ext not in allowed_exts:
            return Response({"error": f"Tipo de archivo no permitido. Usa: {', '.join(allowed_exts)}."}, status=status.HTTP_400_BAD_REQUEST)

        dry_run = request.query_params.get("dry_run", "").lower() in ("true", "1", "yes")
        service = ImportService()

        try:
            if dry_run:
                result = service.dry_run(file)
                return Response(result.to_dict())

            # Modo: agregar a un examen existente (exam_id) o crear uno nuevo (title).
            exam_id = (request.data.get("exam_id") or "").strip()
            target_exam = None
            if exam_id:
                try:
                    target_exam = Exam.objects.get(
                        id=exam_id, organization=request.user.organization
                    )
                except (Exam.DoesNotExist, ValueError, ValidationError):
                    return Response({"error": "El examen indicado no existe."}, status=status.HTTP_404_NOT_FOUND)
            else:
                title = request.data.get("title", "").strip()
                if len(title) < 3:
                    return Response({"error": "El título debe tener al menos 3 caracteres."}, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                # Tolerante: importa las preguntas válidas y reporta las inválidas
                # (no bloquea todo el examen por unas pocas filas con error).
                result = service.process_file(
                    file, request.user.organization, request.user, skip_invalid=True
                )

                if target_exam is None:
                    target_exam = Exam.objects.create(
                        organization=request.user.organization,
                        created_by=request.user,
                        title=title,
                        is_published=False,
                    )

                questions = list(
                    Question.objects.filter(
                        id__in=result.question_ids,
                        organization=request.user.organization,
                        is_active=True,
                    ).order_by("id")
                )

                # Dedup por enunciado: contra las preguntas ya en el examen y dentro
                # del propio lote. Las duplicadas no se enlazan y se borran del banco.
                def _norm(text):
                    return " ".join((text or "").split()).strip().lower()

                seen = {
                    _norm(t) for t in ExamQuestion.objects
                    .filter(exam=target_exam)
                    .values_list("question__question_text", flat=True)
                }
                order = ExamQuestion.objects.filter(exam=target_exam).aggregate(m=Max("order"))["m"] or 0

                to_link, dup_ids = [], []
                for q in questions:
                    key = _norm(q.question_text)
                    if key in seen:
                        dup_ids.append(q.id)
                        continue
                    seen.add(key)
                    order += 1
                    to_link.append(ExamQuestion(exam=target_exam, question=q, order=order, points=1.0))

                ExamQuestion.objects.bulk_create(to_link)
                if dup_ids:
                    Question.objects.filter(id__in=dup_ids).delete()

            return Response({
                **result.to_dict(),
                "questions_created": len(to_link),
                "exam_id": str(target_exam.id),
                "exam_title": target_exam.title,
                "appended": bool(exam_id),
                "added": len(to_link),
                "duplicates": len(dup_ids),
            }, status=status.HTTP_201_CREATED)

        except ImportValidationError as exc:
            return Response({"success": False, "errors": exc.errors}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except (ImportFileFormatError, ImportFileTooLargeError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception("Error in import_exam", extra={"user_id": str(request.user.id), "error": str(exc)})
            return Response({"error": "An unexpected error occurred. Please try again later."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["get"], url_path="compare",
            permission_classes=[permissions.IsAuthenticated, IsTeacherOrAdmin])
    def compare(self, request):
        """Aggregate stats for multiple exams. ?ids=uuid1,uuid2,uuid3"""
        ids_raw = request.query_params.get("ids", "")
        exam_ids = [i.strip() for i in ids_raw.split(",") if i.strip()]
        if not exam_ids:
            return Response({"error": "ids param required (comma-separated UUIDs)."}, status=status.HTTP_400_BAD_REQUEST)

        exams = Exam.objects.filter(
            id__in=exam_ids, organization=request.user.organization
        )
        if not exams.exists():
            return Response({"error": "No exams found."}, status=status.HTTP_404_NOT_FOUND)

        result = []
        for exam in exams:
            completed = Attempt.objects.filter(exam=exam, status=Attempt.Status.COMPLETED)
            agg = completed.aggregate(avg=Avg("score"), total=Count("id"))
            pass_count = completed.filter(score__gte=PASS_THRESHOLD).count()
            pass_rate = (pass_count / agg["total"] * 100) if agg["total"] else None

            buckets = [0, 5, 8, 11, 15, 20]
            distribution = []
            for low, high in zip(buckets, buckets[1:]):
                # Final bucket is inclusive so a perfect score (20) is counted.
                if high == buckets[-1]:
                    cnt = completed.filter(score__gte=low, score__lte=high).count()
                else:
                    cnt = completed.filter(score__gte=low, score__lt=high).count()
                distribution.append({"range": f"{low}-{high}", "count": cnt})

            from django.db.models import IntegerField, Value
            from django.db.models.expressions import RawSQL
            from django.db.models.functions import Coalesce
            top_failed_qs = (
                Question.objects.filter(
                    exam_questions__exam=exam,
                    organization=request.user.organization,
                )
                .annotate(
                    _total=Coalesce(
                        RawSQL(
                            "(SELECT COUNT(*) FROM exams_attemptanswer aa"
                            " JOIN exams_attempt a ON a.id = aa.attempt_id"
                            " WHERE aa.question_id = \"exams_question\".\"id\""
                            " AND a.exam_id = %s"
                            " AND a.status = 'COMPLETED' AND aa.is_final = true)",
                            [str(exam.id)],
                            output_field=IntegerField(),
                        ),
                        Value(0),
                    ),
                    _wrong=Coalesce(
                        RawSQL(
                            "(SELECT COUNT(*) FROM exams_attemptanswer aa"
                            " JOIN exams_attempt a ON a.id = aa.attempt_id"
                            " WHERE aa.question_id = \"exams_question\".\"id\""
                            " AND a.exam_id = %s"
                            " AND a.status = 'COMPLETED' AND aa.is_final = true"
                            " AND CASE WHEN \"exams_question\".\"metadata\" ? 'correct_keys' THEN"
                            "   coalesce((SELECT array_agg(upper(x) ORDER BY x)"
                            "             FROM jsonb_array_elements_text("
                            "               CASE WHEN jsonb_typeof(aa.answer_data->'selected_keys') = 'array' THEN aa.answer_data->'selected_keys' ELSE '[]'::jsonb END"
                            "             ) x),"
                            "            ARRAY[]::text[])"
                            "   IS DISTINCT FROM"
                            "   coalesce((SELECT array_agg(upper(x) ORDER BY x)"
                            "             FROM jsonb_array_elements_text("
                            "               CASE WHEN jsonb_typeof(\"exams_question\".\"metadata\"->'correct_keys') = 'array' THEN \"exams_question\".\"metadata\"->'correct_keys' ELSE '[]'::jsonb END"
                            "             ) x),"
                            "            ARRAY[]::text[])"
                            " ELSE"
                            "   upper(aa.answer_data->>'selected_key') IS DISTINCT FROM"
                            "   upper(\"exams_question\".\"metadata\"->>'correct_key')"
                            " END)",
                            [str(exam.id)],
                            output_field=IntegerField(),
                        ),
                        Value(0),
                    ),
                )
                .filter(_total__gt=0)
                .order_by("-_wrong")[:5]
            )
            top_failed = [
                {
                    "question_id": str(q.id),
                    "question_text": q.question_text[:120],
                    "error_rate": round(q._wrong / q._total * 100, 1),
                    "total_answers": q._total,
                    "category": q.metadata.get("category") or q.metadata.get("topic"),
                }
                for q in top_failed_qs
            ]

            result.append({
                "exam_id": str(exam.id),
                "exam_title": exam.title,
                "attempt_count": agg["total"],
                "avg_score": float(agg["avg"]) if agg["avg"] else None,
                "pass_rate": pass_rate,
                "distribution": distribution,
                "top_failed_questions": top_failed,
            })

        return Response(result)

    @action(detail=True, methods=["get"], url_path="monitoring",
            permission_classes=[permissions.IsAuthenticated, IsTeacherOrAdmin])
    def monitoring(self, request, pk=None):
        """Live monitoring: list of IN_PROGRESS attempts for this exam."""
        from django.core.cache import cache

        exam = self.get_object()
        attempts = (
            Attempt.objects.filter(exam=exam, status=Attempt.Status.IN_PROGRESS)
            .select_related("user", "student", "snapshot")
            .prefetch_related("saved_answers", "proctoring_events")
            .order_by("-started_at")
        )
        attempt_ids = list(attempts.values_list("id", flat=True))
        heartbeat_keys = [f"{HEARTBEAT_PREFIX}{aid}" for aid in attempt_ids]
        try:
            heartbeat_map = cache.get_many(heartbeat_keys) if heartbeat_keys else {}
        except Exception:
            logger.warning("Redis unavailable during monitoring heartbeat fetch; returning empty heartbeats")
            heartbeat_map = {}
        serializer = MonitoringAttemptSerializer(
            attempts, many=True, context={"heartbeat_map": heartbeat_map, "heartbeat_prefix": HEARTBEAT_PREFIX}
        )

        completed_count = Attempt.objects.filter(
            exam=exam, status=Attempt.Status.COMPLETED
        ).count()

        recent_events_qs = (
            ProctoringEvent.objects
            .filter(attempt__exam=exam)
            .select_related("attempt__student", "attempt__user")
            .order_by("-created_at")[:20]
        )
        recent_events = []
        for ev in recent_events_qs:
            att = ev.attempt
            name = (
                f"{att.student.first_name} {att.student.last_name}"
                if att.student_id
                else att.user.get_full_name() or att.user.username
            )
            recent_events.append({
                "id": str(ev.id),
                "event_type": ev.event_type,
                "participant_name": name,
                "created_at": ev.created_at.isoformat(),
            })

        return Response({
            "exam_id": str(exam.id),
            "exam_title": exam.title,
            "exam_duration_minutes": exam.duration_minutes,
            "live_count": attempts.count(),
            "completed_count": completed_count,
            "attempts": serializer.data,
            "recent_events": recent_events,
        })


class ExamPublicInfoView(APIView):
    """
    GET /api/v1/auth/exam-info/?slug=<slug>
    GET /api/v1/exams/public/<slug>/
    Returns minimal public exam metadata for the student login page.
    No authentication required.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug=None):
        slug = slug or request.query_params.get("slug", "").strip()
        if not slug:
            return Response({"error": "slug is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            exam = Exam.objects.prefetch_related("exam_questions").get(slug=slug, is_published=True, archived=False)
        except Exam.DoesNotExist:
            return Response({"error": "Exam not found or not published."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "id": str(exam.id),
            "title": exam.title,
            "slug": exam.slug,
            "duration_minutes": exam.duration_minutes,
            "questions_count": exam.exam_questions.count(),
            "course_name": exam.course.name if exam.course_id else None,
        })


class ExamTemplatesView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get(self, request):
        qs = ExamTemplate.objects.filter(
            Q(is_default=True) | Q(organization=request.user.organization)
        ).order_by("-is_default", "name")
        serializer = ExamTemplateSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ExamTemplateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(
            organization=request.user.organization,
            created_by=request.user,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ExamTemplateDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def _get_tpl(self, pk, org):
        try:
            return ExamTemplate.objects.filter(Q(is_default=True) | Q(organization=org)).get(pk=pk)
        except ExamTemplate.DoesNotExist:
            return None

    def get(self, request, pk):
        tpl = self._get_tpl(pk, request.user.organization)
        if not tpl:
            return Response({"error": "Plantilla no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ExamTemplateSerializer(tpl).data)

    def patch(self, request, pk):
        tpl = self._get_tpl(pk, request.user.organization)
        if not tpl:
            return Response({"error": "Plantilla no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        if tpl.is_default:
            return Response({"error": "No se pueden editar plantillas predeterminadas."}, status=status.HTTP_403_FORBIDDEN)
        serializer = ExamTemplateSerializer(tpl, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        tpl = self._get_tpl(pk, request.user.organization)
        if not tpl:
            return Response({"error": "Plantilla no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        if tpl.is_default:
            return Response({"error": "No se pueden eliminar plantillas predeterminadas."}, status=status.HTTP_403_FORBIDDEN)
        tpl.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExamTemplateInstantiateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def post(self, request, template_id):
        try:
            tpl = ExamTemplate.objects.filter(
                Q(is_default=True) | Q(organization=request.user.organization)
            ).get(id=str(template_id))
        except ExamTemplate.DoesNotExist:
            return Response({"error": "Plantilla no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.organization:
            return Response({"error": "No organization assigned."}, status=status.HTTP_400_BAD_REQUEST)
        exam = Exam.objects.create(
            organization=request.user.organization,
            created_by=request.user,
            title=tpl.name,
            duration_minutes=tpl.duration_minutes,
            is_published=False,
        )
        return Response(ExamSerializer(exam, context={"request": request}).data, status=status.HTTP_201_CREATED)