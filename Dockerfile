# Use Node.js Bullseye image for better native module compatibility
FROM node:22-bullseye-slim

# Install only essential system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies
RUN yarn install

# Copy source code
COPY . .

# Create necessary directories for your application
RUN mkdir -p /usr/src/app/cache

# Set environment variables
ENV NODE_ENV=production
ENV USER_PORT=5111
ENV ADMIN_PORT=5222

# Expose both ports
EXPOSE 5111 5222

# Add healthcheck for user port
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:5111/health').then(r => process.exit(r.ok ? 0 : 1))"

# Start the application
CMD ["yarn", "start"]