"""EduTest Pro — ExamEngine: start, submit, score."""

import logging
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from .exceptions import (
    AttemptAlreadyCompletedError, AttemptNotFoundError, AttemptNotInProgressError,
    CrossTenantAccessError, ExamHasNoQuestionsError, ExamNotPublishedError,
    ExamTimeExpiredError, InvalidQuestionError, UnauthorizedAttemptAccessError,
)

logger = logging.getLogger("edutest.exam_engine")
TIME_GRACE_SECONDS = 30
SCORE_MAX = 20
PASS_THRESHOLD = 11


class ExamEngine:

    def start_exam(self, user, exam):
        self._validate_tenant(user, exam.organization_id)
        if not exam.is_published:
            raise ExamNotPublishedError(f"Exam '{exam.title}' is not published.")

        from apps.exams.models import Attempt
        with transaction.atomic():
            existing = (
                Attempt.objects.select_for_update()
                .filter(user=user, exam=exam, status=Attempt.Status.IN_PROGRESS)
                .first()
            )
            if existing:
                logger.info("Returning existing attempt (idempotent)", extra={"attempt_id": str(existing.id)})
                return str(existing.id)

            snapshot = self._get_or_create_snapshot(exam)
            try:
                # Nested savepoint: if the unique constraint trips, only this
                # savepoint is rolled back, leaving the outer transaction usable
                # for the follow-up query (otherwise it would raise
                # TransactionManagementError on a broken transaction).
                with transaction.atomic():
                    attempt = Attempt.objects.create(
                        organization=user.organization,
                        user=user,
                        exam=exam,
                        snapshot=snapshot,
                        status=Attempt.Status.IN_PROGRESS,
                    )
                logger.info("Attempt created", extra={"attempt_id": str(attempt.id)})
                return str(attempt.id)
            except IntegrityError:
                # Race condition: another request created the attempt concurrently.
                existing = (
                    Attempt.objects
                    .filter(user=user, exam=exam, status=Attempt.Status.IN_PROGRESS)
                    .first()
                )
                if existing:
                    logger.info("Race resolved: returning existing attempt", extra={"attempt_id": str(existing.id)})
                    return str(existing.id)
                raise

    def submit_exam(self, attempt_id, answers, user):
        from apps.exams.models import Attempt, AttemptAnswer
        with transaction.atomic():
            try:
                attempt = (
                    Attempt.objects.select_for_update(of=('self',))
                    .select_related("snapshot", "exam", "organization", "user", "student")
                    .get(id=attempt_id)
                )
            except Attempt.DoesNotExist:
                raise AttemptNotFoundError(f"Attempt '{attempt_id}' not found.")

            self._validate_tenant(user, attempt.organization_id)
            self._validate_ownership(user, attempt)

            if attempt.status == Attempt.Status.COMPLETED:
                raise AttemptAlreadyCompletedError(
                    "Attempt already completed.",
                    context={"score": float(attempt.score) if attempt.score else None},
                )

            if attempt.status != Attempt.Status.IN_PROGRESS:
                raise AttemptNotInProgressError(f"Attempt is {attempt.status}.")

            if not attempt.exam.is_published or attempt.exam.archived:
                raise ExamNotPublishedError("Este examen ya no está activo.")

            if self._is_time_expired(attempt):
                attempt.status = Attempt.Status.ABANDONED
                attempt.completed_at = timezone.now()
                attempt.save(update_fields=["status", "completed_at"])
                logger.info("Exam time expired, attempt marked abandoned",
                            extra={"attempt_id": attempt_id})
                raise ExamTimeExpiredError("Exam time has expired.")

            # Read answers from DB inside the transaction to avoid race conditions
            # with concurrent save_answer requests.
            if answers is None:
                answers = {
                    str(a.question_id): a.answer_data
                    for a in AttemptAnswer.objects.filter(attempt=attempt)
                }

            score_data = self.calculate_score(attempt.snapshot, answers)

            attempt.score = Decimal(str(score_data["score_20"])).quantize(
                Decimal("0.1"), rounding=ROUND_HALF_UP
            )
            attempt.status = Attempt.Status.COMPLETED
            attempt.completed_at = timezone.now()
            attempt.save(update_fields=["score", "status", "completed_at"])

            # Fire in-app notifications (non-blocking — failures are swallowed)
            self._notify_attempt_completed(attempt)

            # Mark all submitted answers as final and create missing ones
            self._finalize_attempt_answers(attempt, answers)

            logger.info("Exam completed", extra={
                "attempt_id": attempt_id,
                "score": float(attempt.score),
            })

            exam = attempt.exam
            settings = {
                "show_score": exam.show_score,
                "show_answers": exam.show_answers,
                "show_explanations": exam.show_explanations,
            }

            response = {
                "attempt_id": attempt_id,
                "status": "completed",
                "settings": settings,
                "student_name": (
                    f"{attempt.student.first_name} {attempt.student.last_name}"
                    if attempt.student_id
                    else (attempt.user.get_full_name() or attempt.user.username)
                ),
            }

            if settings["show_score"]:
                score_val = float(attempt.score)
                response["score"] = score_val
                response["score_max"] = SCORE_MAX
                response["passed"] = score_val >= PASS_THRESHOLD
                response["earned_points"] = score_data["earned_points"]
                response["total_points"] = score_data["total_points"]

            if settings["show_answers"]:
                breakdown_out = []
                for item in score_data["breakdown"]:
                    entry = {
                        "question_id": item["question_id"],
                        "question_text": item["question_text"],
                        "your_answer": item["your_answer"],
                        "correct_answer": item["correct_answer"],
                        "is_correct": item["is_correct"],
                        "topic": item["topic"],
                        "points_earned": item["points_earned"],
                        "points_possible": item["points_possible"],
                    }
                    if settings["show_explanations"]:
                        entry["explanation"] = item["explanation"]
                    breakdown_out.append(entry)
                response["breakdown"] = breakdown_out

                topic_errors = {}
                for item in score_data["breakdown"]:
                    if not item["is_correct"] and item["topic"]:
                        t = item["topic"]
                        topic_errors[t] = topic_errors.get(t, 0) + 1
                response["weak_topics"] = [
                    {"topic": t, "errors": c}
                    for t, c in sorted(topic_errors.items(), key=lambda x: -x[1])
                ]

            return response

    def calculate_score(self, snapshot, answers):
        questions = snapshot.snapshot_data.get("questions", [])
        total_points = earned_points = 0.0
        breakdown = []

        for q in questions:
            q_id = str(q["question_id"])
            points_possible = float(q.get("points", 1.0))
            total_points += points_possible
            student_answer = answers.get(q_id)
            is_correct = False

            if student_answer is not None:
                scorer = {
                    "MULTIPLE_CHOICE": self._score_mc,
                    "BOOLEAN": self._score_boolean,
                    "SHORT_ANSWER": self._score_short,
                }.get(q["question_type"], lambda m, a: False)
                is_correct = scorer(q["metadata"], student_answer)

            pts_earned = points_possible if is_correct else 0.0
            earned_points += pts_earned

            breakdown.append({
                "question_id": q_id,
                "question_text": q["question_text"],
                "question_type": q["question_type"],
                "topic": q["metadata"].get("topic") or q["metadata"].get("category") or "",
                "explanation": q["metadata"].get("explanation", ""),
                "metadata": q["metadata"],
                "your_answer": self._format_student_answer(q, student_answer),
                "correct_answer": self._format_correct_answer(q),
                "is_correct": is_correct,
                "points_earned": pts_earned,
                "points_possible": points_possible,
                "student_answer": student_answer,
            })

        score_20 = round((earned_points / total_points * SCORE_MAX) if total_points > 0 else 0.0, 1)
        return {
            "score_20": score_20,
            "earned_points": round(earned_points, 2),
            "total_points": round(total_points, 2),
            "breakdown": breakdown,
        }

    # ── Scoring helpers ───────────────────────────────────────────────────────

    def _score_mc(self, metadata, answer):
        if not isinstance(answer, dict):
            return False
        correct_keys = metadata.get("correct_keys") or []
        correct_set = {str(k).upper() for k in correct_keys}

        if len(correct_set) > 1:
            # Multi-select: student must pick exactly the right set
            selected_keys = answer.get("selected_keys", [])
            if not isinstance(selected_keys, list):
                return False
            return {str(k).upper() for k in selected_keys} == correct_set

        # Single-select
        selected = str(answer.get("selected_key", "")).upper()
        if correct_set:
            return selected in correct_set
        correct = str(metadata.get("correct_key", "")).upper()
        return selected == correct

    def _score_boolean(self, metadata, answer):
        correct = bool(metadata.get("correct_answer", False))
        if isinstance(answer, dict):
            val = answer.get("value", answer.get("selected", None))
        else:
            val = answer
        if isinstance(val, bool):
            return val == correct
        if isinstance(val, str):
            val_lower = val.lower()
            if val_lower in ("true", "1", "verdadero"):
                return True == correct
            if val_lower in ("false", "0", "falso"):
                return False == correct
            # Unknown string value — reject
            return False
        return False

    def _score_short(self, metadata, answer):
        if isinstance(answer, dict):
            text = str(answer.get("text", ""))
        else:
            text = str(answer)
        if not text.strip():
            return False
        keywords = metadata.get("keywords", [])
        case_sensitive = metadata.get("case_sensitive", False)
        strict = metadata.get("strict_mode", False)
        t = text if case_sensitive else text.lower()
        kws = keywords if case_sensitive else [k.lower() for k in keywords]
        if strict:
            return all(k in t for k in kws)
        return any(k in t for k in kws)

    # ── Answer formatting ─────────────────────────────────────────────────────

    def _format_student_answer(self, q, answer):
        if answer is None:
            return None
        qtype = q["question_type"]
        if qtype == "MULTIPLE_CHOICE":
            options = q["metadata"].get("options", [])
            if isinstance(answer, dict) and "selected_keys" in answer:
                keys = [str(k).upper() for k in (answer.get("selected_keys") or [])]
                if not keys:
                    return None
                parts = []
                for k in keys:
                    opt = next((o for o in options if str(o.get("key", "")).upper() == k), None)
                    parts.append(f"{k} - {opt['text']}" if opt else k)
                return ", ".join(parts)
            key = str(answer.get("selected_key", "")).upper() if isinstance(answer, dict) else ""
            if not key:
                return None
            opt = next((o for o in options if str(o.get("key", "")).upper() == key), None)
            return f"{key} - {opt['text']}" if opt else key
        if qtype == "BOOLEAN":
            val = answer.get("value", answer.get("selected")) if isinstance(answer, dict) else answer
            if val is True or (isinstance(val, str) and val.lower() in ("true", "verdadero", "1")):
                return "Verdadero"
            if val is False or (isinstance(val, str) and val.lower() in ("false", "falso", "0")):
                return "Falso"
            return str(val) if val is not None else None
        if qtype == "SHORT_ANSWER":
            return str(answer.get("text", "")) if isinstance(answer, dict) else str(answer)
        return str(answer)

    def _format_correct_answer(self, q):
        qtype = q["question_type"]
        meta = q["metadata"]
        if qtype == "MULTIPLE_CHOICE":
            options = meta.get("options", [])
            correct_keys = meta.get("correct_keys")
            if correct_keys:
                parts = []
                for ck in correct_keys:
                    opt = next((o for o in options if str(o.get("key", "")).upper() == str(ck).upper()), None)
                    parts.append(f"{ck} - {opt['text']}" if opt else str(ck))
                return ", ".join(parts)
            ck = str(meta.get("correct_key", "")).upper()
            if not ck:
                return ""
            opt = next((o for o in options if str(o.get("key", "")).upper() == ck), None)
            return f"{ck} - {opt['text']}" if opt else ck
        if qtype == "BOOLEAN":
            return "Verdadero" if meta.get("correct_answer", False) else "Falso"
        if qtype == "SHORT_ANSWER":
            keywords = meta.get("keywords", [])
            return ", ".join(keywords) if keywords else ""
        return ""

    # ── Snapshot ──────────────────────────────────────────────────────────────

    def _get_or_create_snapshot(self, exam):
        from django.db import transaction as db_transaction
        from apps.exams.models import ExamQuestion, ExamSnapshot
        with db_transaction.atomic():
            existing = (
                ExamSnapshot.objects
                .select_for_update()
                .filter(exam=exam)
                .order_by("-created_at")
                .first()
            )
            if existing:
                current_qs = list(
                    ExamQuestion.objects
                    .select_related("question")
                    .filter(exam=exam)
                    .order_by("order")
                    .values("question_id", "question__version_number", "order", "points")
                )
                current_fp = [
                    (str(r["question_id"]), r["question__version_number"], r["order"], float(r["points"]))
                    for r in current_qs
                ]
                snap_fp = [
                    (q["question_id"], q.get("version_number"), q.get("order", i), float(q.get("points", 1.0)))
                    for i, q in enumerate(existing.snapshot_data.get("questions", []))
                ]
                if current_fp == snap_fp:
                    return existing
                logger.info(
                    "Snapshot stale — creating new one",
                    extra={"exam_id": str(exam.id)},
                )

            exam_questions = ExamQuestion.objects.select_related("question").filter(exam=exam).order_by("order")
            if not exam_questions.exists():
                raise ExamHasNoQuestionsError(f"Exam '{exam.title}' has no questions.")

            questions_data = []
            for eq in exam_questions:
                meta = eq.question.metadata or {}
                qtype = eq.question.question_type
                # Validar preguntas de opción múltiple
                if qtype == "MULTIPLE_CHOICE":
                    options = meta.get("options", [])
                    option_keys = {str(o.get("key", "")).upper() for o in options if o.get("key")}
                    correct_keys = meta.get("correct_keys") or []
                    if correct_keys:
                        invalid_keys = [k for k in correct_keys if str(k).upper() not in option_keys]
                        if invalid_keys:
                            raise InvalidQuestionError(
                                f"Pregunta '{eq.question.question_text[:40]}...' tiene respuestas correctas inválidas: {', '.join(invalid_keys)}. "
                                f"Opciones disponibles: {', '.join(sorted(option_keys))}"
                            )
                    # Si no hay correct_keys pero hay correct_key, validarlo también
                    elif meta.get("correct_key"):
                        ck = str(meta["correct_key"]).upper()
                        if ck not in option_keys:
                            raise InvalidQuestionError(
                                f"Pregunta '{eq.question.question_text[:40]}...' tiene respuesta correcta inválida: {ck}. "
                                f"Opciones disponibles: {', '.join(sorted(option_keys))}"
                            )
                    # Validar que haya al menos 2 opciones
                    if len(option_keys) < 2:
                        raise InvalidQuestionError(
                            f"Pregunta '{eq.question.question_text[:40]}...' debe tener al menos 2 opciones."
                        )

                questions_data.append({
                    "question_id": str(eq.question.id),
                    "version_number": eq.question.version_number,
                    "question_text": eq.question.question_text,
                    "question_type": qtype,
                    "order": eq.order,
                    "points": float(eq.points),
                    "metadata": meta,
                })

            snapshot_data = {
                "exam_id": str(exam.id),
                "exam_title": exam.title,
                "duration_minutes": exam.duration_minutes,
                "captured_at": timezone.now().isoformat(),
                "questions": questions_data,
            }
            return ExamSnapshot.objects.create(exam=exam, snapshot_data=snapshot_data)

    # ── Validation ────────────────────────────────────────────────────────────

    def _finalize_attempt_answers(self, attempt, answers):
        """Mark existing answers as final and create missing ones from the submitted dict."""
        from apps.exams.models import AttemptAnswer
        existing = {
            str(a.question_id): a
            for a in AttemptAnswer.objects.filter(attempt=attempt)
        }
        to_create = []
        for qid, data in answers.items():
            ans = existing.get(str(qid))
            if ans:
                if not ans.is_final:
                    ans.is_final = True
                    ans.answer_data = data
                    ans.save(update_fields=["is_final", "answer_data", "saved_at"])
            else:
                to_create.append(AttemptAnswer(
                    attempt=attempt,
                    question_id=qid,
                    answer_data=data,
                    is_final=True,
                ))
        if to_create:
            AttemptAnswer.objects.bulk_create(to_create, ignore_conflicts=True)

    def _notify_attempt_completed(self, attempt):
        try:
            from services.notifications import create_notification
            student_name = (
                f"{attempt.student.first_name} {attempt.student.last_name}"
                if attempt.student_id
                else (attempt.user.get_full_name() or attempt.user.username)
            )
            score_val = float(attempt.score)
            create_notification(
                attempt.organization_id, "attempt_finished",
                f"Examen completado: {attempt.exam.title}",
                f"{student_name} obtuvo {score_val:.1f}/20",
            )
            if score_val < PASS_THRESHOLD:
                create_notification(
                    attempt.organization_id, "low_score",
                    f"Puntaje bajo: {attempt.exam.title}",
                    f"{student_name} reprobó con {score_val:.1f}/20",
                )
        except Exception:
            logger.exception("Failed to fire notifications for attempt %s", attempt.id)

    def _validate_tenant(self, user, resource_org_id):
        if str(user.organization_id) != str(resource_org_id):
            raise CrossTenantAccessError("Cross-tenant access denied.")

    def _validate_ownership(self, user, attempt):
        if hasattr(user, "attempt_id"):
            if str(attempt.id) != str(user.attempt_id):
                raise UnauthorizedAttemptAccessError("Not your attempt.")
        elif attempt.user_id != user.id:
            raise UnauthorizedAttemptAccessError("Not your attempt.")

    def _is_time_expired(self, attempt):
        if not attempt.exam.duration_minutes:
            return False
        elapsed = timezone.now() - attempt.started_at
        limit = timedelta(minutes=attempt.exam.duration_minutes + (attempt.extra_time_minutes or 0), seconds=TIME_GRACE_SECONDS)
        return elapsed > limit
