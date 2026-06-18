"""
EduTest Pro — DRF Serializers
"""

import logging

from django.contrib.auth import get_user_model
from django.db.models import Prefetch, Q
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    Attempt, AttemptAnswer, Course, Exam, ExamQuestion,
    ExamSnapshot, ExamTemplate, ImportJob, Organization, Question, Student,
)

User = get_user_model()
logger = logging.getLogger("edutest")


# ── Auth ──────────────────────────────────────────────────────────────────────

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Authenticates by email OR username + password. Adds full user info to response."""

    # Accept 'email' key from the frontend (can contain email or username)
    username_field = "email"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Replace the username field with a generic char field
        self.fields.pop(User.USERNAME_FIELD, None)
        self.fields["email"] = serializers.CharField(write_only=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["role"] = user.role
        token["email"] = user.email
        if user.organization_id:
            token["organization_id"] = str(user.organization_id)
        return token

    def validate(self, attrs):
        credential = attrs.get("email", "").strip()
        password = attrs.get("password", "")

        # Look up by email if it contains @, otherwise by username
        try:
            if "@" in credential:
                user = User.objects.get(email=credential)
            else:
                user = User.objects.get(username=credential)
        except User.DoesNotExist:
            raise serializers.ValidationError({"detail": "Credenciales inválidas."})

        if not user.check_password(password):
            raise serializers.ValidationError({"detail": "Credenciales inválidas."})

        if not user.is_active:
            raise serializers.ValidationError({"detail": "Cuenta desactivada."})

        self.user = user
        refresh = self.get_token(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "organization_id": str(user.organization_id) if user.organization_id else None,
            },
        }


# ── Organization ──────────────────────────────────────────────────────────────

class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "is_active", "created_at"]
        read_only_fields = ["id", "is_active", "created_at"]


# ── User ──────────────────────────────────────────────────────────────────────

class UserSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email",
            "role", "organization", "organization_name", "date_joined",
        ]
        read_only_fields = ["id", "username", "role", "organization", "date_joined"]
        extra_kwargs = {"password": {"write_only": True}}


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["username", "email", "password", "role", "organization"]
        read_only_fields = ["role", "organization"]

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


# ── Question ──────────────────────────────────────────────────────────────────

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = [
            "id", "organization", "question_text", "question_type",
            "metadata", "version_number", "is_active", "created_at",
        ]
        read_only_fields = ["id", "version_number", "created_at", "organization", "created_by"]

    def validate_metadata(self, value):
        """Valida que correct_keys estén dentro de las opciones disponibles."""
        if not value:
            return value
        qtype = self.initial_data.get("question_type", "")
        if qtype != "MULTIPLE_CHOICE":
            return value

        options = value.get("options", [])
        option_keys = {str(o.get("key", "")).upper() for o in options if o.get("key")}

        correct_keys = value.get("correct_keys") or []
        if correct_keys:
            invalid = [k for k in correct_keys if str(k).upper() not in option_keys]
            if invalid:
                raise serializers.ValidationError(
                    f"Las respuestas correctas {invalid} no existen en las opciones disponibles ({', '.join(sorted(option_keys))})."
                )
        elif value.get("correct_key"):
            ck = str(value["correct_key"]).upper()
            if ck not in option_keys:
                raise serializers.ValidationError(
                    f"La respuesta correcta '{ck}' no existe en las opciones disponibles ({', '.join(sorted(option_keys))})."
                )

        if len(option_keys) < 2:
            raise serializers.ValidationError("Debe haber al menos 2 opciones.")

        return value

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user:
            validated_data["created_by"] = request.user
            validated_data.setdefault("organization", request.user.organization)
        return super().create(validated_data)


# ── Exam ──────────────────────────────────────────────────────────────────────

class QuestionInExamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["id", "question_text", "question_type", "metadata"]


class ExamQuestionSerializer(serializers.ModelSerializer):
    question = QuestionInExamSerializer(read_only=True)

    class Meta:
        model = ExamQuestion
        fields = ["id", "question", "order", "points"]


class ExamSerializer(serializers.ModelSerializer):
    questions_count = serializers.SerializerMethodField()
    course_name = serializers.CharField(source="course.name", read_only=True, allow_null=True)
    attempts_count = serializers.IntegerField(read_only=True, default=0)
    avg_score = serializers.FloatField(read_only=True, default=None, allow_null=True)
    last_activity_at = serializers.DateTimeField(read_only=True, default=None, allow_null=True)
    pass_rate = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            "id", "organization", "title", "description", "slug",
            "duration_minutes", "max_attempts", "is_published",
            "show_score", "show_answers", "show_explanations",
            "archived", "block_tab_switch",
            "course", "course_name",
            "questions_count", "attempts_count", "avg_score", "pass_rate",
            "last_activity_at", "created_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "organization", "created_by", "is_published", "archived"]

    def get_questions_count(self, obj):
        return obj.exam_questions.count()

    def get_pass_rate(self, obj):
        total = getattr(obj, "attempts_count", 0) or 0
        if not total:
            return None
        pass_count = getattr(obj, "pass_count", 0) or 0
        return round(pass_count / total * 100)

    def validate_course(self, value):
        if value and value.organization_id != self.context["request"].user.organization_id:
            raise serializers.ValidationError("El curso debe pertenecer a tu organización.")
        return value

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user:
            validated_data["created_by"] = request.user
            validated_data.setdefault("organization", request.user.organization)
        return super().create(validated_data)


class ExamVisibilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Exam
        fields = ["show_score", "show_answers", "show_explanations"]


class ExamDetailSerializer(ExamSerializer):
    exam_questions = ExamQuestionSerializer(many=True, read_only=True)
    snapshot = serializers.SerializerMethodField()

    class Meta(ExamSerializer.Meta):
        fields = ExamSerializer.Meta.fields + ["exam_questions", "snapshot"]

    def get_snapshot(self, obj):
        snap = obj.snapshots.first()
        if snap:
            return {"id": str(snap.id), "created_at": snap.created_at}
        return None


# ── Snapshot ──────────────────────────────────────────────────────────────────

class ExamSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamSnapshot
        fields = ["id", "exam", "snapshot_data", "created_at"]
        read_only_fields = ["id", "created_at"]


# ── Attempt ───────────────────────────────────────────────────────────────────

class AttemptSerializer(serializers.ModelSerializer):
    exam_title = serializers.CharField(source="exam.title", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = [
            "id", "exam", "exam_title", "user", "user_email", "user_name",
            "score", "status", "started_at", "completed_at", "extra_time_minutes",
        ]
        read_only_fields = ["id", "started_at", "score", "status", "completed_at", "exam", "user"]

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class AttemptAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttemptAnswer
        fields = ["id", "question_id", "answer_data", "is_final", "saved_at"]
        read_only_fields = ["id", "is_final", "saved_at"]


class SubmitExamSerializer(serializers.Serializer):
    answers = serializers.DictField(child=serializers.JSONField())

    def validate_answers(self, value):
        if len(value) > 500:
            raise serializers.ValidationError("Too many answers; maximum is 500.")
        return value


# ── ImportJob ─────────────────────────────────────────────────────────────────

class ImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportJob
        fields = [
            "id", "file_name", "status", "total_rows",
            "rows_created", "errors", "created_at", "completed_at",
        ]
        read_only_fields = [f for f in fields if f != "file_name"]


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStatsSerializer(serializers.Serializer):
    total_exams = serializers.IntegerField()
    total_attempts = serializers.IntegerField()
    avg_score = serializers.FloatField(allow_null=True)
    pass_rate = serializers.FloatField(allow_null=True)
    exams_breakdown = serializers.ListField()
    recent_attempts = serializers.ListField()


# ── Course ────────────────────────────────────────────────────────────────────

class CourseSerializer(serializers.ModelSerializer):
    students_count = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id", "name", "code", "teacher", "teacher_name",
            "organization", "students_count", "created_at",
        ]
        read_only_fields = ["id", "organization", "teacher", "created_at"]

    def get_students_count(self, obj):
        return obj.students.count()

    def get_teacher_name(self, obj):
        if not obj.teacher_id:
            return None
        return obj.teacher.get_full_name() or obj.teacher.username


# ── Student ───────────────────────────────────────────────────────────────────

class StudentSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source="course.name", read_only=True)
    full_name = serializers.SerializerMethodField()
    score_trend = serializers.SerializerMethodField()
    attempts_count = serializers.SerializerMethodField()
    avg_score = serializers.SerializerMethodField()
    last_activity_at = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id", "code", "first_name", "last_name", "full_name",
            "email", "course", "course_name", "organization", "created_at",
            "score_trend", "attempts_count", "avg_score", "last_activity_at",
        ]
        read_only_fields = ["id", "created_at", "organization"]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"

    def get_score_trend(self, obj):
        cache = getattr(obj, "recent_attempts_cache", None)
        if cache is not None:
            scores = [float(a.score) for a in cache[:5] if a.score is not None]
            return list(reversed(scores))
        return []

    def get_attempts_count(self, obj):
        cache = getattr(obj, "recent_attempts_cache", None)
        if cache is not None:
            return len(cache)
        return obj.attempts.filter(status=Attempt.Status.COMPLETED).count()

    def get_avg_score(self, obj):
        cache = getattr(obj, "recent_attempts_cache", None)
        if cache is not None:
            scores = [float(a.score) for a in cache if a.score is not None]
            return sum(scores) / len(scores) if scores else None
        from django.db.models import Avg as DjAvg
        agg = obj.attempts.filter(status=Attempt.Status.COMPLETED).aggregate(avg=DjAvg("score"))
        return float(agg["avg"]) if agg["avg"] is not None else None

    def get_last_activity_at(self, obj):
        cache = getattr(obj, "recent_attempts_cache", None)
        if cache is not None:
            return cache[0].completed_at if cache else None
        last = obj.attempts.filter(status=Attempt.Status.COMPLETED).order_by("-completed_at").first()
        return last.completed_at if last else None


class StudentBulkItemSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    email = serializers.EmailField(required=False, default="", allow_blank=True)


class StudentProfileSerializer(StudentSerializer):
    avg_score = serializers.SerializerMethodField()
    attempts_count = serializers.SerializerMethodField()
    ranking = serializers.SerializerMethodField()
    attempts = serializers.SerializerMethodField()
    topic_stats = serializers.SerializerMethodField()

    class Meta(StudentSerializer.Meta):
        fields = StudentSerializer.Meta.fields + [
            "avg_score", "attempts_count", "ranking", "attempts", "topic_stats",
        ]

    def get_avg_score(self, obj):
        from django.db.models import Avg
        agg = obj.attempts.filter(status=Attempt.Status.COMPLETED).aggregate(avg=Avg("score"))
        return float(agg["avg"]) if agg["avg"] is not None else None

    def get_attempts_count(self, obj):
        return obj.attempts.filter(status=Attempt.Status.COMPLETED).count()

    def get_ranking(self, obj):
        from django.db.models import Avg
        course_avgs = (
            Student.objects.filter(course=obj.course, organization_id=obj.organization_id)
            .annotate(avg=Avg("attempts__score", filter=Q(attempts__status=Attempt.Status.COMPLETED)))
            .order_by("-avg")
            .values_list("id", flat=True)
        )
        ids = list(course_avgs)
        try:
            return ids.index(obj.id) + 1
        except ValueError:
            return None

    def get_attempts(self, obj):
        qs = (
            obj.attempts.filter(status=Attempt.Status.COMPLETED)
            .select_related("exam")
            .order_by("-completed_at")[:20]
        )
        return [
            {
                "id": str(a.id),
                "exam_title": a.exam.title,
                "score": float(a.score) if a.score is not None else None,
                "completed_at": a.completed_at.isoformat() if a.completed_at else None,
            }
            for a in qs
        ]

    def get_topic_stats(self, obj):
        from services.exam_engine import ExamEngine
        engine = ExamEngine()
        topic_map = {}
        completed = (
            obj.attempts
            .filter(status=Attempt.Status.COMPLETED)
            .select_related("snapshot")
            .prefetch_related(
                Prefetch("saved_answers", queryset=AttemptAnswer.objects.filter(is_final=True))
            )
        )
        for attempt in completed:
            # Use the prefetched, already is_final-filtered saved_answers (a .filter()
            # here would issue a fresh query per attempt and defeat the Prefetch above).
            answers = {
                str(a.question_id): a.answer_data
                for a in attempt.saved_answers.all()
            }
            try:
                result = engine.calculate_score(attempt.snapshot, answers)
            except Exception:
                continue
            for item in result["breakdown"]:
                topic = item.get("topic") or "Sin tema"
                bucket = topic_map.setdefault(topic, {"correct": 0, "total": 0})
                bucket["total"] += 1
                if item["is_correct"]:
                    bucket["correct"] += 1
        return [
            {
                "topic": t,
                "total": v["total"],
                "correct": v["correct"],
                "error_rate": round((1 - v["correct"] / v["total"]) * 100, 1) if v["total"] > 0 else 0.0,
            }
            for t, v in sorted(topic_map.items(), key=lambda x: -x[1]["total"])
        ]


# ── Exam Template ─────────────────────────────────────────────────────────────

class ExamTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = ExamTemplate
        fields = [
            "id", "organization", "name", "description",
            "duration_minutes", "questions_count", "passing_threshold",
            "is_default", "created_by", "created_by_name", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ── Question Bank ─────────────────────────────────────────────────────────────

class QuestionBankSerializer(serializers.ModelSerializer):
    usage_count = serializers.IntegerField(read_only=True, default=0)
    error_rate = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            "id", "question_text", "question_type", "metadata",
            "usage_count", "error_rate", "category",
            "version_number", "is_active", "created_at",
        ]
        read_only_fields = ["id", "version_number", "created_at"]

    def get_category(self, obj):
        return obj.metadata.get("category") or obj.metadata.get("topic")

    def get_error_rate(self, obj):
        if obj.question_type == "SHORT_ANSWER":
            return None
        total = getattr(obj, "_total_answers", None)
        if not total:
            return None
        wrong = getattr(obj, "_wrong_answers", 0)
        return round(wrong / total * 100, 1)


# ── Attempt Detail ────────────────────────────────────────────────────────────

class AttemptAnswerDetailSerializer(serializers.Serializer):
    question_id = serializers.UUIDField()
    question_text = serializers.CharField()
    question_type = serializers.CharField()
    topic = serializers.CharField(allow_null=True, allow_blank=True)
    correct_answer = serializers.JSONField()
    student_answer = serializers.JSONField(allow_null=True)
    is_correct = serializers.BooleanField(allow_null=True)
    explanation = serializers.CharField(allow_null=True, allow_blank=True)
    time_spent = serializers.IntegerField(allow_null=True)  # seconds from attempt start to last save


class AttemptDetailSerializer(AttemptSerializer):
    answers = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    weak_topics = serializers.SerializerMethodField()

    class Meta(AttemptSerializer.Meta):
        fields = AttemptSerializer.Meta.fields + ["answers", "student_name", "weak_topics"]

    def get_student_name(self, obj):
        if obj.student_id:
            return f"{obj.student.first_name} {obj.student.last_name}"
        return obj.user.get_full_name() or obj.user.username

    def get_answers(self, obj):
        from services.exam_engine import ExamEngine
        final_answers = list(obj.saved_answers.filter(is_final=True))
        saved = {str(a.question_id): a.answer_data for a in final_answers}
        saved_at_map = {str(a.question_id): a.saved_at for a in final_answers}
        engine = ExamEngine()
        try:
            result = engine.calculate_score(obj.snapshot, saved)
        except Exception:
            logger.exception("Error calculating score in AttemptDetailSerializer.get_answers")
            return []
        items = []
        for item in result["breakdown"]:
            q_id = str(item["question_id"])
            time_spent = None
            if q_id in saved_at_map and obj.started_at:
                delta = (saved_at_map[q_id] - obj.started_at).total_seconds()
                time_spent = max(0, round(delta))
            meta = item.get("metadata", {})
            correct_answer_obj = {}
            if item["question_type"] == "MULTIPLE_CHOICE":
                correct_keys = meta.get("correct_keys")
                if correct_keys:
                    correct_answer_obj = {"correct_keys": correct_keys}
                elif meta.get("correct_key"):
                    correct_answer_obj = {"correct_key": meta["correct_key"]}
            elif item["question_type"] == "BOOLEAN":
                correct_answer_obj = {"value": meta.get("correct_answer", False)}
            else:
                correct_answer_obj = meta.get("correct_answer", "")

            items.append({
                "question_id": item["question_id"],
                "question_text": item["question_text"],
                "question_type": item["question_type"],
                "topic": item.get("topic", ""),
                "correct_answer": correct_answer_obj,
                "student_answer": item.get("your_answer"),
                "is_correct": item["is_correct"],
                "explanation": item.get("explanation", ""),
                "time_spent": time_spent,
            })
        return AttemptAnswerDetailSerializer(items, many=True).data

    def get_weak_topics(self, obj):
        from services.exam_engine import ExamEngine
        saved = {str(a.question_id): a.answer_data for a in obj.saved_answers.filter(is_final=True)}
        engine = ExamEngine()
        try:
            result = engine.calculate_score(obj.snapshot, saved)
        except Exception:
            logger.exception("Error calculating score in AttemptDetailSerializer.get_weak_topics")
            return []
        topic_errors: dict = {}
        for item in result["breakdown"]:
            if not item["is_correct"] and item.get("topic"):
                t = item["topic"]
                topic_errors[t] = topic_errors.get(t, 0) + 1
        return [{"topic": t, "errors": c} for t, c in sorted(topic_errors.items(), key=lambda x: -x[1])]


# ── Monitoring ────────────────────────────────────────────────────────────────

class MonitoringAttemptSerializer(serializers.ModelSerializer):
    participant_name = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    last_heartbeat = serializers.SerializerMethodField()
    proctoring_events_count = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = [
            "id", "participant_name", "status", "started_at",
            "progress", "last_heartbeat", "proctoring_events_count",
        ]

    def get_participant_name(self, obj):
        if obj.student_id:
            return f"{obj.student.first_name} {obj.student.last_name}"
        return obj.user.get_full_name() or obj.user.username

    def get_progress(self, obj):
        questions = obj.snapshot.snapshot_data.get("questions", [])
        answered = obj.saved_answers.count()
        return {"answered": answered, "total": len(questions)}

    def get_last_heartbeat(self, obj):
        # Prefer batched cache lookups passed via serializer context
        heartbeat_map = self.context.get("heartbeat_map", {})
        key = f"{self.context.get('heartbeat_prefix', 'edutest:heartbeat:')}{obj.id}"
        return heartbeat_map.get(key)

    def get_proctoring_events_count(self, obj):
        return obj.proctoring_events.count()
