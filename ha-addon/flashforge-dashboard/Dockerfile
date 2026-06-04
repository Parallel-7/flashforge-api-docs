ARG BUILD_FROM
FROM $BUILD_FROM

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
