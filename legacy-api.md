# FlashForge "legacy" TCP API
All wifi-enabled FlashForge printers before the Adventurer 5 series utilize this API.

## Coverage
| Printer | Description |
|--------|-------------|
| Adventurer 5M/Pro | Fully tested |
| Adventurer 4 Series | Partial Testing. Confirmed by existing APIs |
| Adventurer 3 | Not tested. Confirmed by existing APIs |
| Finder I | Not tested. Confirmed by existing APIs. |

## Initial Connection
After connecting to the TCP socket, you must send M601 to establish "control".

If you receive a "Control Failed" response, you either forgot to close the last connection (with M602), or other software is already connected.

### Login (M601)
```
CMD M601 Received.
Control Success V2.1.
ok
```

### Logout (M602)
```
CMD M602 Received.
Control Release.
ok
```

### Keep-Alive
The printer will drop the connection if no command(s) are received after a short period of time. FlashPrint sends a few commands in a loop, but sending M27 (or any command) every few seconds is enough.


## Information 
Commands for requesting printer / job information


### Printer Information (M115)
Returns detailed printer information
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

### Print Status (M27)
Returns basic job progress information
```
CMD M27 Received.
SD printing byte 0/100
Layer: 0/0
ok
```

### Extruder & Bed Temp (M105)
Returns extruder and bed temperature information
```
CMD M105 Received.
T0:17.9/0.0 T1:0.0/0.0 B:18.5/0.0 (New Format)
T0:22 /0 B:11/0 (Old Format)
ok

An actual message will only contain one 'format'.

T0 / T1 - Extruder (Current/Set)
B - Bed (Current/Set)
```

### Endstop Information (M119)
Returns information about the current state of the printer (paused, printing, etc.) Also includes if LEDs are enabled/disabled, and the name of the current job (if printing)
```
CMD M119 Received.
Endstop: X-max: 110 Y-max: 110 Z-min: 0
MachineStatus: READY
MoveMode: READY
Status: S:1 L:0 J:0 F:0
LED: 1 - LEDs are on
CurrentFile: - not present because there's no active job
ok

Move Modes: MOVING, PAUSED, READY, WAIT_ON_TOOL, HOMING
Machine Status (Modes): BUILDING_FROM_SD, BUILDING_COMPLETED, PAUSED, READY, BUSY
```

### Current Position (M114)
```
CMD M114 Received.
X:110.050 Y:110.050 Z:200.000 A:0.000 B:0
ok
```

### Local File List (M661)
Returns a list of all files on the printer (can take a few seconds with a lot of files)


**This sends it's data after the ok, unlike other commands**
```
Received reply for command: CMD M661 Received.
ok

D��D�::��#/data/Mason Jar Flower Lid Wood.3mf::��/data/test.3mf::��⸮/data/FileUploadTest.gcode::��#/data/FlashPrintUploadTest.gcode.gx::��/data/Mason Jar Flower Lid.3mf::��"/data/platypus-trader-mini-stl.3mf::��(/data/wood-ca
rved-wolf-sculpture-stl.3mf::��!/data/BirdbuddySpillshroud+v3.3mf::��/data/ASA Benchy.3mf
```

### Local File Preview (PNG)
Returns PNG (model preview) data for the requested file


**This sends it's data after the ok, unlike other commands**
```
Response: CMD M662 Received.
ok
**¢¢yûPNG


IHDRôxÔúyÂIDATxí{^Uyþ)
HZ4Èy8á"HDpH"°!FÄ¨G°0Øjµµv<´ô`Û±­
(full response omitted)
```

## Control

### Home Axes (G28)

### Emergency Stop (M112)
Unsure what this works on, does not work on my 5M Pro.

### Start Print (M23)
```
M23 0:/user/file_name.3mf (or .gcode/.gx)
```

### Job Control
*Once a print is stopped from the TCP API , it must be cleared manually printer-side to start another or control various things.*
```
Pause Print (M25)
Resume Print (M24)
Stop Print (M26)
```


### Led Control (M146)
```
LEDs ON: M146 r255 g255 b255 F0
LEDs OFF: M146 r0 g0 b0 F0
```

### Set Extruder Temp (M104)
```
M104 S123 - 123 is desired temp
M104 S0 - Disable extruder heating
```

### Set Bed Temp (M140)
```
M140 S123 - 123 is desired temp
M140 S0 - Disable bed heating
```



