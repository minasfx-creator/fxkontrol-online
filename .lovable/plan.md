# Finale 3D Feature Replication — Incremental Plan

## Phase 1: Script Window + Chains (CURRENT)
- Full Script Window with Finale 3D columns (Event Time, Effect Time, Prefire, Position, Address, Pan/Tilt, Duration, Description, Cost, Chain Ref, Chain Gap, etc.)
- Chain effects system (combine shells into chains, chain gaps, chain duration calculations)
- Script row grouping and collapsing
- Sort/filter expressions

## Phase 2: VDL + Effect Editor
- Visual Descriptive Language parser (e.g., "3in Red Peony" auto-generates simulation)
- VDL color support (Red, Green, Blue, Gold, Silver, etc.)
- VDL timing terms (PFT, LFT, DLY, DUR, CDS)
- Effect Editor panel for fine-tuning: height, spread angle, star count, tail, strobe
- Per-show effects collection

## Phase 3: Camera Animation + Wind
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
