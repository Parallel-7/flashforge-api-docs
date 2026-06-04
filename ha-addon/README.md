# FlashForge Dashboard — Home Assistant Add-on

Add-on per Home Assistant che porta la dashboard FlashForge direttamente nella sidebar di HA.
Controlli camera, temperatura, stampa e upload GCode integrati nell'interfaccia di Home Assistant.

## Installazione

### 1. Aggiungi il repository

1. In Home Assistant vai su **Impostazioni → Add-on → Store**
2. Clicca **⋮** (tre puntini in alto a destra) → **Aggiungi repository**
3. Incolla l'URL del repository:
   ```
   https://github.com/MikManenti/flashforge-api-docs
   ```
4. Clicca **Aggiungi**

### 2. Installa l'add-on

1. Cerca **FlashForge Dashboard** nella lista degli add-on
2. Clicca sull'add-on → **Installa**
3. Attendi il completamento del download e build del container

### 3. Configura

Nel tab **Configurazione** dell'add-on inserisci:

| Campo | Descrizione |
|---|---|
| `printer_ip` | Indirizzo IP della stampante in LAN (es. `192.168.1.100`) |
| `serial_number` | Numero di serie della stampante (etichetta sul retro) |
| `check_code` | CheckCode LAN — vedi sotto come trovarlo |

#### Come trovare il CheckCode

1. Apri l'app **FlashForge** sul telefono
2. Seleziona la stampante → **Impostazioni** → **Connessione LAN**
3. Il codice a 8 cifre mostrato è il `check_code`

### 4. Avvia

1. Clicca **Avvia** nel tab Info dell'add-on
2. L'add-on appare nella **sidebar di Home Assistant** sotto il nome _FlashForge_
3. Clicca sull'icona 🖨 per aprire la dashboard

## Funzionalità

| Funzione | Dettaglio |
|---|---|
| 🎥 Camera live | Stream MJPEG proxato, attivazione/disattivazione in-app |
| 🌡 Temperature | Ugello, piatto e camera — valori correnti e target |
| 📊 Info stampa | Layer corrente / totale, progresso, tempo rimanente, nome file |
| ⏸ ▶ ⏹ Controlli | Pausa, Riprendi, Stop della stampa corrente |
| 📂 File in memoria | Lista file sulla stampante, thumbnail, avvio stampa |
| ⬆ Upload GCode | Carica `.gcode` / `.g` / `.gx` / `.3mf` con opzione "Stampa subito" |

## Note tecniche

- L'add-on usa **Ingress**: è accessibile tramite il reverse proxy di HA senza aprire porte aggiuntive sul router, ed è protetto dall'autenticazione di Home Assistant.
- La porta interna del container è `8099`.
- La camera è accessibile su `http://<ip-stampante>:8080/?action=stream` (MJPEG, nessuna autenticazione richiesta dalla stampante).
- Architetture supportate: `amd64`, `aarch64`, `armv7`, `armhf`.

## Struttura dell'add-on

```
ha-addon/
├── repository.yaml                    ← Descrittore repository HA
└── flashforge-dashboard/
    ├── config.yaml                    ← Metadati, opzioni, ingress
    ├── build.yaml                     ← Base image multi-arch
    ├── Dockerfile
    ├── run.sh                         ← Script avvio (legge config via bashio)
    ├── server.js                      ← Backend Express
    ├── package.json
    └── frontend/public/
        ├── index.html
        ├── style.css
        └── app.js
```

---

*Progetto non ufficiale, non affiliato con FlashForge o Home Assistant.*
