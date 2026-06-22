# Changelog

Todos los cambios notables de este proyecto se documentan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/)
y el proyecto adopta [SemVer](https://semver.org/lang/es/).

## [0.3.0](https://github.com/jflores31/edutest_pro/compare/v0.2.0...v0.3.0) (2026-06-22)


### Features

* **import:** question import auto-detects type + robust CSV parsing ([1150e05](https://github.com/jflores31/edutest_pro/commit/1150e05fad22fed6c03e83d522eb14e17cab9abb))
* **students:** delete with confirmation + clean duplicate-DNI errors ([ef7ee42](https://github.com/jflores31/edutest_pro/commit/ef7ee423adc92bf457cf9217b9770085ed028c61))
* **students:** enforce DNI = exactly 8 digits (numbers only) ([484c507](https://github.com/jflores31/edutest_pro/commit/484c507f4e4c4b6e505b504a403707b03cd2676f))
* **students:** import from CSV/XLSX and export to CSV (DNI, Nombres, Apellidos) ([610f9a7](https://github.com/jflores31/edutest_pro/commit/610f9a733e4408f61dee7f3c0b309eca448b7993))


### Bug Fixes

* **students:** import tab supports XLSX and semicolon CSV ([be19a4d](https://github.com/jflores31/edutest_pro/commit/be19a4db76d3c19061947ce3de6e5141514e6416))

## [Unreleased]

## [0.2.0] — 2026-06-21

### Added
- **Reconstrucción completa del frontend** (React 19 + Vite 8 + Tailwind v4):
  sistema de diseño propio (`design-system/`: Button, Card, Badge, Input, Table,
  Tabs, Toggle, Avatar, Skeleton, Icon), módulos por dominio (`features/`:
  charts, dashboard, import, toast, notifications, student, exams), hooks
  reutilizables (`useDebounce`, `useLocalStorage`, `useMediaQuery`, `useCountUp`),
  utilidades, `layout/Sidebar`, tema claro/oscuro (`ThemeContext`) y guard de
  rutas de estudiante.

### Fixed
- **Exam-runner**: `question_type` `TRUE_FALSE`→`BOOLEAN` y el contrato de
  respuestas de opción múltiple (`selected_key` / `selected_keys`) alineados con
  el backend.
- **Despliegue**: proxy `/api` de Vercel, contrato de login por `email` y seed de
  Render corregidos.
- **Calidad de código**: 49 errores de ESLint resueltos (lint en 0, build OK),
  incluyendo bugs reales en runtime: botón eliminar del editor de importación
  (`ReferenceError`), comparación de exámenes (ref no declarada), `DonutChart`
  (hook tras un *early return*) y colisión de IDs por `Date.now()` en el editor.

### Changed
- `useMediaQuery` reescrito con `useSyncExternalStore`; componentes inline
  *hoisted* y estado derivado en render según buenas prácticas de React.

## [0.1.1] — 2026-06-18

### Security
- **Fuga de respuestas corregida:** el snapshot que se enviaba al estudiante
  (endpoint `GET /attempts/:id/state/` y respuesta de `POST /auth/student/login/`)
  incluía las respuestas correctas (`correct_keys`, `correct_key`, `correct_answer`,
  `keywords`, `case_sensitive`, `strict_mode`, `explanation` y el `is_correct` de
  cada opción). Ahora se sanea con `sanitize_snapshot_for_student()` (whitelist:
  solo `key`/`text` de opciones, una pista `multiple` no reveladora y campos de
  display seguros). La calificación sigue leyendo las respuestas del snapshot en BD,
  nunca del cliente. Cubierto por `SnapshotSanitizationTest`.

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

[Unreleased]: https://github.com/jflores31/edutest_pro/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/jflores31/edutest_pro/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/jflores31/edutest_pro/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jflores31/edutest_pro/releases/tag/v0.1.0
