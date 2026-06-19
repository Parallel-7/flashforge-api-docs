# BUILD_FROM is injected by the HA build system based on build.yaml.
# The default below is a local-dev fallback for x86_64 machines only.
ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

# Install Node.js
RUN apk add --no-cache nodejs npm ffmpeg

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
