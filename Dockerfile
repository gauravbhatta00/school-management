# ============================================================================
# STAGE 1: Build React Frontend with Node
# ============================================================================
FROM node:18-alpine AS frontend-builder

WORKDIR /frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy frontend source
COPY frontend/ .

# Build the React app with Vite
RUN npm run build


# ============================================================================
# STAGE 2: Build Python Backend (prepare dependencies)
# ============================================================================
FROM python:3.11-slim AS backend-builder

WORKDIR /backend

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc curl postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# ============================================================================
# STAGE 3: Final Runtime Image (Nginx + Django Backend)
# ============================================================================
FROM python:3.11-slim

# Prevents .pyc files and enables real-time logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install Nginx and runtime dependencies
RUN apt-get update && apt-get install -y \
    nginx curl \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

# Copy Python dependencies from builder stage
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# Copy Django backend source
COPY backend/ /app/backend/
COPY backend/requirements.txt /app/

# Collect static files at build time (permanent fix for missing CSS)
RUN cd /app/backend && SECRET_KEY=temp-build-key python manage.py collectstatic --noinput

# Copy React build output from frontend builder stage
COPY --from=frontend-builder /frontend/dist /app/frontend-dist

# Create non-root user for security
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app

# Copy Nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script (permanent fix for CRLF issues)
COPY entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r//' /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Nginx needs to run as root to bind to port 80
EXPOSE 80
EXPOSE 443

ENTRYPOINT ["/app/entrypoint.sh"]