# Stage 1: Build stage (for Prisma compilation if needed)
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies (only needed if Prisma needs compilation)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build time)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Generate Prisma client if using Prisma
RUN npx prisma generate || true

# Stage 2: Production stage (minimal runtime image)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files from builder
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy Prisma schema and generated client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy application source code
COPY --chown=nodejs:nodejs src/ ./src/

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4000

# Health check (removed .env reference, no longer copied in production)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Start application
CMD ["node", "src/server.js"]
