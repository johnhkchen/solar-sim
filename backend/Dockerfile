# =============================================================================
# Solar-Sim Django Backend
# =============================================================================

FROM python:3.14-slim-bookworm AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies
RUN uv pip install --system -e .

# -----------------------------------------------------------------------------
# Development
# -----------------------------------------------------------------------------
FROM base AS development

RUN uv pip install --system -e ".[dev]"

COPY . .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# -----------------------------------------------------------------------------
# Production
# -----------------------------------------------------------------------------
FROM base AS production

COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput

# Create non-root user
RUN groupadd -g 1001 django && \
    useradd -u 1001 -g django -s /bin/false django && \
    chown -R django:django /app

USER django

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health/ || exit 1

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
