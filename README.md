# EduTest Pro

Plataforma de evaluaciones académicas multi-tenant con panel para docentes y flujo de examen para alumnos.

## Stack

| Capa | Tecnología |
|---|---|
| **Backend** | Django 4 + DRF + SimpleJWT + Redis + PostgreSQL |
| **Frontend** | React 19 + Vite 8 + Tailwind CSS v4 |
| **Infra** | Docker Compose — 5 contenedores |

> **Sin dependencias pesadas:** native `fetch` (no Axios), no React Query, no Recharts, no Framer Motion. Los gráficos son SVG custom.

---

## Inicio rápido

```bash
make setup     # copia .env.example → .env y crea directorios de datos
make up        # construye imágenes y levanta todos los contenedores
make superuser # crea usuario administrador interactivamente
```

Acceso por defecto: `admin` / `Admin1234!` en `http://localhost`

---

## Comandos útiles

```bash
make logs          # tail de todos los contenedores
make logs-b        # tail solo del backend
make test          # pytest completo dentro del contenedor backend
make test-parallel # pytest -n auto
make shell         # Django shell interactivo
make psql          # cliente psql dentro del contenedor postgres
make redis         # Redis CLI

# Rebuild parcial (solo backend Python)
docker compose build backend && docker compose up -d

# Rebuild parcial (solo frontend)
docker compose build frontend && docker compose up -d

# Test de un archivo o función específica
docker compose exec backend pytest apps/exams/tests/test_views.py -k "test_name" -v

# Migraciones tras cambios en modelos
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

---

## Arquitectura

```
Browser → Nginx (:80)
            ├── /api/v1/*       → Backend Gunicorn (:8000)
            ├── /*              → Frontend SPA (React/Vite)
            └── /static, /media → Volúmenes Docker

Backend → PostgreSQL (:5433 host) + Redis (:6380 host — caché/heartbeat)
```

**Sin Celery:** los imports corren **síncronos** dentro de la request y la detección de
abandono es el comando `python manage.py detect_abandoned`, programado por un cron gratis de
GitHub Actions (`.github/workflows/detect-abandoned.yml`).

### Contenedores

| Contenedor | Rol |
|---|---|
| `edutest_nginx` | Reverse proxy + sirve el SPA |
| `edutest_backend` | API Django/Gunicorn |
| `edutest_frontend` | Build Vite servido por nginx interno |
| `edutest_postgres` | Base de datos principal |
| `edutest_redis` | Caché + heartbeat de intentos + rate-limit + tokens revocados |

---

## Backend — `backend/`

### Modelos (`apps/exams/models.py`)

```
Organization (tenant raíz)
 └── User (ADMIN | TEACHER | STUDENT)
      └── UserIntegration (key, connected bool)
 └── Course
      └── Student (sin cuenta User — auth por código + nombres; `code` = DNI de 8 dígitos, único por org)
 └── Question (versionada, metadata JSON)
 └── Exam ──M2M(ExamQuestion)──► Question
      ├── ExamSnapshot (copia JSON inmutable al iniciar el intento)
      └── Attempt (IN_PROGRESS | COMPLETED | ABANDONED)
           ├── AttemptAnswer (autoguardado por pregunta)
           └── ProctoringEvent (TAB_SWITCH, FOCUS_LOST, RECONNECT, OFFLINE)
 └── ExamTemplate
 └── ImportJob
 └── Notification (in-app — tipo, título, cuerpo, org)
```

### Escala de notas

- `Attempt.score` almacena nota **vigesimal 0–20**
- Umbral de aprobación: **score ≥ 11** (`PASS_THRESHOLD = 11`)
- El dashboard devuelve `avg_score` en la misma escala 0–20
- Para mostrar en porcentaje: `score × 5`

### Autenticación

- **Docentes/Admin:** cookies httpOnly (`access_token` + `refresh_token`). El middleware `CookieAuthMiddleware` inyecta el token como `Authorization: Bearer` transparentemente.
- **Alumnos:** `StudentAttemptAuthentication` — header `Authorization: Student <jwt>`. Payload contiene `attempt_id`, `student_id`, `org_id`, `exam_id`. Token vive en memoria (no localStorage).
- **Refresh:** `POST /auth/refresh/` sin body — lee `refresh_token` cookie y rota ambos tokens como nuevas cookies httpOnly.

### Multi-tenancy

Todos los querysets filtran por `organization_id` del usuario autenticado. Acceso cruzado lanza `CrossTenantAccessError`.

### Caché y heartbeat

| Clave Redis | TTL | Propósito |
|---|---|---|
| `dashboard_stats_{org_id}_{course_id}` | 300 s | Payload completo del dashboard |
| `edutest:heartbeat:{attempt_id}` | max(1200 s, duración_examen + 600 s) | Prueba de vida del intento |
| `edutest:revoked_token:{jti}` | — | Tokens de alumno revocados |

### Notificaciones in-app

Al completar un examen, `ExamEngine.submit_exam()` crea automáticamente:
- `attempt_finished` — siempre
- `low_score` — si `score < 11`

`GET /api/v1/notifications/` devuelve las últimas 30 notificaciones de la organización.

Las preferencias de email se gestionan en `GET/PATCH /api/v1/auth/me/notifications/` y devuelven `[{key, on}]`.

### Migraciones (`apps/exams/migrations/`)

| Migración | Cambio |
|---|---|
| 0001–0005 | Modelos base, constraints iniciales |
| 0006 | Constraints únicos para IN_PROGRESS + RunPython deduplicación |
| 0007 | No-op intencional |
| 0008 | `Attempt.extra_time_minutes` |
| 0009 | `ImportJob.draft_token` UUID |
| 0010 | Student unique constraint (RunSQL idempotente) |
| 0011 | `Exam.max_attempts` |
| 0012 | Modelo `Notification` |

---

## Frontend — `frontend/src/`

### Rutas (`App.jsx`)

```
/login                       — Login docente
/forgot-password             — Solicitud de reset de contraseña
/reset-password?uid=&token=  — Confirmación de reset
/exam/:slug                  — StudentLoginPage (pública)
/exam/:slug/run              — ExamRunPage (JWT alumno)
/exam/:slug/results          — StudentResultsPage

/teacher/*  (protegido, AppShell)
  dashboard      — Métricas generales
  exams          — Lista de exámenes
  exams/new      — Crear examen
  exams/:id/edit — Editar examen
  bank           — Banco de preguntas
  students       — Lista de alumnos
  students/:id   — Perfil de alumno
  import         — Importar preguntas y alumnos
  monitoring     — Monitoreo en vivo
  compare        — Comparativa de exámenes
  attempts/:id   — Detalle de intento
  settings       — Configuración (cuenta, cursos, integraciones, notificaciones, plantillas)
```

### Cliente API (`src/services/api.js`)

- `fetch` nativo con refresh silencioso en 401 (cola para evitar múltiples refreshes concurrentes)
- Timeout global de 30 s con AbortController
- `getAll()` sigue paginación DRF automáticamente
- Módulos: `auth`, `exams`, `questions`, `attempts`, `students`, `courses`, `templates`, `dashboard`, `integrations`, `notifications`, `imports`

### Notificaciones frontend

- `NotificationBell` en el Sidebar: muestra badge con conteo de no leídas (compara `created_at` vs `localStorage.notifications_last_seen`)
- Dropdown con las últimas 30 notificaciones, ícono por tipo, tiempo relativo
- `SettingsPage` tab "Notificaciones": usa las keys reales del backend; convierte respuesta `[{key, on}]` → `{key: bool}` para los Toggles

### Patrones clave

- **Tipo de pregunta (única/múltiple/V-F/corta):** el backend solo guarda
  `MULTIPLE_CHOICE/BOOLEAN/SHORT_ANSWER`; **única vs múltiple se deriva del nº de respuestas
  correctas** (1 → única, ≥2 → múltiple). La regla está centralizada en `utils/questionType.js`
  (`resolveLogicalType`, `isMultiAnswer`, `parseCorrectKeys`, `QUESTION_TYPE_META`) y la consumen el
  banco de preguntas, el editor de exámenes y el render del alumno. El snapshot del alumno se sanea
  (sin claves correctas) y solo lleva la pista `metadata.multiple` para mostrar radio vs checkbox.
- **Autosave:** 600 ms debounce en ExamRunPage
- **Heartbeat:** cada 25 s durante el examen
- **mountedRef:** todos los componentes con fetch usan alive guard para evitar setState post-unmount
- **Gráficos:** SVG/HTML custom — DonutChart, Histogram, Heatmap, Sparkline y **BarChart
  horizontal** ("Promedio por examen": título legible + tooltip del nombre completo, color por
  umbral, marca de umbral; evita el solapamiento de etiquetas rotadas). `buildBarData` ordena por
  nota y limita a top 10.
- **ChartSkeleton:** placeholder de carga para todos los contenedores de gráficos
- **Diseño / iconos (sistema duotono, theme-aware):** acento de marca **índigo** + paleta
  educativa de tonos `--color-ic-*` (indigo/violet/teal/amber/sky/emerald/rose/slate, con `-soft`,
  en `tokens.css`). El componente `Icon` (wrapper de lucide-react) mapea cada icono a un tono
  (`TONE`) y soporta `variant` `plain` | `soft` | `chip` + prop `tone`. `Badge` tiene variantes de
  tono. Aplicado en: sidebar (nav por color), logo "E" (degradado índigo→violeta), KPIs y accesos
  rápidos del dashboard, **encabezados** (`PageHead` deriva un chip de color del breadcrumb),
  **tarjetas de examen** y **badges** (tipo/dificultad). Los iconos chicos de control quedan en
  `plain` (legibilidad).
- **Responsive + sidebar colapsable:** el `Sidebar` es drawer en `< md` (hamburguesa + overlay) y
  persistente en `md+`, donde además se puede **ocultar/mostrar** (chevron para colapsar + botón
  flotante para reabrir). `PageHead` apila título/acciones y las tablas usan `overflow-x-auto`.
  Hooks `useIsMobile`/`useIsTablet` en `hooks/useMediaQuery.js`.
- **Sesión:** `AppShell` muestra un spinner "Verificando sesión…" mientras valida `/auth/me/` y
  redirige a `/login` si no hay sesión (el backend bloquea además todo dato sin auth → 401).

---

## Importación y exportación de datos

Todo el parseo de archivos corre en el **backend** (CSV con coma / `;` / tab, con o sin
BOM, UTF-8 o Latin-1; y `.xlsx` vía openpyxl). Máx 10 MB / 2 000 filas.

### Alumnos

- **Importar** (`POST /students/import/`, multipart `file` + `course_id`): columnas
  **`DNI, Nombres, Apellidos`** (+ `Correo` opcional). El docente elige el curso destino en
  la UI (lista de alumnos → "Importar alumnos", o pestaña Importar). El **DNI debe tener
  exactamente 8 dígitos (solo números)**; se guarda como `Student.code` y es único por
  organización (DNI repetido → se omite; DNI inválido → fila reportada y omitida).
- **Exportar** (`GET /students/export/?course_id=`): CSV `DNI,Nombres,Apellidos` (BOM para
  Excel, guard anti-inyección de fórmulas). Respeta el filtro de curso.
- **CRUD**: **alta individual** ("Agregar alumno"), editar y eliminar desde la lista
  (eliminar es seguro aun con intentos — `Attempt.student` es `SET_NULL`).

### Preguntas / exámenes

- **Importar** (`POST /exams/import/`): plantilla de **9 columnas**
  `Pregunta, Opción A–E, Respuesta Correcta, Explicación, Tema` (Opción E opcional). Puede
  **crear un examen nuevo** (campo `title`) o **agregar a un examen existente** (`exam_id`)
  con **deduplicación por enunciado** (las repetidas no se enlazan y se reportan).
  El **tipo se detecta automáticamente** (insensible a acentos, con sinónimos en español):
  - opciones llenas + 1 respuesta correcta (`A`) → **opción única** → radio
  - opciones llenas + varias correctas (`A, C y D`) → **opción múltiple** → checkbox
  - sin opciones, o con opciones = Verdadero/Falso, + `Verdadero`/`Falso`/`Sí`/`No` → **Verdadero/Falso**
  - sin opciones + texto → **respuesta corta**

  Una columna `Tipo` opcional la sobreescribe ("Verdadero/Falso", "Opción múltiple",
  "Selección simple"…). Flujo: subir → **vista previa con panel de validación** (✅/❌,
  conteos y lista de errores por fila) → crear/agregar. Las filas inválidas se **omiten**
  (importación tolerante) y se pueden **exportar a CSV** ("Exportar errores", con columna
  `Error`) para corregirlas y reimportar. La calificación de las múltiples es **conjunto
  exacto** (todo-o-nada, sin crédito parcial).
- **Eliminar:** un examen con intentos/snapshots se borra de forma forzada (elimina también
  sus intentos); una pregunta **en uso** por un examen se **desactiva** (sale del banco, el
  examen queda intacto) y si **no** está en uso se borra físicamente.

> **Herramienta auxiliar:** `banco-preguntas.html` (raíz del repo) — archivo único
> autocontenido (vanilla JS, sin dependencias ni APIs) para importar/validar/visualizar un
> CSV de 9 columnas, con modo examen de práctica y exportación de errores. Se abre directo
> en el navegador.

---

## Variables de entorno

`.env` (gitignoreado) maneja todos los secretos. Plantilla: `.env.example`.

Variables críticas: `SECRET_KEY`, `DATABASE_URL`, `CACHE_URL`, `REDIS_PASSWORD`.

Sentry es opcional: define `SENTRY_DSN` en `.env` para habilitarlo (si está vacío, la integración se deshabilita).

---

## Tests

```bash
# Todos los tests
make test

# Paralelo
make test-parallel

# Un test específico
docker compose exec backend pytest apps/exams/tests/test_views.py -k "test_name" -v
```

Los tests viven en `backend/apps/exams/tests/test_views.py`. Los fixtures están en `backend/conftest.py` con helpers `make_*`: `api_client`, `org`, `teacher`, `course`, `student`, `question`.
