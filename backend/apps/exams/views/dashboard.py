import logging
from datetime import timedelta

from django.core.cache import cache
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .mixins import IsTeacherOrAdmin
from ..models import Attempt, Exam, Question

logger = logging.getLogger("edutest")


def _resolve_attempt_name(attempt):
    """Nombre del participante del intento, sea alumno o usuario docente."""
    if attempt.student_id and attempt.student:
        s = attempt.student
        full = f"{s.first_name} {s.last_name}".strip()
        return full or s.code
    if attempt.user_id and attempt.user:
        return attempt.user.get_full_name() or attempt.user.username
    return "—"


def _resolve_attempt_email(attempt):
    if attempt.student_id and attempt.student:
        return attempt.student.email or ""
    if attempt.user_id and attempt.user:
        return attempt.user.email or ""
    return ""


class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get(self, request):
        org = request.user.organization
        course_id = request.query_params.get("course_id")
        period = request.query_params.get("period", "30d")

        if not org:
            return Response({
                "total_exams": 0,
                "total_attempts": 0,
                "avg_score": None,
                "pass_rate": None,
                "exams_breakdown": [],
                "recent_attempts": [],
                "total_students": 0,
                "abandonment_rate": None,
                "avg_time_minutes": None,
                "exams_draft_count": 0,
                "top_course_by_attempts": None,
                "delta_avg_score": None,
                "delta_pass_rate": None,
                "delta_abandonment_rate": None,
            })

        cache_key = f"dashboard_stats_{org.id}_{course_id or 'all'}_{period}"
        try:
            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached)
        except Exception:
            logger.warning("Redis unavailable during dashboard fetch; computing fresh data")

        exam_filter = Q(organization=org)
        attempt_filter = Q(organization=org)
        student_filter = Q(organization=org)

        if course_id:
            exam_filter &= Q(course_id=course_id)
            attempt_filter &= Q(student__course_id=course_id)
            student_filter &= Q(course_id=course_id)

        # Period filtering
        period_days = {"7d": 7, "30d": 30, "90d": 90}.get(period)
        now = timezone.now()
        if period_days:
            current_start = now - timedelta(days=period_days)
            prev_start = current_start - timedelta(days=period_days)
            period_q = Q(completed_at__gte=current_start)
            prev_period_q = Q(completed_at__gte=prev_start, completed_at__lt=current_start)
        else:
            period_q = Q()
            prev_period_q = None

        total_exams = Exam.objects.filter(exam_filter).count()

        # Draft exams
        exams_draft_count = Exam.objects.filter(
            exam_filter, is_published=False, archived=False
        ).count()

        # Students
        from ..models import Student
        total_students = Student.objects.filter(student_filter).count()

        # Attempts aggregation
        completed_q = attempt_filter & Q(status=Attempt.Status.COMPLETED) & period_q
        agg = Attempt.objects.filter(completed_q).aggregate(
            total=Count("id"),
            avg=Avg("score"),
            pass_count=Count("id", filter=Q(score__gte=11)),
        )
        total_attempts = agg["total"]
        avg_score = float(agg["avg"]) if agg["avg"] else None
        pass_rate = (agg["pass_count"] / total_attempts * 100) if total_attempts > 0 else None

        # Abandonment rate (period-filtered)
        all_attempts_count = Attempt.objects.filter(attempt_filter & period_q).count()
        abandoned_count = Attempt.objects.filter(
            attempt_filter & period_q, status=Attempt.Status.ABANDONED
        ).count()
        abandonment_rate = (
            (abandoned_count / all_attempts_count * 100) if all_attempts_count > 0 else None
        )

        # Delta vs previous period
        delta_avg_score = None
        delta_pass_rate = None
        delta_abandonment_rate = None
        if prev_period_q is not None:
            prev_completed_q = attempt_filter & Q(status=Attempt.Status.COMPLETED) & prev_period_q
            prev_agg = Attempt.objects.filter(prev_completed_q).aggregate(
                total=Count("id"),
                avg=Avg("score"),
                pass_count=Count("id", filter=Q(score__gte=11)),
            )
            prev_total = prev_agg["total"]
            if prev_total > 0:
                prev_avg = float(prev_agg["avg"]) if prev_agg["avg"] else None
                prev_pass = (prev_agg["pass_count"] / prev_total * 100)
                if avg_score is not None and prev_avg is not None:
                    delta_avg_score = round(avg_score - prev_avg, 1)
                if pass_rate is not None:
                    delta_pass_rate = round(pass_rate - prev_pass, 1)
            prev_all = Attempt.objects.filter(attempt_filter & prev_period_q).count()
            if prev_all > 0:
                prev_aband = Attempt.objects.filter(
                    attempt_filter & prev_period_q, status=Attempt.Status.ABANDONED
                ).count()
                prev_aband_rate = prev_aband / prev_all * 100
                if abandonment_rate is not None:
                    delta_abandonment_rate = round(abandonment_rate - prev_aband_rate, 1)

        # Average time (minutes)
        avg_duration = Attempt.objects.filter(completed_q).aggregate(
            avg=Avg(
                ExpressionWrapper(
                    F("completed_at") - F("started_at"),
                    output_field=DurationField(),
                )
            )
        )["avg"]
        if avg_duration is None:
            avg_time_minutes = None
        elif isinstance(avg_duration, timedelta):
            avg_time_minutes = round(avg_duration.total_seconds() / 60, 1)
        else:
            avg_time_minutes = round(float(avg_duration) / 60, 1)

        # Top course by attempts
        top_course = None
        if total_attempts > 0:
            top = (
                Attempt.objects.filter(completed_q)
                .values("student__course__name")
                .annotate(count=Count("id"))
                .order_by("-count")
                .first()
            )
            if top:
                top_course = {
                    "name": top["student__course__name"] or "Sin curso",
                    "count": top["count"],
                }

        completed_filter = Q(attempts__status=Attempt.Status.COMPLETED)
        exams_breakdown = [
            {
                "exam_id": str(e["id"]),
                "exam_title": e["title"],
                "attempt_count": e["attempt_count"],
                "avg_score": float(e["avg_score"]) if e["avg_score"] is not None else 0.0,
            }
            for e in Exam.objects.filter(exam_filter, is_published=True).annotate(
                attempt_count=Count("attempts", filter=completed_filter),
                avg_score=Avg("attempts__score", filter=completed_filter),
            ).values("id", "title", "attempt_count", "avg_score")
        ]

        recent_qs = (
            Attempt.objects.filter(attempt_filter, status=Attempt.Status.COMPLETED)
            .select_related("user", "student", "exam")
            .order_by("-completed_at")[:30]
        )
        recent_attempts = [
            {
                "id": str(a.id),
                "user_name": _resolve_attempt_name(a),
                "user_email": _resolve_attempt_email(a),
                "exam": a.exam.title,
                "exam_id": str(a.exam.id),
                "score": float(a.score) if a.score is not None else None,
                "status": a.status,
                "started_at": a.started_at.isoformat() if a.started_at else None,
                "completed_at": a.completed_at.isoformat() if a.completed_at else None,
                "date": a.completed_at.isoformat() if a.completed_at else a.started_at.isoformat(),
            }
            for a in recent_qs
        ]

        # ── Heatmap 7×24 ──────────────────────────────────────────────────
        from django.db.models.functions import ExtractWeekDay, ExtractHour
        heatmap_raw = (
            Attempt.objects.filter(attempt_filter, status=Attempt.Status.COMPLETED)
            .annotate(day=ExtractWeekDay("completed_at"), hour=ExtractHour("completed_at"))
            .values("day", "hour")
            .annotate(count=Count("id"))
            .values_list("day", "hour", "count")
        )
        # ExtractWeekDay: 1=Sunday…7=Saturday → convert to 0=Mon…6=Sun
        heatmap_by_hour = [
            {"day": (day - 2) % 7, "hour": hour, "count": count}
            for day, hour, count in heatmap_raw
        ]

        # ── Top failed questions ───────────────────────────────────────────────
        from django.db.models import IntegerField, Value
        from django.db.models.expressions import RawSQL
        from django.db.models.functions import Coalesce
        top_failed_qs = (
            Question.objects.filter(organization=org, is_active=True)
            .annotate(
                total_ans=Coalesce(
                    RawSQL(
                        "(SELECT COUNT(*) FROM exams_attemptanswer aa"
                        " JOIN exams_attempt a ON a.id = aa.attempt_id"
                        " WHERE aa.question_id = \"exams_question\".\"id\""
                        " AND a.status = 'COMPLETED' AND aa.is_final = true)",
                        [], output_field=IntegerField(),
                    ), Value(0),
                ),
                wrong_ans=Coalesce(
                    RawSQL(
                        "(SELECT COUNT(*) FROM exams_attemptanswer aa"
                        " JOIN exams_attempt a ON a.id = aa.attempt_id"
                        " WHERE aa.question_id = \"exams_question\".\"id\""
                        " AND a.status = 'COMPLETED' AND aa.is_final = true"
                        " AND CASE \"exams_question\".\"question_type\""
                        "   WHEN 'MULTIPLE_CHOICE' THEN CASE"
                        "     WHEN \"exams_question\".\"metadata\"->>'correct_keys' IS NOT NULL THEN"
                        "       NOT (\"exams_question\".\"metadata\"->'correct_keys' @>"
                        "         to_jsonb(aa.answer_data->>'selected_key'))"
                        "     ELSE"
                        "       aa.answer_data->>'selected_key' IS DISTINCT FROM"
                        "       (\"exams_question\".\"metadata\"->>'correct_key')"
                        "   END"
                        "   WHEN 'BOOLEAN' THEN"
                        "     lower(coalesce(aa.answer_data->>'value','false')) IN ('true','1','yes','t') IS DISTINCT FROM"
                        "     lower(coalesce(\"exams_question\".\"metadata\"->>'correct_answer','false')) IN ('true','1','yes','t')"
                        "   ELSE false END)",
                        [], output_field=IntegerField(),
                    ), Value(0),
                ),
            )
            .filter(total_ans__gt=0)
            .order_by("-wrong_ans")[:5]
        )
        top_failed_questions = [
            {
                "question_id": str(q.id),
                "question_text": q.question_text[:120],
                "error_rate": round(q.wrong_ans / q.total_ans * 100, 1),
                "total_answers": q.total_ans,
                "category": q.metadata.get("category") or q.metadata.get("topic"),
            }
            for q in top_failed_qs
        ]

        # ── Score histogram (vigesimal 0-20, 5 buckets) ───────────────────────
        hist_base = Attempt.objects.filter(
            attempt_filter, status=Attempt.Status.COMPLETED, score__isnull=False
        )
        hist = hist_base.aggregate(
            b0_4  =Count("id", filter=Q(score__gte=0,  score__lte=4)),
            b5_8  =Count("id", filter=Q(score__gte=5,  score__lte=8)),
            b9_10 =Count("id", filter=Q(score__gte=9,  score__lte=10)),
            b11_15=Count("id", filter=Q(score__gte=11, score__lte=15)),
            b16_20=Count("id", filter=Q(score__gte=16, score__lte=20)),
        )
        score_histogram = [
            {"label": "0–4",   "min": 0,  "max": 4,  "count": hist["b0_4"]},
            {"label": "5–8",   "min": 5,  "max": 8,  "count": hist["b5_8"]},
            {"label": "9–10",  "min": 9,  "max": 10, "count": hist["b9_10"]},
            {"label": "11–15", "min": 11, "max": 15, "count": hist["b11_15"]},
            {"label": "16–20", "min": 16, "max": 20, "count": hist["b16_20"]},
        ]

        payload = {
            "total_exams": total_exams,
            "total_attempts": total_attempts,
            "avg_score": avg_score,
            "pass_rate": pass_rate,
            "exams_breakdown": exams_breakdown,
            "recent_attempts": recent_attempts,
            "heatmap_by_hour": heatmap_by_hour,
            "top_failed_questions": top_failed_questions,
            "score_histogram": score_histogram,
            "total_students": total_students,
            "abandonment_rate": abandonment_rate,
            "avg_time_minutes": avg_time_minutes,
            "exams_draft_count": exams_draft_count,
            "top_course_by_attempts": top_course,
            "delta_avg_score": delta_avg_score,
            "delta_pass_rate": delta_pass_rate,
            "delta_abandonment_rate": delta_abandonment_rate,
        }
        try:
            cache.set(cache_key, payload, timeout=300)
        except Exception:
            logger.warning("Redis unavailable during dashboard cache write; skipping")
        return Response(payload)


