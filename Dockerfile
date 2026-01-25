# Multi-stage build for Vite React app on Cloud Run

# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Install sed for entrypoint script
RUN apk add --no-cache sed

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Ensure config.js exists (it should be copied from public/ during build)
# If not, create it from template
RUN if [ ! -f /usr/share/nginx/html/config.js ]; then \
    echo "// Runtime configuration - will be injected by entrypoint script" > /usr/share/nginx/html/config.js && \
    echo "window.__ENV__ = {" >> /usr/share/nginx/html/config.js && \
    echo "  VITE_API_URL: '{{VITE_API_URL}}'," >> /usr/share/nginx/html/config.js && \
    echo "  VITE_API_URL_MAINTENANCE: '{{VITE_API_URL_MAINTENANCE}}'," >> /usr/share/nginx/html/config.js && \
    echo "  VITE_IMAGE_API_URL: '{{VITE_IMAGE_API_URL}}'," >> /usr/share/nginx/html/config.js && \
    echo "};" >> /usr/share/nginx/html/config.js; \
    fi

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Copy nginx configuration for SPA routing
RUN echo 'server { \
    listen 8080; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /health { \
        access_log off; \
        return 200 "healthy\n"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Use entrypoint script to inject environment variables
ENTRYPOINT ["/entrypoint.sh"]

