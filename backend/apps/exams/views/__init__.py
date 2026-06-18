"""
EduTest Pro — API Views (modular split)
Views are thin: they validate HTTP, call services, return responses.
No business logic here.
"""

from .mixins import IsSameOrganization, IsTeacherOrAdmin, IsTeacherInOrg, _client_ip, _rate_limit, _revoke_student_token
from .auth import LoginView, LogoutView, RegisterView, MeView, ChangePasswordView, CookieTokenRefreshView, PasswordResetRequestView, PasswordResetConfirmView, NotificationPrefsView
from .organizations import OrganizationViewSet
from .questions import QuestionViewSet
from .exams import ExamViewSet, ExamPublicInfoView, ExamTemplatesView, ExamTemplateDetailView, ExamTemplateInstantiateView
from .attempts import AttemptViewSet, StudentLoginView, StudentLookupView
from .dashboard import DashboardView, DashboardLiveView, SparklineView, HeatmapView, TopQuestionsView
from .students import StudentViewSet, CourseViewSet
from .imports import ImportJobViewSet, ImportPreviewView, ImportConfirmView
from .integrations import IntegrationListView, IntegrationToggleView
from .notifications import NotificationsView