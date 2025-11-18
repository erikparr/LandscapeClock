# Dockerfile for Railway Worker
FROM node:20-slim

# Install required system dependencies for sharp
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for now)
RUN npm install

# Copy application code
COPY . .

# Ensure static/images directory exists and seed images are present
RUN mkdir -p /app/static/images && \
    if [ ! -f /app/static/images/input.jpg ]; then \
        echo "Creating fallback seed image..." && \
        curl -L "https://picsum.photos/512/512" -o /app/static/images/input.jpg || \
        convert -size 512x512 xc:skyblue /app/static/images/input.jpg || \
        echo "Warning: Could not create seed image"; \
    fi && \
    if [ ! -f /app/static/images/default_seed_image.png ]; then \
        cp /app/static/images/input.jpg /app/static/images/default_seed_image.png 2>/dev/null || true; \
    fi && \
    ls -la /app/static/images/ || echo "static/images directory check"

# Expose port for health checks
EXPOSE 3001

# Start the worker
CMD ["node", "railway-worker.js"]
