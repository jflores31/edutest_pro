# EduTest Pro — Guía de Despliegue y Migración

Esta guía contiene **todo lo necesario** para levantar el proyecto desde cero en otro ambiente (otra máquina, otro servidor, otra red).

---

## 1. Requisitos del ambiente destino

| Componente | Versión mínima | Notas |
|---|---|---|
| Docker Engine | 24.0+ | Soporta `docker compose` (sin guion) |
| Docker Compose | v2.20+ | Plugin moderno, no `docker-compose` legacy |
| Git | 2.30+ | Solo si se clona desde repositorio |
| Espacio en disco | ≥ 5 GB | Imágenes + volúmenes |
| RAM disponible | ≥ 4 GB | Para los 5 contenedores |
| Puertos libres en host | `80`, `5433`, `6380` | Configurables en `.env` |

**Sistema operativo:** Linux, macOS o Windows con WSL2 / Docker Desktop. No requiere Python, Node ni PostgreSQL instalados localmente — todo corre dentro de Docker.

---

## 2. Estructura mínima del proyecto

Lo que **debes copiar** al ambiente destino (todo lo no listado se reconstruye solo):

```
edutest_pro/
├── backend/                # Código Django (apps, services, config)
│   ├── apps/exams/         # Modelos, vistas, serializers, migraciones, management commands
│   ├── config/             # settings.py, urls.py, wsgi.py, middleware
│   ├── services/           # Lógica de negocio (exam_engine, attempt, import)
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── manage.py
│   ├── pytest.ini
│   ├── conftest.py
│   └── requirements.txt
├── frontend/               # SPA React + Vite
│   ├── src/
│   ├── public/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── eslint.config.js
│   └── index.html
├── nginx/
│   ├── nginx.conf          # Reverse proxy edge
│   └── proxy_params.conf
├── postgres/
│   └── init.sql            # CREATE EXTENSION uuid-ossp, UTC timezone
├── docker-compose.yml
├── Makefile
├── README.md
├── CLAUDE.md               # Opcional — solo si se usará Claude Code
├── .env.example            # Plantilla — NUNCA copies el .env real
└── .gitignore
```

**No copiar nunca al destino:**
- `.env` real (contiene secretos del ambiente origen)
- `data/postgres/`, `data/redis/` (datos del ambiente origen — corrompen el destino)
- `frontend/node_modules/`, `frontend/dist/`
- `backend/__pycache__/`, `*.pyc`
- `backend/staticfiles/`, `backend/media/` (se regeneran)

---

## 3. Pasos de migración (paso a paso)

### 3.1. Transferir el código

**Opción A — vía Git (recomendado):**
```bash
git clone <repo-url> edutest_pro
cd edutest_pro
```

**Opción B — vía archivo comprimido (Linux / macOS / WSL2 / Git Bash):**
```bash
cd /c/Users/JESHU/Downloads
tar --exclude='edutest_pro/data' \
    --exclude='edutest_pro/.env' \
    --exclude='edutest_pro/frontend/node_modules' \
    --exclude='edutest_pro/frontend/dist' \
    --exclude='edutest_pro/backend/__pycache__' \
    --exclude='edutest_pro/.claude' \
    --exclude='edutest_pro/.agents' \
    -czf edutest_pro.tar.gz edutest_pro/
```

**Opción B (Windows PowerShell nativo):**
```powershell
$exclude = @('data','.env','frontend\node_modules','frontend\dist','backend\__pycache__','.claude','.agents')
Get-ChildItem -Path edutest_pro -Recurse -Force |
    Where-Object { $f = $_.FullName; -not ($exclude | Where-Object { $f -match [regex]::Escape("edutest_pro\$_") }) } |
    Compress-Archive -DestinationPath edutest_pro.zip -Force
```
(Alternativa más simple: usar 7-Zip GUI excluyendo manualmente esas carpetas.)

En el ambiente destino:
```bash
tar -xzf edutest_pro.tar.gz   # o: unzip edutest_pro.zip
cd edutest_pro
```

### 3.2. Crear el archivo `.env`

```bash
cp .env.example .env
```

Editar `.env` y reemplazar los valores marcados como `change-me-*`. Los **críticos** son:

