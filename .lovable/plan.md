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

## Phase 7: Additional Exports (DONE ✅)
- 40+ firing system formats (Galaxis, FireOne, Pyrodigital, etc.)
- DMX fixture support
- Video export (WebM recording with TC burn-in, configurable resolution)
- SMPTE/LTC timecode synchronization (Master/Slave/Freerun, external TC via WebSocket)
- Sound level charts (dB SPL analysis, A/C weighting, Leq, exceedance tracking)

## Phase 8: Scripting Power Tools (DONE ✅)
- Randomize timing/positions
- Make into sequence (auto-distribute across positions)
- Make into fan (auto-angle distribution)
- Spread out based on durations
- Reverse order, Quantize to grid
- Keyboard shortcuts (Space, S, Delete, Ctrl+D, Ctrl+A, i, e, ?)

## Phase 9: Advanced Drone Physics (DONE ✅)
- PID Controller engine (src/lib/pidController.ts) — 5-axis PID with Kp/Ki/Kd tuning
- PID presets: DJI Matrice 600, Show Drone 250g, Custom
- Realistic tilt/roll/pitch from acceleration, drag model, wind forces
- PIDPanel UI with per-axis gain sliders, test flight simulator, visual stats
- DMX512/Art-Net engine (src/lib/dmxEngine.ts) — virtual fixture patching, universes, keyframes
- Auto-patch drones as RGBW fixtures across DMX universes
- DMX keyframe interpolation and Art-Net CSV export
- DMXPanel UI with universe grid, fixture selector, keyframe controls
- Battery discharge model (src/lib/batteryModel.ts) — LiPo simulation with temp derating
- RTL safety margin alerts (30% reserve), voltage sag under load
- Battery presets: 2S/4S/6S configurations
- BatteryPanel UI with visual battery bar, real-time simulation, flight condition sliders

## Phase 10: MAVLink Protocol Bridge (DONE ✅)
- MAVLink 2.0 virtual protocol engine (src/lib/mavlinkProtocol.ts)
- Message types: HEARTBEAT, ATTITUDE, GPS_RAW_INT, VFR_HUD, SYS_STATUS, LOCAL_POSITION_NED
- Telemetry state per drone with full flight data (position, velocity, attitude, battery, GPS)
- Base64 encoding for WebSocket/SSE transport as described in research paper
- MAVLink store (src/store/useMAVLinkStore.ts) for multi-drone telemetry management
- Edge function bridge (supabase/functions/mavlink-bridge) — validates telemetry, processes commands
- Bridge validates: battery levels, excessive tilt, GPS fix, speed limits
- Command relay: ARM, DISARM, TAKEOFF, LAND, RTL, GUIDED, SET_MODE, REBOOT
- MAVLinkPanel UI with connection status, telemetry HUD, command buttons, message log
- Auto-stream: Boids simulation → MAVLink telemetry in real-time
- Coordinate conversion: Y-up (sim) → NED (MAVLink) automatic

## Phase 11: Advanced Music Sync (DONE ✅)
- Music-Reactive Engine (src/lib/musicReactiveEngine.ts) — real-time intensity modulation from audio analysis
- Onset-driven cue placement: auto-place pyrotechnic cues on beats, onsets, or energy peaks
- Cue placement modes: Beats, Onsets, Peaks, Combined with configurable beat divisor (1/2/4/8)
- Onset type filtering: kick, snare, hi-hat, transient — selective cue triggers
- Distribution options: cycle effects and positions across generated cues
- Sensitivity & min-interval controls for fine-tuning cue density
- Preview system: visualize generated cues on waveform before applying
- getReactiveState() — per-frame intensity/bass/mid/high for real-time visual modulation
- ONSET_EFFECT_MAP — suggested effect categories per onset type (kick→morteiros, snare→peonias, etc.)
- Synesthesia panel: 2-tab UI (Auto Cues + Formations) with full parameter controls

## Phase 12: AR Overlay & Sharing (DONE ✅)
- AR/Hybrid overlay engine (src/lib/arOverlayEngine.ts) — composite simulated effects over real venue photos
- Perspective calibration: horizon line, vanishing point, FOV estimate, effect scale, rotation offset
- Blend modes: Screen, Additive, Normal, Overlay with configurable opacity
- Calibration grid and horizon line visual guides
- worldToImagePosition() — maps 3D world coords to 2D image positions via single-point perspective
- AROverlayPanel UI with venue photo upload, calibration sliders, blend controls
- Show Preview Sharing (ShowSharePanel) — generate shareable read-only preview links
- Access controls: public/private, password protection, expiry (1h/24h/7d/30d/never)
- Content visibility toggles: timeline, positions, comments, watermark

## Phase 13: Collaboration, Particles & Versioning (DONE ✅)
- Multi-user collaboration engine (src/lib/collaborationEngine.ts) — Supabase Realtime presence + broadcast
- Real-time cursor sharing, presence tracking, edit broadcasting with last-writer-wins conflict resolution
- CollaborationPanel UI with room codes, online user list, activity log
- Custom Particle Editor (ParticleEditorPanel) — granular particle system designer
- 6 built-in presets (Peony, Willow, Crackle, Waterfall, Smoke, Comet)
- Full parameter control: emission, physics (speed/gravity/drag/turbulence), appearance (colors/shape/blend/trail)
- Live 2D canvas preview with real-time particle simulation
- Show Versioning (VersioningPanel) — named snapshots with diff comparison and restore
- Snapshot save/restore with position and cue count tracking

## Phase 14: Collision, Weather & Approval (DONE ✅)
- Advanced drone formation collision detection (src/lib/collisionDetector.ts)
  - Spatial grid acceleration for O(n) average collision checks
  - Checks hold phases and transition phases (interpolated smoothstep)
  - Min distance over time chart, severity classification (warning/critical)
  - CollisionPanel UI with detail list, seekable collisions, sample rate control
- Weather API integration (src/lib/weatherService.ts) — Open-Meteo (free, no API key)
  - Current conditions + 24h hourly forecast
  - Flight risk analyzer: wind, gusts, precipitation, visibility, temperature, thunderstorm
  - Risk levels: Safe/Caution/Warning/Grounded with score 0-100
  - Auto-apply wind to simulation, WeatherPanel UI with live data
- Client approval workflow (ClientApprovalPanel)
  - Approval statuses: Draft → Pending Review → Changes Requested / Approved
  - Threaded comments with resolve/reject per comment, reply system, filtering

## Phase 15: Next
- Multi-language localization (PT-BR, EN, ES)
- Show template marketplace
- Advanced trajectory optimization
- Real-time 3D collision avoidance during playback
