'use strict';

/* ── State ───────────────────────────────────────────────────────────────── */
let currentJobID = null;
let currentStatus = null;
let pollingTimer = null;
let cameraActive = false;

/* ── DOM refs ────────────────────────────────────────────────────────────── */
const badge          = document.getElementById('status-badge');
const cameraImg      = document.getElementById('camera-img');
const cameraPlaceholder = document.getElementById('camera-placeholder');
const btnCameraOn    = document.getElementById('btn-camera-on');
const btnCameraOff   = document.getElementById('btn-camera-off');
const sFname         = document.getElementById('s-filename');
const sProgress      = document.getElementById('s-progress');
const sLayer         = document.getElementById('s-layer');
const sTime          = document.getElementById('s-time');
const progressBar    = document.getElementById('progress-bar');
const tNozzle        = document.getElementById('t-nozzle');
const tNozzleTarget  = document.getElementById('t-nozzle-target');
const tBed           = document.getElementById('t-bed');
const tBedTarget     = document.getElementById('t-bed-target');
const tChamber       = document.getElementById('t-chamber');
const tChamberTarget = document.getElementById('t-chamber-target');
const btnPause       = document.getElementById('btn-pause');
const btnResume      = document.getElementById('btn-resume');
const btnStop        = document.getElementById('btn-stop');
const ctrlMsg        = document.getElementById('ctrl-message');
const lastUpdate     = document.getElementById('last-update');

const btnRefreshFiles = document.getElementById('btn-refresh-files');
const fileList        = document.getElementById('file-list');
const printModal      = document.getElementById('print-modal');
const modalFilename   = document.getElementById('modal-filename');
const modalLeveling   = document.getElementById('modal-leveling');
const modalConfirm    = document.getElementById('modal-confirm');
const modalCancel     = document.getElementById('modal-cancel');

const uploadForm      = document.getElementById('upload-form');
const fileInput       = document.getElementById('file-input');
const dropText        = document.getElementById('drop-text');
const dropArea        = document.getElementById('drop-area');
const printNowChk     = document.getElementById('print-now');
const levelingUpload  = document.getElementById('leveling-upload');
const btnUpload       = document.getElementById('btn-upload');
const uploadProgressWrap = document.getElementById('upload-progress');
const uploadProgressBar  = document.getElementById('upload-progress-bar');
const uploadProgressText = document.getElementById('upload-progress-text');
const uploadMessage   = document.getElementById('upload-message');

/* ── Utilities ───────────────────────────────────────────────────────────── */
function fmt(v, unit = '°C') {
  return v !== undefined && v !== null ? `${Math.round(v)}${unit}` : '—';
}
function fmtTime(seconds) {
  if (!seconds || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
function showCtrlMsg(msg, ok = true) {
  ctrlMsg.textContent = msg;
  ctrlMsg.style.color = ok ? 'var(--success)' : 'var(--danger)';
  setTimeout(() => { ctrlMsg.textContent = ''; }, 4000);
}
function showUploadMsg(msg, ok = true) {
  uploadMessage.textContent = msg;
  uploadMessage.style.color = ok ? 'var(--success)' : 'var(--danger)';
}

/* ── Status polling ──────────────────────────────────────────────────────── */
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const json = await res.json();
    if (json.detail) updateUI(json.detail);
    lastUpdate.textContent = `Ultimo aggiornamento: ${new Date().toLocaleTimeString('it-IT')}`;
  } catch (e) {
    badge.textContent = 'Errore connessione';
    badge.className = 'badge badge--error';
  }
}

