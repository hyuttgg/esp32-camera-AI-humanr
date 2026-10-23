# Dockerfile for Ocean Vision Python Worker (RAM-only pHash & TurboQuant)
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install runtime dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Run test on startup and launch worker
CMD ["python", "worker.py"]

