import logging

from django.core.cache import cache
from rest_framework import permissions

logger = logging.getLogger("edutest")


class IsSameOrganization(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        org_id = getattr(obj, "organization_id", None)
        return org_id is not None and org_id == request.user.organization_id


class IsTeacherOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ("TEACHER", "ADMIN")


class IsTeacherInOrg(permissions.BasePermission):
    """IsAuthenticated + IsTeacherOrAdmin + same organization as object."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ("TEACHER", "ADMIN")
            and request.user.organization_id is not None
        )

    def has_object_permission(self, request, view, obj):
        org_id = getattr(obj, "organization_id", None)
        return org_id is not None and org_id == request.user.organization_id


def _client_ip(request):
    # X-Real-IP is set by nginx from its own REMOTE_ADDR — not spoofable by clients
    real_ip = request.META.get("HTTP_X_REAL_IP")
    if real_ip:
        return real_ip.strip()
    # Fallback: rightmost XFF entry is the one nginx appended (client cannot forge the last hop)
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[-1].strip()
    return request.META.get("REMOTE_ADDR", "")


def _rate_limit(request, key_prefix, limit=5, timeout=300):
    ip = _client_ip(request)
    cache_key = f"edutest:rate:{key_prefix}:{ip}"
    try:
        attempts = cache.get(cache_key, 0)
        if attempts >= limit:
            return False
        cache.set(cache_key, attempts + 1, timeout=timeout)
    except Exception:
        logger.warning("Redis unavailable during rate limiting; allowing request")
    return True


def _revoke_student_token(request):
    """Revoke the student attempt token after exam completion."""
    token = getattr(request, "auth", None)
    if token:
        jti = token.get("jti")
        if jti:
            try:
                cache.set(f"edutest:revoked_token:{jti}", True, timeout=4 * 3600)
            except Exception:
                logger.warning("Redis unavailable during token revocation; skipping")