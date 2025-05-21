# FlashForge Legacy TCP API Documentation

This document describes the legacy TCP-based API, primarily used by FlashForge printer models released before the Adventurer 5 series. Some newer models may retain compatibility for specific functionalities or for backward compatibility with software like FlashPrint.

## Printer Model Coverage

The information in this document has been compiled from various sources, including direct testing and community reports.

| Printer             | Coverage Status                                                                 |
|---------------------|---------------------------------------------------------------------------------|
| Adventurer 5M/Pro   | Fully tested by document authors.                                               |
| Adventurer 4 Series | Partially tested; functionality largely confirmed by existing API knowledge.    |
| Adventurer 3 Series | Functionality reported by users or inferred from other API implementations.     |
| Finder Series       | Functionality reported by users or inferred from other API implementations.     |

*Note: "Functionality reported by users or inferred" means the commands are expected to work based on community feedback or similarities with other FlashForge APIs, but may not have been directly tested on that specific model by the document authors.*

## Initial Connection

To interact with the printer via the TCP API, a specific handshake process is required.

1.  **Establish Connection:** Connect to the printer's TCP socket on port `8899`.
2.  **Request Control (M601):** Send the `M601` command to request control of the printer.
    *   **Successful Response:**
        ```
        CMD M601 Received.
        Control Success V2.1.
        ok
        ```
    *   **Failure Response:** If you receive a "Control Failed" response, it typically means either the previous TCP connection was not properly closed (using `M602`), or another software application is currently connected to the printer.
3.  **Release Control (M602):** Before disconnecting or closing the TCP session, send the `M602` command to release control.
    *   **Response:**
        ```
        CMD M602 Received.
        Control Release.
        ok
        ```

### Keep-Alive

The printer may automatically close the TCP connection if no commands are received for a certain period. To maintain the connection, it's recommended to send a command periodically (e.g., every few seconds). The `M27` (Print Status) command is suitable for this purpose, though any command should suffice. FlashPrint, for example, sends a loop of commands to keep the connection active.


## Information Commands

These commands are used to request various types of information from the printer, such as status, temperature, and file lists.

### `M115` - Get Printer Information

**Description:** Retrieves detailed information about the printer.

**Example Response:**
```
CMD M115 Received.
Machine Type: Flashforge Adventurer 5M Pro
Machine Name: Adventurer 5M Pro
Firmware: v3.1.5
SN: SNMOMC9900728
X: 220 Y: 220 Z: 220
Tool Count: 1
Mac Address:88:A9:A7:97:B2:BF
ok
```

### `M27` - Get Print Status

**Description:** Returns basic information about the current print job's progress.

**Example Response:**
```
CMD M27 Received.
SD printing byte 0/100
Layer: 0/0
ok
```
*Note: The `byte 0/100` typically represents the percentage of the print job completed.*

### `M105` - Get Extruder and Bed Temperatures

**Description:** Returns current and target temperatures for the extruder(s) and heated bed.

**Example Response:**
The printer will respond in one of two formats, depending on its firmware or model:

*   **New Format:**
    ```
    CMD M105 Received.
    T0:17.9/0.0 T1:0.0/0.0 B:18.5/0.0
    ok
    ```
*   **Old Format:**
    ```
    CMD M105 Received.
    T0:22 /0 B:11/0
    ok
    ```
**Key:**
*   `T0`: Primary extruder temperature (Current/Target)
*   `T1`: Secondary extruder temperature (Current/Target, if applicable)
*   `B`: Heated bed temperature (Current/Target)

*Note: An actual response will only contain one of the formats shown above.*

### `M119` - Get Endstop and Printer Status

**Description:** Returns information about endstop states, current machine status, movement mode, LED status, and the active print job's filename.

**Example Response (when idle):**
```
CMD M119 Received.
Endstop: X-max: 110 Y-max: 110 Z-min: 0
MachineStatus: READY
MoveMode: READY
Status: S:1 L:0 J:0 F:0
LED: 1
CurrentFile: 
ok
```
*Note: `CurrentFile:` will be empty if no job is active.*

**Response Components:**
*   **`Endstop`**: Indicates the state of the X, Y, and Z endstops.
*   **`MachineStatus`**: The overall state of the printer. Common states include:
    *   `BUILDING_FROM_SD`
    *   `BUILDING_COMPLETED`
    *   `PAUSED`
    *   `READY`
    *   `BUSY`
*   **`MoveMode`**: The current movement state of the printer. Common modes include:
    *   `MOVING`
    *   `PAUSED`
    *   `READY`
    *   `WAIT_ON_TOOL`
    *   `HOMING`
*   **`Status`**: A condensed status string (S: System State, L: LED State, J: Job State, F: Fan State - exact interpretation may vary).
*   **`LED`**: Indicates LED status (`1` for ON, `0` for OFF).
*   **`CurrentFile`**: The name of the file currently being printed.

