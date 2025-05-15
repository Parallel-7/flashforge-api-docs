# FlashForge HTTP API Documentation


## Overview

After firmware 3.1.3 on the 5M / Pro, FlashForge added a new API over HTTP, operating on port 8898 by default. 

Adventurer 5M/Pro models running firmware 3.1.3+ are still compatible with the "legacy" TCP API, for FlashPrint compatibility. 

This allows you to utilize new features introduced in the HTTP API, while still having access to direct G/M code commands, for things such as homing the printer.


## Authentication

Authentication is required for all endpoints. The authentication details are included in the request payload for most endpoints:

```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE"
}
```

## Base URL

All endpoints are accessed through the base URL:

```
http://{printer-ip}:port (8898 by default)
```

## Endpoints

### `/detail` - Get Printer Details

Returns detailed information about the printer's current state, temperature, print job progress, etc.

**Method:** POST

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
    "autoShutdown": "open",
    "autoShutdownTime": 30,
    "cameraStreamUrl": "http://192.168.1.123:8080/stream",
    "chamberFanSpeed": 100,
    "chamberTargetTemp": 0,
    "chamberTemp": 45,
    "coolingFanSpeed": 100,
    "cumulativeFilament": 120.5,
    "cumulativePrintTime": 1234,
    "currentPrintSpeed": 100,
    "doorStatus": "close",
    "errorCode": "",
    "estimatedLeftLen": 0,
    "estimatedLeftWeight": 0,
    "estimatedRightLen": 12500,
    "estimatedRightWeight": 35.5,
    "estimatedTime": 3600,
    "externalFanStatus": "open",
    "fillAmount": 20,
    "firmwareVersion": "v3.1.3",
    "flashRegisterCode": "ABCDEFGH",
    "internalFanStatus": "open",
    "ipAddr": "192.168.1.123",
    "leftFilamentType": "",
    "leftTargetTemp": 0,
    "leftTemp": 0,
    "lightStatus": "open",
    "location": "Office",
    "macAddr": "00:11:22:33:44:55",
    "name": "CustomPrinterName",
    "nozzleCnt": 1,
    "nozzleModel": "0.4mm",
    "nozzleStyle": 1,
    "pid": 123,
    "platTargetTemp": 60,
    "platTemp": 58,
    "polarRegisterCode": "IJKLMNOP",
    "printDuration": 1800,
    "printFileName": "Benchy.gcode",
    "printFileThumbUrl": "http://192.168.1.123:8898/thumb/Benchy.gcode",
    "printLayer": 50,
    "printProgress": 0.45,
    "printSpeedAdjust": 100,
    "remainingDiskSpace": 1024,
    "rightFilamentType": "PLA",
    "rightTargetTemp": 210,
    "rightTemp": 209,
    "status": "printing",
    "targetPrintLayer": 100,
    "tvoc": 0,
    "zAxisCompensation": 0
  }
}
```

### `/product` - Control Product Features

Retrieve availability of the printer's control states such as LEDs and fans.

**Method:** POST

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
    "chamberTempCtrlState": 0, - not available
    "externalFanCtrlState": 1, - available 
    "internalFanCtrlState": 1, - available
    "lightCtrlState": 1, - available
    "nozzleTempCtrlState": 1, - available
    "platformTempCtrlState": 1, - available
  }
}
```

### `/control` - Send Control Commands

This is the base endpoint for all control commands

**Method:** POST

**Request Payload Format:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "COMMAND_NAME",
    "args": {
      // Command-specific arguments
    }
  }
}
```

#### Available Commands:

##### Light Control (`lightControl_cmd`)

Controls the printer's LED lights.

**Request Payload Example:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "lightControl_cmd",
    "args": {
      "status": "open"  // or "close" to turn off
    }
  }
}
```

##### Printer Control (`printerCtl_cmd`)

Adjusts various printer settings during printing.

**Request Payload Example:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "printerCtl_cmd",
    "args": {
      "zAxisCompensation": 0.1, - this is not the actual format
      "speed": 100, - 0 - 100 print speed override
      "chamberFan": 100, 0 - 100 fan speed overrides
      "coolingFan": 100,
      "coolingLeftFan": 0
    }
  }
}
```

##### Job Control (`jobCtl_cmd`)

Controls the current print job.

**Request Payload Example:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "jobCtl_cmd",
    "args": {
      "jobID": "",
      "action": "pause"  // Other values: "continue", "cancel"
    }
  }
}
```

