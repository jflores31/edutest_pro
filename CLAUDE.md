# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

All development runs through Docker. The primary entrypoint is `docker compose` (or the `Makefile` shortcuts).

```bash
# First-time setup
make setup          # copies .env.example → .env and creates data dirs

# Start / Stop
make up             # docker compose up --build -d  (rebuilds images)
make down           # docker compose down
make logs           # tail all containers
make logs-b         # tail backend only

# Database
make migrate        # python manage.py migrate (inside running backend container)
make superuser      # create Django superuser interactively
make psql           # open psql inside postgres container

# Tests
make test           # pytest (all tests, inside backend container)
make test-parallel  # pytest -n auto

# Single test file or function
docker compose exec backend pytest apps/exams/tests/test_views.py -k "test_name" -v

# Django shell
make shell

# Redis CLI
make redis
```

When only backend Python files change, rebuild just that image to save time:
```bash
docker compose build backend
docker compose up -d
```

When frontend files change:
```bash
docker compose build frontend
docker compose up -d
```

The `entrypoint.sh` automatically runs `migrate` and `collectstatic` on every backend startup — migrations do not need to be run manually after a rebuild.

---

## Architecture

### Infrastructure

```
Browser → Nginx (:80)
            ├── /api/v1/*   → Backend Gunicorn (:8000)
            ├── /*          → Frontend SPA (React/Vite, served by Nginx)
            └── /static, /media → Docker volumes

Backend → PostgreSQL (:5433 host) + Redis (:6380 host — cache/heartbeat only)
```

No Celery. Bulk imports run **synchronously** inside the request; periodic
abandonment detection runs via the `detect_abandoned` management command,
scheduled by a free GitHub Actions cron (`.github/workflows/detect-abandoned.yml`).

Five containers: `edutest_nginx`, `edutest_backend`, `edutest_frontend`, `edutest_postgres`, `edutest_redis`.  
All have healthchecks. Nginx waits for `backend` to be healthy before starting.

### Backend (`backend/`)

**Entry point:** `config/settings.py` (reads all secrets from `.env` via `python-decouple`).  
**URL root:** `config/urls.py` → mounts `/api/v1/` from `apps/exams/urls.py`, `/admin/`, and `/api/health/`.

**Domain layer — `apps/exams/`**

| File | Responsibility |
|---|---|
| `models.py` | All domain models — see model map below |
| `views/` | Views package — thin HTTP layer split across modules (see below) |
| `serializers.py` | DRF serializers. `CustomTokenObtainPairSerializer` embeds `role`, `organization_id` into JWT. |
| `auth.py` | `StudentAttemptAuthentication` — separate auth class for student exam sessions (token type `"student_attempt"`, `Authorization: Student <jwt>`). |
| `urls.py` | DRF router + explicit paths for auth, dashboard, integrations, templates. |

**Views package — `apps/exams/views/`**

| File | Responsibility |
|---|---|
| `auth.py` | Login, Logout, Register, Me, ChangePassword, PasswordReset, CookieTokenRefreshView, NotificationPrefs |
| `exams.py` | ExamViewSet, ExamPublicInfoView, ExamTemplates* |
| `attempts.py` | AttemptViewSet, StudentLoginView, StudentLookupView |
| `students.py` | StudentViewSet, CourseViewSet |
| `questions.py` | QuestionViewSet |
| `dashboard.py` | DashboardView, DashboardLiveView, SparklineView, HeatmapView, TopQuestionsView |
| `imports.py` | ImportJobViewSet, ImportPreviewView, ImportConfirmView |
| `organizations.py` | OrganizationViewSet |
| `integrations.py` | IntegrationListView, IntegrationToggleView |
| `mixins.py` | IsSameOrganization, IsTeacherOrAdmin, IsTeacherInOrg, `_rate_limit`, `_client_ip` |

**Cookie auth middleware — `config/middleware/cookie_auth.py`**  
`CookieAuthMiddleware` reads `access_token` httpOnly cookie and injects it as `Authorization: Bearer <token>` so SimpleJWT processes it transparently. Only activates when no `Authorization` header is already present (student sessions use `Authorization: Student <jwt>` and are unaffected).

**Service layer — `services/`**

| File | Responsibility |
|---|---|
| `exam_engine.py` | `ExamEngine.start_exam()`, `submit_exam()`, `calculate_score()`. Score scale: **vigesimal 0–20**, pass threshold ≥ 11 (`PASS_THRESHOLD = 11`). |
| `attempt_service.py` | `save_answer`, `heartbeat`, `get_state`, `detect_abandoned`. Heartbeat key prefix: `HEARTBEAT_PREFIX`. |
| `import_service.py` | CSV/XLSX parsing, validation, atomic bulk creation of `Question` rows. |
| `exceptions.py` | Typed service exceptions (`CrossTenantAccessError`, `ExamTimeExpiredError`, etc.) — all have `.to_dict()` for response serialization. |

