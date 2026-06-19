'use strict';

// Note: no dotenv — environment variables are injected by run.sh via bashio.

const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');

const app = express();
const PORT = process.env.PORT || 8099;
const PRINTER_IP = process.env.PRINTER_IP;
const SERIAL_NUMBER = process.env.SERIAL_NUMBER;
const CHECK_CODE = process.env.CHECK_CODE;
const KNOWN_MQTT_COMMAND_PAYLOADS = new Set([
  '1', 'ON', 'TRUE', 'OPEN', 'PAUSE', 'STOP', 'CLEAR', 'PRESS', 'RESUME', 'CONTINUE', 'CLOSE', '0', 'OFF', 'FALSE',
]);

// HA Ingress sets this env var to the URL prefix it uses when proxying
// (e.g. "/api/hassio_ingress/abc123"). The frontend needs this to build
// correct absolute URLs for fetch() calls and the camera stream.
const INGRESS_PATH = (process.env.INGRESS_PATH || '').replace(/\/$/, '');

const PRINTER_API = `http://${PRINTER_IP}:8898`;
const GO2RTC_URL = (process.env.GO2RTC_URL || 'http://ccab4aaf-frigate:1984').replace(/\/$/, '');
const GO2RTC_STREAM = (process.env.GO2RTC_STREAM || 'Stampante').trim();
const MQTT_ENABLED = parseBooleanEnv(process.env.MQTT_ENABLED, true);
const MQTT_HOST = process.env.MQTT_HOST || 'core-mosquitto';
const MQTT_PORT = Number(process.env.MQTT_PORT || 1883);
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';
const MQTT_BASE_TOPIC = sanitizeTopic(process.env.MQTT_BASE_TOPIC || 'flashforge');
const MQTT_POLL_INTERVAL_MS = 10000;

const DEVICE_ID = String(SERIAL_NUMBER || PRINTER_IP || 'flashforge_printer')
  .replace(/[^\w-]/g, '_')
  .toLowerCase();
const DEVICE_NAME = SERIAL_NUMBER ? `FlashForge ${SERIAL_NUMBER}` : 'FlashForge Printer';
const MQTT_ROOT_TOPIC = `${MQTT_BASE_TOPIC}/${DEVICE_ID}`;
const MQTT_AVAILABILITY_TOPIC = `${MQTT_ROOT_TOPIC}/availability`;

let mqttClient = null;
let mqttConnected = false;
let mqttDiscoveryPublished = false;
let lastPrinterDetail = null;
let cameraSwitchState = 'OFF';
let mqttPollingTimer = null;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend', 'public')));

// multer: store upload in memory, then stream to printer
const upload = multer({ storage: multer.memoryStorage() });

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * POST to the printer's HTTP REST API with standard auth fields.
 * Times out after PRINTER_TIMEOUT_MS to avoid hanging indefinitely.
 */
const PRINTER_TIMEOUT_MS = 8000;

