FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies without running the prepare script
RUN npm install --ignore-scripts

# Copy source code and tsconfig
COPY tsconfig.json ./
COPY src ./src

# Build the application manually
RUN npx tsc && chmod +x build/index.js

FROM node:20-alpine AS release

WORKDIR /app

# Copy built files and package files from builder stage
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

# Set environment to production
ENV NODE_ENV=production

# Install only production dependencies without running scripts
RUN npm ci --ignore-scripts --omit=dev

# Create logs directory
RUN mkdir -p logs

# Set the entrypoint
ENTRYPOINT ["node", "build/index.js"]