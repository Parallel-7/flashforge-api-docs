<div align="center">

# FlashForge API Documentation

### Unofficial Community-Driven Documentation for FlashForge 3D Printer APIs

A comprehensive resource for developers integrating with FlashForge 3D printers across multiple generations and protocols.

This documentation is compiled from network traffic analysis, publicly available source code, and extensive community testing across various printer models.

---

## API Types

### Legacy TCP API

The original text-based command protocol used across FlashForge's printer lineup. This API remains available on newer models for backward compatibility and specific control functions. Commands are sent over TCP connections using a text-based structure, supporting both older and newer printer generations.

**[View Legacy TCP API Documentation →](legacy-api.md)**

### HTTP API

A modern, RESTful interface introduced with recent printer series, offering enhanced functionality and developer-friendly JSON data exchange. Built on standard HTTP methods with JSON-based request and response formats, this API provides feature-rich control with native support on Adventurer 5 Series and newer models.

**[View HTTP API Documentation →](http-api.md)**

---

## Supported Printer Models

**Adventurer 5X Series** | **Adventurer 5M/Pro Series**

Fully tested with both HTTP and Legacy TCP support

**Adventurer 3/4 Series**

Partial support via Legacy TCP protocol

---

## Contributing

Community contributions are essential to maintaining accurate, comprehensive documentation.

Verify documented commands and endpoints against your printer model. Add discovered undocumented endpoints, commands, or parameters. Help identify and fix errors or outdated information. Contribute findings for untested or partially supported printer models.

All contributions should be submitted via pull requests with clear documentation of testing methodology and printer model information.

---

**Built by the community, for the community**

For implementation examples and reference applications, see [FlashForgeUI-Electron](https://github.com/Parallel-7/FlashForgeUI-Electron)

</div>
