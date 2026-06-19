# FlashForge Home Assistant Add-on Repository

Repository add-on per Home Assistant.
Contiene l’add-on **FlashForge Dashboard** pronto per essere aggiunto nello store di Home Assistant.

## Installazione

1. In Home Assistant vai su **Impostazioni → Add-on → Store**
2. Clicca **⋮ → Repositories**
3. Aggiungi questo URL:

```text
https://github.com/MikManenti/flashforge-api-docs
```

4. Cerca e installa **FlashForge Dashboard**

## Add-on incluso

### FlashForge Dashboard
Dashboard locale per stampanti FlashForge AD5M / AD5X / 5M Pro con:
- camera live
- stato stampa
- temperature
- controlli pausa/riprendi/stop
- lista file e upload GCode
- integrazione MQTT Discovery per sensori e switch in Home Assistant

## Struttura repository

```text
.
├── repository.yaml
└── flashforge-dashboard/
    ├── config.yaml
    ├── Dockerfile
    ├── run.sh
    ├── server.js
    ├── package.json
    └── frontend/public/
```

## Note

Progetto non ufficiale, non affiliato con FlashForge o Home Assistant.

## Accesso dashboard

- **Ingress Home Assistant**: da sidebar (come prima)
- **HTTP diretto**: `http://<IP_HOME_ASSISTANT>:8099`

## Integrazione camera con Frigate

Per visualizzare il feed della camera della stampante nel dashboard è possibile usare [Frigate](https://frigate.video/) con [go2rtc](https://github.com/AlexxIT/go2rtc).

### Configurazione Frigate

```yaml
go2rtc:
  streams:
    Stampante:
      - "ffmpeg:http://IP_DELLA_STAMPANTE:8080/?action=stream"

cameras:
  Stampante:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/Stampante
```

Dopo aver configurato Frigate, Home Assistant esporrà automaticamente un'entità camera (es. `camera.stampante`).  
Inserisci il nome dell'entità nella configurazione dell'add-on nel campo **`camera_entity`** (es. `camera.stampante`).

## Integrazione automatica Home Assistant (MQTT)

L’add-on pubblica automaticamente sensori/switch via **MQTT Discovery**.

Prerequisiti:
- integrazione MQTT configurata in Home Assistant
- broker MQTT raggiungibile dall’add-on (default: `core-mosquitto`)

Opzioni configurabili nell’add-on:
- `mqtt_enabled` (default `true`)
- `mqtt_host` (default `core-mosquitto`)
- `mqtt_port` (default `1883`)
- `mqtt_username` / `mqtt_password` (opzionali)
- `mqtt_base_topic` (default `flashforge`)

Entità principali esposte:
- sensori: stato, progress, temperature, tempo stimato
- binary sensor: stampa in corso
- switch: pausa/riprendi, camera stream
- button: stop stampa, clear stato stampante
