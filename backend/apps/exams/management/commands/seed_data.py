"""Management command: seed demo data."""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone


class Command(BaseCommand):
    help = "Seed demo organization, questions, exam, and attempts"

    def handle(self, *args, **options):
        from apps.exams.models import (
            Attempt, AttemptAnswer, Exam, ExamQuestion,
            ExamSnapshot, Organization, Question, User,
        )

        with transaction.atomic():
            # ── Organization ──────────────────────────────────────────────────
            org, org_created = Organization.objects.get_or_create(name="Demo Organization")
            self.stdout.write(f"{'Created' if org_created else 'Found'} org: {org.name}")

            # ── Admin user ────────────────────────────────────────────────────
            admin = User.objects.filter(is_superuser=True).first()
            if admin:
                changed = []
                if admin.organization_id != org.id:
                    admin.organization = org
                    changed.append("organization")
                if admin.role != "ADMIN":
                    admin.role = "ADMIN"
                    changed.append("role")
                if changed:
                    admin.save(update_fields=changed)
                    self.stdout.write(f"Updated admin {admin.username}: {', '.join(changed)}")
                else:
                    self.stdout.write(f"Admin already configured: {admin.username}")
            else:
                admin = User.objects.create_superuser(
                    username="admin",
                    email="admin@demo.com",
                    password="Admin1234!",
                    organization=org,
                    role="ADMIN",
                )
                self.stdout.write(f"Created admin: {admin.username}")

            # ── Student user ──────────────────────────────────────────────────
            student, s_created = User.objects.get_or_create(
                username="student1",
                defaults={
                    "email": "student1@demo.com",
                    "organization": org,
                    "role": "STUDENT",
                },
            )
            if s_created:
                student.set_password("Student1234!")
                student.save()
            elif student.organization_id != org.id:
                student.organization = org
                student.save(update_fields=["organization"])
            self.stdout.write(f"{'Created' if s_created else 'Found'} student: {student.username}")

            # ── Questions ─────────────────────────────────────────────────────
            questions_spec = [
                {
                    "text": "¿Cuál es el modelo de referencia que describe las comunicaciones de red en 7 capas?",
                    "type": "MULTIPLE_CHOICE",
                    "metadata": {
                        "options": [
                            {"key": "A", "text": "TCP/IP", "is_correct": False},
                            {"key": "B", "text": "OSI", "is_correct": True},
                            {"key": "C", "text": "IEEE 802.11", "is_correct": False},
                            {"key": "D", "text": "HTTP/HTTPS", "is_correct": False},
                        ],
                        "correct_key": "B",
                        "category": "Redes",
                        "explanation": "El modelo OSI define 7 capas: física, enlace de datos, red, transporte, sesión, presentación y aplicación.",
                    },
                },
                {
                    "text": "¿Qué protocolo asigna direcciones IP dinámicamente en una red?",
                    "type": "MULTIPLE_CHOICE",
                    "metadata": {
                        "options": [
                            {"key": "A", "text": "DNS", "is_correct": False},
                            {"key": "B", "text": "FTP", "is_correct": False},
                            {"key": "C", "text": "DHCP", "is_correct": True},
                            {"key": "D", "text": "SMTP", "is_correct": False},
                        ],
                        "correct_key": "C",
                        "category": "Protocolos",
                        "explanation": "DHCP asigna automáticamente direcciones IP y parámetros de red a los dispositivos.",
                    },
                },
                {
                    "text": "¿En qué capa del modelo OSI opera el protocolo IP?",
                    "type": "MULTIPLE_CHOICE",
                    "metadata": {
                        "options": [
                            {"key": "A", "text": "Capa 2 — Enlace de datos", "is_correct": False},
                            {"key": "B", "text": "Capa 3 — Red", "is_correct": True},
                            {"key": "C", "text": "Capa 4 — Transporte", "is_correct": False},
                            {"key": "D", "text": "Capa 7 — Aplicación", "is_correct": False},
                        ],
                        "correct_key": "B",
                        "category": "Modelo OSI",
                        "explanation": "IP opera en la capa 3 (Red), responsable del enrutamiento de paquetes entre redes.",
                    },
                },
                {
                    "text": "TCP garantiza la entrega ordenada y sin errores de los datos.",
                    "type": "BOOLEAN",
                    "metadata": {
                        "correct_answer": True,
                        "category": "Protocolos",
                        "explanation": "TCP establece conexión orientada, verifica errores y reenvía paquetes perdidos.",
                    },
                },
                {
                    "text": "¿Cuántos bits tiene una dirección IPv4?",
                    "type": "MULTIPLE_CHOICE",
                    "metadata": {
                        "options": [
                            {"key": "A", "text": "16 bits", "is_correct": False},
                            {"key": "B", "text": "32 bits", "is_correct": True},
                            {"key": "C", "text": "64 bits", "is_correct": False},
                            {"key": "D", "text": "128 bits", "is_correct": False},
                        ],
                        "correct_key": "B",
                        "category": "Direccionamiento",
                        "explanation": "IPv4 usa 32 bits, expresados en notación decimal con puntos (ej. 192.168.1.1).",
                    },
                },
            ]

            questions = []
            for spec in questions_spec:
                q, created = Question.objects.get_or_create(
                    organization=org,
                    question_text=spec["text"],
                    defaults={
                        "question_type": spec["type"],
                        "metadata": spec["metadata"],
                        "version_number": 1,
                        "is_active": True,
                        "created_by": admin,
                    },
                )
                questions.append(q)
                if created:
                    self.stdout.write(f"  + Q: {q.question_text[:55]}…")
            self.stdout.write(f"Questions ready: {len(questions)}")

            # ── Exam ──────────────────────────────────────────────────────────
            exam, e_created = Exam.objects.get_or_create(
                organization=org,
                title="Fundamentos de Redes",
                defaults={
                    "description": "Examen básico sobre conceptos de redes de computadoras.",
                    "duration_minutes": 30,
                    "is_published": True,
                    "created_by": admin,
                },
            )
            if not e_created and not exam.is_published:
                exam.is_published = True
                exam.save(update_fields=["is_published"])
            self.stdout.write(f"{'Created' if e_created else 'Found'} exam: {exam.title}")

            for order, q in enumerate(questions, start=1):
                ExamQuestion.objects.get_or_create(
                    exam=exam, question=q,
                    defaults={"order": order, "points": 1.0},
                )

            # ── ExamSnapshot ──────────────────────────────────────────────────
            snap_data = {
                "exam_id": str(exam.id),
                "title": exam.title,
                "duration_minutes": exam.duration_minutes,
                "questions": [
                    {
                        "question_id": str(q.id),
                        "question_text": q.question_text,
                        "question_type": q.question_type,
                        "points": 1.0,
                        "metadata": q.metadata,
                    }
                    for q in questions
                ],
            }
            snapshot, snap_created = ExamSnapshot.objects.get_or_create(
                exam=exam,
                defaults={"snapshot_data": snap_data},
            )
            if not snap_created:
                snapshot.snapshot_data = snap_data
                snapshot.save(update_fields=["snapshot_data"])
            self.stdout.write(f"{'Created' if snap_created else 'Updated'} snapshot")

            # ── Attempts ──────────────────────────────────────────────────────
            self._seed_attempt(org, student, exam, snapshot, score=80.0,
                               correct_idx={0, 1, 2, 4}, label="80%",
                               delta_days=3, questions=questions)
            self._seed_attempt(org, student, exam, snapshot, score=60.0,
                               correct_idx={0, 2, 3}, label="60%",
                               delta_days=1, questions=questions)

        self.stdout.write(self.style.SUCCESS("\nSeed complete!"))
        self.stdout.write("  admin    → Admin1234!")
        self.stdout.write("  student1 → Student1234!")

    def _seed_attempt(self, org, student, exam, snapshot, score, correct_idx, label, delta_days, questions):
        from apps.exams.models import Attempt, AttemptAnswer

        existing = Attempt.objects.filter(
            organization=org, user=student, exam=exam,
            status=Attempt.Status.COMPLETED, score=score,
        ).first()
        if existing:
            self.stdout.write(f"  Found attempt {label}")
            return

        attempt = Attempt.objects.create(
            organization=org,
            user=student,
            exam=exam,
            snapshot=snapshot,
            score=score,
            status=Attempt.Status.COMPLETED,
            completed_at=timezone.now() - timedelta(days=delta_days),
        )

        for i, q in enumerate(questions):
            meta = q.metadata
            is_correct = i in correct_idx

            if q.question_type == "MULTIPLE_CHOICE":
                ck = meta.get("correct_key", "A")
                wrong = next(
                    (o["key"] for o in meta.get("options", []) if o["key"] != ck),
                    "A",
                )
                answer_data = {"selected_key": ck if is_correct else wrong}
            elif q.question_type == "BOOLEAN":
                cv = meta.get("correct_answer", True)
                answer_data = {"value": cv if is_correct else not cv}
            else:
                answer_data = {"text": "respuesta de ejemplo" if is_correct else ""}

            AttemptAnswer.objects.create(
                attempt=attempt,
                question_id=q.id,
                answer_data=answer_data,
                is_final=True,
            )

        self.stdout.write(f"  Created attempt {label} (score={score})")
