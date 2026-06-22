import logging
from django.db import transaction
from django.db.models import Count, Q
from rest_framework import parsers, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .mixins import IsTeacherInOrg
from ..models import Attempt, Course, Student
from ..serializers import (
    CourseSerializer, StudentProfileSerializer, StudentSerializer,
)

logger = logging.getLogger("edutest")


class CourseViewSet(viewsets.ModelViewSet):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherInOrg]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return (
            Course.objects.filter(organization=self.request.user.organization)
            .select_related("teacher")
            .annotate(students_count_ann=Count("students", distinct=True))
            .order_by("name")
        )

    def perform_create(self, serializer):
        from django.db import IntegrityError
        from rest_framework.exceptions import ValidationError
        try:
            serializer.save(
                organization=self.request.user.organization,
                teacher=self.request.user,
            )
        except IntegrityError:
            raise ValidationError({"code": ["A course with this code already exists in your organization."]})


class StudentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated, IsTeacherInOrg]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        from django.db.models import Prefetch as DjPrefetch
        recent_attempts_qs = (
            Attempt.objects.filter(status=Attempt.Status.COMPLETED, score__isnull=False)
            .order_by("-completed_at")
            .only("score", "completed_at", "student_id")
        )
        qs = (
            Student.objects.filter(organization=self.request.user.organization)
            .select_related("course")
            .prefetch_related(DjPrefetch("attempts", queryset=recent_attempts_qs, to_attr="recent_attempts_cache"))
        )

        course_id = self.request.query_params.get("course_id")
        if course_id:
            qs = qs.filter(course_id=course_id)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(code__icontains=search)
                | Q(email__icontains=search)
            )
        return qs.order_by("course__name", "last_name", "first_name")

    def perform_create(self, serializer):
        from django.db import IntegrityError
        from rest_framework.exceptions import ValidationError
        try:
            serializer.save(organization=self.request.user.organization)
        except IntegrityError:
            raise ValidationError({"code": ["Ya existe un alumno con este DNI en tu organización."]})

    def perform_update(self, serializer):
        from django.db import IntegrityError
        from rest_framework.exceptions import ValidationError
        try:
            serializer.save()
        except IntegrityError:
            raise ValidationError({"code": ["Ya existe un alumno con este DNI en tu organización."]})

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        """
        POST /api/v1/students/bulk/
        Body: { course_id, students: [{code, first_name, last_name, email?}] }
        Creates multiple students in one transaction.
        """
        from ..serializers import StudentBulkItemSerializer

        course_id = request.data.get("course_id")
        if not course_id:
            return Response({"error": "course_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            course = Course.objects.get(id=course_id, organization=request.user.organization)
        except Course.DoesNotExist:
            return Response({"error": "Course not found."}, status=status.HTTP_404_NOT_FOUND)

        items_data = request.data.get("students", [])
        if not isinstance(items_data, list) or not items_data:
            return Response({"error": "students must be a non-empty list."}, status=status.HTTP_400_BAD_REQUEST)

        item_ser = StudentBulkItemSerializer(data=items_data, many=True)
        if not item_ser.is_valid():
            return Response({"errors": item_ser.errors}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        skipped = []
        with transaction.atomic():
            for item in item_ser.validated_data:
                # Dedup by (organization, code): code is unique per org, so a code
                # that already exists in another course must not trigger an
                # IntegrityError (which would abort the whole transaction).
                _, was_created = Student.objects.get_or_create(
                    organization=request.user.organization,
                    code=item["code"],
                    defaults={
                        "course": course,
                        "first_name": item["first_name"],
                        "last_name": item["last_name"],
                        "email": item.get("email", ""),
                    },
                )
                if was_created:
                    created_count += 1
                else:
                    skipped.append(item["code"])

        return Response(
            {"created": created_count, "skipped": skipped, "total": len(items_data)},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        """GET /api/v1/students/export/?course_id=<id>

        Exporta los alumnos en CSV con el formato: DNI,Nombres,Apellidos.
        El campo `code` se exporta como DNI. Respeta el filtro de curso.
        """
        import csv
        from io import StringIO
        from django.http import HttpResponse as DjangoHttpResponse

        qs = (
            Student.objects.filter(organization=request.user.organization)
            .select_related("course")
        )
        course_id = request.query_params.get("course_id")
        if course_id:
            qs = qs.filter(course_id=course_id)
        qs = qs.order_by("course__name", "last_name", "first_name")

        def safe(val):
            s = str(val or "")
            # Evita inyección de fórmulas si el CSV se abre en Excel/Sheets
            return ("'" + s) if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s

        buffer = StringIO()
        buffer.write("\ufeff")  # BOM → Excel detecta UTF-8
        writer = csv.writer(buffer)
        writer.writerow(["DNI", "Nombres", "Apellidos"])
        for s in qs:
            writer.writerow([safe(s.code), safe(s.first_name), safe(s.last_name)])

        response = DjangoHttpResponse(
            buffer.getvalue(), content_type="text/csv; charset=utf-8"
        )
        response["Content-Disposition"] = 'attachment; filename="alumnos.csv"'
        return response

    @action(
        detail=False,
        methods=["post"],
        url_path="import",
        parser_classes=[parsers.MultiPartParser, parsers.FormParser],
    )
    def import_students(self, request):
        """POST /api/v1/students/import/  (multipart)

        Campos: file (CSV/XLSX) + course_id.
        Columnas del archivo: DNI, Nombres, Apellidos. El DNI se guarda como `code`
        y la unicidad es por organización (DNI repetido → omitido).
        """
        from services.student_import_service import parse_student_file, StudentFileError
        from ..serializers import DNI_PATTERN

        course_id = request.data.get("course_id")
        if not course_id:
            return Response({"error": "Selecciona un curso destino."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            course = Course.objects.get(id=course_id, organization=request.user.organization)
        except (Course.DoesNotExist, ValueError):
            return Response({"error": "Curso no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No se envió archivo."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rows = parse_student_file(file)
        except StudentFileError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if not rows:
            return Response({"error": "El archivo no contiene alumnos."}, status=status.HTTP_400_BAD_REQUEST)

        created = 0
        skipped = []
        errors = []
        with transaction.atomic():
            for i, r in enumerate(rows, start=1):
                dni, first_name, last_name = r["dni"], r["first_name"], r["last_name"]
                if not (dni and first_name and last_name):
                    errors.append({"row": i, "message": "DNI, Nombres y Apellidos son obligatorios."})
                    continue
                if not DNI_PATTERN.match(dni):
                    errors.append({"row": i, "message": f"DNI inválido '{dni}': debe tener 8 dígitos (solo números)."})
                    continue
                _, was_created = Student.objects.get_or_create(
                    organization=request.user.organization,
                    code=dni,
                    defaults={
                        "course": course,
                        "first_name": first_name,
                        "last_name": last_name,
                        "email": r.get("email", ""),
                    },
                )
                if was_created:
                    created += 1
                else:
                    skipped.append(dni)

        return Response(
            {"created": created, "skipped": skipped, "errors": errors, "total": len(rows)},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="profile")
    def profile(self, request, pk=None):
        """GET /api/v1/students/{id}/profile/ — KPIs + attempt history."""
        student = self.get_object()
        student = Student.objects.filter(organization=self.request.user.organization).prefetch_related("attempts__exam").get(pk=student.pk)
        serializer = StudentProfileSerializer(student, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="report-card")
    def report_card(self, request, pk=None):
        """GET /api/v1/students/{id}/report-card/?output=json|pdf"""
        student = self.get_object()
        student = (
            Student.objects.filter(organization=self.request.user.organization)
            .select_related("course")
            .prefetch_related("attempts__exam", "attempts__snapshot", "attempts__saved_answers")
            .get(pk=student.pk)
        )
        fmt = request.query_params.get("output", "json")

        profile_ser = StudentProfileSerializer(student, context={"request": request})
        data = profile_ser.data

        if fmt == "pdf":
            try:
                import datetime as dt_pdf
                from io import BytesIO
                from reportlab.lib.pagesizes import A4
                from reportlab.lib import colors
                from reportlab.lib.styles import ParagraphStyle
                from reportlab.lib.enums import TA_CENTER, TA_RIGHT
                from reportlab.platypus import (
                    SimpleDocTemplate, Paragraph, Table, TableStyle,
                    Spacer, HRFlowable, KeepTogether,
                )
                from django.http import HttpResponse as DjangoHttpResponse
            except ImportError:
                return Response(
                    {"error": "PDF not available. Install: pip install reportlab"},
                    status=status.HTTP_501_NOT_IMPLEMENTED,
                )

            C_ACCENT  = colors.HexColor("#7c3aed")
            C_ACCENT2 = colors.HexColor("#5b21b6")
            C_OK      = colors.HexColor("#059669")
            C_DANGER  = colors.HexColor("#e11d48")
            C_WARN    = colors.HexColor("#d97706")
            C_BG_ALT  = colors.HexColor("#f8fafc")
            C_BORDER  = colors.HexColor("#cbd5e1")
            C_TEXT    = colors.HexColor("#0f172a")
            C_MUTED   = colors.HexColor("#64748b")
            C_PURPLE_SOFT = colors.HexColor("#c4b5fd")

            def ps(name, **kw):
                defaults = dict(fontName="Helvetica", fontSize=9,
                                textColor=C_TEXT, leading=12,
                                spaceBefore=0, spaceAfter=0)
                defaults.update(kw)
                return ParagraphStyle(name, **defaults)

            S_H1       = ps("h1",  fontSize=18, fontName="Helvetica-Bold",
                            textColor=colors.white, leading=22)
            S_BRAND    = ps("br",  fontSize=10, fontName="Helvetica-Bold",
                            textColor=colors.white, alignment=TA_RIGHT)
            S_SUBHDR   = ps("sh",  fontSize=8, textColor=C_PURPLE_SOFT)
            S_SUBHDR_R = ps("shr", fontSize=8, textColor=C_PURPLE_SOFT, alignment=TA_RIGHT)
            S_H2       = ps("h2",  fontSize=11, fontName="Helvetica-Bold",
                            spaceBefore=14, spaceAfter=4)
            S_MUTED    = ps("mu",  fontSize=8, textColor=C_MUTED)
            S_KPI_LBL  = ps("kl",  fontSize=7, fontName="Helvetica-Bold",
                            textColor=C_MUTED, alignment=TA_CENTER)
            S_TH       = ps("th",  fontSize=8, fontName="Helvetica-Bold",
                            textColor=colors.white, alignment=TA_CENTER)
            S_TD       = ps("td",  fontSize=8, alignment=TA_CENTER)
            S_TD_L     = ps("tdl", fontSize=8)
            S_FOOTER   = ps("ft",  fontSize=7, textColor=C_MUTED, alignment=TA_CENTER)

            buffer = BytesIO()
            usable_w = A4[0] - 80
            doc = SimpleDocTemplate(
                buffer, pagesize=A4,
                rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40,
            )
            story = []

            full_name   = f"{data['first_name']} {data['last_name']}"
            course_name = data.get("course_name") or "Sin curso asignado"
            gen_date    = dt_pdf.date.today().strftime("%d/%m/%Y")

            hdr = Table([
                [Paragraph(full_name, S_H1),
                 Paragraph("EduTest Pro", S_BRAND)],
                [Paragraph(f"Código: {data['code']}  ·  {course_name}", S_SUBHDR),
                 Paragraph(f"Generado: {gen_date}", S_SUBHDR_R)],
            ], colWidths=[usable_w * 0.65, usable_w * 0.35])
            hdr.setStyle(TableStyle([
                ("BACKGROUND",    (0, 0), (-1, -1), C_ACCENT),
                ("TOPPADDING",    (0, 0), (-1, 0),  14),
                ("BOTTOMPADDING", (0, 0), (-1, 0),  2),
                ("TOPPADDING",    (0, 1), (-1, 1),  2),
                ("BOTTOMPADDING", (0, 1), (-1, 1),  12),
                ("LEFTPADDING",   (0, 0), (-1, -1), 16),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 16),
                ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
                ("LINEBELOW",     (0, -1), (-1, -1), 3, C_ACCENT2),
            ]))
            story.append(hdr)
            story.append(Spacer(1, 14))

            avg     = data.get("avg_score")
            avg_str = f"{avg:.1f}/20" if avg is not None else "N/A"
            avg_ok  = (avg or 0) >= 11
            S_KPI_V  = ps("kv", fontSize=20, fontName="Helvetica-Bold",
                          textColor=C_OK if avg_ok else C_DANGER,
                          alignment=TA_CENTER, leading=24)
            S_KPI_AT = ps("ka", fontSize=20, fontName="Helvetica-Bold",
                          alignment=TA_CENTER, leading=24)
            rank_str = str(data["ranking"]) if data.get("ranking") else "N/A"
            kpi_col  = usable_w / 3

            kpi = Table([
                [Paragraph("PROMEDIO", S_KPI_LBL),
                 Paragraph("INTENTOS", S_KPI_LBL),
                 Paragraph("RANKING",  S_KPI_LBL)],
                [Paragraph(avg_str, S_KPI_V),
                 Paragraph(str(data["attempts_count"]), S_KPI_AT),
                 Paragraph(rank_str, S_KPI_AT)],
            ], colWidths=[kpi_col, kpi_col, kpi_col])
            kpi.setStyle(TableStyle([
                ("BACKGROUND",    (0, 0), (-1, -1), C_BG_ALT),
                ("TOPPADDING",    (0, 0), (-1, 0),  10),
                ("BOTTOMPADDING", (0, 0), (-1, 0),  2),
                ("TOPPADDING",    (0, 1), (-1, 1),  2),
                ("BOTTOMPADDING", (0, 1), (-1, 1),  10),
                ("LEFTPADDING",   (0, 0), (-1, -1), 8),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
                ("BOX",           (0, 0), (-1, -1), 0.5, C_BORDER),
                ("LINEAFTER",     (0, 0), (1, -1),  0.5, C_BORDER),
                ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ]))
            story.append(kpi)

            story.append(Paragraph("Últimos Intentos", S_H2))
            attempts = data.get("attempts", [])
            if attempts:
                att_rows = [[Paragraph(h, S_TH) for h in
                             ["Examen", "Puntaje", "Estado", "Fecha"]]]
                for a in attempts[:15]:
                    sc     = a.get("score")
                    sc_str = f"{sc:.1f}/20" if sc is not None else "N/A"
                    passed = (sc or 0) >= 11
                    S_SC   = ps("sc", fontSize=8, fontName="Helvetica-Bold",
                                textColor=C_OK if passed else C_DANGER, alignment=TA_CENTER)
                    S_ST   = ps("st", fontSize=7, fontName="Helvetica-Bold",
                                textColor=C_OK if passed else C_DANGER, alignment=TA_CENTER)
                    att_rows.append([
                        Paragraph(a.get("exam_title", "—"), S_TD_L),
                        Paragraph(sc_str, S_SC),
                        Paragraph("Aprobado" if passed else "Reprobado", S_ST),
                        Paragraph((a.get("completed_at") or "")[:10], S_TD),
                    ])
                t_att = Table(att_rows,
                              colWidths=[usable_w * 0.50, usable_w * 0.17,
                                         usable_w * 0.18, usable_w * 0.15],
                              repeatRows=1)
                t_att.setStyle(TableStyle([
                    ("BACKGROUND",    (0, 0), (-1, 0),   C_ACCENT2),
                    ("ROWBACKGROUNDS",(0, 1), (-1, -1),  [colors.white, C_BG_ALT]),
                    ("BOX",           (0, 0), (-1, -1),  0.5, C_BORDER),
                    ("INNERGRID",     (0, 0), (-1, -1),  0.3, C_BORDER),
                    ("TOPPADDING",    (0, 0), (-1, -1),  5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1),  5),
                    ("LEFTPADDING",   (0, 0), (-1, -1),  6),
                    ("RIGHTPADDING",  (0, 0), (-1, -1),  6),
                    ("VALIGN",        (0, 0), (-1, -1),  "MIDDLE"),
                ]))
                story.append(KeepTogether([t_att]))
            else:
                story.append(Paragraph("Sin intentos registrados.", S_MUTED))

            topic_stats = data.get("topic_stats")
            if topic_stats:
                story.append(Paragraph("Rendimiento por Tema", S_H2))
                top_rows = [[Paragraph(h, S_TH) for h in
                             ["Tema", "Correctas", "Total", "Tasa de error"]]]
                for ts in topic_stats:
                    er    = ts.get("error_rate", 0)
                    er_c  = C_OK if er < 30 else (C_WARN if er < 60 else C_DANGER)
                    S_ER  = ps("er", fontSize=8, fontName="Helvetica-Bold",
                               textColor=er_c, alignment=TA_CENTER)
                    top_rows.append([
                        Paragraph(ts.get("topic") or "General", S_TD_L),
                        Paragraph(str(ts["correct"]), S_TD),
                        Paragraph(str(ts["total"]),   S_TD),
                        Paragraph(f"{er}%", S_ER),
                    ])
                t_top = Table(top_rows,
                              colWidths=[usable_w * 0.46, usable_w * 0.18,
                                         usable_w * 0.18, usable_w * 0.18],
                              repeatRows=1)
                t_top.setStyle(TableStyle([
                    ("BACKGROUND",    (0, 0), (-1, 0), colors.HexColor("#059669")),
                    ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, C_BG_ALT]),
                    ("BOX",           (0, 0), (-1, -1), 0.5, C_BORDER),
                    ("INNERGRID",     (0, 0), (-1, -1), 0.3, C_BORDER),
                    ("TOPPADDING",    (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING",   (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
                    ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
                ]))
                story.append(KeepTogether([t_top]))

            story.append(Spacer(1, 20))
            story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER))
            story.append(Spacer(1, 6))
            story.append(Paragraph(
                f"EduTest Pro  ·  Generado el {gen_date}  ·  Documento de uso interno",
                S_FOOTER,
            ))

            doc.build(story)
            buffer.seek(0)
            response = DjangoHttpResponse(buffer, content_type="application/pdf")
            response["Content-Disposition"] = (
                f'attachment; filename="boletin_{student.code}.pdf"'
            )
            return response

        return Response(data)