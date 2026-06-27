"""
EduTest Pro — Domain Models
Complete multi-tenant exam platform models.
"""

import uuid

from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import IntegrityError, models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _


# ── Mixins ────────────────────────────────────────────────────────────────────

class TimestampMixin(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ── Organization (Tenant) ─────────────────────────────────────────────────────

class Organization(TimestampMixin):
    """Root tenant entity. All data is isolated per organization."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


# ── User ──────────────────────────────────────────────────────────────────────

class User(AbstractUser):
    """Custom user model with tenant and role support."""

    class Role(models.TextChoices):
        ADMIN = "ADMIN", _("Admin")
        TEACHER = "TEACHER", _("Teacher")
        STUDENT = "STUDENT", _("Student")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="users",
        null=True,
        blank=True,
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT, db_index=True)
    email = models.EmailField(unique=True)
    notification_prefs = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["email"]
        indexes = [
            models.Index(fields=["organization", "role"], name="user_org_role_idx"),
        ]

    def __str__(self):
        return f"{self.email} ({self.role})"


class UserIntegration(models.Model):
    """Stores per-user toggle state for external integrations."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="integrations")
    key = models.CharField(max_length=50)
    connected = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "key"],
                name="unique_user_integration",
            ),
        ]

    def __str__(self):
        return f"{self.user.email} — {self.key} ({'on' if self.connected else 'off'})"


# ── Course ────────────────────────────────────────────────────────────────────

class Course(TimestampMixin):
    """A class/group of students within an organization."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="courses")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    teacher = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="taught_courses",
        limit_choices_to={"role__in": [User.Role.TEACHER, User.Role.ADMIN]},
    )

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="unique_course_code_per_org",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.teacher_id and self.organization_id and self.teacher.organization_id != self.organization_id:
            raise ValidationError("Teacher must belong to the same organization as the course.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} — {self.name}"


# ── Student ───────────────────────────────────────────────────────────────────

class Student(TimestampMixin):
    """
    Student record within a course.
    Students do NOT have User accounts — they authenticate via code + names,
    not email/password.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="students")
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name="students")
    code = models.CharField(max_length=50)  # e.g. "A-1234"
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(blank=True, default="")

    class Meta:
        ordering = ["last_name", "first_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["course", "code"],
                name="unique_student_code_per_course",
            ),
            models.UniqueConstraint(
                fields=["organization", "code"],
                name="unique_student_code_per_org",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.course_id and self.organization_id and self.course.organization_id != self.organization_id:
            raise ValidationError("Student organization must match course organization.")

    def save(self, *args, **kwargs):
        if self.course_id and not self.organization_id:
            self.organization_id = self.course.organization_id
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.code})"


# ── Question ──────────────────────────────────────────────────────────────────

class Question(TimestampMixin):
    """Exam question with immutable versioning support."""

    class QuestionType(models.TextChoices):
        MULTIPLE_CHOICE = "MULTIPLE_CHOICE", _("Multiple Choice")
        BOOLEAN = "BOOLEAN", _("True / False")
        SHORT_ANSWER = "SHORT_ANSWER", _("Short Answer")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="questions", db_index=True)
    question_text = models.TextField()
    question_type = models.CharField(max_length=30, choices=QuestionType.choices, db_index=True)
    metadata = models.JSONField(default=dict)
    version_number = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True, db_index=True)
    parent_question = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="next_versions"
    )
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="created_questions")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "is_active"], name="question_org_active_idx"),
        ]

    def __str__(self):
        return f"[v{self.version_number}] {self.question_text[:60]}"


# ── Exam ──────────────────────────────────────────────────────────────────────

class Exam(TimestampMixin):
    """Exam definition with questions and publishing control."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="exams", db_index=True)
    course = models.ForeignKey(
        "Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="exams",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    duration_minutes = models.PositiveIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    max_attempts = models.PositiveIntegerField(null=True, blank=True, validators=[MinValueValidator(1)], help_text="Max attempts per student. Null = unlimited.")
    is_published = models.BooleanField(default=False, db_index=True)
    show_score = models.BooleanField(default=True)
    show_answers = models.BooleanField(default=True)
    show_explanations = models.BooleanField(default=True)
    archived = models.BooleanField(default=False, db_index=True)
    block_tab_switch = models.BooleanField(default=False)
    slug = models.SlugField(max_length=255, blank=True, null=True, unique=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="created_exams")
    questions = models.ManyToManyField(Question, through="ExamQuestion", related_name="exams")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "is_published"], name="exam_org_published_idx"),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.course_id and self.organization_id and self.course.organization_id != self.organization_id:
            raise ValidationError("Exam organization must match course organization.")

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:200] or "exam"
            slug = base
            qs = Exam.objects.filter(slug=slug)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                slug = f"{base[:190]}-{str(uuid.uuid4())[:8]}"
            self.slug = slug
        self.full_clean()
        for i in range(2):
            try:
                super().save(*args, **kwargs)
                return
            except IntegrityError:
                if i == 1 or not self._state.adding:
                    raise
                self.slug = f"{slugify(self.title)[:190]}-{str(uuid.uuid4())[:8]}"
                self.pk = None

    def __str__(self):
        return f"{self.title} ({'published' if self.is_published else 'draft'})"


class ExamQuestion(models.Model):
    """Through table for Exam ↔ Question M2M with ordering and points."""

    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="exam_questions")
    question = models.ForeignKey(Question, on_delete=models.PROTECT, related_name="exam_questions")
    order = models.PositiveIntegerField(default=1)
    points = models.DecimalField(max_digits=5, decimal_places=2, default=1.00, validators=[MinValueValidator(0)])

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["exam", "question"],
                name="unique_exam_question",
            ),
        ]
        ordering = ["order"]

    def __str__(self):
        return f"{self.exam.title} — Q{self.order}"


# ── ExamSnapshot ──────────────────────────────────────────────────────────────

class ExamSnapshot(models.Model):
    """Immutable snapshot of exam at the moment it is launched."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam = models.ForeignKey(Exam, on_delete=models.PROTECT, related_name="snapshots")
    snapshot_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Snapshot of '{self.exam.title}' @ {self.created_at:%Y-%m-%d %H:%M}"


