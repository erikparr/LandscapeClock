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

# Expose port for health checks
EXPOSE 3001

# Start the worker
CMD ["node", "railway-worker.js"]
