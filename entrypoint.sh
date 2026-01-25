#!/bin/sh

# Replace placeholders in config.js with environment variables from Cloud Run
sed -i "s|{{VITE_API_URL}}|${VITE_API_URL:-http://localhost:8000}|g" /usr/share/nginx/html/config.js
sed -i "s|{{VITE_API_URL_MAINTENANCE}}|${VITE_API_URL_MAINTENANCE:-http://localhost:8000}|g" /usr/share/nginx/html/config.js
sed -i "s|{{VITE_IMAGE_API_URL}}|${VITE_IMAGE_API_URL:-}|g" /usr/share/nginx/html/config.js

# Start nginx
exec nginx -g 'daemon off;'

