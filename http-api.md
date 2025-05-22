# FlashForge HTTP API Documentation

## Overview

This document outlines the HTTP-based API for FlashForge 3D printers, introduced in firmware version 3.1.3 for the Adventurer 5M/Pro series. This API operates on port `8898` by default.

Adventurer 5M/Pro models running firmware 3.1.3 and later maintain compatibility with the "legacy" TCP API, primarily for FlashPrint software compatibility. This dual compatibility allows users to leverage the new features of the HTTP API while retaining access to direct G/M code commands (e.g., for homing the printer) via the TCP API.

## Authentication

Authentication is required for all HTTP API endpoints. For most endpoints, authentication details are included in the JSON request payload:

```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE"
}
```
**Note:** For the `/uploadGcode` endpoint, authentication details (`serialNumber` and `checkCode`) are transmitted via request headers instead of a JSON payload.

## Base URL

All API endpoints are accessed using the following base URL structure:

`http://{printer_ip}:{port}`

The default port is `8898`.

## Endpoints

### `/detail` - Get Printer Details

Retrieves comprehensive information about the printer's current status, including temperatures, print job progress, and other operational data.

**Method:** `POST`

**Request Payload:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE"
}
```

**Response Example:**
```json
{
  "code": 0,
  "message": "Success",
  "detail": {
    "autoShutdown": "open",        // "open" or "close"
    "autoShutdownTime": 30,        // Minutes
    "cameraStreamUrl": "http://192.168.1.123:8080/stream",
    "chamberFanSpeed": 100,        // Percentage
    "chamberTargetTemp": 0,        // Celsius
    "chamberTemp": 45,             // Celsius
    "coolingFanSpeed": 100,        // Percentage
    "cumulativeFilament": 120.5,   // Meters
    "cumulativePrintTime": 1234,   // Seconds
    "currentPrintSpeed": 100,      // Percentage
    "doorStatus": "close",         // "open" or "close"
    "errorCode": "",
    "estimatedLeftLen": 0,         // Millimeters
    "estimatedLeftWeight": 0,      // Grams
    "estimatedRightLen": 12500,    // Millimeters
    "estimatedRightWeight": 35.5,  // Grams
    "estimatedTime": 3600,         // Seconds
    "externalFanStatus": "open",   // "open" or "close"
    "fillAmount": 20,              // Percentage
    "firmwareVersion": "v3.1.3",
    "flashRegisterCode": "ABCDEFGH",
    "internalFanStatus": "open",   // "open" or "close"
    "ipAddr": "192.168.1.123",
    "leftFilamentType": "",
    "leftTargetTemp": 0,           // Celsius
    "leftTemp": 0,                 // Celsius
    "lightStatus": "open",         // "open" or "close"
    "location": "Office",
    "macAddr": "00:11:22:33:44:55",
    "name": "CustomPrinterName",
    "nozzleCnt": 1,
    "nozzleModel": "0.4mm",
    "nozzleStyle": 1,
    "pid": 123,
    "platTargetTemp": 60,          // Celsius
    "platTemp": 58,                // Celsius
    "polarRegisterCode": "IJKLMNOP",
    "printDuration": 1800,         // Seconds
    "printFileName": "Benchy.gcode",
    "printFileThumbUrl": "http://192.168.1.123:8898/thumb/Benchy.gcode",
    "printLayer": 50,
    "printProgress": 0.45,         // Ratio (0.0 - 1.0)
    "printSpeedAdjust": 100,       // Percentage
    "remainingDiskSpace": 1024,    // Megabytes
    "rightFilamentType": "PLA",
    "rightTargetTemp": 210,        // Celsius
    "rightTemp": 209,              // Celsius
    "status": "printing",          // See "Machine States" table
    "targetPrintLayer": 100,
    "tvoc": 0,                     // Total Volatile Organic Compounds
    "zAxisCompensation": 0         // Millimeters
  }
}
```

### `/product` - Get Product Feature Availability

Retrieves the availability status of various controllable printer features, such as LEDs and fans.

**Method:** `POST`

**Request Payload:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE"
}
```

