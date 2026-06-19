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
const KNOWN_MQTT_COMMAND_PAYLOADS = new Set([\n  '1', 'ON', 'TRUE', 'OPEN', 'PAUSE', 'STOP', 'CLEAR', 'PRESS', 'RESUME', 'CONTINUE', 'CLOSE', '0', 'OFF', 'FALSE',\n]);

// HA Ingress sets this env var to the URL prefix it uses when proxying
// (e.g. "/api/hassio_ingress/abc123"). The frontend needs this to build
// correct absolute URLs for fetch() calls and the camera stream.
const INGRESS_PATH = (process.env.INGRESS_PATH || '').replace(/\\/$/, '');

const PRINTER_API = `http://${PRINTER_IP}:8898`;
const GO2RTC_URL = (process.env.GO2RTC_URL || 'http://ccab4aaf-frigate:1984').replace(/\/$/, '');
const GO2RTC_STREAM = (process.env.GO2RTC_STREAM || 'Stampante').trim();

// Target host header dedicated for Frigate/go2rtc internal docker network
const GO2RTC_UPSTREAM_HOST_HEADER = 'ccab4aaf-frigate:1984';

// Use memory storage for tiny G-code file uploads to avoid wearing out SD card storage.
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 150 * 1024 * 1024 } // 150MB maximum
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.json());

/* ── API Routes ──────────────────────────────────────────────────────────── */

// Returns runtime options needed by the frontend dashboard.
app.get('/api/config', (req, res) => {
  res.json({
    configured: !!(PRINTER_IP && SERIAL_NUMBER && CHECK_CODE),
    ingressPath: INGRESS_PATH,
    go2rtcStream: GO2RTC_STREAM
  });
});

// Proxy route to pull go2rtc's official front-end client script safely through the add-on.
app.get('/api/go2rtc/client.js', async (req, res) => {
  try {
    const targetUrl = `${GO2RTC_URL}/api/client.js`;
    const response = await fetch(targetUrl, {
      headers: {
        'Host': GO2RTC_UPSTREAM_HOST_HEADER,
        'User-Agent': req.headers['user-agent'] || 'HomeAssistantAddon'
      },
      timeout: 5000
    });

    if (!response.ok) {
      throw new Error(`Upstream go2rtc returned status ${response.status}`);
    }

    const jsContent = await response.text();
    res.type('application/javascript').send(jsContent);
  } catch (err) {
    console.error(`Error proxying go2rtc client.js: ${err.message}`);
    res.status(502).send(`/* go2rtc client proxy error: ${err.message} */`);
  }
});

// Proxy standard printer API JSON endpoints transparently
app.get('/api/printer/*', async (req, res) => {
  const subPath = req.params[0];
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  try {
    const targetUrl = `${PRINTER_API}/${subPath}${queryString}`;
    const response = await fetch(targetUrl, { timeout: 3000 });
    if (!response.ok) return res.status(response.status).send(await response.text());
    res.json(await response.json());
  } catch (err) {
    res.status(504).json({ code: -1, message: `Printer connection failed: ${err.message}` });
  }
});

