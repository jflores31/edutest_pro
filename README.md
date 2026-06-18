# EduTest Pro

Plataforma multi-tenant para crear, aplicar y calificar exámenes en línea, con
panel docente, banco de preguntas, monitoreo en vivo y rendición segura para
estudiantes. Calificación en escala **vigesimal (0–20)**, aprobación **≥ 11**.

- **Backend:** Django 4.2 + Django REST Framework, PostgreSQL, Redis.
- **Frontend:** React 19 + Vite 8, Tailwind CSS v4, react-router 7 (sin Axios/Recharts).
- **Async:** detección de abandono por comando programado (sin Celery).

> Documentación complementaria: [`CLAUDE.md`](CLAUDE.md) (arquitectura detallada),
> [`DEPLOYMENT.md`](DEPLOYMENT.md) (despliegue con Docker) y
> [`DEPLOY_FREE_TIER.md`](DEPLOY_FREE_TIER.md) (Vercel + Render + Supabase + Upstash).

---

## Características

- **Multi-tenancy:** cada consulta se aísla por `organization`. Acceso cruzado bloqueado.
- **Roles:** ADMIN · TEACHER · STUDENT (los estudiantes acceden por código, sin cuenta).
- **Exámenes:** creación, publicación, archivado, duplicado, plantillas y límite de intentos.
- **ExamSnapshot:** al iniciar un intento se congela una copia inmutable del examen;
  editar preguntas después no afecta a intentos en curso.
- **Rendición segura:** JWT de estudiante en memoria, autosave con debounce,
  heartbeat, temporizador con auto-entrega y registro de eventos de proctoring.
- **Importación masiva:** CSV/XLSX con validación previa (todo-o-nada).
- **Dashboard y analítica:** KPIs, gráficos SVG propios, heatmaps, comparación de exámenes.
- **Monitoreo en vivo:** intentos en progreso actualizados cada 15 s.

---

## Arquitectura

```
Navegador
  ├─ Frontend (React/Vite)  ──/api/v1/*──►  Backend (Django REST + Gunicorn)
  │                                              ├─ PostgreSQL
  │                                              └─ Redis (caché, heartbeat, rate-limit)
  └─ Rendición de examen (JWT de estudiante, header `Authorization: Student <jwt>`)

Detección de abandono: `python manage.py detect_abandoned` (programado por cron)
```

| Capa | Ubicación |
|---|---|
| Modelos de dominio | `backend/apps/exams/models.py` |
| Vistas (HTTP) | `backend/apps/exams/views/` |
| Lógica de negocio | `backend/services/` (`exam_engine`, `attempt_service`, `import_service`) |
| Auth de estudiante | `backend/apps/exams/auth.py` |
| Frontend (SPA) | `frontend/src/` (`app/`, `features/`, `components/`, `services/api.js`) |

Núcleo del dominio (nodos más conectados del grafo del proyecto):
`Organization`, `Attempt`, `ExamEngine`, `Question`, `Exam`, `Student`, `ExamSnapshot`.

---

## Inicio rápido (Docker)

```bash
make setup        # crea .env desde .env.example y los directorios de datos
make up           # levanta los contenedores (build + up -d)
make migrate      # aplica migraciones (también corre en cada arranque)
make superuser    # crea un superusuario
```

App en `http://localhost`. Credenciales de desarrollo (seed): `admin` / `Admin1234!`.

### Frontend en local (sin Docker)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, proxy /api → http://localhost:8000
```

### Pruebas

```bash
make test           # pytest (dentro del contenedor backend)
make test-parallel  # pytest -n auto
```

---

## Estructura del repositorio

```
backend/            Django + DRF (apps/exams, services, tasks, config)
frontend/           React + Vite (src/app, src/features, src/components, src/services)
nginx/              Configuración de Nginx (despliegue Docker)
postgres/           Init de PostgreSQL
render.yaml         Blueprint de despliegue del backend en Render
docker-compose.yml  Orquestación local (postgres, redis, backend, frontend, nginx)
.github/workflows/  CI + cron de detección de abandono
```

---

## Despliegue gratuito

Stack objetivo: **Vercel** (frontend) · **Render** (backend) · **Supabase**
(PostgreSQL) · **Upstash** (Redis). El cron de detección de abandono corre vía
GitHub Actions. Pasos completos en [`DEPLOY_FREE_TIER.md`](DEPLOY_FREE_TIER.md).

---

## Versionado

El proyecto sigue [SemVer](https://semver.org/lang/es/). Los cambios se
registran en [`CHANGELOG.md`](CHANGELOG.md) y se etiquetan en git (`vX.Y.Z`).
