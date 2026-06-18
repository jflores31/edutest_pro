from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AttemptViewSet, ChangePasswordView, CourseViewSet, DashboardLiveView, DashboardView,
    ExamPublicInfoView, ExamTemplateDetailView, ExamTemplateInstantiateView, ExamTemplatesView,
    ExamViewSet, HeatmapView, ImportConfirmView, ImportJobViewSet, ImportPreviewView,
    IntegrationListView, IntegrationToggleView,
    LoginView, LogoutView, MeView, NotificationPrefsView, NotificationsView, OrganizationViewSet,
    PasswordResetConfirmView, PasswordResetRequestView,
    QuestionViewSet, RegisterView,
    SparklineView, StudentLoginView, StudentLookupView, StudentViewSet, TopQuestionsView,
    CookieTokenRefreshView,
)

router = DefaultRouter()
router.register(r"organizations", OrganizationViewSet, basename="organization")
router.register(r"questions", QuestionViewSet, basename="question")
router.register(r"exams", ExamViewSet, basename="exam")
router.register(r"attempts", AttemptViewSet, basename="attempt")
router.register(r"imports", ImportJobViewSet, basename="import")
router.register(r"courses", CourseViewSet, basename="course")
router.register(r"students", StudentViewSet, basename="student")

urlpatterns = [
    # Auth
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/refresh/", CookieTokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/student/lookup/", StudentLookupView.as_view(), name="student-lookup"),
    path("auth/student/login/", StudentLoginView.as_view(), name="student-login"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("auth/me/notifications/", NotificationPrefsView.as_view(), name="notification-prefs"),
    path("notifications/", NotificationsView.as_view(), name="notifications"),
    # Public exam info (slug-based only)
    path("exams/public/<slug:slug>/", ExamPublicInfoView.as_view(), name="exam-public-detail"),
    # Integrations
    path("integrations/", IntegrationListView.as_view(), name="integrations"),
    path("integrations/<str:key>/toggle/", IntegrationToggleView.as_view(), name="integration-toggle"),
    # Exam templates
    path("exam-templates/", ExamTemplatesView.as_view(), name="exam-templates"),
    path("exam-templates/<int:pk>/", ExamTemplateDetailView.as_view(), name="exam-template-detail"),
    path("exam-templates/<int:template_id>/instantiate/", ExamTemplateInstantiateView.as_view(), name="exam-template-instantiate"),
    # Dashboard / Stats
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("dashboard/stats/", DashboardView.as_view(), name="dashboard-stats"),
    path("dashboard/live/", DashboardLiveView.as_view(), name="dashboard-live"),
    path("dashboard/sparkline/", SparklineView.as_view(), name="dashboard-sparkline"),
    path("dashboard/heatmap/", HeatmapView.as_view(), name="dashboard-heatmap"),
    path("dashboard/top-questions/", TopQuestionsView.as_view(), name="dashboard-top-questions"),
    path("imports/preview/", ImportPreviewView.as_view(), name="import-preview"),
    path("imports/confirm/", ImportConfirmView.as_view(), name="import-confirm"),
    # Router URLs
    path("", include(router.urls)),
]