class DashboardLiveView(APIView):
    """Real-time dashboard data (no caching)."""

    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get(self, request):
        org = request.user.organization
        if not org:
            return Response({
                "live_attempts": 0,
                "exams_in_progress": 0,
                "proctoring_alerts_24h": 0,
                "abandoned_today": 0,
                "latest_attempts": [],
            })

        course_id = request.query_params.get("course_id")

        attempts_qs = Attempt.objects.filter(organization=org, status=Attempt.Status.IN_PROGRESS)
        from ..models import ProctoringEvent
        proctoring_qs = ProctoringEvent.objects.filter(attempt__organization=org)
        abandoned_qs = Attempt.objects.filter(organization=org, status=Attempt.Status.ABANDONED)

        if course_id:
            attempts_qs = attempts_qs.filter(student__course_id=course_id)
            proctoring_qs = proctoring_qs.filter(attempt__student__course_id=course_id)
            abandoned_qs = abandoned_qs.filter(student__course_id=course_id)

        live_attempts = attempts_qs.count()
        exams_in_progress = attempts_qs.values("exam_id").distinct().count()

        since_24h = timezone.now() - timedelta(hours=24)
        proctoring_alerts_24h = proctoring_qs.filter(created_at__gte=since_24h).count()

        today = timezone.now().date()
        abandoned_today = abandoned_qs.filter(completed_at__date=today).count()

        latest = (
            attempts_qs.select_related("exam", "student", "user", "snapshot")
            .annotate(saved_answers_count=Count("saved_answers"))
            .order_by("-started_at")[:10]
        )

        # Batch heartbeat lookups
        from services.attempt_service import HEARTBEAT_PREFIX
        attempt_ids = list(latest.values_list("id", flat=True))
        heartbeat_keys = [f"{HEARTBEAT_PREFIX}{aid}" for aid in attempt_ids]
        try:
            heartbeat_map = cache.get_many(heartbeat_keys) if heartbeat_keys else {}
        except Exception:
            logger.warning("Redis unavailable during live dashboard heartbeat fetch; returning empty heartbeats")
            heartbeat_map = {}

        latest_attempts = []
        for att in latest:
            # An IN_PROGRESS attempt should always have a snapshot, but guard against
            # a null/missing one rather than raising a 500 on the live dashboard.
            snapshot_data = att.snapshot.snapshot_data if att.snapshot_id else {}
            total = len(snapshot_data.get("questions", []))
            answered = att.saved_answers_count
            name = (
                f"{att.student.first_name} {att.student.last_name}"
                if att.student_id
                else (att.user.get_full_name() or att.user.username)
            )
            hb = heartbeat_map.get(f"{HEARTBEAT_PREFIX}{att.id}")
            latest_attempts.append({
                "id": str(att.id),
                "exam_title": att.exam.title,
                "student_name": name,
                "started_at": att.started_at.isoformat(),
                "progress": {"answered": answered, "total": total},
                "last_heartbeat": hb if isinstance(hb, str) else (hb.isoformat() if hasattr(hb, "isoformat") else None),
            })

        return Response({
            "live_attempts": live_attempts,
            "exams_in_progress": exams_in_progress,
            "proctoring_alerts_24h": proctoring_alerts_24h,
            "abandoned_today": abandoned_today,
            "latest_attempts": latest_attempts,
        })


