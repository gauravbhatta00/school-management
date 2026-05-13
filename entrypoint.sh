#!/bin/bash
set -e

echo "Running migrations..."
cd /app/backend && python manage.py migrate --noinput

echo "Starting Gunicorn..."
cd /app/backend && gunicorn config.wsgi:application \
  --bind 127.0.0.1:8000 \
  --workers 3 \
  --worker-class sync \
  --access-logfile /dev/stdout \
  --error-logfile /dev/stderr \
  --timeout 120 &

echo "Starting Nginx..."
nginx -g 'daemon off;'