##### Circulation Control (`circulateCtl_cmd`)

Controls the printer's filtration/circulation fans.

**Request Payload Example:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "circulateCtl_cmd",
    "args": {
      "internal": "open",  // or "close"
      "external": "open"   // or "close"
    }
  }
}
```

##### Camera Control (`streamCtrl_cmd`)

Controls the printer's camera (Pro models only).

**Request Payload Example:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "streamCtrl_cmd",
    "args": {
      "action": "open"  // or "close"
    }
  }
}
```

##### Platform Clear Command (`stateCtrl_cmd`)

Clears the platform after a print is complete. This allows for various control normally blocked after a finished print, including starting a new job (not that it would be a good idea..).

**Request Payload Example:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "payload": {
    "cmd": "stateCtrl_cmd",
    "args": {
      "action": "setClearPlatform"
    }
  }
}
```

**Response Example (for all control commands):**
```json
{
  "code": 0,
  "message": "Success"
}
```

### `/gcodeList` - Get Recent Files

Retrieves a list of 10 most recently used files on the printer.

**Method:** POST

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
  ]
}
```

### `/gcodeThumb` - Get File Thumbnail

Retrieves a thumbnail image for a specific file.

**Method:** POST

**Request Payload:**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "fileName": "Benchy.gcode"
}
```

**Response Example:**
```json
{
  "code": 0,
  "message": "Success",
  "imageData": "BASE64_ENCODED_IMAGE_DATA"
}
```

### `/printGcode` - Print a Local File

Starts printing a file that already exists on the printer.

**Method:** POST

**Request Payload (Firmware < 3.1.3):**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "fileName": "Benchy.gcode",
  "levelingBeforePrint": true
}
```

**Request Payload (Firmware >= 3.1.3):**
```json
{
  "serialNumber": "YOUR_SERIAL_NUMBER",
  "checkCode": "YOUR_CHECK_CODE",
  "fileName": "Benchy.gcode",
  "levelingBeforePrint": true,
  "flowCalibration": false, -  not tested 
  "useMatlStation": false, - AD5X specific
  "gcodeToolCnt": 0, - Not sure.
  "materialMappings": [] - AD5X specific
}
```


### `/uploadGcode` - Upload and Print a File

Uploads a file to the printer and optionally starts printing it.

**Method:** POST

**Headers:**
```
serialNumber: YOUR_SERIAL_NUMBER
checkCode: YOUR_CHECK_CODE
fileSize: FILE_SIZE_IN_BYTES
printNow: true
levelingBeforePrint: true
Expect: 100-continue
Content-Type: multipart/form-data
```

**Additional Headers for Firmware >= 3.1.3:**

These are not used on the standard 5M/Pro to my knowledge, only the AD5X.
```
flowCalibration: false
useMatlStation: false
gcodeToolCnt: 0
materialMappings: W10=  // Base64 encoded "[]"
```

**Request Body:**
The file content sent as form data with key `gcodeFile`.

**Response Example:**
```json
{
  "code": 0,
  "message": "Success"
}
```

## Error Handling

All API responses include a `code` and `message` field. A successful response will have a code of `0` and a message of `"Success"`. Error responses will have a non-zero code and an error message.

## Response Codes

| Code | Message | Description |
|------|---------|-------------|
| 0    | Success | Operation completed successfully |
| 1    | Error   | Generic error |
| 2    | Invalid parameter | The request contains invalid parameters |
| 3    | Unauthorized | Authentication failed |
| 4    | Not found | Requested resource not found |
| 5    | Busy | Printer is busy with another operation |

## Machine States

The printer's status is represented by one of the following states:

| Status | Description |
|--------|-------------|
| ready | Printer is idle and ready for commands |
| busy | Printer is performing a non-printing operation |
| calibrate_doing | Printer is calibrating |
| error | An error has occurred |
| heating | Printer is heating up |
| printing | Printer is actively printing |
| pausing | Print job is in the process of pausing |
| paused | Print job is paused |
| cancel | Print job has been canceled |
| completed | Print job has completed successfully |


