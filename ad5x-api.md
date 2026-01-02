# FlashForge AD5X API Documentation

## Overview

The Adventurer 5X (AD5X) is a specialized model in the 5M series equipped with a **Multi-Material Station (IFS)**, allowing for multi-color and multi-material printing. While it shares the core HTTP API with the Adventurer 5M/Pro, it introduces specific protocols and parameters for managing the IFS, material mappings, and multi-tool print jobs.

> [!NOTE]
> The AD5X does **not** have a built-in camera or factory-installed LEDs, unlike the 5M Pro.

## Material Station (IFS) Protocol

The IFS (Intelligent Filament System) manages up to 4 material slots. Interactions with the IFS primarily involve querying its status via the `/detail` endpoint and specifying material mappings when uploading or starting print jobs.

### Data Models

#### `AD5XMaterialMapping`
Used to map a specific tool (extruder logical index) to a physical slot in the material station.

| Field | Type | Description |
| :--- | :--- | :--- |
| `toolId` | Number | The logical tool index (0-3). Note: This refers to the color index, not a physical extruder. |
| `slotId` | Number | The physical slot index (1-4). |
| `materialName` | String | Name of the material (e.g., "PLA"). |
| `toolMaterialColor` | String | Hex color code of the expected material (e.g., "#000000"). |
| `slotMaterialColor` | String | Hex color code of the actual material in the slot (e.g., "#000000"). |

#### `MatlStationInfo`
Detailed status of the material station, returned as part of the machine details.

| Field | Type | Description |
| :--- | :--- | :--- |
| `currentLoadSlot` | Number | The slot ID currently being loaded (0 if none). |
| `currentSlot` | Number | The slot ID currently active/printing (0 if none). |
| `slotCnt` | Number | Total number of slots (typically 4). |
| `stateAction` | Number | Current action state code. |
| `stateStep` | Number | Current step within the action state. |
| `slotInfos` | Array | List of `SlotInfo` objects for each slot. |

#### `SlotInfo`
Information about a specific slot in the material station.

| Field | Type | Description |
| :--- | :--- | :--- |
| `slotId` | Number | The physical slot ID (0-3 in backend, 1-4 in UI). |
| `hasFilament` | Boolean | Whether filament is detected in the slot. |
| `materialName` | String | The type of material detected/configured (e.g., "PLA"). |
| `materialColor` | String | The hex color of the material. |

## AD5X Specific Endpoints & Parameters

### `/detail` - Machine Details

For AD5X printers, the `/detail` response includes additional fields related to the material station.

**Response additions:**
```json
{
  "detail": {
    // ... standard fields ...
    "hasMatlStation": true,
    "matlStationInfo": {
      "currentLoadSlot": 0,
      "currentSlot": 1,
      "slotCnt": 4,
      "stateAction": 0,
      "stateStep": 0,
      "slotInfos": [
        {
          "hasFilament": true,
          "materialColor": "#FFFFFF",
          "materialName": "PLA",
          "slotId": 0
        },
        // ... slots 1-3
      ]
    },
    "indepMatlInfo": { ... } // Independent material loading info
  }
}
```

## Implementation Workflow

For a detailed guide on implementing AD5X support, including querying the IFS status, matching materials, and constructing the correct payloads for `/uploadGcode` and `/printGcode`, please see:

**[AD5X Implementation Workflow](ad5x-workflow.md)**

### Key Endpoints involved:

*   **`/detail`**: Checking `matlStationInfo` to see available materials.
*   **`/gcodeList`**: Determining file requirements (color counts/colors).
*   **`/uploadGcode`**: Sending `materialMappings` via headers.
*   **`/printGcode`**: Sending `materialMappings` via JSON body.

### `/gcodeList` - Enhanced File List

On AD5X printers, the `/gcodeList` endpoint returns richer data about files, including their material requirements.

**Response Structure:**
```json
{
  "gcodeListDetail": [
    {
      "gcodeFileName": "Model.gcode",
      "printingTime": 3600,
      "totalFilamentWeight": 150.5,
      "useMatlStation": true,
      "gcodeToolCnt": 4, // Represents the number of distinct colors/rolls used
      "gcodeToolDatas": [
        {
          "toolId": 0,
          "materialName": "PLA",
          "materialColor": "#FF0000",
          "filamentWeight": 50.2,
          "slotId": 0
        }
        // ...
      ]
    }
  ]
}
```
