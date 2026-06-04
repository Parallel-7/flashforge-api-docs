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

## Struttura repository

```text
.
├── repository.yaml
└── flashforge-dashboard/
    ├── config.yaml
    ├── build.yaml
    ├── Dockerfile
    ├── run.sh
    ├── server.js
    ├── package.json
    └── frontend/public/
```

## Note

Progetto non ufficiale, non affiliato con FlashForge o Home Assistant.