| Variable | Cómo generar / qué poner |
|---|---|
| `SECRET_KEY` | `python -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits+'!@#$%^&*(-_=+)') for _ in range(64)))"` |
| `POSTGRES_PASSWORD` | Password fuerte aleatorio (≥ 20 caracteres) |
| `DATABASE_URL` | Debe contener el `POSTGRES_PASSWORD` que pusiste arriba |
| `REDIS_PASSWORD` | Password fuerte aleatorio |
| `CACHE_URL` | Debe contener el `REDIS_PASSWORD` que pusiste arriba |
| `ALLOWED_HOSTS` | Dominio público del nuevo ambiente (ej. `evaluaciones.misitio.com`) — siempre incluir `localhost,127.0.0.1,backend` |
| `CSRF_TRUSTED_ORIGINS` | URL pública con esquema (ej. `https://evaluaciones.misitio.com`) |
| `CORS_ALLOWED_ORIGINS` | Mismas URLs que CSRF |
| `DEBUG` | `False` siempre en producción |

**Para producción con HTTPS** además:
```env
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

### 3.3. Setup inicial y arranque

```bash
make setup    # si no existe .env, copia .env.example → .env; crea ./data/postgres y ./data/redis
make up       # docker compose up --build -d → construye y levanta los 5 contenedores
```

> **Nota sobre `./data/`:** Estos directorios son scaffold legado y están vacíos. Los datos reales viven en **volúmenes Docker nombrados** (`postgres_data`, `redis_data`, `static_files`, `media_files`) — gestionados por Docker, no en bind mounts del proyecto. Por eso `make clean` (`docker compose down -v`) sí destruye los datos aunque `./data/` aparente estar vacío.

El primer `make up` toma 3–8 minutos. Docker descarga 5 imágenes base (`postgres:16-alpine`, `redis:7-alpine`, `nginx:1.27-alpine`, `python:3.12-slim`, `node:20-alpine`), construye 2 imágenes propias (backend y frontend), instala dependencias y compila el bundle Vite.

`entrypoint.sh` del backend automáticamente:
1. Espera a Postgres (`wait_for_db`)
2. Ejecuta `migrate --noinput`
3. Ejecuta `collectstatic --noinput`
4. Arranca Gunicorn con 3 workers en `:8000`

### 3.4. Verificar que todo está arriba

```bash
docker compose ps                       # 4 servicios deben mostrar (healthy); ver tabla abajo
curl -i http://localhost/api/health/    # 200 OK
curl -i http://localhost/               # 200 con index.html del SPA
make redis                              # dentro del CLI: PING → PONG
```

| Servicio | Healthcheck propio | Estado esperado |
|---|---|---|
| `postgres`, `redis`, `backend`, `frontend` | Sí | `Up (healthy)` |
| `nginx` | No (depende de `backend healthy`) | `Up` solamente |

Si algo falla:
```bash
make logs        # logs de todos los contenedores
make logs-b      # solo backend
docker compose logs nginx
```

### 3.5. Crear superusuario administrador

**Opción A — usuario manual (producción):**
```bash
make superuser
```
Django pedirá `username`, `email` y password. El usuario se crea con `is_superuser=True` pero **sin** organización ni `role=ADMIN` asignados. Para asociarlo a una organización entra al admin (`/admin/exams/user/`) o usa `make shell`.

**Opción B — seed completo (demo / staging):**
```bash
docker compose exec backend python manage.py seed_data
```
Esto crea: organización "Demo Organization", admin `admin/Admin1234!` (si no existe), estudiante `student1/Student1234!`, ~10 preguntas de Redes, un examen ejemplo, y algunos intentos sembrados. Si ya existe un superuser, lo asocia a la org Demo y le asigna `role=ADMIN` (no lo duplica). **No usar en producción** con datos reales.

Acceso: `http://localhost/login` con `admin` / `Admin1234!`.

---

## 4. Migración con datos existentes

Si necesitas **conservar los datos** del ambiente origen (usuarios, organizaciones, exámenes, intentos), sigue esto **en lugar** de crear superusuario.

### 4.1. Exportar desde el ambiente origen

