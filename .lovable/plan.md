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

## Phase 3: Camera Animation + Wind (CURRENT)
- Camera keyframe system (position, lookAt, FOV over time)
- Camera path preview with spline interpolation
- Wind simulation affecting particles (direction, speed)
- Smoke/drift physics

## Phase 4: Reports + Rack Management
- PDF report generation (Safety Distance, Wiring Script, Chain Specs, Pinboard Cue Sheet)
- Rack types (circle, tiltable, fan, variable tube)
- Rack layout diagrams (visual arrangement)
- Labels generation
- Site layout diagrams

## Phase 5: Advanced Addressing
- Module/Slat/Pin addressing with constraints and sorts
- Custom module specifications
- Virtual slats and splitter boxes
- Multiple firing systems/universes
- Rack-based addressing
- Lock addresses

## Phase 6: Inventory Management
- Quantities tracking (On Hand, Available, Remaining)
- Cost summaries per show
- Effect import from CSV/Excel with VDL auto-simulation
- Supplier catalog integration

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