async function printerPost(endpoint, body = {}) {
  const payload = { serialNumber: SERIAL_NUMBER, checkCode: CHECK_CODE, ...body };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRINTER_TIMEOUT_MS);
  try {
    const res = await fetch(`${PRINTER_API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Printer returned ${res.status}: ${text}`);
    }
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Printer did not respond within ${PRINTER_TIMEOUT_MS / 1000}s (${PRINTER_API})`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function printerControl(cmd, args = {}) {
  return printerPost('/control', {
    payload: {
      cmd,
      args,
    },
  });
}

function sanitizeTopic(topic) {
  return String(topic || 'flashforge')
    .trim()
    .replace(/^[\/\s]+|[\/\s]+$/g, '')
    .replace(/\s+/g, '_');
}

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function mqttPublish(topic, payload, options = {}) {
  if (!mqttClient || !mqttConnected) return;
  mqttClient.publish(topic, String(payload), { qos: 0, retain: false, ...options });
}

function getCurrentJobId() {
  if (!lastPrinterDetail || !Array.isArray(lastPrinterDetail.jobInfo)) return '';
  return (lastPrinterDetail.jobInfo[0] && lastPrinterDetail.jobInfo[0][1]) || '';
}

function publishMqttState(detail) {
  if (!detail || !mqttConnected) return;

  const normalizedStatus = String(detail.status || 'ready').trim().toUpperCase();
  const progress = detail.printProgress != null ? Math.round(detail.printProgress * 100) : 0;
  const isPrinting = ['PRINTING', 'BUSY', 'HEATING', 'PAUSED', 'PAUSING'].includes(normalizedStatus);
  const pauseSwitchState = ['PAUSED', 'PAUSING'].includes(normalizedStatus) ? 'ON' : 'OFF';

  mqttPublish(`${MQTT_ROOT_TOPIC}/state/status`, normalizedStatus, { retain: true });
  mqttPublish(`${MQTT_ROOT_TOPIC}/state/progress`, progress, { retain: true });
  mqttPublish(`${MQTT_ROOT_TOPIC}/state/file_name`, detail.printFileName || '', { retain: true });
  mqttPublish(`${MQTT_ROOT_TOPIC}/state/nozzle_temp`, detail.rightTemp ?? '', { retain: true });
  mqttPublish(`${MQTT_ROOT_TOPIC}/state/bed_temp`, detail.platTemp ?? '', { retain: true });
  mqttPublish(`${MQTT_ROOT_TOPIC}/state/chamber_temp`, detail.chamberTemp ?? '', { retain: true });
  mqttPublish(`${MQTT_ROOT_TOPIC}/state/estimated_time_s`, detail.estimatedTime ?? '', { retain: true });
  mqttPublish(`${MQTT_ROOT_TOPIC}/state/layer_current`, detail.printLayer ?? '', { retain: true });
  mqttPublish(`${MQTT_ROOT_TOPIC}/state/layer_target`, detail.targetPrintLayer ?? '', { retain: true });
  mqttPublish(`${MQTT_ROOT_TOPIC}/state/is_printing`, isPrinting ? 'ON' : 'OFF', { retain: true });
  mqttPublish(`${MQTT_ROOT_TOPIC}/state/pause_switch`, pauseSwitchState, { retain: true });
  mqttPublish(`${MQTT_ROOT_TOPIC}/state/camera_switch`, cameraSwitchState, { retain: true });
}

function updatePrinterDetail(detail) {
  if (!detail) return;
  lastPrinterDetail = detail;
  publishMqttState(detail);
}

function createMqttDeviceInfo() {
  return {
    identifiers: [DEVICE_ID],
    name: DEVICE_NAME,
    manufacturer: 'FlashForge',
    model: 'AD5 Series',
  };
}

function publishMqttDiscovery() {
  if (!mqttConnected || mqttDiscoveryPublished) return;
  const device = createMqttDeviceInfo();
  const discoveryBase = 'homeassistant';
  const publishDiscovery = (component, objectId, payload) => {
    const topic = `${discoveryBase}/${component}/${DEVICE_ID}/${objectId}/config`;
    mqttPublish(topic, JSON.stringify(payload), { retain: true });
  };

  publishDiscovery('sensor', 'status', {
    name: 'Status',
    unique_id: `${DEVICE_ID}_status`,
    state_topic: `${MQTT_ROOT_TOPIC}/state/status`,
    icon: 'mdi:printer-3d-nozzle-alert',
    availability_topic: MQTT_AVAILABILITY_TOPIC,
    device,
  });
  publishDiscovery('sensor', 'progress', {
    name: 'Progress',
    unique_id: `${DEVICE_ID}_progress`,
    state_topic: `${MQTT_ROOT_TOPIC}/state/progress`,
    unit_of_measurement: '%',
    icon: 'mdi:progress-clock',
    availability_topic: MQTT_AVAILABILITY_TOPIC,
    device,
  });
  publishDiscovery('sensor', 'nozzle_temp', {
    name: 'Nozzle Temperature',
    unique_id: `${DEVICE_ID}_nozzle_temp`,
    state_topic: `${MQTT_ROOT_TOPIC}/state/nozzle_temp`,
    unit_of_measurement: '°C',
    device_class: 'temperature',
    availability_topic: MQTT_AVAILABILITY_TOPIC,
    device,
  });
  publishDiscovery('sensor', 'bed_temp', {
    name: 'Bed Temperature',
    unique_id: `${DEVICE_ID}_bed_temp`,
    state_topic: `${MQTT_ROOT_TOPIC}/state/bed_temp`,
    unit_of_measurement: '°C',
    device_class: 'temperature',
    availability_topic: MQTT_AVAILABILITY_TOPIC,
    device,
  });
  publishDiscovery('sensor', 'chamber_temp', {
    name: 'Chamber Temperature',
    unique_id: `${DEVICE_ID}_chamber_temp`,
    state_topic: `${MQTT_ROOT_TOPIC}/state/chamber_temp`,
    unit_of_measurement: '°C',
    device_class: 'temperature',
    availability_topic: MQTT_AVAILABILITY_TOPIC,
    device,
  });
  publishDiscovery('sensor', 'estimated_time', {
    name: 'Estimated Time',
    unique_id: `${DEVICE_ID}_estimated_time_s`,
    state_topic: `${MQTT_ROOT_TOPIC}/state/estimated_time_s`,
    unit_of_measurement: 's',
    icon: 'mdi:timer-outline',
    availability_topic: MQTT_AVAILABILITY_TOPIC,
    device,
  });
  publishDiscovery('binary_sensor', 'is_printing', {
    name: 'Printing',
    unique_id: `${DEVICE_ID}_is_printing`,
    state_topic: `${MQTT_ROOT_TOPIC}/state/is_printing`,
    payload_on: 'ON',
    payload_off: 'OFF',
    availability_topic: MQTT_AVAILABILITY_TOPIC,
    device,
  });
  publishDiscovery('switch', 'pause_resume', {
    name: 'Pause Print',
    unique_id: `${DEVICE_ID}_pause_resume`,
    state_topic: `${MQTT_ROOT_TOPIC}/state/pause_switch`,
    command_topic: `${MQTT_ROOT_TOPIC}/command/pause_resume`,
    payload_on: 'PAUSE',
    payload_off: 'RESUME',
    state_on: 'ON',
    state_off: 'OFF',
    icon: 'mdi:pause-circle',
    availability_topic: MQTT_AVAILABILITY_TOPIC,
    device,
  });
  publishDiscovery('switch', 'camera', {
    name: 'Camera Stream',
    unique_id: `${DEVICE_ID}_camera_stream`,
    state_topic: `${MQTT_ROOT_TOPIC}/state/camera_switch`,
    command_topic: `${MQTT_ROOT_TOPIC}/command/camera`,
    payload_on: 'OPEN',
    payload_off: 'CLOSE',
    state_on: 'ON',
    state_off: 'OFF',
    icon: 'mdi:cctv',
    availability_topic: MQTT_AVAILABILITY_TOPIC,
    device,
  });
  publishDiscovery('button', 'stop', {
    name: 'Stop Print',
    unique_id: `${DEVICE_ID}_stop`,
    command_topic: `${MQTT_ROOT_TOPIC}/command/stop`,
    payload_press: 'STOP',
    icon: 'mdi:stop-circle',
    availability_topic: MQTT_AVAILABILITY_TOPIC,
    device,
  });
  publishDiscovery('button', 'clear_state', {
    name: 'Clear Printer State',
    unique_id: `${DEVICE_ID}_clear_state`,
    command_topic: `${MQTT_ROOT_TOPIC}/command/clear_state`,
    payload_press: 'CLEAR',
    icon: 'mdi:broom',
    availability_topic: MQTT_AVAILABILITY_TOPIC,
    device,
  });

  mqttDiscoveryPublished = true;
}

async function refreshPrinterState() {
  if (!PRINTER_IP || !SERIAL_NUMBER || !CHECK_CODE) return;
  try {
    const data = await printerPost('/detail');
    if (data && data.detail) {
      updatePrinterDetail(data.detail);
    }
  } catch (err) {
    console.warn(`MQTT state refresh failed: ${err.message}`);
  }
}

function isKnownCommandPayload(payload) {
  return KNOWN_MQTT_COMMAND_PAYLOADS.has(payload);
}

async function handleMqttCommand(topic, payloadRaw) {
  const payload = String(payloadRaw || '').trim().toUpperCase();
  if (!payload || !isKnownCommandPayload(payload)) return;

  if (topic === `${MQTT_ROOT_TOPIC}/command/camera`) {
    const action = ['OPEN', 'ON', '1', 'TRUE'].includes(payload) ? 'open' : 'close';
    cameraSwitchState = action === 'open' ? 'ON' : 'OFF';
    mqttPublish(`${MQTT_ROOT_TOPIC}/state/camera_switch`, cameraSwitchState, { retain: true });
    return;
  }

  if (topic === `${MQTT_ROOT_TOPIC}/command/pause_resume`) {
    const action = ['PAUSE', 'ON', '1', 'TRUE'].includes(payload) ? 'pause' : 'continue';
    await printerControl('jobCtl_cmd', { jobID: getCurrentJobId(), action });
    await refreshPrinterState();
    return;
  }

  if (topic === `${MQTT_ROOT_TOPIC}/command/stop`) {
    if (!['STOP', 'PRESS', 'ON', '1', 'TRUE'].includes(payload)) return;
    await printerControl('jobCtl_cmd', { jobID: getCurrentJobId(), action: 'cancel' });
    await refreshPrinterState();
    return;
  }

  if (topic === `${MQTT_ROOT_TOPIC}/command/clear_state`) {
    if (!['CLEAR', 'PRESS', 'ON', '1', 'TRUE'].includes(payload)) return;
    await printerControl('stateCtrl_cmd', { action: 'setClearPlatform' });
    await refreshPrinterState();
  }
}

function setupMqtt() {
  if (!MQTT_ENABLED) {
    console.log('MQTT disabled via configuration.');
    return;
  }

  const mqttUrl = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
  const options = {
    reconnectPeriod: 5000,
    will: {
      topic: MQTT_AVAILABILITY_TOPIC,
      payload: 'offline',
      retain: true,
    },
  };
  if (MQTT_USERNAME) options.username = MQTT_USERNAME;
  if (MQTT_PASSWORD) options.password = MQTT_PASSWORD;

  mqttClient = mqtt.connect(mqttUrl, options);

  mqttClient.on('connect', async () => {
    mqttConnected = true;
    mqttDiscoveryPublished = false;
    console.log(`Connected to MQTT broker at ${mqttUrl}`);
    mqttPublish(MQTT_AVAILABILITY_TOPIC, 'online', { retain: true });
    publishMqttDiscovery();
    await refreshPrinterState();

    const commandTopics = [
      `${MQTT_ROOT_TOPIC}/command/camera`,
      `${MQTT_ROOT_TOPIC}/command/pause_resume`,
      `${MQTT_ROOT_TOPIC}/command/stop`,
      `${MQTT_ROOT_TOPIC}/command/clear_state`,
    ];
    mqttClient.subscribe(commandTopics, (err) => {
      if (err) {
        console.warn(`MQTT subscribe error: ${err.message}`);
      }
    });
  });

  mqttClient.on('message', async (topic, payload) => {
    try {
      await handleMqttCommand(topic, payload);
    } catch (err) {
      console.warn(`MQTT command error on ${topic}: ${err.message}`);
    }
  });

  mqttClient.on('error', (err) => {
    console.warn(`MQTT error: ${err.message}`);
  });

  mqttClient.on('close', () => {
    mqttConnected = false;
  });
}

/**
 * Validate that required env vars are set and return 503 otherwise.
 */
function requireConfig(req, res, next) {
  if (!PRINTER_IP || !SERIAL_NUMBER || !CHECK_CODE) {
    return res.status(503).json({
      error: 'Printer not configured. Set printer_ip, serial_number and check_code in the add-on Configuration tab.',
    });
  }
  next();
}

// ── API Routes ───────────────────────────────────────────────────────────────

/**
 * GET /api/status
 * Returns the full detail response from the printer.
 */
app.get('/api/status', requireConfig, async (req, res) => {
  try {
    const data = await printerPost('/detail');
    if (data && data.detail) {
      updatePrinterDetail(data.detail);
    }
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/**
 * POST /api/control
 * Body: { action: "pause"|"continue"|"cancel", jobID?: "..." }
 */
app.post('/api/control', requireConfig, async (req, res) => {
  const { action, jobID } = req.body;
  if (!action) {
    return res.status(400).json({ error: 'action is required' });
  }
  try {
    const data = await printerControl('jobCtl_cmd', { jobID: jobID || '', action });
    await refreshPrinterState();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/state/clear', requireConfig, async (req, res) => {
  try {
    const data = await printerControl('stateCtrl_cmd', { action: 'setClearPlatform' });
    await refreshPrinterState();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/**
 * GET /api/files
 * Returns the list of printable files stored on the printer.
 */
app.get('/api/files', requireConfig, async (req, res) => {
  try {
    const data = await printerPost('/gcodeList');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/**
 * GET /api/thumb?fileName=...
 * Returns base64 thumbnail for a file.
 */
app.get('/api/thumb', requireConfig, async (req, res) => {
  const { fileName } = req.query;
  if (!fileName) return res.status(400).json({ error: 'fileName is required' });
  try {
    const data = await printerPost('/gcodeThumb', { fileName });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/**
 * POST /api/print
 * Body: { fileName: "...", levelingBeforePrint: true|false }
 * Starts printing a file already stored on the printer.
 */
app.post('/api/print', requireConfig, async (req, res) => {
  const { fileName, levelingBeforePrint = false } = req.body;
  if (!fileName) return res.status(400).json({ error: 'fileName is required' });
  try {
    const data = await printerPost('/printGcode', { fileName, levelingBeforePrint });
    await refreshPrinterState();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/**
 * POST /api/upload
 * Multipart form with field "gcodeFile".
 * Optional form fields: printNow (0|1), levelingBeforePrint (0|1)
 */
app.post('/api/upload', requireConfig, upload.single('gcodeFile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'gcodeFile is required' });

  const printNow = req.body.printNow || '0';
  const levelingBeforePrint = req.body.levelingBeforePrint || '0';
  const fileSize = req.file.size;

  // Build a multipart body to forward to the printer
  const boundary = `----FormBoundary${Date.now()}`;
  const preamble = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="gcodeFile"; filename="${req.file.originalname}"`,
    `Content-Type: application/octet-stream`,
    '',
    '',
  ].join('\r\n');
  const epilogue = `\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    Buffer.from(preamble),
    req.file.buffer,
    Buffer.from(epilogue),
  ]);

  const printerRes = await fetch(`${PRINTER_API}/uploadGcode`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      serialNumber: SERIAL_NUMBER,
      checkCode: CHECK_CODE,
      fileSize: String(fileSize),
      printNow,
      levelingBeforePrint,
    },
    body,
  });

  const result = await printerRes.json().catch(() => ({ code: printerRes.status }));
  if (printerRes.ok && result.code === 0) {
    if (printNow === '1') {
      try {
        await printerPost('/printGcode', {
          fileName: req.file.originalname,
          levelingBeforePrint: levelingBeforePrint === '1',
        });
      } catch (err) {
        // Upload succeeded; report the print-start failure without blocking the response
        await refreshPrinterState();
        return res.status(200).json({ code: 0, printStartError: err.message });
      }
    }
    await refreshPrinterState();
  }
  res.status(printerRes.ok ? 200 : 502).json(result);
});

/**
 * POST /api/camera
 * Body: { action: "open"|"close" }
 * Tracks camera switch state (the stream itself is provided by HA).
 */
app.post('/api/camera', requireConfig, async (req, res) => {
  const { action } = req.body;
  if (!action) return res.status(400).json({ error: 'action is required' });
  cameraSwitchState = action === 'open' ? 'ON' : 'OFF';
  mqttPublish(`${MQTT_ROOT_TOPIC}/state/camera_switch`, cameraSwitchState, { retain: true });
  res.json({});
});

// ── go2rtc integration ───────────────────────────────────────────────────────

/** Server-side cache for go2rtc client script to avoid fetching it on every page load. */
let cachedVideoRtcJs = null;
let cachedVideoRtcJsAt = 0;
const VIDEO_RTC_CACHE_TTL_MS = 3600000; // 1 hour

const GO2RTC_UPSTREAM_HOST = 'ccab4aaf-frigate';
const GO2RTC_UPSTREAM_PORT = 1984;
const GO2RTC_UPSTREAM_HOST_HEADER = `${GO2RTC_UPSTREAM_HOST}:${GO2RTC_UPSTREAM_PORT}`;
const GO2RTC_CLIENT_CANDIDATE_PATHS = ['/api/go2rtc/client.js', '/video-rtc.js'];

/**
 * GET /api/go2rtc/client.js
 * Proxies the go2rtc client JS so the browser can load it from the same origin.
 */
app.get('/api/go2rtc/client.js', async (req, res) => {
  if (!GO2RTC_URL) {
    return res.status(503).send('// go2rtc_url not configured\n');
  }

  const now = Date.now();
  if (cachedVideoRtcJs && (now - cachedVideoRtcJsAt) < VIDEO_RTC_CACHE_TTL_MS) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'max-age=3600');
    return res.send(cachedVideoRtcJs);
  }

  try {
    for (const candidatePath of GO2RTC_CLIENT_CANDIDATE_PATHS) {
      const upstream = await fetch(`${GO2RTC_URL}${candidatePath}`, {
        headers: { Host: GO2RTC_UPSTREAM_HOST_HEADER },
      });
      if (!upstream.ok) continue;

      cachedVideoRtcJs = await upstream.text();
      cachedVideoRtcJsAt = now;
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'max-age=3600');
      return res.send(cachedVideoRtcJs);
    }

    if (cachedVideoRtcJs) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.send(cachedVideoRtcJs);
    }

    return res.status(502).send('// go2rtc client not available from upstream\n');
  } catch (err) {
    if (cachedVideoRtcJs) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.send(cachedVideoRtcJs);
    }
    return res.status(502).send(`// go2rtc client error: ${err.message}\n`);
  }
});

