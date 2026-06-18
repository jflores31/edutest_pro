import pytest
from rest_framework.test import APIClient
from apps.exams.tests.test_views import (
    make_org, make_teacher, make_course, make_student, make_question,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def org(db):
    return make_org()


@pytest.fixture
def teacher(db, org):
    return make_teacher(org)


@pytest.fixture
def auth_client(api_client, teacher):
    api_client.force_authenticate(user=teacher)
    return api_client


@pytest.fixture
def course(db, org, teacher):
    return make_course(org, teacher)


@pytest.fixture
def student(db, org, course):
    return make_student(org, course)


@pytest.fixture
def question(db, org, teacher):
    return make_question(org, teacher)
