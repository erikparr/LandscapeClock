# Dockerfile for Railway Worker
FROM node:20-slim

# Install required system dependencies for sharp
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for now)
RUN npm install

# Copy application code
COPY . .

# Ensure static/images directory exists and copy seed images explicitly
RUN mkdir -p /app/static/images
COPY static/images/input.jpg /app/static/images/input.jpg
COPY static/images/default_seed_image.png /app/static/images/default_seed_image.png

# Expose port for health checks
EXPOSE 3001

# Start the worker
CMD ["node", "railway-worker.js"]
