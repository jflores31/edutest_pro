#!/bin/sh
set -e

echo ">>> Waiting for database..."
python manage.py wait_for_db

echo ">>> Running migrations..."
python manage.py migrate --noinput

echo ">>> Collecting static files..."
python manage.py collectstatic --noinput

if [ "$#" -gt 0 ]; then
    echo ">>> Starting: $@"
    exec "$@"
fi

echo ">>> Starting Gunicorn..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
