# AD5X Implementation Workflow

Implementing AD5X support requires handling the interaction between the file's material requirements and the printer's physical material station (IFS). This applies to both uploading new files and starting valid local files.

## 1. Query Material Station Status

Before any operation, retrieve the current configuration of the IFS to know what materials are available in which slots.

**Endpoint:** `/detail`
**Check:**
1.  `hasMatlStation`: Must be `true`.
2.  `matlStationInfo.slotInfos`: Iterate through this array to perceive the state (Loaded/Empty, Material Type, Color) of each physical slot (1-4).

## 2. Determine File Requirements

Identify the tools (distinct colors/filaments) required by the G-code/3MF.
*   **For Local Files:** Use `/gcodeList` to get `gcodeToolDatas`.
*   **For New Uploads:** Parse the 3MF/G-code metadata locally to extract filament information (Color, Type, Tool Index).

## 3. Generate Material Mappings

You must construct a `materialMappings` array to tell the printer which physical slot to use for each logical tool (color).

> [!IMPORTANT]
> **Single-Color Jobs:** Even single-color prints using the IFS require a mapping (e.g., mapping logical "Tool 0" to physical "Slot 1").

**Matching Logic:**
For each tool required by the file:
1.  Find a compatible slot in `matlStationInfo` (matching Material Type).
2.  Prefer exact color matches.
3.  Create an object linking the `toolId` to the `slotId`.

**Example Mapping (Single Color via Slot 3):**
```json
[
  {
    "toolId": 0,
    "slotId": 3, 
    "materialName": "PLA",
    "toolMaterialColor": "#FF0000",
    "slotMaterialColor": "#FF0000"
  }
]
```

## 4. Send Command

### Uploading (`/uploadGcode`)
Include the mappings in the headers.

*   `useMatlStation`: `true`
*   `gcodeToolCnt`: Number of tools/colors (e.g., `1` for single color, `2+` for multi-color). Note: This is the count of distinct "rolls" of filament used.
*   `materialMappings`: **Base64 encoded** JSON string of the mapping array.

### Starting Local Job (`/printGcode`)
Include the mappings in the JSON payload.

*   `useMatlStation`: `true`
*   `gcodeToolCnt`: Number of tools/colors.
*   `materialMappings`: The JSON array object itself (not Base64 encoded).

## Example: Starting a Multi-Color Local Print

```json
{
  "serialNumber": "SN123456",
  "checkCode": "Code123",
  "fileName": "Project.3mf",
  "levelingBeforePrint": true,
  "flowCalibration": false,
  "useMatlStation": true,
  "gcodeToolCnt": 2,
  "materialMappings": [
    {
      "toolId": 0,
      "slotId": 1, 
      "materialName": "PLA",
      "toolMaterialColor": "#FFFFFF", 
      "slotMaterialColor": "#FFFFFF"
    },
    {
      "toolId": 1, 
      "slotId": 2,
      "materialName": "PLA",
      "toolMaterialColor": "#000000",
      "slotMaterialColor": "#000000"
    }
  ]
}
```
