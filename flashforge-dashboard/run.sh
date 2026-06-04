#!/usr/bin/with-contenv bashio
# ==============================================================================
# FlashForge Dashboard – Home Assistant add-on start script
# Reads options from /data/options.json via bashio and launches the Node server.
# ==============================================================================

bashio::log.info "Starting FlashForge Dashboard..."

export PRINTER_IP="$(bashio::config 'printer_ip')"
export SERIAL_NUMBER="$(bashio::config 'serial_number')"
export CHECK_CODE="$(bashio::config 'check_code')"
export PORT="8099"
export NODE_ENV="production"
export INGRESS_PATH="$(bashio::addon.ingress_entry)"

if bashio::config.is_empty 'printer_ip'; then
  bashio::log.warning "printer_ip is not configured. Set it in the add-on Configuration tab."
fi
if bashio::config.is_empty 'serial_number'; then
  bashio::log.warning "serial_number is not configured. Set it in the add-on Configuration tab."
fi
if bashio::config.is_empty 'check_code'; then
  bashio::log.warning "check_code is not configured. Set it in the add-on Configuration tab."
fi

bashio::log.info "Printer IP: ${PRINTER_IP}"
bashio::log.info "Listening on port ${PORT}"

exec node /app/server.js
