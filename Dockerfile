# ==============================================================================
# UNIFIED HEAVY CLOUD DOCKERFILE (React Web + NestJS Backend + Python AI Worker)
# Compatible with: Hugging Face Spaces (16GB RAM Free), Render, Koyeb, Railway
# ==============================================================================

# Stage 1: Build React Frontend (apps/web-ocean)
FROM node:20-alpine AS web-builder
WORKDIR /workspace/apps/web-ocean
COPY apps/web-ocean/package*.json ./
RUN npm install
COPY apps/web-ocean/ ./
RUN npm run build

# Stage 2: Build NestJS Backend (apps/api-nest)
FROM node:20-alpine AS api-builder
WORKDIR /workspace/apps/api-nest
COPY apps/api-nest/package*.json ./
RUN npm install
COPY apps/api-nest/ ./
RUN npm run build

# Stage 3: Unified Production Runtime (Node 20 + Python 3.11 Vision Engine)
FROM node:20-bookworm-slim
WORKDIR /workspace

# Install Python 3 runtime for AI Vision Worker & Serial Flasher
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Copy Python Vision Worker & compiled ESP32-CAM firmware binaries
COPY apps/vision-worker ./apps/vision-worker
COPY human_detector.py ./human_detector.py
COPY include ./include
COPY src ./src
COPY firmware ./firmware
RUN pip3 install --no-cache-dir --break-system-packages -r apps/vision-worker/requirements.txt pyserial

# Copy built Frontend and Backend
COPY --from=web-builder /workspace/apps/web-ocean/dist ./apps/web-ocean/dist
COPY --from=api-builder /workspace/apps/api-nest/dist ./apps/api-nest/dist
COPY --from=api-builder /workspace/apps/api-nest/node_modules ./apps/api-nest/node_modules
COPY --from=api-builder /workspace/apps/api-nest/package.json ./apps/api-nest/package.json

ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

WORKDIR /workspace/apps/api-nest
CMD ["sh", "-c", "python3 ../vision-worker/worker.py & node dist/main.js"]

