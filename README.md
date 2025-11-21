<div align="center">

# FlashForge API Documentation

### Unofficial Community-Driven Documentation for FlashForge 3D Printer APIs

A comprehensive resource for developers integrating with FlashForge 3D printers across multiple generations and protocols.

---

</div>

## Overview

FlashForge printers utilize two distinct API architectures to enable programmatic control and monitoring. This documentation is compiled from network traffic analysis, publicly available source code, and extensive community testing across various printer models.

## API Types

### Legacy TCP API

The original text-based command protocol used across FlashForge's printer lineup. This API remains available on newer models for backward compatibility and specific control functions.

**Key Characteristics:**
- Text-based command structure over TCP connections
- Supported across older and newer printer generations
- Essential for legacy system integration
- Backward compatibility layer for modern printers

**[View Legacy TCP API Documentation →](legacy-api.md)**

### HTTP API

A modern, RESTful interface introduced with recent printer series, offering enhanced functionality and developer-friendly JSON data exchange.

**Key Characteristics:**
- Standard HTTP methods (GET, POST, etc.)
- JSON-based request and response formats
- Feature-rich interface for advanced control
- Native support on Adventurer 5 Series and newer models

**[View HTTP API Documentation →](http-api.md)**

---

## Supported Printer Models

This documentation has been tested and verified across multiple FlashForge printer generations:

**Fully Supported:**
- Adventurer 5X Series
- Adventurer 5M/Pro Series

**Partial Support:**
- Adventurer 3/4 Series (Legacy TCP)
- Additional models (community verification ongoing)

---

## Contributing

Community contributions are essential to maintaining accurate, comprehensive documentation.

**Ways to Contribute:**

- **Verify Information:** Test documented commands and endpoints against your printer model and report results
- **Add Missing Content:** Share discovered undocumented endpoints, commands, or parameters
- **Correct Inaccuracies:** Help identify and fix errors or outdated information
- **Expand Coverage:** Contribute findings for untested or partially supported printer models

All contributions should be submitted via pull requests with clear documentation of testing methodology and printer model information.

---

<div align="center">

**Built by the community, for the community**

For implementation examples and reference applications, see [FlashForgeUI-Electron](https://github.com/Parallel-7/FlashForgeUI-Electron)

</div>
