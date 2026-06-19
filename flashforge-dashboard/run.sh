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
export MQTT_ENABLED="$(bashio::config 'mqtt_enabled')"
export MQTT_HOST="$(bashio::config 'mqtt_host')"
export MQTT_PORT="$(bashio::config 'mqtt_port')"
export MQTT_USERNAME="$(bashio::config 'mqtt_username')"
export MQTT_PASSWORD="$(bashio::config 'mqtt_password')"
export MQTT_BASE_TOPIC="$(bashio::config 'mqtt_base_topic')"
export CAMERA_ENTITY="$(bashio::config 'camera_entity')"
export GO2RTC_URL="$(bashio::config 'go2rtc_url')"
export GO2RTC_STREAM="$(bashio::config 'go2rtc_stream')"

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
bashio::log.info "MQTT enabled: ${MQTT_ENABLED}"
bashio::log.info "MQTT broker: ${MQTT_HOST}:${MQTT_PORT}"
if [ -n "${GO2RTC_STREAM}" ]; then
  bashio::log.info "go2rtc URL: ${GO2RTC_URL} / stream: ${GO2RTC_STREAM}"
fi

exec node /app/server.js
