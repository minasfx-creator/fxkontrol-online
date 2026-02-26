# Finale 3D Feature Replication — Incremental Plan

## Phase 1: Script Window + Chains (CURRENT)
- Full Script Window with Finale 3D columns (Event Time, Effect Time, Prefire, Position, Address, Pan/Tilt, Duration, Description, Cost, Chain Ref, Chain Gap, etc.)
- Chain effects system (combine shells into chains, chain gaps, chain duration calculations)
- Script row grouping and collapsing
- Sort/filter expressions

## Phase 2: VDL + Effect Editor (DONE ✅)
- VDL parser (src/lib/vdlParser.ts) — parses "3in Red Peony w/ tail" into structured params
- VDL colors: 20 named colors (red, gold, silver, titanium, brocade, etc.)
- VDL types: 25 effect types (peony, chrysanthemum, willow, kamuro, comet, mine, fan, etc.)
- VDL modifiers: tail, glitter, strobe, crackle, pistol, twinkle, whistle, report
- VDL caliber scaling: height, spread, duration, star count, cost auto-calculated
- Effect Editor panel with sliders: caliber, height, spread angle, star count, duration
- Color picker grid with 20 VDL colors
- Modifier toggle badges
- VDL Quick Add input in Effect Library sidebar (Enter to add)
- toVDL() reverse generator from params

## Phase 3: Camera Animation + Wind (DONE ✅)
- Camera keyframe system with Catmull-Rom spline interpolation (position, lookAt, FOV)
- Camera path 3D preview (cyan spline + octahedron markers at keyframes)
- CameraAnimator component driving camera during playback
- Wind simulation: direction (0-360°), speed (0-15 m/s), gust strength (0-100%)
- Wind affects all particle physics (firework bursts drift with wind)
- WindCameraPanel UI with sliders + keyframe list
- Toolbar toggle button for Wind & Camera panel

## Phase 4: Reports + Rack Management (DONE ✅)
- PDF report generation via printable HTML: Safety Distance (NFPA 1123), Wiring Script, Chain Specs, Pinboard Cue Sheet
- Report engine (src/lib/reportEngine.ts) with open-in-window + download
- Rack store (src/store/useRackStore.ts) with types: circle, tiltable, fan, variable-tube
- Rack Manager panel with SVG visual layout diagrams
- Tube generation per rack type with angle/heading distribution
- Labels generation (printable HTML labels per tube)
- Toolbar buttons for Reports (📄) and Racks (📦)

## Phase 5: Advanced Addressing (DONE ✅)
- Addressing store (src/store/useAddressingStore.ts) with Module/Slat/Pin assignment
- 6 pre-configured module specs (Cobra 18R2/R3, FireOne 32, PyroDigital 32, Galaxis G2, Custom)
- Auto-assign algorithm respecting locked addresses and occupied slots
- Virtual slats via splitter boxes (expandable pin count per physical pin)
- Multiple firing systems / universes with independent module specs
- Rack-based addressing (assigns by rack tube order)
- Lock/unlock individual addresses to preserve during re-assignment
- Sort by time, module, position, or rack
- AddressingPanel UI with 4 tabs: Addresses, Modules, Splitters, Systems
- Toolbar button (⚡ Cpu icon) for Addressing panel toggle

## Phase 6: Inventory Management (DONE ✅)
- Inventory store (src/store/useInventoryStore.ts) with on-hand, allocated, remaining tracking
- Cost summaries with markup multiplier per show
- CSV import with VDL auto-detection for effect matching
- InventoryPanel UI with 3 tabs: Stock, Costs, Import
- Low-stock warnings with visual indicators
- Toolbar button ($) for Inventory panel toggle

## Phase 7: Additional Exports
- 40+ firing system formats (Galaxis, FireOne, Pyrodigital, etc.)
- DMX fixture support
- Video export (simulation recording)
- Timecode support (SMPTE/FSK)
- Sound level charts

## Phase 8: Scripting Power Tools
- Copy/paste with fill handle
- Randomize timing/positions
- Make into sequence (auto-distribute across positions)
- Make into fan (auto-angle distribution)
- Effect macros
- Spread out based on durations
- Keyboard shortcuts
