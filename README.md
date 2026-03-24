# FX KONTROL — Drone & Fireworks Show Platform

> **by Minas FX** · Next-Generation Autonomous Simulation & Show Design

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FX KONTROL PLATFORM                       │
│                       by Minas FX                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Web Studio   │  │  GPU Engine   │  │  Show Orchestrator│  │
│  │  React/Three  │  │  WebGL/WebGPU │  │  State Machine    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│  ┌──────┴──────────────────┴────────────────────┴──────────┐ │
│  │              Flockwave Protocol (JSON-RPC)               │ │
│  └──────┬──────────────────┬────────────────────┬──────────┘ │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌────────┴─────────┐   │
│  │  Swarm Core   │  │  Physics Sim  │  │  AI Choreography │  │
│  │  (Rust/WASM)  │  │  (C++/WASM)   │  │  (Gemini/GPT)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  MAVLink Ctrl │  │  Digital Twin │  │  Kubernetes Mesh  │  │
│  │  PX4/ArduPilot│  │  Terrain/Wind │  │  Distributed Sim  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
fx-kontrol/
├── frontend/               # Web Studio (this repo — React/Three.js)
│   ├── src/components/     # 80+ editor panels, GPU effects
│   ├── src/lib/            # Flockwave, physics, AI engines
│   └── supabase/functions/ # Edge functions (MAVLink, Art-Net, SMPTE)
├── swarm-core-rust/        # [Planned] WASM swarm engine
├── physics-engine-cpp/     # [Planned] WASM physics
├── ai/                     # Show generator, autonomy
├── drone-control/mavlink/  # Hardware bridge (PX4/ArduPilot)
├── simulation/             # Digital twin, WebGPU compute
├── cluster/kubernetes/     # Distributed simulation
└── tools/                  # Terrain importer, show exporter
```

## Capabilities

- **3D Viewport**: Three.js with bloom, ACES, 10K instanced drones
- **GPU Particles**: HDR fireworks with thermal transitions, wind physics
- **Show Control**: Flockwave v2 state machine, fleet management, geofence
- **AI**: SwarmGPT formations, music-reactive choreography
- **Export**: .skyc, .vviz, .kmz, CSV (Cobra/FireOne/Galaxis)

## Capacity: 10K drones, 100K GPU particles, SMPTE sync, MAVLink bridge

## Getting Started

```bash
npm install && npm run dev
```

## About Minas FX

Brazilian technology company specializing in drone shows & pyrotechnics choreography.
FX KONTROL is our flagship show design platform.

© 2024-2026 Minas FX. All rights reserved.
