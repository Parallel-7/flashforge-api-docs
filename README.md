# FlashForge API Documentation

Unofficial, community-driven documentation for FlashForge 3D printer networking protocols and APIs. Covers the Adventurer 3, Adventurer 4, Adventurer 5M, and AD5X printer families.

All documentation lives in the **[Wiki](../../wiki)**.

---

## Supported Printer Families

| Family | Primary API | Auth | Wiki Page |
|--------|-------------|------|-----------|
| Adventurer 5M / 5M Pro | HTTP REST (8898) + TCP (8899) | CheckCode | [Adventurer 5M Series](../../wiki/Adventurer-5M-Series) |
| AD5X | HTTP REST (8898) + TCP (8899) + IFS | CheckCode | [AD5X](../../wiki/AD5X) |
| Adventurer 4 Pro / Lite | TCP (8899) | None | [Adventurer 4 Series](../../wiki/Adventurer-4-Series) |
| Adventurer 3 Series | TCP (8899) | None | [Adventurer 3 Series](../../wiki/Adventurer-3-Series) |

## Documentation

### Core Protocols

- **[HTTP REST API](../../wiki/HTTP-REST-API)** — JSON-based control interface on port 8898 (5M / AD5X)
- **[TCP Protocol](../../wiki/TCP-Protocol)** — Text-based G/M-code interface on port 8899 (all models)
- **[Discovery Protocol](../../wiki/Discovery-Protocol)** — UDP auto-discovery for finding printers on the network
- **[Authentication](../../wiki/Authentication)** — CheckCode auth for HTTP API, open access for TCP

### References

- **[G-Code Reference](../../wiki/G%E2%80%90Code-Reference)** — Supported G-code commands via TCP
- **[M-Code Reference](../../wiki/M-Code-Reference)** — Standard and proprietary FlashForge M-codes
- **[State Machines](../../wiki/State-Machines)** — Unified state model across modern and legacy firmware
- **[Capability Matrix](../../wiki/Capability-Matrix)** — Feature support matrix across all printer models
- **[Error Codes](../../wiki/Error-Codes)** — HTTP, TCP, and IFS error codes with recovery strategies

### Printer-Specific

- **[Adventurer 5M Series](../../wiki/Adventurer-5M-Series)** — HTTP/TCP architecture, status polling, file operations
  - **[5M Pro Features](../../wiki/Adventurer-5M-Pro-Features)** — Camera, air filtration, TVOC monitoring
- **[AD5X](../../wiki/AD5X)** — Material station commands, manual control, extended endpoints
  - **[IFS Material Station](../../wiki/AD5X-IFS-Material-Station)** — Multi-material slot management, load/unload, color mapping
- **[Adventurer 4 Series](../../wiki/Adventurer-4-Series)** — TCP-only, 33 commands, Pro/Lite variant comparison
- **[Adventurer 3 Series](../../wiki/Adventurer-3-Series)** — Legacy TCP protocol, 37 commands, 4 variant comparison

### Advanced

- **[AD5X Root Access](../../wiki/AD5X-Root-Access)** — Root SSH/ADB via USB firmware update mechanism
- **[AD5X Maintenance Console](../../wiki/AD5X-Maintenance-Console)** — Hidden touchscreen debug/calibration UI
- **[5M Maintenance Console](../../wiki/Adventurer-5M-Maintenance-Console)** — Hidden maintenance UI for 5M/5M Pro
- **[AD5X IFS Serial Protocol](../../wiki/AD5X-IFS-Serial-Protocol)** — Raw UART protocol for the Intelligent Filament Station
- **[AD5X Platform Notes](../../wiki/AD5X-Platform-Notes)** — Ingenic X2600 MIPS32 SoC, hardware, kernel, filesystem

## Endpoint YAML Files

Machine-readable endpoint specifications are available in the [`endpoints/`](endpoints/) directory:

| File | Description |
|------|-------------|
| `endpoints_5m_3.2.7.yaml` | Adventurer 5M / 5M Pro HTTP endpoints (firmware 3.2.7) |
| `endpoints_ad5x_1.1.7.yaml` | AD5X HTTP endpoints (firmware 1.1.7) |
| `endpoints_ad5x_1.2.1.yaml` | AD5X HTTP endpoints (firmware 1.2.1) |
| `networkserver_commands_adventurer3.yaml` | Adventurer 3 TCP commands |
| `networkserver_commands_adventurer4.yaml` | Adventurer 4 TCP commands |

## Methodology

This documentation is compiled from:

- Firmware analysis and filesystem inspection
- Network traffic capture and protocol analysis
- Community testing across multiple printer models and firmware versions

## Contributing

Contributions are welcome via pull requests. When submitting:

- Specify the printer model and firmware version tested
- Include methodology (traffic capture, binary analysis, live testing)
- Reference specific protocol details or packet captures where possible

---

*This is an unofficial community project and is not affiliated with FlashForge.*
