"""
EduTest Pro — View Tests (new endpoints)
Run with: python manage.py test apps.exams.tests
"""

import json
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from apps.exams.models import (
    Attempt, Course, Exam, ExamQuestion, ExamSnapshot,
    Organization, Question, Student, User,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_org(name="Test Org"):
    return Organization.objects.create(name=name)


def make_teacher(org, username="teacher1"):
    return User.objects.create_user(
        username=username,
        email=f"{username}@test.com",
        password="pass1234!",
        role=User.Role.TEACHER,
        organization=org,
    )


def make_course(org, teacher, name="Math 101", code="MATH101"):
    return Course.objects.create(
        organization=org, teacher=teacher, name=name, code=code,
    )


def make_student(org, course, code="A-001", first="Ana", last="Lopez"):
    return Student.objects.create(
        organization=org, course=course, code=code,
        first_name=first, last_name=last,
    )


def make_question(org, teacher):
    return Question.objects.create(
        organization=org,
        question_text="What is 2+2?",
        question_type="MULTIPLE_CHOICE",
        metadata={
            "options": [
                {"key": "A", "text": "3", "is_correct": False},
                {"key": "B", "text": "4", "is_correct": True},
            ],
            "correct_key": "B",
            "correct_keys": ["B"],
            "category": "Arithmetic",
        },
        created_by=teacher,
    )


def make_exam(org, teacher, title="Sample Exam", published=True):
    exam = Exam.objects.create(
        organization=org, created_by=teacher, title=title,
        is_published=published,
    )
    return exam


def make_snapshot(exam, question):
    data = {
        "exam_id": str(exam.id),
        "questions": [
            {
                "question_id": str(question.id),
                "question_text": question.question_text,
                "question_type": question.question_type,
                "metadata": question.metadata,
                "points": 1.0,
            }
        ],
    }
    return ExamSnapshot.objects.create(exam=exam, snapshot_data=data)


def make_attempt(org, user, exam, snapshot, student=None):
    return Attempt.objects.create(
        organization=org, user=user, exam=exam, snapshot=snapshot,
        status=Attempt.Status.IN_PROGRESS, student=student,
    )


# ── Student Login ─────────────────────────────────────────────────────────────

class StudentLoginViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.course = make_course(self.org, self.teacher)
        self.student = make_student(self.org, self.course)
        self.exam = make_exam(self.org, self.teacher)
        self.question = make_question(self.org, self.teacher)
        ExamQuestion.objects.create(exam=self.exam, question=self.question, order=1)
        self.url = "/api/v1/auth/student/login/"

    def test_login_success(self):
        resp = self.client.post(self.url, {
            "exam_slug": self.exam.slug,
            "code": "A-001",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("attempt_id", resp.data)
        self.assertIn("attempt_token", resp.data)
        self.assertIn("exam_snapshot", resp.data)

    def test_login_wrong_code(self):
        resp = self.client.post(self.url, {
            "exam_slug": self.exam.slug,
            "code": "NONEXISTENT",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_unpublished_exam(self):
        draft = make_exam(self.org, self.teacher, title="Draft", published=False)
        resp = self.client.post(self.url, {
            "exam_slug": draft.slug,
            "code": "A-001",
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_login_missing_fields(self):
        resp = self.client.post(self.url, {"exam_slug": self.exam.slug}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_idempotent(self):
        """Second login returns the same IN_PROGRESS attempt."""
        payload = {
            "exam_slug": self.exam.slug,
            "code": "A-001",
            "first_name": "Ana",
            "last_name": "Lopez",
        }
        r1 = self.client.post(self.url, payload, format="json")
        r2 = self.client.post(self.url, payload, format="json")
        self.assertEqual(r1.data["attempt_id"], r2.data["attempt_id"])


# ── Course CRUD ───────────────────────────────────────────────────────────────

class CourseViewSetTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.client.force_authenticate(user=self.teacher)
        self.list_url = "/api/v1/courses/"

    def test_list_empty(self):
        resp = self.client.get(self.list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_create_course(self):
        resp = self.client.post(self.list_url, {
            "name": "Physics 101",
            "code": "PHY101",
            "teacher": str(self.teacher.id),
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["code"], "PHY101")
        self.assertEqual(resp.data["students_count"], 0)

    def test_create_duplicate_code(self):
        make_course(self.org, self.teacher, code="DUP")
        resp = self.client.post(self.list_url, {
            "name": "Dup Course",
            "code": "DUP",
            "teacher": str(self.teacher.id),
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_course(self):
        course = make_course(self.org, self.teacher)
        resp = self.client.patch(
            f"{self.list_url}{course.id}/", {"name": "Math 202"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["name"], "Math 202")

    def test_other_org_teacher_cannot_see(self):
        org2 = make_org("Org 2")
        teacher2 = make_teacher(org2, "teacher2")
        course = make_course(self.org, self.teacher)
        self.client.force_authenticate(user=teacher2)
        resp = self.client.get(f"{self.list_url}{course.id}/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# ── Student CRUD + Bulk ───────────────────────────────────────────────────────

class StudentViewSetTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.course = make_course(self.org, self.teacher)
        self.client.force_authenticate(user=self.teacher)
        self.list_url = "/api/v1/students/"

    def test_create_student(self):
        resp = self.client.post(self.list_url, {
            "code": "10000001",
            "first_name": "Luis",
            "last_name": "Ramirez",
            "course": str(self.course.id),
            "organization": str(self.org.id),
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_filter_by_course(self):
        make_student(self.org, self.course, code="C-001")
        course2 = make_course(self.org, self.teacher, code="SC2")
        make_student(self.org, course2, code="D-001")
        resp = self.client.get(self.list_url, {"course_id": str(self.course.id)})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        self.assertEqual(len(results), 1)

    def test_search(self):
        make_student(self.org, self.course, code="E-001", first="Carlos")
        make_student(self.org, self.course, code="E-002", first="Maria")
        resp = self.client.get(self.list_url, {"search": "Carlos"})
        results = resp.data.get("results", resp.data)
        self.assertEqual(len(results), 1)

    def test_bulk_import(self):
        resp = self.client.post(
            f"{self.list_url}bulk/",
            {
                "course_id": str(self.course.id),
                "students": [
                    {"code": "10000010", "first_name": "Uno", "last_name": "Uno"},
                    {"code": "10000011", "first_name": "Dos", "last_name": "Dos"},
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["created"], 2)
        self.assertEqual(resp.data["skipped"], [])

    def test_bulk_skips_duplicates(self):
        make_student(self.org, self.course, code="20000001")
        resp = self.client.post(
            f"{self.list_url}bulk/",
            {
                "course_id": str(self.course.id),
                "students": [
                    {"code": "20000001", "first_name": "X", "last_name": "Y"},
                    {"code": "20000002", "first_name": "A", "last_name": "B"},
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["created"], 1)
        self.assertIn("20000001", resp.data["skipped"])

    def test_profile(self):
        student = make_student(self.org, self.course)
        resp = self.client.get(f"{self.list_url}{student.id}/profile/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("avg_score", resp.data)
        self.assertIn("attempts_count", resp.data)
        self.assertIn("ranking", resp.data)

    def test_report_card_json(self):
        student = make_student(self.org, self.course)
        resp = self.client.get(f"{self.list_url}{student.id}/report-card/", {"output": "json"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_report_card_pdf(self):
        student = make_student(self.org, self.course)
        resp = self.client.get(f"{self.list_url}{student.id}/report-card/", {"output": "pdf"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "application/pdf")


# ── Question Bank Filters ─────────────────────────────────────────────────────

class QuestionBankFilterTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.client.force_authenticate(user=self.teacher)
        self.url = "/api/v1/questions/"

    def _make_q(self, text="Q?", category=None):
        meta = {
            "correct_key": "A", "correct_keys": ["A"],
            "options": [{"key": "A", "text": "X", "is_correct": True}],
        }
        if category:
            meta["category"] = category
        return Question.objects.create(
            organization=self.org, created_by=self.teacher,
            question_text=text, question_type="MULTIPLE_CHOICE", metadata=meta,
        )

    def test_list_includes_usage_count(self):
        self._make_q()
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        self.assertIn("usage_count", results[0])

    def test_filter_by_topic(self):
        self._make_q("Q about Redes", category="Redes")
        self._make_q("Q about Math", category="Math")
        resp = self.client.get(self.url, {"topic": "Redes"})
        results = resp.data.get("results", resp.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["category"], "Redes")

    def test_filter_by_search(self):
        self._make_q("Question about Python")
        self._make_q("Question about Java")
        resp = self.client.get(self.url, {"search": "Python"})
        results = resp.data.get("results", resp.data)
        self.assertEqual(len(results), 1)

    def test_filter_by_min_usage(self):
        q = self._make_q("Used question")
        exam = make_exam(self.org, self.teacher)
        ExamQuestion.objects.create(exam=exam, question=q, order=1)
        self._make_q("Unused question")
        resp = self.client.get(self.url, {"min_usage": "1"})
        results = resp.data.get("results", resp.data)
        self.assertEqual(len(results), 1)


# ── Exam Compare ──────────────────────────────────────────────────────────────

class ExamCompareTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.client.force_authenticate(user=self.teacher)
        self.url = "/api/v1/exams/compare/"

    def test_compare_requires_ids(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_compare_returns_stats(self):
        e1 = make_exam(self.org, self.teacher, "Exam 1")
        e2 = make_exam(self.org, self.teacher, "Exam 2")
        resp = self.client.get(self.url, {"ids": f"{e1.id},{e2.id}"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 2)
        first = resp.data[0]
        self.assertIn("avg_score", first)
        self.assertIn("pass_rate", first)
        self.assertIn("distribution", first)
        self.assertEqual(len(first["distribution"]), 5)  # 5 buckets

    def test_compare_cross_org_excluded(self):
        org2 = make_org("Org 2")
        teacher2 = make_teacher(org2, "t2")
        e_other = make_exam(org2, teacher2, "Other Org Exam")
        e_own = make_exam(self.org, self.teacher, "Own Exam")
        resp = self.client.get(self.url, {"ids": f"{e_own.id},{e_other.id}"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)


# ── Monitoring ────────────────────────────────────────────────────────────────

class MonitoringTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.course = make_course(self.org, self.teacher)
        self.student = make_student(self.org, self.course)
        self.exam = make_exam(self.org, self.teacher)
        self.question = make_question(self.org, self.teacher)
        ExamQuestion.objects.create(exam=self.exam, question=self.question, order=1)
        self.snapshot = make_snapshot(self.exam, self.question)
        self.client.force_authenticate(user=self.teacher)

    def test_monitoring_no_attempts(self):
        resp = self.client.get(f"/api/v1/exams/{self.exam.id}/monitoring/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["live_count"], 0)

    def test_monitoring_shows_in_progress(self):
        guest, _ = User.objects.get_or_create(
            username=f"__student_guest_{self.org.id}__",
            defaults={
                "email": f"guest@{self.org.id}.internal",
                "organization": self.org,
                "role": User.Role.STUDENT,
                "is_active": False,
            },
        )
        make_attempt(self.org, guest, self.exam, self.snapshot, student=self.student)
        resp = self.client.get(f"/api/v1/exams/{self.exam.id}/monitoring/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["live_count"], 1)
        attempt_data = resp.data["attempts"][0]
        self.assertIn("progress", attempt_data)
        self.assertIn("proctoring_events_count", attempt_data)


# ── Attempt Detail ────────────────────────────────────────────────────────────

class AttemptDetailTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.exam = make_exam(self.org, self.teacher)
        self.question = make_question(self.org, self.teacher)
        ExamQuestion.objects.create(exam=self.exam, question=self.question, order=1)
        self.snapshot = make_snapshot(self.exam, self.question)
        self.client.force_authenticate(user=self.teacher)

    def test_attempt_detail_shows_answers(self):
        from apps.exams.models import AttemptAnswer
        attempt = make_attempt(self.org, self.teacher, self.exam, self.snapshot)
        AttemptAnswer.objects.create(
            attempt=attempt,
            question_id=self.question.id,
            answer_data={"selected_key": "B"},
            is_final=True,
        )
        attempt.status = Attempt.Status.COMPLETED
        attempt.score = 100
        attempt.save(update_fields=["status", "score"])

        resp = self.client.get(f"/api/v1/attempts/{attempt.id}/detail/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("answers", resp.data)
        self.assertEqual(len(resp.data["answers"]), 1)
        answer = resp.data["answers"][0]
        self.assertIn("is_correct", answer)
        self.assertIn("correct_answer", answer)


# ── time_spent in attempt detail ─────────────────────────────────────────────

class TimeSpentTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.exam = make_exam(self.org, self.teacher)
        self.question = make_question(self.org, self.teacher)
        ExamQuestion.objects.create(exam=self.exam, question=self.question, order=1)
        self.snapshot = make_snapshot(self.exam, self.question)
        self.client.force_authenticate(user=self.teacher)

    def test_attempt_detail_includes_time_spent(self):
        from apps.exams.models import AttemptAnswer
        attempt = make_attempt(self.org, self.teacher, self.exam, self.snapshot)
        AttemptAnswer.objects.create(
            attempt=attempt,
            question_id=self.question.id,
            answer_data={"selected_key": "B"},
            is_final=True,
        )
        attempt.status = Attempt.Status.COMPLETED
        attempt.score = 100
        attempt.save(update_fields=["status", "score"])

        resp = self.client.get(f"/api/v1/attempts/{attempt.id}/detail/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        answer = resp.data["answers"][0]
        self.assertIn("time_spent", answer)
        ts = answer["time_spent"]
        self.assertTrue(ts is None or isinstance(ts, int))

    def test_unanswered_question_has_null_time_spent(self):
        attempt = make_attempt(self.org, self.teacher, self.exam, self.snapshot)
        attempt.status = Attempt.Status.COMPLETED
        attempt.score = 0
        attempt.save(update_fields=["status", "score"])

        resp = self.client.get(f"/api/v1/attempts/{attempt.id}/detail/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNone(resp.data["answers"][0]["time_spent"])


# ── top_failed_questions in compare ──────────────────────────────────────────

class CompareTopFailedTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.client.force_authenticate(user=self.teacher)
        self.url = "/api/v1/exams/compare/"

    def test_compare_includes_top_failed_questions_field(self):
        exam = make_exam(self.org, self.teacher, "Exam TF")
        resp = self.client.get(self.url, {"ids": str(exam.id)})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("top_failed_questions", resp.data[0])
        self.assertIsInstance(resp.data[0]["top_failed_questions"], list)

    def test_compare_top_failed_populated_after_wrong_answers(self):
        from apps.exams.models import AttemptAnswer
        exam = make_exam(self.org, self.teacher, "Exam TF2")
        question = make_question(self.org, self.teacher)
        ExamQuestion.objects.create(exam=exam, question=question, order=1)
        snapshot = make_snapshot(exam, question)

        attempt = make_attempt(self.org, self.teacher, exam, snapshot)
        AttemptAnswer.objects.create(
            attempt=attempt,
            question_id=question.id,
            answer_data={"selected_key": "A"},  # wrong — correct is B
            is_final=True,
        )
        attempt.status = Attempt.Status.COMPLETED
        attempt.score = 0
        attempt.save(update_fields=["status", "score"])

        resp = self.client.get(self.url, {"ids": str(exam.id)})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        top_failed = resp.data[0]["top_failed_questions"]
        self.assertEqual(len(top_failed), 1)
        self.assertIn("error_rate", top_failed[0])
        self.assertEqual(top_failed[0]["error_rate"], 100.0)


# ── topic_stats in student profile ───────────────────────────────────────────

class TopicStatsTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.course = make_course(self.org, self.teacher)
        self.client.force_authenticate(user=self.teacher)

    def _make_guest(self):
        guest, _ = User.objects.get_or_create(
            username=f"__student_guest_{self.org.id}__",
            defaults={
                "email": f"guest@{self.org.id}.internal",
                "organization": self.org,
                "role": User.Role.STUDENT,
                "is_active": False,
            },
        )
        return guest

    def test_profile_topic_stats_empty_without_attempts(self):
        student = make_student(self.org, self.course)
        resp = self.client.get(f"/api/v1/students/{student.id}/profile/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsInstance(resp.data["topic_stats"], list)
        self.assertEqual(len(resp.data["topic_stats"]), 0)

    def test_profile_topic_stats_computed_from_attempts(self):
        from apps.exams.models import AttemptAnswer
        student = make_student(self.org, self.course)
        question = make_question(self.org, self.teacher)
        exam = make_exam(self.org, self.teacher)
        ExamQuestion.objects.create(exam=exam, question=question, order=1)
        snapshot = make_snapshot(exam, question)

        attempt = make_attempt(self.org, self._make_guest(), exam, snapshot, student=student)
        AttemptAnswer.objects.create(
            attempt=attempt,
            question_id=question.id,
            answer_data={"selected_key": "B"},  # correct
            is_final=True,
        )
        attempt.status = Attempt.Status.COMPLETED
        attempt.score = 100
        attempt.save(update_fields=["status", "score"])

        resp = self.client.get(f"/api/v1/students/{student.id}/profile/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        stats = resp.data["topic_stats"]
        self.assertIsInstance(stats, list)
        self.assertEqual(len(stats), 1)
        entry = stats[0]
        self.assertIn("topic", entry)
        self.assertIn("total", entry)
        self.assertIn("correct", entry)
        self.assertIn("error_rate", entry)
        self.assertEqual(entry["total"], 1)
        self.assertEqual(entry["correct"], 1)
        self.assertEqual(entry["error_rate"], 0.0)


# ── PDF report-card ───────────────────────────────────────────────────────────

class ReportCardPDFTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.course = make_course(self.org, self.teacher)
        self.client.force_authenticate(user=self.teacher)

    def test_report_card_pdf_returns_pdf_or_501(self):
        """Accepts 200+PDF or 501 if reportlab not installed."""
        student = make_student(self.org, self.course)
        resp = self.client.get(
            f"/api/v1/students/{student.id}/report-card/",
            {"output": "pdf"},
        )
        self.assertIn(resp.status_code, [status.HTTP_200_OK, status.HTTP_501_NOT_IMPLEMENTED])
        if resp.status_code == status.HTTP_200_OK:
            self.assertEqual(resp["Content-Type"], "application/pdf")
            self.assertIn("boletin_", resp["Content-Disposition"])

    def test_report_card_json_still_works(self):
        student = make_student(self.org, self.course)
        resp = self.client.get(
            f"/api/v1/students/{student.id}/report-card/",
            {"output": "json"},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("avg_score", resp.data)


# ── Dashboard Extended ────────────────────────────────────────────────────────

class DashboardExtendedTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.client.force_authenticate(user=self.teacher)

    def test_dashboard_includes_heatmap_and_top_failed(self):
        resp = self.client.get("/api/v1/dashboard/stats/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("heatmap_by_hour", resp.data)
        self.assertIn("top_failed_questions", resp.data)
        self.assertIsInstance(resp.data["heatmap_by_hour"], list)
        self.assertIsInstance(resp.data["top_failed_questions"], list)


class SnapshotSanitizationTest(TestCase):
    """The student-facing exam snapshot (state endpoint + student login) must never
    expose correct answers."""

    def _snapshot(self):
        return {
            "exam_title": "T",
            "questions": [
                {
                    "question_id": "q1", "question_text": "Capital?",
                    "question_type": "MULTIPLE_CHOICE", "order": 1, "points": 1.0,
                    "metadata": {
                        "options": [
                            {"key": "A", "text": "Lima", "is_correct": True},
                            {"key": "B", "text": "Cusco", "is_correct": False},
                        ],
                        "correct_keys": ["A"], "explanation": "Lima es la capital", "topic": "Geo",
                    },
                },
                {
                    "question_id": "q2", "question_text": "2+2=4?",
                    "question_type": "TRUE_FALSE", "order": 2, "points": 1.0,
                    "metadata": {"correct_answer": True, "explanation": "si"},
                },
                {
                    "question_id": "q3", "question_text": "Define X",
                    "question_type": "SHORT_ANSWER", "order": 3, "points": 1.0,
                    "metadata": {"keywords": ["clave"], "case_sensitive": False, "strict_mode": True},
                },
                {
                    "question_id": "q4", "question_text": "Multi",
                    "question_type": "MULTIPLE_CHOICE", "order": 4, "points": 1.0,
                    "metadata": {
                        "options": [
                            {"key": "A", "text": "a", "is_correct": True},
                            {"key": "B", "text": "b", "is_correct": True},
                        ],
                        "correct_keys": ["A", "B"],
                    },
                },
            ],
        }

    def test_sanitized_snapshot_hides_all_answer_fields(self):
        from services.attempt_service import sanitize_snapshot_for_student
        out = sanitize_snapshot_for_student(self._snapshot())
        blob = json.dumps(out)
        for leaked in ("is_correct", "correct_keys", "correct_answer", "keywords",
                       "case_sensitive", "strict_mode", "explanation", "Lima es la capital"):
            self.assertNotIn(leaked, blob, f"answer field leaked: {leaked}")

    def test_sanitized_snapshot_keeps_display_data(self):
        from services.attempt_service import sanitize_snapshot_for_student
        out = sanitize_snapshot_for_student(self._snapshot())
        q1 = out["questions"][0]
        self.assertEqual(q1["question_text"], "Capital?")
        self.assertEqual(
            q1["metadata"]["options"],
            [{"key": "A", "text": "Lima"}, {"key": "B", "text": "Cusco"}],
        )
        self.assertEqual(q1["metadata"].get("topic"), "Geo")
        # Multi-answer questions keep a non-revealing "choose more than one" hint.
        self.assertTrue(out["questions"][3]["metadata"].get("multiple"))


# ── Certificate endpoint ──────────────────────────────────────────────────────

class CertificateEndpointTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = make_org()
        self.teacher = make_teacher(self.org)
        self.exam = make_exam(self.org, self.teacher)
        self.question = make_question(self.org, self.teacher)
        ExamQuestion.objects.create(exam=self.exam, question=self.question, order=1)
        self.snapshot = make_snapshot(self.exam, self.question)
        self.client.force_authenticate(user=self.teacher)

    def _attempt(self, *, status_value=Attempt.Status.COMPLETED, score=16):
        attempt = make_attempt(self.org, self.teacher, self.exam, self.snapshot)
        attempt.status = status_value
        attempt.score = score
        attempt.save(update_fields=["status", "score"])
        return attempt

    def _url(self, attempt):
        return f"/api/v1/attempts/{attempt.id}/certificate/"

    def test_teacher_passed_attempt_returns_html(self):
        attempt = self._attempt(score=16)
        resp = self.client.get(self._url(attempt))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp["Content-Type"].startswith("text/html"))
        self.assertIn(b"Aprobado", resp.content)
        self.assertIn(b"SAMPLE EXAM", resp.content)  # exam title, uppercased

    def test_failed_attempt_forbidden(self):
        attempt = self._attempt(score=10)
        resp = self.client.get(self._url(attempt))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_in_progress_attempt_forbidden(self):
        attempt = self._attempt(status_value=Attempt.Status.IN_PROGRESS, score=16)
        resp = self.client.get(self._url(attempt))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_org_teacher_cannot_access(self):
        attempt = self._attempt(score=16)
        other_org = make_org("Other Org")
        other_teacher = make_teacher(other_org, username="teacher2")
        other = APIClient()
        other.force_authenticate(user=other_teacher)
        resp = other.get(self._url(attempt))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_certificate_token_grants_only_certificate_access(self):
        from apps.exams.auth import CertificateToken
        attempt = self._attempt(score=16)
        token = str(CertificateToken.for_attempt(attempt))
        anon = APIClient()  # no session — relies solely on the certificate token
        resp = anon.get(self._url(attempt), HTTP_AUTHORIZATION=f"Certificate {token}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # The same token must NOT authorize any other attempt endpoint.
        state = anon.get(
            f"/api/v1/attempts/{attempt.id}/state/",
            HTTP_AUTHORIZATION=f"Certificate {token}",
        )
        self.assertNotEqual(state.status_code, status.HTTP_200_OK)