function updateUI(d) {
  currentStatus = d.status || 'IDLE';

  // Badge
  const statusMap = {
    PRINTING: ['badge--printing', 'STAMPA'],
    PAUSED:   ['badge--paused',   'IN PAUSA'],
    IDLE:     ['badge--idle',     'INATTIVA'],
    ERROR:    ['badge--error',    'ERRORE'],
    HOMING:   ['badge--printing', 'HOMING'],
  };
  const [cls, label] = statusMap[currentStatus] || ['badge--idle', currentStatus];
  badge.className = `badge ${cls}`;
  badge.textContent = label;

  // Job info
  currentJobID = d.jobInfo ? (d.jobInfo[0] && d.jobInfo[0][1]) : null;
  sFname.textContent = d.printFileName || '—';
  sFname.title = d.printFileName || '';

  const pct = d.printProgress != null ? Math.round(d.printProgress * 100) : null;
  sProgress.textContent = pct !== null ? `${pct}%` : '—';
  progressBar.style.width = pct !== null ? `${pct}%` : '0%';

  const layer    = d.printLayer        ?? null;
  const maxLayer = d.targetPrintLayer  ?? null;
  sLayer.textContent = (layer !== null && maxLayer !== null)
    ? `${layer} / ${maxLayer}`
    : (layer !== null ? String(layer) : '—');

  sTime.textContent = fmtTime(d.estimatedTime);

  // Temperatures
  tNozzle.textContent       = fmt(d.rightTemp);
  tNozzleTarget.textContent = d.rightTargetTemp ? `→ ${fmt(d.rightTargetTemp)}` : '';
  tBed.textContent          = fmt(d.platTemp);
  tBedTarget.textContent    = d.platTargetTemp ? `→ ${fmt(d.platTargetTemp)}` : '';
  tChamber.textContent      = fmt(d.chamberTemp);
  tChamberTarget.textContent = d.chamberTargetTemp ? `→ ${fmt(d.chamberTargetTemp)}` : '';

  // Controls enable/disable
  const isPrinting = currentStatus === 'PRINTING';
  const isPaused   = currentStatus === 'PAUSED';
  btnPause.disabled  = !isPrinting;
  btnResume.disabled = !isPaused;
  btnStop.disabled   = !(isPrinting || isPaused);

  // Camera: if the printer reports a stream URL, auto-enable
  if (d.cameraStreamUrl && !cameraActive) {
    enableCamera();
  }
}

/* ── Camera ──────────────────────────────────────────────────────────────── */
function enableCamera() {
  cameraImg.src = `/api/camera/stream?t=${Date.now()}`;
  cameraImg.classList.add('active');
  cameraPlaceholder.classList.add('hidden');
  cameraActive = true;
}
function disableCamera() {
  cameraImg.src = '';
  cameraImg.classList.remove('active');
  cameraPlaceholder.classList.remove('hidden');
  cameraActive = false;
}

btnCameraOn.addEventListener('click', async () => {
  try {
    await fetch('/api/camera', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open' }) });
  } catch (_) { /* ignore – try to show stream anyway */ }
  enableCamera();
});

btnCameraOff.addEventListener('click', async () => {
  disableCamera();
  try {
    await fetch('/api/camera', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'close' }) });
  } catch (_) { /* ignore */ }
});

cameraImg.addEventListener('error', () => {
  disableCamera();
});

/* ── Print controls ──────────────────────────────────────────────────────── */
async function sendControl(action) {
  if (!currentJobID) { showCtrlMsg('Nessun job attivo.', false); return; }
  try {
    const res = await fetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, jobID: currentJobID }),
    });
    const json = await res.json();
    if (json.code === 0) {
      showCtrlMsg(`Comando "${action}" inviato.`);
      await fetchStatus();
    } else {
      showCtrlMsg(`Errore: ${json.message || json.code}`, false);
    }
  } catch (e) {
    showCtrlMsg(`Errore di rete: ${e.message}`, false);
  }
}

btnPause.addEventListener('click',  () => sendControl('pause'));
btnResume.addEventListener('click', () => sendControl('resume'));
btnStop.addEventListener('click', async () => {
  if (!confirm('Sei sicuro di voler interrompere la stampa?')) return;
  await sendControl('stop');
});

/* ── File list ───────────────────────────────────────────────────────────── */
let selectedFileName = null;

btnRefreshFiles.addEventListener('click', loadFiles);

async function loadFiles() {
  fileList.innerHTML = '<p class="hint">Caricamento…</p>';
  try {
    const res = await fetch('/api/files');
    const json = await res.json();
    const files = json.gcodeList || [];
    if (!files.length) {
      fileList.innerHTML = '<p class="hint">Nessun file trovato nella stampante.</p>';
      return;
    }
    fileList.innerHTML = '';
    files.forEach(renderFileItem);
  } catch (e) {
    fileList.innerHTML = `<p class="hint" style="color:var(--danger)">Errore: ${e.message}</p>`;
  }
}

