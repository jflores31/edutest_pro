# Despliegue gratis: Vercel + Render + Supabase + Upstash

Arquitectura objetivo (sin Celery):

```
Vercel    → frontend (React/Vite)   — vercel.json proxya /api/* → Render
Render    → backend Django/Gunicorn — render.yaml
Supabase  → PostgreSQL              — SSL + pooler 6543
Upstash   → Redis                   — caché, heartbeat, rate-limit, tokens revocados
GitHub Actions → cron detect_abandoned (reemplaza Celery Beat), gratis
```

Celery fue eliminado: los imports corren **síncronos** en la request (≤10MB/2000 filas) y la
detección de abandono es el comando `python manage.py detect_abandoned`.

---

## 0. Prerrequisitos (lo que falta en el repo)

- [ ] **Recuperar `frontend/src/`** — hoy está vacío; sin el código fuente Vercel no compila.
- [ ] Crear repo en GitHub y `git push` (ya hay un commit base en la rama `deploy/free-tier`).
- [ ] Cuentas en: Supabase, Upstash, Render, Vercel.

---

## 1. Supabase (PostgreSQL)

1. New project → copia la contraseña de la BD.
2. Project Settings → Database → **Connection pooling**. Para Render (servidor
   persistente) usa el **Session pooler**: host `...pooler.supabase.com`, puerto **5432**,
   usuario `postgres.<ref>`, db `postgres`. Soporta cursores y conexiones persistentes.
   - Si en su lugar usas el **Transaction pooler (6543)**, además define
     `DB_CONN_MAX_AGE=0` y `DB_DISABLE_SERVER_SIDE_CURSORS=True` (si no, Django falla en runtime).
3. Guarda estos valores para `POSTGRES_*` y pon `POSTGRES_SSLMODE=require`.

## 2. Upstash (Redis)

1. Create database (región cercana a Render).
2. Copia la **URL `rediss://`** (TLS) → será tu `CACHE_URL`.

## 3. Render (backend)

1. New → **Blueprint** → apunta al repo (usa `render.yaml`).
2. En el dashboard, completa las variables marcadas `sync: false`:

   | Variable | Valor |
   |---|---|
   | `SECRET_KEY` | genera uno de 64 chars |
   | `ALLOWED_HOSTS` | `edutest-backend.onrender.com` |
   | `CSRF_TRUSTED_ORIGINS` | `https://<tu-app>.vercel.app` |
   | `CORS_ALLOWED_ORIGINS` | `https://<tu-app>.vercel.app` |
   | `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_HOST` | de Supabase |
   | `POSTGRES_PORT` | `6543` |
   | `POSTGRES_SSLMODE` | `require` |
   | `CACHE_URL` | la URL `rediss://` de Upstash |

   (`SECURE_*` ya vienen activados en `render.yaml`.)
3. El build corre `migrate` y `collectstatic` automáticamente.
4. Crea el superusuario una vez: Render → Shell → `python manage.py createsuperuser`.

## 4. Vercel (frontend)

1. Import Project → **Root Directory = `frontend`** (Vercel detecta Vite y usa `vercel.json`).
2. En `frontend/vercel.json` reemplaza el host de destino del proxy por tu URL real de Render:
   `https://edutest-backend.onrender.com` → `https://<tu-backend>.onrender.com`.
3. Deploy. El proxy `/api/*` mantiene el mismo origen → las cookies de auth funcionan sin tocar nada.

## 5. Cron de detección de abandono (gratis, GitHub Actions)

El workflow `.github/workflows/detect-abandoned.yml` ya corre cada 10 min.
Añade estos **GitHub repo secrets**: `SECRET_KEY`, `POSTGRES_DB`, `POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`, `CACHE_URL`.

---

## Notas / pendientes

- **Render free** duerme tras ~15 min de inactividad (primer request lento). Aceptable para empezar.
- Subida de imports: ahora va a disco efímero solo durante la request (seguro). Si en el futuro
  hace falta persistir archivos, migrar a Supabase Storage.
- Pendiente de iteración (requiere pruebas): fingerprint de `ExamSnapshot` (#7) y lote N+1.