### `M114` - Get Current Position

**Description:** Retrieves the current X, Y, Z coordinates of the print head, and extruder (A/B) positions.

**Example Response:**
```
CMD M114 Received.
X:110.050 Y:110.050 Z:200.000 A:0.000 B:0
ok
```

### `M661` - Get Local File List

**Description:** Returns a list of all files stored on the printer's local storage (e.g., internal memory or USB drive). This command might take a few seconds to respond if many files are present.

> **Important:** Unlike most other commands, the primary data for `M661` is sent *after* the initial `ok` confirmation.

**Example Interaction:**
```
< Sent: M661
> CMD M661 Received.
> ok
> D��D�::��#/data/Mason Jar Flower Lid Wood.3mf::��/data/test.3mf::��⸮/data/FileUploadTest.gcode::��#/data/FlashPrintUploadTest.gcode.gx
```
*The data following "ok" is a raw string containing file paths, often delimited by special characters (like `::��`). Parsing this data requires specific handling to extract individual filenames.*

### `M662` - Get Local File Preview (PNG)

**Description:** Retrieves a PNG thumbnail image for the specified file stored on the printer.

**Command Format:**
`M662 file_path`
*Example: `M662 /data/MyModel.gcode`*

> **Important:** Similar to `M661`, the binary PNG data for `M662` is sent *after* the initial `ok` confirmation.

**Example Interaction (conceptual):**
```
< Sent: M662 /data/MyModel.gcode
> CMD M662 Received.
> ok
> [Raw PNG binary data starts here...]
> ‰PNG
> 
> IHDR............
```
*The data following "ok" is the raw binary content of the PNG image.*

## Control Commands

These commands are used to control various printer operations, such as starting prints, managing jobs, and setting temperatures.

### `G28` - Home Axes

**Description:** Initiates the homing sequence for all axes (X, Y, and Z), moving the print head to the origin position.

**Command:**
`G28`

**Response (typically):**
```
CMD G28 Received.
ok
```

### `M112` - Emergency Stop

**Description:** Intended to halt all printer activity immediately.
The effectiveness and compatibility of the `M112` command can vary between printer models and firmware versions. It was found to be non-operational on an Adventurer 5M Pro during testing.

**Command:**
`M112`

**Response (if acknowledged):**
```
CMD M112 Received.
ok
```

### `M23` - Start Print Job

**Description:** Starts printing a specified file from the printer's local storage.

**Command Format:**
`M23 0:{file_path}`
*   `{file_path}` should be the full path to the file on the printer (e.g., `/user/file_name.gcode`, `/data/model.3mf`).

**Example Request:**
`M23 0:/user/Benchy.gcode`

**Response (typically):**
```
CMD M23 Received.
ok
```

### Job Control Commands (`M24`, `M25`, `M26`)

These commands are used to manage an active print job.

*   **`M24` - Resume Print:** Resumes a paused print job.
*   **`M25` - Pause Print:** Pauses the current print job.
*   **`M26` - Stop Print:** Stops the current print job.

**Example Usage:**
`M25` (to pause)

**Typical Response for all job control commands:**
```
CMD M2X Received. // Where X is 4, 5, or 6
ok
```

> #### Important Note on Job Stoppage
> Once a print job is stopped using the `M26` command via the TCP API, the printer may enter a state where it requires manual intervention on the printer's interface (e.g., clearing the completed/stopped job notification) before a new print job can be started or certain other control commands can be effectively issued.


### `M146` - LED Control

**Description:** Controls the printer's internal LED lights.

**Command Format:**
`M146 r{red} g{green} b{blue} F{flag}`
*   `{red}`, `{green}`, `{blue}`: Color intensity values (0-255).
*   `{flag}`: A control flag, typically `0`. Its exact function might vary but is usually required. `F0` is commonly used to apply the settings.

**Examples:**
*   **LEDs ON (White):** `M146 r255 g255 b255 F0`
*   **LEDs OFF:** `M146 r0 g0 b0 F0`

**Response (typically):**
```
CMD M146 Received.
ok
```

### `M104` - Set Extruder Temperature

**Description:** Sets the target temperature for the primary extruder.

**Command Format:**
`M104 S{temperature}`
*   `S{temperature}`: Target temperature in Celsius.
*   `S0`: Disables extruder heating.

**Examples:**
*   Set extruder to 210°C: `M104 S210`
*   Turn off extruder heating: `M104 S0`

**Response (typically):**
```
CMD M104 Received.
ok
```

### `M140` - Set Bed Temperature

**Description:** Sets the target temperature for the heated bed.

**Command Format:**
`M140 S{temperature}`
*   `S{temperature}`: Target temperature in Celsius.
*   `S0`: Disables bed heating.

**Examples:**
*   Set bed to 60°C: `M140 S60`
*   Turn off bed heating: `M140 S0`

**Response (typically):**
```
CMD M140 Received.
ok
```