# ── Attempt ───────────────────────────────────────────────────────────────────

class Attempt(models.Model):
    """A student's attempt at an exam."""

    class Status(models.TextChoices):
        IN_PROGRESS = "IN_PROGRESS", _("In Progress")
        COMPLETED = "COMPLETED", _("Completed")
        ABANDONED = "ABANDONED", _("Abandoned")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="attempts", db_index=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="attempts")
    student = models.ForeignKey(
        Student, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="attempts",
    )
    exam = models.ForeignKey(Exam, on_delete=models.PROTECT, related_name="attempts")
    snapshot = models.ForeignKey(ExamSnapshot, on_delete=models.PROTECT, related_name="attempts")
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    extra_time_minutes = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_PROGRESS, db_index=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["organization", "user", "status"], name="attempt_org_user_status_idx"),
            models.Index(fields=["exam", "status"], name="attempt_exam_status_idx"),
        ]
        constraints = [
            # Prevent duplicate IN_PROGRESS attempts for registered users
            models.UniqueConstraint(
                fields=["user", "exam"],
                condition=models.Q(status="IN_PROGRESS", student__isnull=True),
                name="unique_in_progress_user_attempt",
            ),
            # Prevent duplicate IN_PROGRESS attempts for codeless student users
            models.UniqueConstraint(
                fields=["student", "exam"],
                condition=models.Q(status="IN_PROGRESS"),
                name="unique_in_progress_student_attempt",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.organization_id and self.exam_id and self.organization_id != self.exam.organization_id:
            raise ValidationError("Attempt organization must match exam organization.")

    def save(self, *args, **kwargs):
        if self.exam_id and not self.organization_id:
            self.organization_id = self.exam.organization_id
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.email} → {self.exam.title} [{self.status}]"

    @property
    def participant_name(self):
        """Nombre del participante del intento, sea alumno (sin cuenta) o usuario docente.

        Fuente única de verdad: antes esta lógica estaba duplicada en
        exam_engine.py y dashboard.py.
        """
        if self.student_id and self.student:
            s = self.student
            full = f"{s.first_name} {s.last_name}".strip()
            return full or s.code
        if self.user_id and self.user:
            return self.user.get_full_name() or self.user.username
        return "—"


class AttemptAnswer(models.Model):
    """Partial or final answer saved during an attempt."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name="saved_answers")
    question_id = models.UUIDField(db_index=True)
    answer_data = models.JSONField()
    is_final = models.BooleanField(default=False)
    saved_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["attempt", "question_id"],
                name="unique_attempt_answer",
            ),
        ]

    def __str__(self):
        return f"Attempt({self.attempt_id}) → Q({self.question_id})"


# ── ProctoringEvent ───────────────────────────────────────────────────────────

class ProctoringEvent(models.Model):
    """Records anti-cheating events emitted during an exam attempt."""

    class EventType(models.TextChoices):
        TAB_SWITCH = "TAB_SWITCH", _("Tab Switch")
        FOCUS_LOST = "FOCUS_LOST", _("Focus Lost")
        RECONNECT  = "RECONNECT",  _("Reconnect")
        OFFLINE    = "OFFLINE",    _("Offline")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name="proctoring_events")
    event_type = models.CharField(max_length=20, choices=EventType.choices, db_index=True)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.event_type} @ {self.created_at:%Y-%m-%d %H:%M:%S} (attempt {self.attempt_id})"


class ExamTemplate(TimestampMixin):
    """Predefined exam blueprints that teachers can instantiate."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="exam_templates")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    duration_minutes = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    questions_count = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    passing_threshold = models.PositiveSmallIntegerField(
        default=60,
        help_text="Percentage 0-100",
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    is_default = models.BooleanField(default=False, db_index=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="exam_templates")

    class Meta:
        ordering = ["-is_default", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_template_name_per_org",
            ),
        ]

    def __str__(self):
        return self.name


class ImportJob(models.Model):
    """Tracks async bulk question import jobs."""

    class Status(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        PROCESSING = "PROCESSING", _("Processing")
        COMPLETED = "COMPLETED", _("Completed")
        FAILED = "FAILED", _("Failed")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="import_jobs")
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="import_jobs")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=512)
    total_rows = models.PositiveIntegerField(default=0)
    rows_created = models.PositiveIntegerField(default=0)
    errors = models.JSONField(default=list)
    celery_task_id = models.CharField(max_length=255, blank=True, default="")
    draft_token = models.UUIDField(null=True, blank=True, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.file_name} [{self.status}]"


# ── Notification ──────────────────────────────────────────────────────────────

class Notification(models.Model):
    """In-app notification record scoped to a teacher organization."""

    class Type(models.TextChoices):
        ATTEMPT_FINISHED  = "attempt_finished",  _("Attempt Finished")
        LOW_SCORE         = "low_score",          _("Low Score")
        PROCTORING_ALERT  = "proctoring_alert",   _("Proctoring Alert")
        DAILY_SUMMARY     = "daily_summary",      _("Daily Summary")
        SYSTEM            = "system",             _("System")

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="notifications", db_index=True)
    type         = models.CharField(max_length=30, choices=Type.choices, db_index=True)
    title        = models.CharField(max_length=255)
    body         = models.TextField(blank=True, default="")
    created_at   = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.type}] {self.title}"
