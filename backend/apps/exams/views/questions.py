import logging
from django.db.models import Count, IntegerField, Value
from django.db.models.expressions import RawSQL
from django.db.models.functions import Coalesce
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework import status

from .mixins import IsTeacherOrAdmin
from ..models import Question
from ..serializers import QuestionBankSerializer, QuestionSerializer

logger = logging.getLogger("edutest")


class QuestionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsTeacherOrAdmin]

    def get_serializer_class(self):
        if self.request.query_params.get("bank") == "true" or self.action == "list":
            return QuestionBankSerializer
        return QuestionSerializer

    def get_queryset(self):
        qs = Question.objects.filter(
            organization=self.request.user.organization,
            is_active=True,
        ).annotate(
            usage_count=Count("exam_questions", distinct=True),
            _total_answers=Coalesce(
                RawSQL(
                    "(SELECT COUNT(*) FROM exams_attemptanswer aa"
                    " WHERE aa.question_id = \"exams_question\".\"id\""
                    " AND aa.is_final = true)",
                    [],
                    output_field=IntegerField(),
                ),
                Value(0),
            ),
            _wrong_answers=Coalesce(
                RawSQL(
                    "(SELECT COUNT(*) FROM exams_attemptanswer aa"
                    " JOIN exams_attempt a ON a.id = aa.attempt_id"
                    " WHERE aa.question_id = \"exams_question\".\"id\""
                    " AND a.status = 'COMPLETED'"
                    " AND aa.is_final = true"
                    " AND CASE \"exams_question\".\"question_type\""
                    "   WHEN 'MULTIPLE_CHOICE' THEN"
                    "     CASE WHEN \"exams_question\".\"metadata\" ? 'correct_keys' THEN"
                    "       coalesce((SELECT array_agg(upper(x) ORDER BY x)"
                    "                 FROM jsonb_array_elements_text("
                    "                   CASE WHEN jsonb_typeof(aa.answer_data->'selected_keys') = 'array' THEN aa.answer_data->'selected_keys' ELSE '[]'::jsonb END"
                    "                 ) x),"
                    "                ARRAY[]::text[])"
                    "       IS DISTINCT FROM"
                    "       coalesce((SELECT array_agg(upper(x) ORDER BY x)"
                    "                 FROM jsonb_array_elements_text("
                    "                   CASE WHEN jsonb_typeof(\"exams_question\".\"metadata\"->'correct_keys') = 'array' THEN \"exams_question\".\"metadata\"->'correct_keys' ELSE '[]'::jsonb END"
                    "                 ) x),"
                    "                ARRAY[]::text[])"
                    "     ELSE"
                    "       upper(aa.answer_data->>'selected_key') IS DISTINCT FROM"
                    "       upper(\"exams_question\".\"metadata\"->>'correct_key')"
                    "     END"
                    "   WHEN 'BOOLEAN' THEN"
                    "     lower(coalesce(aa.answer_data->>'value','false')) IN ('true','1','yes','t') IS DISTINCT FROM"
                    "     lower(coalesce(\"exams_question\".\"metadata\"->>'correct_answer','false')) IN ('true','1','yes','t')"
                    "   ELSE false END)",
                    [],
                    output_field=IntegerField(),
                ),
                Value(0),
            ),
        )

        params = self.request.query_params

        topic = params.get("topic")
        if topic:
            qs = qs.filter(metadata__category=topic)

        search = params.get("search")
        if search:
            qs = qs.filter(question_text__icontains=search)

        min_usage = params.get("min_usage")
        if min_usage:
            qs = qs.filter(usage_count__gte=int(min_usage))

        min_error_rate = params.get("min_error_rate")
        if min_error_rate:
            threshold = float(min_error_rate)
            filtered_ids = [
                q.id for q in qs
                if q._total_answers and (q._wrong_answers / q._total_answers * 100) >= threshold
            ]
            qs = qs.filter(id__in=filtered_ids)

        q_type = params.get("type")
        if q_type:
            qs = qs.filter(question_type=q_type.upper())

        return qs.order_by("created_at")

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except ValueError:
            return Response({"error": "Parámetro de filtro inválido."}, status=status.HTTP_400_BAD_REQUEST)

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            created_by=self.request.user,
        )

    def destroy(self, request, *args, **kwargs):
        from django.db.models.deletion import ProtectedError
        instance = self.get_object()
        try:
            instance.delete()
        except ProtectedError:
            # En uso por uno o más exámenes: no se puede borrar físicamente sin
            # romper esos exámenes. Se desactiva → desaparece del banco y los
            # exámenes (snapshot + ExamQuestion) quedan intactos.
            instance.is_active = False
            instance.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)