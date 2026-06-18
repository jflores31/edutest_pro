"""
Student codeless authentication — separated to avoid circular imports
when referenced in DEFAULT_AUTHENTICATION_CLASSES.
"""
import logging
import uuid
from datetime import timedelta

from django.core.cache import cache

logger = logging.getLogger("edutest")
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError


class StudentAttemptToken(AccessToken):
    token_type = "student_attempt"
    lifetime = timedelta(hours=4)

    @classmethod
    def for_attempt(cls, attempt, student):
        token = cls()
        token["token_type"] = cls.token_type
        token["attempt_id"] = str(attempt.id)
        token["student_id"] = str(student.id)
        token["org_id"] = str(student.organization_id) if student.organization_id else None
        token["exam_id"] = str(attempt.exam_id)
        token["jti"] = str(uuid.uuid4())
        return token


class StudentPrincipal:
    """Lightweight request.user substitute for student-token requests."""

    def __init__(self, attempt_id, student_id, org_id):
        self.id = student_id
        self.attempt_id = attempt_id
        self.student_id = student_id
        self.organization_id = org_id

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    @property
    def role(self):
        return "STUDENT"

    def has_perm(self, perm, obj=None):
        return False

    def has_module_perms(self, app_label):
        return False

    @property
    def is_active(self):
        return True

    @property
    def pk(self):
        return self.student_id


class StudentAttemptAuthentication(BaseAuthentication):
    keyword = "Student"

    def authenticate(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth.startswith(f"{self.keyword} "):
            return None
        raw = auth[len(self.keyword) + 1:].strip()
        try:
            from rest_framework_simplejwt.tokens import UntypedToken
            token = UntypedToken(raw)
            if token.get("token_type") != "student_attempt":
                return None

            attempt_id = token["attempt_id"]
            student_id = token["student_id"]
            org_id = token.get("org_id")
            jti = token.get("jti")

            if not attempt_id or not student_id:
                raise AuthenticationFailed("Invalid student token payload.")

            if jti:
                cache_key = f"edutest:revoked_token:{jti}"
                try:
                    if cache.get(cache_key):
                        raise AuthenticationFailed("Student token has been revoked.")
                except AuthenticationFailed:
                    raise
                except Exception:
                    logger.error("Redis unavailable during token revocation check; rejecting token")
                    raise AuthenticationFailed("Service temporarily unavailable. Please try again.")

            self._validate_token_claims(attempt_id, student_id, org_id)

            principal = StudentPrincipal(
                attempt_id=attempt_id,
                student_id=student_id,
                org_id=org_id,
            )
            return (principal, token)
        except (TokenError, KeyError):
            return None

    def _validate_token_claims(self, attempt_id, student_id, org_id):
        from apps.exams.models import Attempt
        try:
            attempt = Attempt.objects.select_related("organization", "exam").get(id=attempt_id)
        except Attempt.DoesNotExist:
            raise AuthenticationFailed("Invalid student token: attempt not found.")

        if str(attempt.organization_id) != str(org_id):
            raise AuthenticationFailed("Invalid student token: organization mismatch.")

        if attempt.student_id and str(attempt.student_id) != str(student_id):
            raise AuthenticationFailed("Invalid student token: student mismatch.")

        if attempt.status != "IN_PROGRESS":
            raise AuthenticationFailed("This exam attempt is no longer in progress.")

        if not attempt.exam.is_published:
            raise AuthenticationFailed("This exam is no longer available.")

    def authenticate_header(self, request):
        return f'{self.keyword} realm="api"'