```bash
# Backup completo de Postgres (estructura + datos), streaming directo al host
docker compose exec -T postgres pg_dump -U edutest -d edutest -F c > edutest_backup.dump

# Backup del volumen media (si subiste archivos en /media)
docker run --rm -v edutest_pro_media_files:/data -v "$PWD":/backup alpine \
    tar czf /backup/media_backup.tar.gz -C /data .
```

> **Nombre del volumen:** Docker Compose prefija los volúmenes con el nombre del proyecto (carpeta donde está `docker-compose.yml`). Si renombras la carpeta `edutest_pro/` a otra cosa, los volúmenes serán `<nuevonombre>_media_files`, etc. Verifica con `docker volume ls`.

Copiar al ambiente destino los archivos `edutest_backup.dump` y `media_backup.tar.gz` (scp, rsync, S3, etc.).

### 4.2. Restaurar en el ambiente destino

```bash
# Setup base (.env, dirs) y crear los volúmenes vacíos
make setup
docker compose up -d postgres redis

# Esperar a que postgres esté healthy (sin polling — un solo retry suele bastar)
docker compose exec postgres pg_isready -U edutest

# Restaurar el dump por stdin (sin pasar por el filesystem del contenedor)
docker compose exec -T postgres pg_restore -U edutest -d edutest --clean --if-exists < edutest_backup.dump

# Restaurar media en el volumen ya creado por docker compose up
docker run --rm -v edutest_pro_media_files:/data -v "$PWD":/backup alpine \
    sh -c "cd /data && tar xzf /backup/media_backup.tar.gz"

# Arrancar el resto (backend, frontend, nginx)
make up
```

**Importante:**
- La versión de Postgres del origen y destino debe ser la misma (`postgres:16-alpine`).
- **NO ejecutes `make superuser` ni `seed_data`** después de restaurar: el dump ya trae todos los usuarios con sus hashes de contraseña intactos.
- Las migraciones se re-aplican automáticamente vía `entrypoint.sh` al levantar `backend`; como el dump ya tiene la tabla `django_migrations` poblada, `migrate` es no-op.

---

## 5. Configuraciones críticas por ambiente

### 5.1. Puertos expuestos

Por defecto solo nginx escucha en el host (`:80`). Postgres (`:5433`) y Redis (`:6380`) están **bindeados a `127.0.0.1`** vía:

```yaml
ports:
  - "${POSTGRES_EXTERNAL_PORT:-127.0.0.1:5433:5432}"
  - "${REDIS_PORT:-127.0.0.1:6380:6379}"
```

Para abrirlos a la red o cambiar el puerto del host, añade al `.env` el mapeo completo (la sustitución reemplaza la cadena entera, no solo el puerto):

```env
POSTGRES_EXTERNAL_PORT=0.0.0.0:5433:5432
REDIS_PORT=0.0.0.0:6380:6379
NGINX_PORT=8080         # si :80 ya está ocupado en el host
```

⚠ Abrir Postgres o Redis a `0.0.0.0` solo si están protegidos por firewall externo — exponen credenciales si quedan accesibles a internet.

### 5.2. HTTPS / TLS

`nginx/nginx.conf` actualmente expone solo HTTP. Para producción con HTTPS hay dos caminos:

**A. Terminación TLS upstream (recomendado):** poner un load balancer (Cloudflare, AWS ALB, Caddy, Traefik) delante de nginx. No tocar el `nginx.conf` interno.

**B. TLS dentro del nginx del proyecto:** montar certificados como volumen y agregar `listen 443 ssl;` con `ssl_certificate`/`ssl_certificate_key` en `nginx/nginx.conf`. Recordar agregar `ports: - "443:443"` al servicio `nginx` en `docker-compose.yml`.

En cualquier caso, en `.env` activar `SECURE_SSL_REDIRECT=True` y `SESSION_COOKIE_SECURE=True`.

### 5.3. Zona horaria

`config/settings.py` fija `TIME_ZONE = "America/Lima"` y `LANGUAGE_CODE = "es-pe"`. Si el nuevo ambiente requiere otra zona, edítalo allí (no por env var).

### 5.4. Tamaño máximo de upload

- Nginx edge: `client_max_body_size 15M` (`nginx/nginx.conf`)
- Backend import: `MAX_IMPORT_FILE_SIZE_MB = 10` (`config/settings.py`)

Si necesitas archivos más grandes, aumenta **ambos**.