// Handle G-code uploads and pipe them as multipart data directly to FlashForge native network API
app.post('/api/printer/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ code: -1, message: 'No file uploaded.' });

  try {
    const printNow = req.body.printNow === 'true' ? '1' : '0';
    const leveling = req.body.leveling === 'true' ? '1' : '0';

    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
    const header = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="printNow"\r\n\r\n${printNow}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="leveling"\r\n\r\n${leveling}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${req.file.originalname}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const payloadBuffer = Buffer.concat([
      Buffer.from(header, 'utf-8'),
      req.file.buffer,
      Buffer.from(footer, 'utf-8')
    ]);

    const response = await fetch(`${PRINTER_API}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: payloadBuffer,
      timeout: 180000 // 3 minutes timeout for massive files
    });

    if (!response.ok) return res.status(response.status).send(await response.text());
    res.json(await response.json());
  } catch (err) {
    res.status(504).json({ code: -1, message: `Upload payload transmission failed: ${err.message}` });
  }
});

/* ── MQTT Integration ────────────────────────────────────────────────────── */
const MQTT_ENABLED = process.env.MQTT_ENABLED === 'true';
const MQTT_HOST = process.env.MQTT_HOST || 'core-mosquitto';
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '1883', 10);
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';
const MQTT_BASE_TOPIC = (process.env.MQTT_BASE_TOPIC || 'flashforge').replace(/\/$/, '');

const MQTT_STATE_TOPIC = `${MQTT_BASE_TOPIC}/state`;
const MQTT_AVAILABILITY_TOPIC = `${MQTT_BASE_TOPIC}/availability`;
const MQTT_COMMAND_TOPIC = `${MQTT_BASE_TOPIC}/command`;

let mqttClient = null;
let mqttPollingTimer = null;

function mqttPublish(topic, payload, options = {}) {
  if (!mqttClient || !mqttClient.connected) return;
  const msg = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
  mqttClient.publish(topic, msg, options, (err) => {
    if (err) console.warn(`MQTT Publish failed on ${topic}: ${err.message}`);
  });
}

if (MQTT_ENABLED && PRINTER_IP) {
  const mqttOptions = {
    port: MQTT_PORT,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 10000,
    will: {
      topic: MQTT_AVAILABILITY_TOPIC,
      payload: 'offline',
      qos: 1,
      retain: true
    }
  };
  if (MQTT_USERNAME) mqttOptions.username = MQTT_USERNAME;
  if (MQTT_PASSWORD) mqttOptions.password = MQTT_PASSWORD;

  console.log(`Connecting to MQTT broker at mqtt://${MQTT_HOST}:${MQTT_PORT}...`);
  mqttClient = mqtt.connect(`mqtt://${MQTT_HOST}`, mqttOptions);

  mqttClient.on('connect', () => {
    console.log('MQTT Broker connected successfully.');
    mqttPublish(MQTT_AVAILABILITY_TOPIC, 'online', { retain: true });
    
    mqttClient.subscribe(MQTT_COMMAND_TOPIC, { qos: 1 }, (err) => {
      if (err) console.error(`MQTT fails to subscribe to command topic: ${err.message}`);
      else console.log(`Subscribed to MQTT command topic: ${MQTT_COMMAND_TOPIC}`);
    });

    // Start background background cyclic daemon polling printer state onto HA MQTT bus
    if (mqttPollingTimer) clearInterval(mqttPollingTimer);
    mqttPollingTimer = setInterval(async () => {
      try {
        const data = await fetch(`${PRINTER_API}/get_status`, { timeout: 2000 }).then(r => r.json());
        if (data && data.code === 0) {
          mqttPublish(MQTT_STATE_TOPIC, data.data);
          mqttPublish(MQTT_AVAILABILITY_TOPIC, 'online', { retain: true });
        } else {
          mqttPublish(MQTT_AVAILABILITY_TOPIC, 'offline', { retain: true });
        }
      } catch (_) {
        mqttPublish(MQTT_AVAILABILITY_TOPIC, 'offline', { retain: true });
      }
    }, 4000);
  });

  mqttClient.on('message', async (topic, message) => {
    if (topic !== MQTT_COMMAND_TOPIC) return;
    const rawPayload = message.toString().trim().toUpperCase();
    if (!KNOWN_MQTT_COMMAND_PAYLOADS.has(rawPayload)) return;

    try {
      let endpoint = null;
      if (['1', 'ON', 'TRUE', 'OPEN', 'RESUME', 'CONTINUE'].includes(rawPayload)) endpoint = 'resume_print';
      else if (['PAUSE'].includes(rawPayload)) endpoint = 'pause_print';
      else if (['0', 'OFF', 'FALSE', 'STOP', 'CLEAR', 'PRESS', 'CLOSE'].includes(rawPayload)) endpoint = 'stop_print';

      if (!endpoint) return;
      console.log(`MQTT Command execution received: ${rawPayload} -> Invoking ${endpoint}`);
      await fetch(`${PRINTER_API}/${endpoint}`, { method: 'POST', timeout: 3000 });
    } catch (err) {
      console.error(`Failed executing remote printer service over MQTT payload request: ${err.message}`);
    }
  });

  mqttClient.on('error', (err) => console.error(`MQTT client framework internal error: ${err.message}`));
}

/* ── HTTP & WebSockets Server Core initialization ───────────────────────── */

const server = http.createServer(app);

// Infallibile WebSocket Proxy Tunnel per gestire lo stream di Frigate (go2rtc) sotto Ingress
server.on('upgrade', (req, socket, head) => {
  // Controllo elastico: basta che l'URL contenga il nostro path, ignorando i prefissi dinamici dell'Ingress
  if (!req.url.includes('go2rtc/ws')) {
    socket.destroy();
    return;
  }

  // Estraiamo il corretto parametro 'src' analizzando la query string finale
  const queryIdx = req.url.indexOf('?');
  const searchParams = new URLSearchParams(queryIdx !== -1 ? req.url.substring(queryIdx) : '');
  const streamName = searchParams.get('src') || GO2RTC_STREAM;
  
  const targetPath = `/api/ws?src=${encodeURIComponent(streamName)}`;
  const targetUrl = new URL(GO2RTC_URL);
  const targetHost = targetUrl.hostname;
  const targetPort = targetUrl.port || 1984;

  const wsKey = req.headers['sec-websocket-key'];
  const wsVersion = req.headers['sec-websocket-version'] || '13';
  const wsProtocol = req.headers['sec-websocket-protocol'];
  const wsExtensions = req.headers['sec-websocket-extensions'];
  const origin = req.headers['origin'];
  const userAgent = req.headers['user-agent'];

  // Apriamo una connessione TCP nativa verso l'add-on Frigate
  const proxySocket = net.net || net.connect(targetPort, targetHost, () => {
    const lines = [
      `GET ${targetPath} HTTP/1.1`,
      `Host: ${GO2RTC_UPSTREAM_HOST_HEADER}`, // Forza l'header richiesto da Frigate
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

server.listen(PORT, () => {
  console.log(`FlashForge Dashboard Backend Add-on listening inside Docker container on port ${PORT}`);
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
  setTimeout(() => process.exit(1), 2000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
  