async function renderFileItem(fileName) {
  const item = document.createElement('div');
  item.className = 'file-item';

  // Thumb
  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'file-thumb-placeholder';
  thumbWrap.textContent = '📄';
  item.appendChild(thumbWrap);

  const nameEl = document.createElement('span');
  nameEl.className = 'file-name';
  nameEl.textContent = fileName;
  item.appendChild(nameEl);

  item.addEventListener('click', () => openPrintModal(fileName));
  fileList.appendChild(item);

  // Async thumb load
  try {
    const res = await fetch(`/api/thumb?fileName=${encodeURIComponent(fileName)}`);
    const json = await res.json();
    if (json.imageData) {
      const img = document.createElement('img');
      img.className = 'file-thumb';
      img.src = `data:image/png;base64,${json.imageData}`;
      img.alt = fileName;
      thumbWrap.replaceWith(img);
    }
  } catch (_) { /* keep placeholder */ }
}

function openPrintModal(fileName) {
  selectedFileName = fileName;
  modalFilename.textContent = fileName;
  modalLeveling.checked = false;
  printModal.classList.remove('hidden');
}

modalCancel.addEventListener('click', () => {
  printModal.classList.add('hidden');
  selectedFileName = null;
});

modalConfirm.addEventListener('click', async () => {
  if (!selectedFileName) return;
  printModal.classList.add('hidden');
  try {
    const res = await fetch('/api/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: selectedFileName, levelingBeforePrint: modalLeveling.checked }),
    });
    const json = await res.json();
    if (json.code === 0) {
      showCtrlMsg(`Stampa avviata: ${selectedFileName}`);
      await fetchStatus();
    } else {
      showCtrlMsg(`Errore: ${json.message || json.code}`, false);
    }
  } catch (e) {
    showCtrlMsg(`Errore di rete: ${e.message}`, false);
  }
  selectedFileName = null;
});

// Close modal on backdrop click
printModal.addEventListener('click', (e) => {
  if (e.target === printModal) {
    printModal.classList.add('hidden');
    selectedFileName = null;
  }
});

/* ── Upload ──────────────────────────────────────────────────────────────── */
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) {
    dropText.textContent = `📄 ${fileInput.files[0].name}`;
    btnUpload.disabled = false;
  }
});

// Drag & drop
dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('drag-over'); });
dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
dropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  dropArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    dropText.textContent = `📄 ${file.name}`;
    btnUpload.disabled = false;
  }
});

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;

  btnUpload.disabled = true;
  uploadProgressWrap.classList.remove('hidden');
  setUploadPct(0);
  showUploadMsg('');

  const formData = new FormData();
  formData.append('gcodeFile', file);
  formData.append('printNow', printNowChk.checked ? '1' : '0');
  formData.append('levelingBeforePrint', levelingUpload.checked ? '1' : '0');

  // Use XMLHttpRequest for upload progress
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload');

  xhr.upload.addEventListener('progress', (ev) => {
    if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
  });

  xhr.addEventListener('load', () => {
    try {
      const json = JSON.parse(xhr.responseText);
      if (json.code === 0) {
        showUploadMsg(`✅ Upload completato: ${file.name}`);
        if (printNowChk.checked) fetchStatus();
        loadFiles();
      } else {
        showUploadMsg(`❌ Errore stampante: ${json.message || json.code}`, false);
      }
    } catch (_) {
      showUploadMsg(`❌ Risposta non valida (HTTP ${xhr.status})`, false);
    }
    btnUpload.disabled = false;
    uploadProgressWrap.classList.add('hidden');
  });

  xhr.addEventListener('error', () => {
    showUploadMsg('❌ Errore di rete durante l\'upload.', false);
    btnUpload.disabled = false;
    uploadProgressWrap.classList.add('hidden');
  });

  xhr.send(formData);
});

function setUploadPct(pct) {
  uploadProgressBar.style.setProperty('--pct', `${pct}%`);
  uploadProgressText.textContent = `${pct}%`;
}

/* ── Boot ────────────────────────────────────────────────────────────────── */
(async () => {
  // Check configuration
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    if (!cfg.configured) {
      badge.textContent = 'NON CONFIGURATO';
      badge.className = 'badge badge--error';
      document.querySelector('main').insertAdjacentHTML('afterbegin',
        `<div class="card" style="grid-column:1/-1;color:var(--warning)">
          ⚠️ La stampante non è configurata. Crea il file <code>.env</code> nella cartella <code>webapp/</code>
          copiando <code>.env.example</code> e inserendo IP, numero di serie e CheckCode.
        </div>`
      );
      return;
    }
  } catch (_) { /* proceed anyway */ }

  await fetchStatus();
  pollingTimer = setInterval(fetchStatus, 4000);
})();
