"""Borra los datos demo (examen, preguntas, curso, alumnos, intentos y el usuario
student1) creados por `seed_data` y las pruebas, **conservando** el usuario admin
y la organización para que sigas teniendo acceso.

Ejecutar en el Shell de Render:

    python manage.py purge_demo          # muestra el resumen y pide confirmación
    python manage.py purge_demo --yes    # sin confirmación

Corre dentro de una transacción: si algo falla, NO borra nada. Está dirigido por
marcadores del seed (no borra toda la organización), así que tus propios datos
(otros exámenes/cursos/alumnos que hayas creado) no se tocan.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q


class Command(BaseCommand):
    help = "Borra los datos demo conservando el usuario admin y la organización."

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true", help="No pedir confirmación.")
        parser.add_argument("--org", default="Demo Organization", help="Nombre de la organización demo.")
        parser.add_argument("--exam", default="Fundamentos de Redes", help="Título del examen demo.")

    def handle(self, *args, **opts):
        from apps.exams.models import (
            Attempt, Course, Exam, ExamQuestion, ExamSnapshot,
            Organization, Question, Student, User,
        )

        org = Organization.objects.filter(name=opts["org"]).first()
        if not org:
            self.stdout.write(self.style.WARNING(
                f"No existe la organización '{opts['org']}'. Nada que borrar."
            ))
            return

        demo_exams = Exam.objects.filter(organization=org, title=opts["exam"])
        demo_courses = Course.objects.filter(organization=org).filter(
            Q(name="CURSO-DEMO") | Q(code="CURSO-DEMO")
        )
        demo_students = Student.objects.filter(organization=org).filter(
            Q(course__in=demo_courses) | Q(code__in=["DEMO01", "DEMO02"])
        )
        student1 = User.objects.filter(organization=org, username="student1")
        demo_q_ids = list(
            ExamQuestion.objects.filter(exam__in=demo_exams).values_list("question_id", flat=True)
        )
        attempts = Attempt.objects.filter(exam__in=demo_exams)

        self.stdout.write(f"Organización: {org.name}")
        self.stdout.write(f"  Exámenes demo:    {demo_exams.count()}")
        self.stdout.write(f"  Intentos:         {attempts.count()}  (+ respuestas/eventos en cascada)")
        self.stdout.write(f"  Snapshots:        {ExamSnapshot.objects.filter(exam__in=demo_exams).count()}")
        self.stdout.write(f"  Preguntas demo:   hasta {len(demo_q_ids)} (solo las que no se usen en otros exámenes)")
        self.stdout.write(f"  Cursos demo:      {demo_courses.count()}")
        self.stdout.write(f"  Alumnos demo:     {demo_students.count()}")
        self.stdout.write(f"  Usuario student1: {student1.count()}")
        self.stdout.write(self.style.NOTICE("  Se CONSERVAN el usuario admin y la organización."))

        if not opts["yes"]:
            ans = input("¿Confirmas el borrado? escribe 'si': ").strip().lower()
            if ans not in ("si", "sí", "s", "yes", "y"):
                self.stdout.write("Cancelado.")
                return

        with transaction.atomic():
            attempts.delete()                                  # cascada: respuestas + eventos
            ExamSnapshot.objects.filter(exam__in=demo_exams).delete()
            ExamQuestion.objects.filter(exam__in=demo_exams).delete()
            demo_exams.delete()
            # Preguntas demo que quedaron sin pertenecer a ningún examen
            Question.objects.filter(id__in=demo_q_ids, exam_questions__isnull=True).delete()
            demo_students.delete()                             # Attempt.student es SET_NULL
            demo_courses.delete()
            student1.delete()                                  # integraciones en cascada

        self.stdout.write(self.style.SUCCESS("✓ Datos demo borrados. admin y la organización se conservaron."))