**Scheduled task — `apps/exams/management/commands/detect_abandoned.py`**  
Django management command `python manage.py detect_abandoned` (replaces the old Celery Beat
task). Run on a schedule by the free GitHub Actions cron in
`.github/workflows/detect-abandoned.yml` (every 10 min). Imports are no longer a background
task — they run synchronously in the request (see `imports.py` → `ImportService.process_from_job`).

**Multi-tenancy rule:** Every queryset filters by `organization_id` from `request.user.organization`. Cross-tenant access raises `CrossTenantAccessError`. The `IsSameOrganization` permission class enforces object-level isolation.

**Model map:**
```
Organization (tenant root)
 └── User (ADMIN | TEACHER | STUDENT)
      └── UserIntegration (key, connected bool)
 └── Course
      └── Student (no User account — auth by code + names)
 └── Question (versioned, metadata JSON)
 └── Exam ──M2M(ExamQuestion)──► Question
      ├── ExamSnapshot (immutable JSON copy at launch time)
      └── Attempt (IN_PROGRESS | COMPLETED | ABANDONED)
           ├── AttemptAnswer (per-question, autosaved)
           └── ProctoringEvent (TAB_SWITCH, FOCUS_LOST, RECONNECT, OFFLINE)
 └── ExamTemplate
 └── ImportJob
```

**Score storage:** `Attempt.score` is a `DecimalField` storing vigesimal 0–20. The `DashboardView` returns `avg_score` in the same 0–20 scale. The frontend `ScoreBadge` uses threshold `>= 11` and displays as `"X.X/20"`.

**Dashboard caching:** `DashboardView` caches the full payload in Redis for 300 seconds (`dashboard_stats_{org_id}_{course_id}`). `DashboardLiveView` is never cached (polled every 15 s from the frontend).

#### Key behavioral patterns

**Student authentication (`auth.py`):** `StudentAttemptAuthentication` produces a `StudentPrincipal` — a lightweight dataclass, not a `User` model instance. The JWT payload carries `attempt_id`, `student_id`, `org_id`, `exam_id`, and type marker `"student_attempt"`. Token lifetime is 4 hours. Revoked tokens are stored in Redis at `edutest:revoked_token:{jti}`. Header format: `Authorization: Student <jwt>` (not `Bearer`).

**ExamSnapshot pattern:** When `ExamEngine.start_exam()` runs, the entire exam structure (questions, options, metadata) is serialized into an `ExamSnapshot` row. The student session reads exclusively from the snapshot, so editing questions after launch does not affect active attempts.

**Question type — single vs multiple (single source of truth):** The model stores only `MULTIPLE_CHOICE | BOOLEAN | SHORT_ANSWER`. "Opción única" vs "opción múltiple" is **derived from the number of correct keys** in `metadata` (1 → single, ≥2 → multiple), never a separate type. The student snapshot sanitizer (`attempt_service._sanitize_question_for_student`) strips `correct_keys`/`correct_key` but emits a non-revealing `metadata.multiple = True` hint when there is more than one correct answer (derived from the `correct_keys` list, with a fallback to the `correct_key` string for legacy data). On the frontend the **same rule lives in one place** — `frontend/src/utils/questionType.js` (`resolveLogicalType`, `isMultiAnswer`, `parseCorrectKeys`, `QUESTION_TYPE_META`) — consumed by the question bank, exam editor and the student renderer. The import preview parses raw human CSV (connector words like "A y C") and intentionally keeps its own parser.

**Import validation:** `import_service.py` validates all rows before writing any. A single invalid row causes the entire import to fail — no partial imports. The import runs **synchronously** in the request (`imports.py upload` → `ImportService.process_from_job`), updating `ImportJob` status to COMPLETED/FAILED. A dry-run mode is available for client-side validation preview before committing (`ImportPreviewView`/`ImportConfirmView`).

**Heartbeat & abandonment detection:** `AttemptService.heartbeat()` writes key `edutest:heartbeat:{attempt_id}` to Redis with a 20-minute TTL (1 200 s). The `detect_abandoned` management command (scheduled by the GitHub Actions cron) scans `IN_PROGRESS` attempts whose heartbeat key has expired and transitions them to `ABANDONED`.

**Service exceptions:** All service exceptions inherit from `EduTestError` and expose `.code` and `.to_dict()`. Views catch these and return structured JSON error responses — no raw HTTP exceptions from the service layer.

