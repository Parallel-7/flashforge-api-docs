ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

# Install Node.js
RUN apk add --no-cache nodejs npm

# Copy application
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-fund --no-audit

COPY server.js ./
COPY frontend/ ./frontend/

# Start script
COPY run.sh /
RUN chmod +x /run.sh

CMD ["/run.sh"]