**Response Example:**
```json
{
  "code": 0,
  "message": "Success",
  "product": {
    "chamberTempCtrlState": 0,
    "externalFanCtrlState": 1,
    "internalFanCtrlState": 1,
    "lightCtrlState": 1,
    "nozzleTempCtrlState": 1,
    "platformTempCtrlState": 1
  }
}
```
*Note: A value of `0` indicates the feature is not available or not controllable, while `1` indicates it is.*

### `/control` - Send Control Commands

This endpoint serves as the base for sending various control commands to the printer.

**Method:** `POST`

**Request Payload Format:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "COMMAND_NAME", // Specific command to execute
    "args": {
      // Command-specific arguments go here
    }
  }
}
```

#### Available Commands

##### Light Control (`lightControl_cmd`)

Controls the printer's internal LED lighting.

**Request Payload Example:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "lightControl_cmd",
    "args": {
      "status": "open"  // "open" to turn on, "close" to turn off
    }
  }
}
```

##### Printer Control (`printerCtl_cmd`)

Adjusts various printer settings, often during an active print.

**Request Payload Example:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "printerCtl_cmd",
    "args": {
      "zAxisCompensation": 0.1, // Note: The exact structure for zAxisCompensation requires confirmation.
      "speed": 100,             // Print speed override (percentage, e.g., 0-100)
      "chamberFan": 100,        // Chamber fan speed (percentage, e.g., 0-100)
      "coolingFan": 100,        // Main cooling fan speed (percentage, e.g., 0-100)
      "coolingLeftFan": 0       // Left cooling fan speed (percentage, e.g., 0-100, if applicable)
    }
  }
}
```

##### Job Control (`jobCtl_cmd`)

Manages the current print job (e.g., pause, resume, cancel).

**Request Payload Example:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "jobCtl_cmd",
    "args": {
      "jobID": "",       // Typically empty, but may be used in future firmware or in cloud services
      "action": "pause"  // Possible values: "pause", "continue", "cancel"
    }
  }
}
```

##### Circulation Control (`circulateCtl_cmd`)

Controls the printer's internal and external air circulation/filtration fans.

**Request Payload Example:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "circulateCtl_cmd",
    "args": {
      "internal": "open",  // "open" to turn on, "close" to turn off
      "external": "open"   // "open" to turn on, "close" to turn off
    }
  }
}
```

##### Camera Control (`streamCtrl_cmd`)

Controls the printer's integrated camera stream (primarily for Pro models or models with camera add-ons).

**Request Payload Example:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "streamCtrl_cmd",
    "args": {
      "action": "open"  // "open" to start stream, "close" to stop stream
    }
  }
}
```

##### Platform Clear Command (`stateCtrl_cmd`)

Clears the printer's "completed print" state, allowing further operations that might otherwise be blocked. This allows for initiating subsequent operations after finishing a print, without manually clearning the dialog.

**Request Payload Example:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "stateCtrl_cmd",
    "args": {
      "action": "setClearPlatform" // Reset the printer to a "ready" state
    }
  }
}
```

**Response Example (for all `/control` commands):**
```json
{
  "code": 0,
  "message": "Success"
}
```

### `/gcodeList` - Get Recent G-code Files

Retrieves a list of the 10 most recently used G-code files stored on the printer.

**Method:** `POST`

**Request Payload:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE"
}
```

**Response Example:**
```json
{
  "code": 0,
  "message": "Success",
  "gcodeList": [
    "Benchy.gcode",
    "CalibrationCube.gcode",
    "Vase.gcode"
    // ... up to 10 files
  ]
}
```

### `/gcodeThumb` - Get Local File Thumbnail

Retrieves a thumbnail image associated with a specific file stored on the printer.

**Method:** `POST`

**Request Payload:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "fileName": "Benchy.gcode" // Name of the file to get thumbnail for
}
```

**Response Example:**
```json
{
  "code": 0,
  "message": "Success",
  "imageData": "BASE64_ENCODED_IMAGE_DATA" // Base64 encoded image string
}
```

### `/printGcode` - Print a Local File

Initiates a print job for a file that already exists on the printer's local storage.

**Method:** `POST`

**Request Payload (Firmware < 3.1.3):**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "fileName": "Benchy.gcode",
  "levelingBeforePrint": true // Whether to perform auto-leveling before printing
}
```