### 5.5. Sentry (opcional)

En `.env`:
```env
SENTRY_DSN=https://xxx@sentry.io/yyy
SENTRY_ENVIRONMENT=production
VITE_SENTRY_DSN=https://xxx@sentry.io/zzz   # Para el frontend
```

Si `SENTRY_DSN` está vacío, la integración no se inicializa (no falla).

> **⚠ `VITE_SENTRY_DSN` es build-time:** Vite lo embebe en el bundle durante `npm run build`. Cambiarlo en `.env` después de levantar requiere rebuild explícito del frontend: `docker compose build frontend && docker compose up -d frontend`.

### 5.6. Variables build-time del frontend (Vite)

El `Dockerfile` del frontend acepta un build arg que se embebe en el bundle:

| Build arg | Default | Propósito |
|---|---|---|
| `VITE_API_BASE` | `/api/v1` | Prefijo de todas las llamadas del SPA. Solo cambiar si el SPA se sirve en un dominio distinto al de la API. |

Para sobrescribir, añade `args:` al servicio `frontend` en `docker-compose.yml`:
```yaml
frontend:
  build:
    context: ./frontend
    args:
      VITE_API_BASE: https://api.misitio.com/api/v1
```
Luego `docker compose build frontend && docker compose up -d frontend`.

### 5.7. CORS y cookies httpOnly

`config/settings.py` fija `CORS_ALLOW_CREDENTIALS = True` y `CORS_ALLOW_ALL_ORIGINS = False` — obligatorio para que las cookies httpOnly de docente lleguen al backend. Si el SPA y la API quedan en dominios distintos:
1. `CORS_ALLOWED_ORIGINS` en `.env` debe incluir el origen del SPA con esquema (`https://app.misitio.com`).
2. En producción con dominios separados las cookies deben emitirse con `SameSite=None; Secure`, lo cual requiere HTTPS en ambos.

---

## 6. Operación diaria

```bash
# Logs
make logs              # todos los contenedores
make logs-b            # backend

# Detección de abandono (reemplaza a Celery Beat — ver §6.1)
make detect-abandoned  # docker compose exec backend python manage.py detect_abandoned

# Acceso a contenedores
make shell             # Django shell
make bash              # bash dentro del backend
make psql              # cliente psql
make redis             # redis-cli (auto-autenticado)

# Mantenimiento
make migrate           # solo si hiciste makemigrations manualmente
make test              # pytest completo
make test-parallel     # pytest -n auto
docker compose exec backend pytest apps/exams/tests/test_views.py -k "test_login" -v

# Rebuild parcial tras cambios
docker compose build backend && docker compose up -d
docker compose build frontend && docker compose up -d

# Parar / limpiar
make down              # detiene contenedores (conserva volúmenes)
make clean             # detiene Y borra volúmenes — ¡pierdes los datos!
```

### 6.1. Programar la detección de abandono (sin Celery)

Ya no hay `celery-beat`. La transición de intentos `IN_PROGRESS` → `ABANDONED` se hace con el
comando `python manage.py detect_abandoned`. Hay dos formas de programarlo:

- **Despliegue free-tier (Vercel/Render):** el workflow `.github/workflows/detect-abandoned.yml`
  ya lo corre cada 10 min gratis (configura los GitHub repo secrets — ver `DEPLOY_FREE_TIER.md` §5).
- **Self-hosted (Docker):** añade un cron en el host que invoque el comando dentro del contenedor:

  ```cron
  # /etc/cron.d/edutest-detect-abandoned  — cada 10 minutos
  */10 * * * *  cd /ruta/a/edutest_pro && docker compose exec -T backend python manage.py detect_abandoned >> /var/log/edutest-detect.log 2>&1
  ```

---

## 7. Backup periódico (producción)

**Postgres — diario:**
```bash
docker compose exec -T postgres pg_dump -U edutest -d edutest -F c \
    > backups/edutest_$(date +%Y%m%d).dump
```

**Media files — semanal:**
```bash
docker run --rm -v edutest_pro_media_files:/data -v "$PWD/backups":/backup alpine \
    tar czf /backup/media_$(date +%Y%m%d).tar.gz -C /data .
```

**Redis no necesita backup** — almacena solo caché y heartbeat (datos efímeros).

