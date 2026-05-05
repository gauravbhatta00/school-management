FROM python:3.11-slim

# Prevents .pyc files and enables real-time logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (including postgresql-client for health checks)
RUN apt-get update && apt-get install -y \
    gcc curl postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app
USER appuser

# Create entrypoint script to handle migrations and static files
RUN cat > /app/entrypoint.sh << 'EOF'
#!/bin/bash
set -e

echo "Waiting for database connection..."
while ! pg_isready -h ${DB_HOST:-db} -p ${DB_PORT:-5432} -U ${DB_USER} 2>/dev/null; do
  sleep 2
done

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "Starting Gunicorn..."
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --worker-class sync --access-logfile - --error-logfile - --timeout 120
EOF

RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