**Request Payload (Firmware >= 3.1.3):**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "fileName": "Benchy.gcode",
  "levelingBeforePrint": true,    // Whether to perform auto-leveling before printing
  "flowCalibration": false,     // The `flowCalibration` parameter's behavior is currently unverified.
  "useMatlStation": false,      // The `useMatlStation` parameter is specific to AD5X series printers.
  "gcodeToolCnt": 0,            // The purpose of the `gcodeToolCnt` parameter is currently undetermined.
  "materialMappings": []        // The `materialMappings` parameter is specific to AD5X series printers.
}
```

**Response Example (for both firmware versions):**
```json
{
  "code": 0,
  "message": "Success"
}
```

### `/uploadGcode` - Upload and Optionally Print File

Uploads a file to the printer and can optionally start printing it immediately.
This endpoint uses `multipart/form-data` for the request body.

**Method:** `POST`

**Headers:**
*   `serialNumber`: `YOUR_SERIAL_NUMBER`
*   `checkCode`: `YOUR_CHECK_CODE`
*   `fileSize`: `FILE_SIZE_IN_BYTES` (Total size of the file)
*   `printNow`: `true` or `false` (Whether to start printing immediately after upload)
*   `levelingBeforePrint`: `true` or `false` (Whether to perform auto-leveling before printing if `printNow` is true)
*   `Expect`: `100-continue`
*   `Content-Type`: `multipart/form-data; boundary=----WebKitFormBoundary...` (Ensure a proper boundary is set)

**Additional Headers (Firmware >= 3.1.3):**
These additional headers are typically relevant for AD5X series printers.
*   `flowCalibration`: `false` (Behavior unverified)
*   `useMatlStation`: `false` (AD5X specific)
*   `gcodeToolCnt`: `0` (Purpose undetermined)
*   `materialMappings`: `W10=` (Represents material mappings, typically a Base64 encoded JSON array. `W10=` is the Base64 encoding of `[]`. Relevant for AD5X series.)

**Request Body:**
The file content sent as form data. The form field name for the file should be `gcodeFile`. 3MF files *are* accepted.

**Example (conceptual form data structure):**
```
------WebKitFormBoundary...
Content-Disposition: form-data; name="gcodeFile"; filename="Benchy.gcode"
Content-Type: application/octet-stream

(binary content of Benchy.gcode)
------WebKitFormBoundary...--
```

**Response Example:**
```json
{
  "code": 0,
  "message": "Success"
}
```

## General Considerations

*   The default HTTP port for this API is `8898`.
*   For requests with a JSON payload, ensure the `Content-Type: application/json` header is correctly set.
*   The `/uploadGcode` endpoint is an exception and uses `Content-Type: multipart/form-data`.

## Error Handling

All API responses consistently include a `code` field and a `message` field to indicate the outcome of the request.
*   A `code` of `0` signifies a successful operation, accompanied by a `message` of `"Success"`.
*   A non-zero `code` indicates an error, with the `message` field providing a description of the error.

## Response Codes

Known response codes:

| Code | Message           | Description                                     |
|------|-------------------|-------------------------------------------------|
| 0    | Success           | Operation completed successfully.               |
| 1    | Error             | A generic error occurred.                       |
| 2    | Invalid parameter | The request payload contains invalid parameters.  |
| 3    | Unauthorized      | Authentication failed (invalid serial or check code). |
| 4    | Not found         | The requested resource or file was not found.   |
| 5    | Busy              | The printer is currently busy with another operation. |

## Machine States

The printer's operational status is indicated by the `status` field in the `/detail` endpoint response. Known printer states:

| Status          | Description                                           |
|-----------------|-------------------------------------------------------|
| ready           | Printer is idle and ready to accept commands.         |
| busy            | Printer is performing a non-printing operation (e.g., homing). |
| calibrate_doing | Printer is currently performing a calibration sequence. |
| error           | An error has occurred on the printer.                 |
| heating         | Printer is heating its nozzle or platform.            |
| printing        | Printer is actively printing a G-code file.           |
| pausing         | Print job is in the process of pausing.               |
| paused          | Print job is currently paused.                        |
| cancel          | Print job has been canceled by the user or system.    |
| completed       | Print job has finished successfully.                  |
