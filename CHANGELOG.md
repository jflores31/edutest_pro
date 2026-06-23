# Changelog

Todos los cambios notables de este proyecto se documentan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.1.0/)
y el proyecto adopta [SemVer](https://semver.org/lang/es/).

## [0.4.0](https://github.com/jflores31/edutest_pro/compare/v0.3.0...v0.4.0) (2026-06-23)


### Features

* **admin:** add purge_demo management command ([e7c670e](https://github.com/jflores31/edutest_pro/commit/e7c670eaad0758bd356c2ea3eb20140f4f8d39bb))
* **exams:** allow force-delete of exams that have attempts ([4a2f2f8](https://github.com/jflores31/edutest_pro/commit/4a2f2f81e44e33617cd587fd7560a9fc09b12654))
* **import:** append imported questions to an existing exam with dedup ([419ddbf](https://github.com/jflores31/edutest_pro/commit/419ddbf942b45d8a2361a96d382027164ed506ac))
* **import:** exam import skips invalid rows instead of all-or-nothing ([d3c279c](https://github.com/jflores31/edutest_pro/commit/d3c279cb0fe354f7ab2f6da6c88d985cb887c892))
* **import:** support up to 5 options (A–E) in question import ([9a306d2](https://github.com/jflores31/edutest_pro/commit/9a306d2343aa91dc8e0a93d32941d0cbe11111d5))
* **import:** validation panel + export-errors in exam import preview ([a21fa77](https://github.com/jflores31/edutest_pro/commit/a21fa7756c3af59f7e241c09c89c387a1f312b01))
* **layout:** collapsible sidebar + responsive fixes ([6ec65c1](https://github.com/jflores31/edutest_pro/commit/6ec65c17705f2f6d80e499321f3abd9300c5e28b))
* **students:** add single-student create UI ([718b7e4](https://github.com/jflores31/edutest_pro/commit/718b7e404fe2a45eb72191e5de2ecea2941bc6a2))
* **tool:** standalone HTML CSV question-bank importer/validator/exam ([1a86c04](https://github.com/jflores31/edutest_pro/commit/1a86c041c082f8161f42bf3c3e50c6167487c899))
* **ux:** show "Verificando sesión…" spinner while auth loads ([458ef61](https://github.com/jflores31/edutest_pro/commit/458ef617d0551bc9976677c07260ac17c2191279))


### Bug Fixes

* **admin:** purge_demo also clears the dashboard cache ([6c62b4e](https://github.com/jflores31/edutest_pro/commit/6c62b4e889158eec4fb4914d1cf97ae573199c6e))
* **dashboard:** remove duplicate Importar shortcut from Acceso rápido ([df6fd63](https://github.com/jflores31/edutest_pro/commit/df6fd638d9e49f9e16b3c8def4957618a72a7b93))
* **exam-runner:** detect multi-answer questions via the sanitized 'multiple' hint ([6439acf](https://github.com/jflores31/edutest_pro/commit/6439acfcd97bd619fc82f2c459ca375bae548504))
* **exams:** accept multi-answer correct keys when saving a question ([4852812](https://github.com/jflores31/edutest_pro/commit/48528122b213a5462f3d6927f75e4075638b0051))
* **exams:** make delete work for exams with attempts/snapshots ([8a2a7b5](https://github.com/jflores31/edutest_pro/commit/8a2a7b55258511d3a792eba8c47a0b8098d65e0f))
* **frontend:** follow paginated `next` URLs across the proxy ([a207fda](https://github.com/jflores31/edutest_pro/commit/a207fda4840c2403d8297415a08e7a4a99f8e7ae))
* **import:** don't require exam title to preview; ask for it at create ([7bbd02b](https://github.com/jflores31/edutest_pro/commit/7bbd02b97f7b0f4497d2e2744fa31fc9f72f8f6f))
* **import:** far more robust question-type detection ([66082bf](https://github.com/jflores31/edutest_pro/commit/66082bf38ab35f2920b178e16a233e0ab856bea5))
* **import:** preview distinguishes Opción única vs múltiple ([c7d1d4a](https://github.com/jflores31/edutest_pro/commit/c7d1d4a68d1aff1ecd90afaa7b24f6c5cb76dee9))
* **questions:** allow deleting bank questions that are used by exams ([7610439](https://github.com/jflores31/edutest_pro/commit/7610439803e8eddbef8e64bbc496500780a10d74))
* **security:** correct indentation in cookie Secure hardening ([fe0f9fd](https://github.com/jflores31/edutest_pro/commit/fe0f9fd9d78fb6eca6a8772763e3560a1990dc41))
* **security:** force Secure flag on auth cookies in production ([d64388b](https://github.com/jflores31/edutest_pro/commit/d64388b4916195912561be44d805167c56aa3dcc))
* **ui:** repair garbled \uXXXX text and make layout responsive ([dfa4508](https://github.com/jflores31/edutest_pro/commit/dfa4508f696295db6404244f9f19bd6ad7d4b70f))

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
