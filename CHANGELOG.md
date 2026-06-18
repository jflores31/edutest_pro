# Changelog

Todos los cambios notables de este proyecto se documentan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/)
y el proyecto adopta [SemVer](https://semver.org/lang/es/).

## [Unreleased]

## [0.1.0] — 2026-06-18

Primera versión bajo control de versiones. El proyecto pasó a git y quedó listo
para desplegarse en tiers gratuitos, con el frontend reconstruido y correcciones
de un análisis completo del código.

### Added
- Control de versiones (git) y repositorio remoto privado en GitHub.
- **Frontend completo reconstruido** (React 19 + Vite 8 + Tailwind v4): panel
  docente (dashboard, exámenes, editor, banco, estudiantes, importación,
  monitoreo, comparación, ajustes) y flujo de estudiante (login por código,
  rendición con autosave/heartbeat/temporizador, resultados). Cliente API con
  refresh JWT en cola y gráficos SVG propios.
- Preparación para despliegue gratuito: `frontend/vercel.json` (proxy `/api`),
  `render.yaml`, `.github/workflows/detect-abandoned.yml` (cron),
  `DEPLOY_FREE_TIER.md`, `README.md` y este `CHANGELOG.md`.
- Comando `python manage.py detect_abandoned` (reemplaza a Celery Beat).
- Soporte de SSL para Postgres gestionado y `DB_DISABLE_SERVER_SIDE_CURSORS`
  para el pooler de transacciones de Supabase.

### Changed
- **Celery eliminado**: las importaciones corren de forma síncrona en la request
  (≤10 MB / 2000 filas) y la detección de abandono pasa a un comando programado.
- Backend de caché cambiado a `django_redis` (habilita `delete_pattern`, lo que
  corrige la invalidación de caché del dashboard por curso).
- `SECURE_PROXY_SSL_HEADER` configurable para que las cookies de auth obtengan el
  flag `Secure` detrás del proxy TLS.

### Fixed
- Condición de carrera en `start_exam` y login de estudiante: el `IntegrityError`
  ya no rompe la transacción (savepoint anidado).
- `compare`: la nota perfecta (20) ahora cuenta en el último bucket de la distribución.
- Dashboard en vivo: guard contra snapshot nulo (evita 500).
- Importación: nombre de archivo único (evita sobrescritura concurrente).
- Rate-limit: contador atómico y *fail-closed* ante caída de Redis.
- `_parse_xlsx`: cierre del workbook en `finally` (sin fuga de descriptor).
- N+1 en `get_topic_stats` (se aprovecha el prefetch) y filtro de organización en `get_ranking`.
- `OrganizationViewSet`: la edición de la organización se restringe a ADMIN.

### Security
- Cookies de auth con `Secure`/HSTS configurables para producción.
- Pendiente conocido: el endpoint `GET /attempts/:id/state/` expone el snapshot
  con las respuestas correctas al cliente del estudiante (a sanear en backend).

[Unreleased]: https://github.com/jflores31/edutest_pro/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jflores31/edutest_pro/releases/tag/v0.1.0
