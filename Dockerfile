FROM python:3.10-slim

WORKDIR /app

# Avoid writing .pyc files and ensure logs are flushed
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install dependencies first (better layer caching)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user and ensure write access for logs (e.g., app.log)
RUN adduser --disabled-password --gecos "" appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Run via main.py so config.yaml host/port are respected
CMD ["python", "main.py"]


