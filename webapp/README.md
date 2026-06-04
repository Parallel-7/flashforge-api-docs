# FlashForge Web App

Web app locale per controllare la tua stampante FlashForge AD5M (o AD5X / 5M Pro) direttamente dal browser, senza cloud.

## Funzionalità

| Funzione | Dettaglio |
|---|---|
| 🎥 Camera live | Stream MJPEG proxato, attivazione/disattivazione in-app |
| 🌡 Temperature | Ugello, piatto e camera — valori correnti e target |
| 📊 Info stampa | Layer corrente / totale, progresso, tempo rimanente, nome file |
| ⏸ ▶ ⏹ Controlli | Pausa, Riprendi, Stop della stampa corrente |
| 📂 File in memoria | Lista file sulla stampante, anteprima thumbnail, avvio stampa |
| ⬆ Upload GCode | Carica `.gcode` / `.g` / `.gx` / `.3mf` con opzione "Stampa subito" |

## Requisiti

- [Node.js](https://nodejs.org/) 18 o superiore
- Stampante FlashForge sulla stessa rete locale

## Installazione

```bash
cd webapp
npm install
cp .env.example .env
```

Apri `.env` e inserisci:

```env
PRINTER_IP=192.168.1.XXX      # IP della stampante in LAN
SERIAL_NUMBER=SN-XXXXXXXX     # Numero di serie (etichetta sulla stampante)
CHECK_CODE=XXXXXXXX            # CheckCode LAN (vedi sotto)
PORT=3000                      # Porta della web app (opzionale)
```

### Come trovare il CheckCode

1. Apri l'app **FlashForge** sul tuo telefono
2. Seleziona la stampante → **Impostazioni** → **Connessione LAN**
3. Il codice a 8 cifre mostrato è il `checkCode`

In alternativa puoi trovarlo ispezionando il traffico di rete con un proxy (es. Charles, mitmproxy) mentre l'app si connette alla stampante.

## Avvio

```bash
npm start
```

Apri il browser su **http://localhost:3000**

Per lo sviluppo con auto-reload:

```bash
npm run dev
```

## Struttura del progetto

```
webapp/
├── server.js              # Backend Express (proxy API FlashForge)
├── package.json
├── .env.example           # Template configurazione
├── .gitignore
└── frontend/
    └── public/
        ├── index.html     # UI principale
        ├── style.css      # Stili dark mode
        └── app.js         # Logica frontend (polling, upload, ecc.)
```

## API Backend esposte

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/status` | GET | Stato completo della stampante |
| `/api/control` | POST | Pausa / Riprendi / Stop |
| `/api/files` | GET | Lista file in memoria stampante |
| `/api/thumb?fileName=` | GET | Thumbnail base64 di un file |
| `/api/print` | POST | Avvia stampa da file in memoria |
| `/api/upload` | POST | Upload GCode dal browser |
| `/api/camera/stream` | GET | Proxy stream MJPEG camera |
| `/api/camera` | POST | Attiva / disattiva camera |
| `/api/config` | GET | Verifica configurazione |

## Docker (opzionale)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t flashforge-webapp .
docker run -d -p 3000:3000 --env-file .env flashforge-webapp
```

## Note

- La stampante deve essere **sulla stessa rete locale** del server che esegue questa app.
- Il **CheckCode** autentica ogni richiesta HTTP alla porta `8898` della stampante; senza di esso le API restituiscono errore.
- Lo stream camera usa la porta `8080` della stampante (MJPEG over HTTP, senza autenticazione).
- Se la camera risulta spenta, usa il pulsante **"Attiva camera"** che invia prima il comando `streamCtrl_cmd` alla stampante.

---

*Progetto non ufficiale, non affiliato con FlashForge.*
