"""EduTest Pro — AttemptService: save answers, heartbeat."""

import logging
from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

from .exceptions import (
    AttemptNotFoundError, AttemptNotInProgressError,
    CrossTenantAccessError, InvalidQuestionForAttemptError, UnauthorizedAttemptAccessError,
)

logger = logging.getLogger("edutest.attempt")
HEARTBEAT_PREFIX = "edutest:heartbeat:"
HEARTBEAT_TTL = 1200  # 20 min minimum; actual TTL uses exam duration + buffer

# Per-question metadata keys safe to send to a student during an in-progress attempt.
# Everything else reveals the answer: correct_keys / correct_key / correct_answer /
# keywords / case_sensitive / strict_mode / explanation, plus per-option `is_correct`.
_SAFE_META_DISPLAY_KEYS = ("image", "image_url", "media", "category", "topic")


def _sanitize_question_for_student(q):
    meta = q.get("metadata") or {}
    safe_options = [
        {"key": o.get("key"), "text": o.get("text")}
        for o in (meta.get("options") or [])
    ]
    safe_meta = {"options": safe_options}
    # Preserve a multi-select hint (how many to choose, not which) without leaking keys.
    correct_keys = meta.get("correct_keys")
    if isinstance(correct_keys, list) and len(correct_keys) > 1:
        safe_meta["multiple"] = True
    for k in _SAFE_META_DISPLAY_KEYS:
        if meta.get(k) is not None:
            safe_meta[k] = meta[k]
    return {
        "question_id": q.get("question_id"),
        "question_text": q.get("question_text"),
        "question_type": q.get("question_type"),
        "order": q.get("order"),
        "points": q.get("points"),
        "metadata": safe_meta,
    }


def sanitize_snapshot_for_student(snapshot_data):
    """Strip answer-revealing fields from an ExamSnapshot before exposing it to a
    student client (the `state` endpoint and the student-login response). Scoring
    reads the correct answers server-side from the DB snapshot, never from the client."""
    if not snapshot_data:
        return snapshot_data
    data = dict(snapshot_data)
    data["questions"] = [
        _sanitize_question_for_student(q) for q in snapshot_data.get("questions", [])
    ]
    return data


class AttemptService:

    def save_answer(self, attempt_id, question_id, answer_data, user):
        import json
        MAX_ANSWER_BYTES = 10_000  # 10 KB
        if answer_data is not None:
            payload_size = len(json.dumps(answer_data))
            if payload_size > MAX_ANSWER_BYTES:
                raise ValueError("Answer too large.")

        attempt = self._get_validated(attempt_id, user)
        self._validate_question(question_id, attempt.snapshot)

        from apps.exams.models import AttemptAnswer
        obj, _ = AttemptAnswer.objects.update_or_create(
            attempt=attempt,
            question_id=question_id,
            defaults={"answer_data": answer_data or {}, "is_final": False},
        )
        return {"question_id": question_id, "saved_at": obj.saved_at.isoformat(), "is_final": False}

    def heartbeat(self, attempt_id, user):
        from apps.exams.models import Attempt
        attempt = self._get_validated(attempt_id, user, require_in_progress=False)
        now = timezone.now()
        if attempt.status == Attempt.Status.IN_PROGRESS:
            exam_secs = (attempt.exam.duration_minutes or 0) * 60
            ttl = max(HEARTBEAT_TTL, exam_secs + 600)
            cache.set(f"{HEARTBEAT_PREFIX}{attempt_id}", now.isoformat(), timeout=ttl)
        remaining = self._time_remaining(attempt)
        return {"attempt_id": attempt_id, "status": attempt.status,
                "time_remaining_seconds": remaining, "last_heartbeat": now.isoformat()}

    def get_attempt_state(self, attempt_id, user):
        attempt = self._get_validated(attempt_id, user, require_in_progress=False)
        from apps.exams.models import AttemptAnswer
        saved = {str(a.question_id): a.answer_data
                 for a in AttemptAnswer.objects.filter(attempt=attempt)}
        snapshot_data = attempt.snapshot.snapshot_data if attempt.snapshot else {}
        questions = snapshot_data.get("questions", [])
        return {
            "attempt_id": attempt_id,
            "exam_title": attempt.exam.title,
            "status": attempt.status,
            "started_at": attempt.started_at.isoformat(),
            "completed_at": attempt.completed_at.isoformat() if attempt.completed_at else None,
            "score": float(attempt.score) if attempt.score is not None else None,
            "time_remaining_seconds": self._time_remaining(attempt),
            "saved_answers": saved,
            "questions_count": len(questions),
            "answered_count": len(saved),
            "exam_snapshot": sanitize_snapshot_for_student(snapshot_data),
        }

    def detect_and_mark_abandoned(self, organization_id):
        from apps.exams.models import Attempt
        cutoff = timezone.now() - timedelta(minutes=15)
        in_progress = list(Attempt.objects.filter(
            organization_id=organization_id,
            status=Attempt.Status.IN_PROGRESS,
            started_at__lt=cutoff
        ).values_list("id", flat=True))

        if not in_progress:
            return 0

        try:
            keys = [f"{HEARTBEAT_PREFIX}{aid}" for aid in in_progress]
            values = cache.get_many(keys)
        except Exception:
            logger.warning("Redis unavailable during abandoned detection; skipping scan")
            return 0

        abandoned = [aid for aid in in_progress if f"{HEARTBEAT_PREFIX}{aid}" not in values]

        if abandoned:
            Attempt.objects.filter(
                id__in=abandoned,
                status=Attempt.Status.IN_PROGRESS,
            ).update(
                status=Attempt.Status.ABANDONED, completed_at=timezone.now()
            )
        return len(abandoned)

    def _get_validated(self, attempt_id, user, require_in_progress=True):
        from apps.exams.models import Attempt
        try:
            attempt = Attempt.objects.select_related("exam", "snapshot", "organization").get(id=attempt_id)
        except Attempt.DoesNotExist:
            raise AttemptNotFoundError(f"Attempt '{attempt_id}' not found.")

        if str(attempt.organization_id) != str(user.organization_id):
            raise CrossTenantAccessError("Cross-tenant access denied.")
        # StudentPrincipal authenticates via attempt_id claim, not user_id
        if hasattr(user, "attempt_id"):
            if str(attempt.id) != str(user.attempt_id):
                raise UnauthorizedAttemptAccessError("Not your attempt.")
        elif attempt.user_id != user.id:
            raise UnauthorizedAttemptAccessError("Not your attempt.")
        if require_in_progress and attempt.status != Attempt.Status.IN_PROGRESS:
            raise AttemptNotInProgressError(f"Attempt is {attempt.status}.")
        return attempt

    def _validate_question(self, question_id, snapshot):
        if not snapshot or not getattr(snapshot, "snapshot_data", None):
            raise InvalidQuestionForAttemptError("No exam snapshot available.")
        ids = {str(q["question_id"]) for q in snapshot.snapshot_data.get("questions", [])}
        if str(question_id) not in ids:
            raise InvalidQuestionForAttemptError(f"Question {question_id} not in snapshot.")

    def _time_remaining(self, attempt):
        if not attempt.exam.duration_minutes:
            return None
        elapsed = (timezone.now() - attempt.started_at).total_seconds()
        return max(0, int((attempt.exam.duration_minutes + (attempt.extra_time_minutes or 0)) * 60 - elapsed))