// ── Config check endpoint ────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    configured: !!(PRINTER_IP && SERIAL_NUMBER && CHECK_CODE),
    printerIp: PRINTER_IP || null,
    go2rtcConfigured: !!(GO2RTC_URL && GO2RTC_STREAM),
    go2rtcStream: GO2RTC_STREAM || null,
    ingressPath: INGRESS_PATH,
  });
});

// ── Serve index.html dynamically with injected INGRESS_PATH ─────────────────
// HA Ingress strips the path prefix before forwarding requests, so all backend
// routes work at /api/... as normal. However, browser-side fetch() calls use
// absolute paths (e.g. /api/status) which would bypass the ingress prefix.
// We inject window.INGRESS_PATH into the HTML so the frontend can prefix them.
const INDEX_HTML_PATH = path.join(__dirname, 'frontend', 'public', 'index.html');
const indexHtmlBase = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

function serveIndex(req, res) {
  let headInject = `<script>window.INGRESS_PATH = '${INGRESS_PATH}';</script>`;
  if (GO2RTC_URL && GO2RTC_STREAM) {
    headInject += `\n  <script>window.GO2RTC_STREAM = ${JSON.stringify(GO2RTC_STREAM)};</script>`;
  }
  const html = indexHtmlBase.replace('</head>', `  ${headInject}\n</head>`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

app.get('*', serveIndex);

// ── Start ────────────────────────────────────────────────────────────────────
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`FlashForge Dashboard (HA add-on) running on port ${PORT}`);
  console.log(`Ingress path: ${INGRESS_PATH || '(none)'}`);
  console.log(`Direct HTTP URL: http://<HOST_IP>:${PORT}`);
  if (!PRINTER_IP || !SERIAL_NUMBER || !CHECK_CODE) {
    console.warn('⚠  printer_ip, serial_number or check_code not set. Configure them in the HA add-on Configuration tab.');
  }
  setupMqtt();
  if (MQTT_ENABLED) {
    mqttPollingTimer = setInterval(() => {
      refreshPrinterState();
    }, MQTT_POLL_INTERVAL_MS);
  }
});