class SparklineView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get(self, request):
        from django.db.models.functions import TruncDate

        org = request.user.organization
        if not org:
            return Response({"attempts": [], "avg_score": []})

        try:
            days = int(request.query_params.get("days", 30))
        except (ValueError, TypeError):
            days = 30
        days = days if days in (7, 30, 90) else 30

        cache_key = f"dashboard_sparkline_{org.id}_{days}"
        try:
            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached)
        except Exception:
            logger.warning("Redis unavailable during sparkline fetch; computing fresh data")

        today = timezone.now().date()
        start = today - timedelta(days=days - 1)

        daily = (
            Attempt.objects.filter(
                organization=org,
                status=Attempt.Status.COMPLETED,
                completed_at__date__gte=start,
            )
            .annotate(day=TruncDate("completed_at"))
            .values("day")
            .annotate(count=Count("id"), avg=Avg("score"))
            .order_by("day")
        )

        data_by_day = {row["day"]: row for row in daily}
        attempts_series, score_series = [], []
        for i in range(days):
            d = start + timedelta(days=i)
            row = data_by_day.get(d)
            attempts_series.append(row["count"] if row else 0)
            score_series.append(float(row["avg"]) if row and row["avg"] else None)

        payload = {"attempts": attempts_series, "avg_score": score_series}
        try:
            cache.set(cache_key, payload, timeout=300)
        except Exception:
            logger.warning("Redis unavailable during sparkline cache write; skipping")
        return Response(payload)


