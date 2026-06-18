import logging
from datetime import timedelta

from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .mixins import _client_ip, _rate_limit
from ..models import User
from ..serializers import (
    CustomTokenObtainPairSerializer, UserCreateSerializer, UserSerializer,
)

logger = logging.getLogger("edutest")


class CookieTokenRefreshView(TokenRefreshView):
    """Read refresh token from httpOnly cookie; return new tokens as httpOnly cookies."""

    def post(self, request, *args, **kwargs):
        refresh_value = request.data.get("refresh") or request.COOKIES.get("refresh_token")
        if not refresh_value:
            return Response(
                {"detail": "Refresh token not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = self.get_serializer(data={"refresh": refresh_value})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0])

        data = serializer.validated_data
        response = Response(data, status=status.HTTP_200_OK)
        is_secure = request.is_secure()
        samesite = "Lax"
        access_token = data.get("access", "")
        new_refresh = data.get("refresh", "")
        if access_token:
            response.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=is_secure,
                samesite=samesite,
                path="/api/v1",
                max_age=int(timedelta(minutes=60).total_seconds()),
            )
        if new_refresh:
            response.set_cookie(
                key="refresh_token",
                value=new_refresh,
                httponly=True,
                secure=is_secure,
                samesite=samesite,
                path="/api/v1/auth",
                max_age=int(timedelta(days=7).total_seconds()),
            )
        return response


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        if not _rate_limit(request, "login", limit=5, timeout=300):
            return Response(
                {"error": "Demasiados intentos. Intenta de nuevo en 5 minutos."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            data = response.data
            is_secure = request.is_secure()
            samesite = "Lax"
            access_token = data.get("access", "")
            refresh_token = data.get("refresh", "")
            response.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=is_secure,
                samesite=samesite,
                path="/api/v1",
                max_age=int(timedelta(minutes=60).total_seconds()),
            )
            response.set_cookie(
                key="refresh_token",
                value=refresh_token,
                httponly=True,
                secure=is_secure,
                samesite=samesite,
                path="/api/v1/auth",
                max_age=int(timedelta(days=7).total_seconds()),
            )
        return response


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh_token = request.data.get("refresh") or request.COOKIES.get("refresh_token")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie("access_token", path="/api/v1")
        response.delete_cookie("refresh_token", path="/api/v1/auth")
        return response


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not _rate_limit(request, "register", limit=3, timeout=3600):
            return Response(
                {"error": "Demasiados registros. Intenta de nuevo más tarde."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        from django.db import IntegrityError
        serializer = UserCreateSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = serializer.save()
            except IntegrityError:
                return Response({"error": "El email ya está registrado."}, status=status.HTTP_400_BAD_REQUEST)
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        from django.db import IntegrityError
        allowed = {k: v for k, v in request.data.items()
                   if k in ("first_name", "last_name", "email")}
        serializer = UserSerializer(request.user, data=allowed, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save()
        except IntegrityError:
            return Response({"error": "El email ya está registrado."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        current = request.data.get("current_password", "")
        new_pw  = request.data.get("new_password", "")
        if not current or not new_pw:
            return Response({"error": "current_password and new_password are required."},
                            status=status.HTTP_400_BAD_REQUEST)
        if not request.user.check_password(current):
            return Response({"error": "La contraseña actual es incorrecta."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(new_pw, request.user)
        except DjangoValidationError as exc:
            return Response({"error": " ".join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new_pw)
        request.user.save(update_fields=["password"])
        return Response({"detail": "Contraseña actualizada."})


_DEFAULT_NOTIFICATION_PREFS = {
    "attempt_finished": True,
    "daily_summary": True,
    "low_score": True,
    "proctoring_alerts": True,
    "overdue_attempts": False,
    "newsletter": False,
}


class NotificationPrefsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        prefs = {**_DEFAULT_NOTIFICATION_PREFS, **request.user.notification_prefs}
        return Response([{"key": k, "on": prefs.get(k, False)} for k in _DEFAULT_NOTIFICATION_PREFS])

    def patch(self, request):
        update = {
            k: bool(v) for k, v in request.data.items()
            if k in _DEFAULT_NOTIFICATION_PREFS
        }
        merged = {**_DEFAULT_NOTIFICATION_PREFS, **request.user.notification_prefs, **update}
        request.user.notification_prefs = merged
        request.user.save(update_fields=["notification_prefs"])
        return Response([{"key": k, "on": merged[k]} for k in _DEFAULT_NOTIFICATION_PREFS])


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        if not _rate_limit(request, "password_reset", limit=3, timeout=3600):
            return Response(
                {"error": "Demasiados intentos. Intenta de nuevo en 1 hora."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response({"error": "El email es requerido."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            reset_link = f"/reset-password?uid={uid}&token={token}"
            return Response({"detail": "Si el email está registrado, recibirás instrucciones."})
        except User.DoesNotExist:
            return Response({"detail": "Si el email está registrado, recibirás instrucciones."})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_str
        from django.utils.http import urlsafe_base64_decode

        uid = request.data.get("uid", "").strip()
        token = request.data.get("token", "").strip()
        new_password = request.data.get("new_password", "")

        if not all([uid, token, new_password]):
            return Response({"error": "uid, token y new_password son requeridos."}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 8:
            return Response({"error": "La contraseña debe tener al menos 8 caracteres."}, status=status.HTTP_400_BAD_REQUEST)

        ip = self._client_ip(request)
        cache_key = f"edutest:rate:password_reset_confirm:{ip}"
        try:
            attempts = cache.get(cache_key, 0)
            if attempts >= 5:
                return Response(
                    {"error": "Demasiados intentos. Intenta de nuevo en 15 minutos."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            cache.set(cache_key, attempts + 1, timeout=900)
        except Exception:
            logger.warning("Redis unavailable during password reset rate limiting; allowing request")

        try:
            user_pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_pk)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response({"error": "Enlace inválido o expirado."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"error": "El enlace ha expirado o es inválido."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Contraseña actualizada correctamente."})

    @staticmethod
    def _client_ip(request):
        return _client_ip(request)