# Docker Deployment Guide

## Quick Start

### Prerequisites
- Docker & Docker Compose installed
- (Optional) Git for cloning the repository

### One-Command Deployment

```bash
# Clone the repository
git clone <repository-url> school-management
cd school-management

# Ensure .env file exists (copy from .env if needed)
cp .env.example .env

# Start all services (PostgreSQL, Django backend, React frontend)
docker-compose up --build

# On first run, the backend will automatically:
# - Wait for PostgreSQL to be ready
# - Run migrations (creates all database tables)
# - Collect static files
# - Start Gunicorn server
```

## Accessing the Application

After `docker-compose up` completes:

- **Frontend**: http://localhost (React app with Nginx proxy)
- **API**: http://localhost/api/ (proxied to Django backend on port 8000)
- **Django Admin**: http://localhost/admin/ (proxied to Django backend)
- **Direct Backend**: http://localhost:8000 (if needed for debugging)
- **PostgreSQL**: localhost:5432 (database)

## Configuration

### Environment Variables

The application reads configuration from `.env` file:

```env
# Required: Change these in production
SECRET_KEY=your-secret-key-here (50+ chars)
DJANGO_ENV=dev              # or 'prod'
DEBUG=false

# Database (PostgreSQL in Docker)
DB_NAME=school_db
DB_USER=postgres
DB_PASSWORD=postgres        # Change this!
DB_HOST=db                  # Service name in docker-compose
DB_PORT=5432

# Frontend API URL
VITE_API_URL=http://localhost:8000

# Allowed origins (CORS)
CORS_ALLOWED_ORIGINS=http://localhost,http://localhost:8000

# Server configuration
ALLOWED_HOSTS=localhost,127.0.0.1,backend
```

See `.env.example` for all available options.

## Common Tasks

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Run Management Commands
```bash
# Create a superuser
docker-compose exec backend python manage.py createsuperuser

# Run custom management command
docker-compose exec backend python manage.py <command>

# Access Django shell
docker-compose exec backend python manage.py shell
```

### Database Operations
```bash
# Reset database (careful - deletes all data!)
docker-compose exec backend python manage.py flush --noinput

# Backup database
docker-compose exec db pg_dump -U postgres school_db > backup.sql

# Restore database
docker-compose exec -T db psql -U postgres school_db < backup.sql
```

### Stop Services
```bash
# Stop without removing containers
docker-compose stop

# Stop and remove containers (keeps volumes/data)
docker-compose down

# Stop and remove everything (including PostgreSQL data!)
docker-compose down -v
```

### Rebuild Services
```bash
# Rebuild specific service
docker-compose build backend

# Rebuild all services
docker-compose build --no-cache

# Rebuild and restart
docker-compose up --build
```

## Production Deployment

For production, update `.env`:

```env
SECRET_KEY=<generate-a-long-random-string>
DJANGO_ENV=prod
DEBUG=false
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Strong database password
DB_PASSWORD=<strong-password>

# Frontend URL
VITE_API_URL=https://yourdomain.com

# SSL/HTTPS
SECURE_SSL_REDIRECT=true
SESSION_COOKIE_SECURE=true
CSRF_COOKIE_SECURE=true
```

Then deploy:
```bash
docker-compose up -d
```

## Architecture

The system consists of three services:

### PostgreSQL (`db`)
- **Image**: postgres:16-alpine
- **Port**: 5432
- **Volume**: `postgres_data` (persists database between restarts)
- **Health Check**: Confirms database is ready before backend starts

### Django Backend (`backend`)
- **Image**: Custom built from `backend/Dockerfile`
- **Port**: 8000 (Gunicorn application server)
- **Key Process**:
  1. Waits for PostgreSQL to be healthy
  2. Runs database migrations
  3. Collects static files
  4. Starts Gunicorn (3 workers)
- **Volumes**:
  - `./backend:/app` (code, hot-reloadable in dev)
  - `static_vol:/app/static` (collected static files)
  - `media_vol:/app/media` (user uploads)

### React Frontend (`frontend`)
- **Image**: Custom built from `frontend/Dockerfile`
- **Port**: 80 (Nginx web server)
- **Build Process**:
  1. Multi-stage build: Node builder stage compiles React with Vite
  2. Nginx stage: serves compiled assets
- **Nginx Features**:
  - Proxies `/api/` and `/admin/` to backend
  - Serves React SPA with fallback to index.html
  - Gzip compression enabled
  - Asset caching (1 year for .js, .css, .png, etc.)

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose logs backend

# Common issues:
# - Database not ready: Wait longer, check 'db' service health
# - SECRET_KEY not set: Verify .env file exists
# - Port 8000 already in use: docker-compose ps, identify conflict
```

### Frontend shows blank page
```bash
# Check logs
docker-compose logs frontend

# Verify backend is accessible
docker-compose exec frontend wget -O- http://backend:8000/api/

# Check CORS settings
# Ensure CORS_ALLOWED_ORIGINS includes http://localhost or your domain
```

### Database connection errors
```bash
# Verify database is running
docker-compose exec db psql -U postgres -c "SELECT 1;"

# Check DATABASE_URL format
# Must match: postgres://user:password@host:port/dbname
```

### Static files not loading
```bash
# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput

# Verify volume mounted
docker-compose exec backend ls -la /app/static/
```

## Health Checks

Each service includes a health check:

- **PostgreSQL**: Verifies `pg_isready` returns successfully
- **Backend**: HTTP GET to `/api/` endpoint returns 200
- **Frontend**: HTTP GET to `/` returns 200

View health status:
```bash
docker-compose ps
```

The backend won't start until PostgreSQL is healthy (`service_healthy`).

## Scaling & Performance

### Increase Backend Workers
Edit `docker-compose.yml` `entrypoint.sh` line to adjust `--workers`:
```bash
gunicorn ... --workers 6  # Increase from 3
```

### Enable Caching
Set in `.env`:
```env
REDIS_URL=redis://redis:6379/0
```

And add Redis service to `docker-compose.yml` (future enhancement).

## Security Notes

1. **Change Default Credentials**:
   - PostgreSQL password in `.env`
   - Django SECRET_KEY (50+ characters)
   - Create admin user after first run

2. **Production Checklist**:
   - [ ] Change SECRET_KEY to a strong random value
   - [ ] Set `DEBUG=false`
   - [ ] Set `DJANGO_ENV=prod`
   - [ ] Change DB_PASSWORD to a strong value
   - [ ] Update ALLOWED_HOSTS to your domain
   - [ ] Enable HTTPS (SECURE_SSL_REDIRECT, etc.)
   - [ ] Use strong database backup strategy
   - [ ] Monitor logs for errors
   - [ ] Set up log rotation

3. **Container Security**:
   - Backend runs as non-root user `appuser`
   - Frontend runs as non-root user `nginx`
   - No hardcoded secrets in images (all from .env)

## Additional Documentation

- [GitHub Actions CI/CD Guide](../GITHUB_ACTIONS_GUIDE.md)
- [CI Configuration](../.github/workflows/ci.yml)
- [Backend Settings](../backend/config/settings/)
- [Django REST Framework Docs](https://www.django-rest-framework.org/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