### Frontend (`frontend/src/`)

**Stack:** React 19 + Vite 8 + JSX, Tailwind CSS v4 (via `@tailwindcss/vite` plugin), native `fetch` API (no Axios), no React Query, no Recharts, no Framer Motion.

**Design tokens:** `src/design-system/tokens.css` — CSS variables (`--accent`, `--ok`, `--warn`, `--danger`, `--fg-*`, `--bg-*`, `--line`). Theme is toggled via `<html data-theme="light|dark">`. Charts read these via `getComputedColor()` from `features/charts/chart-theme.js`.

**API client:** `src/services/api.js` — native `fetch` with silent JWT refresh on 401 (queue-based). Teacher auth via httpOnly cookies (`credentials: 'include'`); student exam auth via `Authorization: Student <jwt>` header (token stored in memory, not localStorage).

**Authentication flows:**

1. **Teacher/Admin:** `POST /auth/login/` → backend sets `access_token` + `refresh_token` httpOnly cookies → `AuthContext` (useState + `/auth/me/` on load) → `AppShell` checks auth.
2. **Student:** Code lookup → `StudentLoginPage` → `POST /auth/student/login/` → `student_attempt` JWT stored in module-level variable via `setStudentToken()` → `StudentRouteGuard` validates it.

**Token refresh:** `tryRefreshToken()` in `api.js` posts to `/auth/refresh/` with no body — the httpOnly `refresh_token` cookie is sent automatically. Backend `CookieTokenRefreshView` reads it from `request.COOKIES` and rotates both tokens as new cookies.

**Route structure (`App.jsx`):**
```
/login                     — teacher login
/exam/:slug                — StudentLoginPage (public)
/exam/:slug/run            — ExamRunPage (student, student-jwt protected)
/exam/:slug/results        — StudentResultsPage
/teacher/*                 — AppShell layout (checks auth)
  dashboard, exams, exams/new, exams/:id/edit, bank, students, students/:id,
  import, monitoring, compare, attempts/:id, settings
```

**Frontend directory layout:** Pages live in `src/app/teacher/` and `src/app/student/`. Migration from `src/pages/` is complete.

**Key frontend patterns:**
- Data fetching uses custom `useApi` hook (wraps `api.js` calls with loading/error state).
- `ExamRunPage` uses debounced autosave (600 ms) + heartbeat every 25 s.
- Chart components (`BarChart`, `DonutChart`, `Histogram`, `Heatmap`, `Sparkline`) are custom SVG/HTML implementations — no Recharts dependency.
- `ChartSkeleton` is used as a loading placeholder for all chart containers.
- `KpiCard` in `features/dashboard/` supports optional `sparkline`, `delta`, and `onClick` props.
- **Question type:** `utils/questionType.js` is the single source of truth for resolving single/multiple/boolean/short-answer (see the *Question type* behavioral pattern above). Do not re-derive single-vs-multiple inline — import `resolveLogicalType`/`isMultiAnswer`/`parseCorrectKeys`.

### Tests

All tests live in `backend/apps/exams/tests/test_views.py`. Fixtures are defined in `backend/conftest.py` using `make_*` helper functions: `api_client`, `org`, `teacher`, `course`, `student`, `question`. When writing new tests, use these fixtures rather than creating objects inline.

### Migrations

Migrations live in `backend/apps/exams/migrations/`. Current state: `0001`–`0011`.  
- `0006` includes a `RunPython` step (`deduplicate_in_progress_attempts`) that resolves duplicate `IN_PROGRESS` attempts before adding the unique constraint — this is intentional and must not be removed.
- `0007` is intentionally empty (no-op).
- `0008` adds `extra_time_minutes` to `Attempt`.
- `0009` adds `draft_token` UUID field to `ImportJob`.
- `0010` adds `unique_student_code_per_org` constraint with idempotent `RunSQL` (safe to apply if constraint already exists).
- `0011` adds `max_attempts` to `Exam`.

When creating new migrations after model changes:
```bash
docker compose exec backend python manage.py makemigrations
```
If the new migration adds a unique constraint on a table that may already have duplicate data in development, add a `RunPython` cleanup step before the `AddConstraint` operation.

---

## Environment

`.env` (gitignored) drives all secrets. Template: `.env.example`.  
Critical variables: `SECRET_KEY`, `DATABASE_URL`, `CACHE_URL`, `REDIS_PASSWORD`.  
Backend uses `python-decouple` — do not use `os.environ` directly in settings.  
Sentry is optional: set `SENTRY_DSN` in `.env` to enable; if empty, the integration is disabled.

**Dev credentials (seed data):**  
Admin login: `admin` / `Admin1234!`
