

# PCB Layout FXK-M1 — Design Philosophy + Technical PDF

## Design Philosophy: "Copper Topology"

Extending the existing "Circuit Cartography" aesthetic into the physical domain of PCB fabrication — where copper pours become terrain maps, silk screen becomes cartographic annotation, and drill holes become coordinate markers in a landscape of engineered precision.

Will create `FXK_M1_PCB_Philosophy.md` with 4-6 paragraphs covering the visual language of fabrication drawings: copper layers as topographic surfaces, component footprints as architectural floor plans, via arrays as constellation maps.

## PDF Content: Single A3 landscape page (or 4 pages)

### Page 1 — Top Layer: Component Placement
- Board outline: 180mm × 120mm with M3 mounting holes at corners
- All major components placed with reference designators:
  - U1: ESP32-S3-WROOM-1 (center-left)
  - U2-U5: 74HC595 shift register chain (top row)
  - Q1-Q32: IRLZ44N MOSFETs in 4×8 grid (right half)
  - U6: CC1101 radio module (top-left, isolated)
  - U7-U8: CD74HC4067 MUX (bottom-left, near ADC)
  - U9: TP4056 charger + U10: AMS1117-3.3 (bottom edge)
  - J1: USB-C connector, J2: Smartphone dock connector
  - TB1-TB4: Terminal blocks (32 channels, right edge)
- Silk screen layer: white outlines, ref designators, pin-1 markers
- Keep-out zones: antenna clearance (CC1101), high-current isolation

### Page 2 — Bottom Layer: Ground Plane + Routing
- Solid copper ground pour with thermal relief on ground pads
- Signal traces:
  - SPI bus (ESP32 → CC1101, ESP32 → 74HC595 chain): 0.25mm, green
  - ADC lines (MUX → ESP32): 0.2mm, cyan, guarded
  - Gate drive (595 → MOSFETs): 0.3mm, amber
  - Power rails (3.3V, 5V, VBAT): 0.5mm-1.0mm, red
  - E-STOP signal: 0.4mm, crimson, priority routing
- Via stitching around RF section
- Analog/digital ground split with single-point bridge

### Page 3 — Drill Chart + Board Dimensions
- Full dimensioned drawing with:
  - Overall dimensions, mounting hole positions
  - Drill table: hole sizes, quantities, plated/non-plated
  - Layer stackup: 2-layer FR4, 1.6mm, 1oz copper, HASL finish
  - Minimum trace/space: 0.2mm/0.2mm
  - Board edge clearance markers

### Page 4 — Assembly Guide + Fabrication Notes
- Component BOM cross-reference
- Soldering order (SMD first, then through-hole)
- Test points: TP1-TP8 locations
- Fabrication specifications table
- Gerber file naming convention

## Visual Approach
- Dark substrate (#0A0C10) representing bare FR4
- Copper traces in characteristic amber/gold
- Silk screen in white
- Solder mask openings in lighter shade
- Ground pour as subtle crosshatch pattern
- Grid overlay at 2.54mm pitch (standard 0.1" grid)
- Chamfered title blocks per "Circuit Cartography" philosophy

## Process
1. Create `FXK_M1_PCB_Philosophy.md`
2. Build Python script with reportlab for 4-page A3 PDF
3. Render board outline, components as accurate footprints, trace routing
4. Convert to images for QA
5. Fix any overlaps or readability issues
6. Deliver final PDF