server.on('upgrade', (req, socket, head) => {
  let urlPath = req.url || '/';
  if (INGRESS_PATH && urlPath.startsWith(INGRESS_PATH)) {
    urlPath = urlPath.substring(INGRESS_PATH.length) || '/';
  }

  let urlObj;
  try {
    urlObj = new URL(urlPath, 'http://localhost');
  } catch (_) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  if (!urlObj.pathname.startsWith('/api/go2rtc/ws')) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  const streamName = urlObj.searchParams.get('src') || GO2RTC_STREAM;
  const targetPath = `/api/ws?src=${encodeURIComponent(streamName)}`;
  const wsKey = req.headers['sec-websocket-key'];
  if (!wsKey) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  const proxySocket = net.connect(GO2RTC_UPSTREAM_PORT, GO2RTC_UPSTREAM_HOST, () => {
    const wsVersion = req.headers['sec-websocket-version'] || '13';
    const wsProtocol = req.headers['sec-websocket-protocol'];
    const wsExtensions = req.headers['sec-websocket-extensions'];
    const origin = req.headers.origin;
    const userAgent = req.headers['user-agent'];

    const lines = [
      `GET ${targetPath} HTTP/1.1`,
      `Host: ${GO2RTC_UPSTREAM_HOST_HEADER}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${wsKey}`,
      `Sec-WebSocket-Version: ${wsVersion}`,
    ];

    if (wsProtocol) lines.push(`Sec-WebSocket-Protocol: ${wsProtocol}`);
    if (wsExtensions) lines.push(`Sec-WebSocket-Extensions: ${wsExtensions}`);
    if (origin) lines.push(`Origin: ${origin}`);
    if (userAgent) lines.push(`User-Agent: ${userAgent}`);

    lines.push('', '');
    proxySocket.write(lines.join('\r\n'));
    if (head && head.length) proxySocket.write(head);
  });

  const closeBoth = () => {
    if (!socket.destroyed) socket.destroy();
    if (!proxySocket.destroyed) proxySocket.destroy();
  };

  proxySocket.on('error', (err) => {
    console.warn(`go2rtc WebSocket proxy error: ${err.message}`);
    closeBoth();
  });
  socket.on('error', closeBoth);
  socket.on('close', closeBoth);
  proxySocket.on('close', closeBoth);

  socket.pipe(proxySocket);
  proxySocket.pipe(socket);
});

function shutdown() {
  if (mqttPollingTimer) {
    clearInterval(mqttPollingTimer);
    mqttPollingTimer = null;
  }
  if (mqttClient) {
    try {
      mqttPublish(MQTT_AVAILABILITY_TOPIC, 'offline', { retain: true });
      mqttClient.end(true);
    } catch (err) {
      console.warn(`MQTT shutdown warning: ${err.message}`);
    }
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