class HeatmapView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get(self, request):
        from django.db.models.functions import ExtractWeekDay, ExtractHour
        org = request.user.organization
        if not org:
            return Response([])
        heatmap_raw = (
            Attempt.objects.filter(organization=org, status=Attempt.Status.COMPLETED)
            .annotate(day=ExtractWeekDay("completed_at"), hour=ExtractHour("completed_at"))
            .values("day", "hour")
            .annotate(count=Count("id"))
            .values_list("day", "hour", "count")
        )
        return Response([
            {"day": (day - 2) % 7, "hour": hour, "count": count}
            for day, hour, count in heatmap_raw
        ])


class TopQuestionsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get(self, request):
        from django.db.models import IntegerField, Value
        from django.db.models.expressions import RawSQL
        from django.db.models.functions import Coalesce
        org = request.user.organization
        if not org:
            return Response([])
        top_qs = (
            Question.objects.filter(organization=org, is_active=True)
            .annotate(
                total_ans=Coalesce(
                    RawSQL(
                        "(SELECT COUNT(*) FROM exams_attemptanswer aa"
                        " JOIN exams_attempt a ON a.id = aa.attempt_id"
                        " WHERE aa.question_id = \"exams_question\".\"id\""
                        " AND a.status = 'COMPLETED' AND aa.is_final = true)",
                        [], output_field=IntegerField(),
                    ), Value(0),
                ),
                wrong_ans=Coalesce(
                    RawSQL(
                        "(SELECT COUNT(*) FROM exams_attemptanswer aa"
                        " JOIN exams_attempt a ON a.id = aa.attempt_id"
                        " WHERE aa.question_id = \"exams_question\".\"id\""
                        " AND a.status = 'COMPLETED' AND aa.is_final = true"
                        " AND CASE \"exams_question\".\"question_type\""
                        "   WHEN 'MULTIPLE_CHOICE' THEN"
                        "     aa.answer_data->>'selected_key' IS DISTINCT FROM"
                        "     (\"exams_question\".\"metadata\"->>'correct_key')"
                        "   WHEN 'BOOLEAN' THEN"
                        "     lower(coalesce(aa.answer_data->>'value','false')) IN ('true','1','yes','t') IS DISTINCT FROM"
                        "     lower(coalesce(\"exams_question\".\"metadata\"->>'correct_answer','false')) IN ('true','1','yes','t')"
                        "   ELSE false END)",
                        [], output_field=IntegerField(),
                    ), Value(0),
                ),
            )
            .filter(total_ans__gt=0)
            .order_by("-wrong_ans")[:10]
        )
        return Response([
            {
                "question_id": str(q.id),
                "question_text": q.question_text[:120],
                "error_rate": round(q.wrong_ans / q.total_ans * 100, 1),
                "total_answers": q.total_ans,
                "category": q.metadata.get("category") or q.metadata.get("topic"),
            }
            for q in top_qs
        ])