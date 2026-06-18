from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    Attempt, AttemptAnswer, Course, Exam, ExamQuestion,
    ExamSnapshot, ImportJob, Organization, ProctoringEvent,
    Question, Student,
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name"]


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "teacher", "organization", "created_at"]
    list_filter = ["organization"]
    search_fields = ["name", "code", "teacher__email"]
    raw_id_fields = ["organization", "teacher"]


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ["code", "first_name", "last_name", "email", "course", "organization"]
    list_filter = ["organization", "course"]
    search_fields = ["code", "first_name", "last_name", "email"]
    raw_id_fields = ["organization", "course"]


@admin.register(ProctoringEvent)
class ProctoringEventAdmin(admin.ModelAdmin):
    list_display = ["event_type", "attempt", "created_at"]
    list_filter = ["event_type"]
    search_fields = ["attempt__id"]
    raw_id_fields = ["attempt"]
    readonly_fields = ["created_at"]


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ["user", "exam", "status", "score", "student", "started_at"]
    list_filter = ["status", "organization"]
    search_fields = ["user__email", "exam__title"]
    raw_id_fields = ["user", "exam", "snapshot", "organization", "student"]


from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "username", "role", "organization", "is_staff"]
    list_filter = ["role", "organization", "is_staff"]
    fieldsets = BaseUserAdmin.fieldsets + (  # type: ignore[operator]
        ("EduTest", {"fields": ("organization", "role")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (  # type: ignore[operator]
        ("EduTest", {"fields": ("organization", "role")}),
    )


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["question_text", "question_type", "organization", "version_number", "is_active"]
    list_filter = ["question_type", "is_active", "organization"]
    search_fields = ["question_text"]


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ["title", "organization", "is_published", "duration_minutes", "created_at"]
    list_filter = ["is_published", "organization"]
    search_fields = ["title"]


admin.site.register(ExamQuestion)
admin.site.register(ExamSnapshot)
admin.site.register(ImportJob)
admin.site.register(AttemptAnswer)
