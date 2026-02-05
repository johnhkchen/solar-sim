# =============================================================================
# Solar-Sim Dockerfile
# Multi-stage build for development and production
# =============================================================================

# -----------------------------------------------------------------------------
# Base stage: Node.js with dependencies
# Using Node 24 LTS (Krypton) - current LTS as of 2026
# -----------------------------------------------------------------------------
FROM node:24-alpine AS base

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY package*.json ./

# -----------------------------------------------------------------------------
# Development stage: Full dev environment with hot reload
# -----------------------------------------------------------------------------
FROM base AS development

RUN npm ci

COPY . .

EXPOSE 3000 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# -----------------------------------------------------------------------------
# Build stage: Compile TypeScript and build SvelteKit
# -----------------------------------------------------------------------------
FROM base AS builder

RUN npm ci

COPY . .

# Build the production application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# -----------------------------------------------------------------------------
# Production stage: Minimal runtime image
# Using slim Debian image for better compatibility and security updates
# -----------------------------------------------------------------------------
FROM node:24-bookworm-slim AS production

WORKDIR /app

# Install curl for healthcheck (apt for Debian-based image)
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Create non-root user (useradd for Debian)
RUN groupadd -g 1001 solar && \
    useradd -u 1001 -g solar -s /bin/false solar

# Copy built application and production dependencies
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create data directories
RUN mkdir -p /data/canopy /data/climate && \
    chown -R solar:solar /data

# Switch to non-root user
USER solar

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "build"]
