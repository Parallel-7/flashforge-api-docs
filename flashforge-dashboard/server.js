'use strict';

// Note: no dotenv — environment variables are injected by run.sh via bashio.

const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 8099;
const PRINTER_IP = process.env.PRINTER_IP;
const SERIAL_NUMBER = process.env.SERIAL_NUMBER;
const CHECK_CODE = process.env.CHECK_CODE;

// HA Ingress sets this env var to the URL prefix it uses when proxying
// (e.g. "/api/hassio_ingress/abc123"). The frontend needs this to build
// correct absolute URLs for fetch() calls and the camera stream.
const INGRESS_PATH = (process.env.INGRESS_PATH || '').replace(/\/$/, '');

const PRINTER_API = `http://${PRINTER_IP}:8898`;
const CAMERA_URL = `http://${PRINTER_IP}:8080/?action=stream`;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend', 'public')));

// multer: store upload in memory, then stream to printer
const upload = multer({ storage: multer.memoryStorage() });

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * POST to the printer's HTTP REST API with standard auth fields.
 */
async function printerPost(endpoint, body = {}) {
  const payload = { serialNumber: SERIAL_NUMBER, checkCode: CHECK_CODE, ...body };
  const res = await fetch(`${PRINTER_API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printer returned ${res.status}: ${text}`);
  }
  return res.json();
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
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/**
 * POST /api/control
 * Body: { action: "pause"|"resume"|"stop", jobID: "..." }
 */
app.post('/api/control', requireConfig, async (req, res) => {
  const { action, jobID } = req.body;
  if (!action || !jobID) {
    return res.status(400).json({ error: 'action and jobID are required' });
  }
  try {
    const data = await printerPost('/control', {
      payload: {
        cmd: 'jobCtl_cmd',
        args: { jobID, action },
      },
    });
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
  res.status(printerRes.ok ? 200 : 502).json(result);
});

/**
 * GET /api/camera/stream
 * Proxies the MJPEG stream from the printer camera so the browser
 * can display it without cross-origin issues.
 */
app.get('/api/camera/stream', requireConfig, (req, res) => {
  const url = new URL(CAMERA_URL);
  const options = {
    hostname: url.hostname,
    port: url.port || 8080,
    path: url.pathname + url.search,
    method: 'GET',
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'multipart/x-mixed-replace',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).json({ error: `Camera stream error: ${err.message}` });
    }
  });

  req.on('close', () => proxyReq.destroy());
  proxyReq.end();
});

/**
 * POST /api/camera
 * Body: { action: "open"|"close" }
 * Enables or disables the camera stream on the printer.
 */
app.post('/api/camera', requireConfig, async (req, res) => {
  const { action } = req.body;
  if (!action) return res.status(400).json({ error: 'action is required' });
  try {
    const data = await printerPost('/control', {
      payload: {
        cmd: 'streamCtrl_cmd',
        args: { action },
      },
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Config check endpoint ────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    configured: !!(PRINTER_IP && SERIAL_NUMBER && CHECK_CODE),
    printerIp: PRINTER_IP || null,
    cameraUrl: PRINTER_IP ? CAMERA_URL : null,
    ingressPath: INGRESS_PATH,
  });
});

// ── Serve index.html dynamically with injected INGRESS_PATH ─────────────────
// HA Ingress strips the path prefix before forwarding requests, so all backend
// routes work at /api/... as normal. However, browser-side fetch() calls use
// absolute paths (e.g. /api/status) which would bypass the ingress prefix.
// We inject window.INGRESS_PATH into the HTML so the frontend can prefix them.
const INDEX_HTML_PATH = path.join(__dirname, 'frontend', 'public', 'index.html');
let indexHtmlBase = null;

function serveIndex(req, res) {
  if (!indexHtmlBase) {
    indexHtmlBase = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  }
  const script = `<script>window.INGRESS_PATH = '${INGRESS_PATH}';</script>\n`;
  const html = indexHtmlBase.replace('</head>', `  ${script}</head>`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

app.get('*', serveIndex);

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`FlashForge Dashboard (HA add-on) running on port ${PORT}`);
  console.log(`Ingress path: ${INGRESS_PATH || '(none)'}`);
  if (!PRINTER_IP || !SERIAL_NUMBER || !CHECK_CODE) {
    console.warn('⚠  printer_ip, serial_number or check_code not set. Configure them in the HA add-on Configuration tab.');
  }
});
