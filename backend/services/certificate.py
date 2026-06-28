"""EduTest Pro — certificate rendering context.

Builds the template context for ``exams/certificate.html`` from an Attempt.
Kept out of the view so the HTTP layer stays thin (mirrors the service-layer
pattern used elsewhere). The "passed only" gate is enforced by the view; this
module only formats values for display.
"""

from __future__ import annotations

from django.utils import timezone

from services.exam_engine import PASS_THRESHOLD, SCORE_MAX

_MONTHS_ES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)


def _format_date_es(dt) -> str:
    """'28 de junio de 2026' — locale-independent Spanish long date."""
    dt = timezone.localtime(dt) if dt else timezone.localtime(timezone.now())
    return f"{dt.day} de {_MONTHS_ES[dt.month - 1]} de {dt.year}"


def _format_score(score: float) -> str:
    """Integer if whole, one decimal otherwise (matches the .dc.html design)."""
    return str(int(score)) if score == int(score) else f"{score:.1f}"


def _verification_code(student_name: str, attempt_id, year: int) -> str:
    """Deterministic, non-secret display code: EDT-<initials>-<year>-<hash4>.

    Mirrors the reference design's hash but seeds it with the attempt id so two
    students with the same name get distinct codes.
    """
    name = (student_name or "").upper()
    initials = "".join(w[0] for w in name.split() if w)[:4] or "XXXX"
    seed = f"{name}|{attempt_id}"
    h = 0
    for ch in seed:
        h = ((h * 31) + ord(ch)) & 0xFFFF
    return f"EDT-{initials}-{year}-{h:04X}"


def build_certificate_context(attempt) -> dict:
    score = float(attempt.score) if attempt.score is not None else 0.0
    student_name = (attempt.participant_name or "").strip()
    institution = (
        attempt.organization.name
        if attempt.organization_id and attempt.organization
        else "EduTest Pro"
    )
    completed = attempt.completed_at or timezone.now()
    year = timezone.localtime(completed).year

    return {
        "student_name": student_name,
        "exam_name": attempt.exam.title if attempt.exam_id else "",
        "score": score,
        "formatted_score": _format_score(score),
        "max_score": SCORE_MAX,
        "min_approval": PASS_THRESHOLD,
        "is_approved": score >= PASS_THRESHOLD,
        "institution": institution,
        "institution_initial": (institution[:1] or "E").upper(),
        "date": _format_date_es(completed),
        "year": year,
        "ver_code": _verification_code(student_name, attempt.id, year),
    }