---

## 8. Checklist final de migración

Antes de declarar el ambiente como listo:

- [ ] `docker compose ps` muestra 4 servicios `(healthy)` (postgres, redis, backend, frontend) y 1 simplemente `Up` (nginx)
- [ ] `curl http://<host>/api/health/` devuelve `200 OK`
- [ ] Login del admin funciona en `http://<host>/login`
- [ ] El dashboard carga sin errores en consola del navegador
- [ ] `make detect-abandoned` corre sin error (imprime `Marked N attempt(s) as abandoned.`)
- [ ] Cron del host (o GitHub Actions) programado para `detect_abandoned` (ver §6.1)
- [ ] Una importación de preguntas funciona end-to-end (corre síncrona en la request)
- [ ] Crear un examen de prueba y simular un intento funciona end-to-end
- [ ] `.env` tiene `SECRET_KEY`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD` distintos a los del template
- [ ] `DEBUG=False` y `ALLOWED_HOSTS` contiene el dominio público real
- [ ] Si es producción: HTTPS configurado y `SECURE_*=True`
- [ ] Backup automático de Postgres programado (cron / systemd timer)

---

## 9. Resolución de problemas comunes

**"backend: unhealthy" en `docker compose ps`**
→ `make logs-b`. Probable causa: `.env` mal formado o `DATABASE_URL` apuntando a un host inválido. Verifica que `POSTGRES_HOST=postgres` (nombre del servicio, no `localhost`).

**Frontend muestra "Network Error" en login**
→ El SPA hace fetch a `/api/v1/...` (proxy de nginx). Si nginx no está arriba o `backend` no es saludable, el proxy falla. Revisa `docker compose logs nginx`.

**"CSRF verification failed" al loguear**
→ Falta el dominio en `CSRF_TRUSTED_ORIGINS` del `.env`. Debe incluir el esquema (`https://midominio.com`, no `midominio.com`).

**Los intentos no pasan a `ABANDONED`**
→ Ya no hay Celery Beat. La detección la hace `python manage.py detect_abandoned`, que debe
estar programado (cron del host o GitHub Actions — ver §6.1). Pruébalo a mano con
`make detect-abandoned`; si marca intentos, el comando funciona y solo falta el scheduler.

**Migraciones fallan con "duplicate key value"**
→ La migración `0006` ya maneja deduplicación de `IN_PROGRESS` con `RunPython`. Si aparece en otra migración, ejecuta en `make psql` para limpiar manualmente antes de re-correr `migrate`.

**`make up` falla con "port already in use"**
→ El puerto `80` está ocupado en el host. Edita `NGINX_PORT=8080` (o el que quieras) en `.env` y reintenta.

**Cambié `VITE_API_BASE` o `VITE_SENTRY_DSN` en `.env` y no surte efecto**
→ Son variables de build del frontend, no de runtime. Vite las embebe en el bundle durante `npm run build`. Hay que rebuildear: `docker compose build frontend && docker compose up -d frontend`.

**Pierdo sesión inmediatamente al loguear (cookies no se setean)**
→ Si SPA y API están en dominios distintos, las cookies `access_token`/`refresh_token` necesitan `SameSite=None; Secure`, lo cual exige HTTPS en ambos extremos. Sin HTTPS, el navegador rechaza la cookie y el siguiente request va sin auth. Solución: servir todo desde el mismo dominio (recomendado) o forzar HTTPS y ajustar `SESSION_COOKIE_SAMESITE` en `settings.py`.

---

## 10. Rollback rápido

Si algo sale mal después de actualizar:

```bash
git checkout <commit-anterior>
docker compose build
docker compose up -d
```

Si una migración corrupta dejó la DB en mal estado, restaura desde el último dump:
```bash
docker compose stop backend
docker compose exec postgres pg_restore -U edutest -d edutest --clean --if-exists /tmp/last_good.dump
docker compose start backend
```

---

## 11. Contacto y referencias

- Documentación interna de arquitectura: ver `CLAUDE.md` y `README.md`
- Tests: `backend/apps/exams/tests/test_views.py`
- Fixtures de test: `backend/conftest.py`
- Migraciones: `backend/apps/exams/migrations/` (estado actual: `0001`–`0012`)
