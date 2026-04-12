

# JOI Central Intelligence — UI Panels & Rich Rendering Implementation

## Current State

JOI's backend intelligence is **already complete**:
- System prompt defines her as systems intelligence with 7 modes, safety rules, and provenance honesty
- `JoiContextBuilder` aggregates ShowPlan, Verification, Readiness, Hardware, Exports, OperationalMode
- `joiCommandExecutor` has 8 system inspection commands (inspect_showplan, run_verification, etc.)
- `joiModes.ts` defines 7 modes (SHOW, ARCH, ANALYST, VERIFY, PLAN, BLUE, DOCS) with presets
- `FXKAssistant.tsx` has mode selector bar, context injection, streaming chat

**What's missing**: The UI only renders plain markdown. No structured panels, no truth badges in responses, no Mermaid rendering, no insight/artifact separation. JOI looks like a chatbot, not a mission-control intelligence.

---

## Plan

### Phase 1 — JOI Types (`src/core/joi/joiTypes.ts`)

Formalize the intelligence contract types:

```
JOIMode (add 'hardware_truth' as 8th mode)
JOIInsight { source, severity, message, integration_mode, evidence_level }
JOIRecommendation { priority, action, rationale, confidence }
JOIArtifact { id, type, title, content, generated_at }
JOIArtifactType = 'mermaid' | 'matrix' | 'report' | 'checklist' | 'blueprint'
JOIContextState { mode, source_of_truth[], integration_mode, evidence_level, confidence }
JOIConfidenceLevel = 'low' | 'medium' | 'high'
JOITruthSummary { simulated, replay, live_read_only, not_integrated counts + device lists }
```

### Phase 2 — Hardware Truth Mode (`src/core/joi/joiModes.ts`)

Add 8th mode `hardware_truth` between `verify` and `planner`:
- Color: emerald/green
- Icon: `Eye` or `Radio`
- Presets: "Device Provenance", "Integration Status", "Stale Data Check", "Risk Assessment"
- System instruction: focus on provenance interpretation, integration modes, evidence levels

### Phase 3 — JOI Context Ribbon (`src/components/joi/JOIContextRibbon.tsx`)

A compact bar shown inside the JOI panel (below mode selector) displaying:
- Current `source_of_truth` badges
- `integration_mode` indicator (SIMULATED / REPLAY / LIVE / NOT INTEGRATED)
- `evidence_level` badge
- `confidence` level
- System readiness status dot
- Updates on every mode change or system state change

### Phase 4 — JOI Insight Panel (`src/components/joi/JOIInsightPanel.tsx`)

A collapsible panel in the JOI sidebar (when expanded) showing:
- Current blockers (from ReadinessEvaluator)
- Active warnings (from VerificationEngine)
- Anomalies (stale data, offline devices)
- Recommendations (next best action)
- Each item tagged with integration_mode and evidence_level

### Phase 5 — Rich Response Rendering

Update `FXKAssistant.tsx` message rendering to detect and render:

1. **Mermaid blocks**: Detect ` ```mermaid ` code blocks, render using dynamic import of `mermaid` library as inline SVG diagrams
2. **Status cards**: Detect `[JOI_STATUS]{...}[/JOI_STATUS]` blocks, render as styled telemetry cards with readiness badge, health score, device counts
3. **Matrix blocks**: Detect `[JOI_MATRIX]{...}[/JOI_MATRIX]` blocks, render as color-coded tables with status cells (green/amber/red/cyan)
4. **Truth badges inline**: When JOI mentions a subsystem, auto-tag with its integration mode badge

### Phase 6 — JOI Truth Inspector (`src/components/joi/JOITruthInspector.tsx`)

A dedicated panel (accessible via button in JOI header or as expanded sidebar section):
- Lists all adapters with their integration_mode badge
- Shows evidence_level per adapter
- Shows data freshness
- Color-coded: green (live), blue (simulated), amber (replay), red (not integrated)
- Summary counts at top

### Phase 7 — Enhanced System Prompt Additions

Update `systemPrompt.ts` to:
- Add `hardware_truth` mode instructions
- Instruct JOI to use `[JOI_STATUS]` and `[JOI_MATRIX]` blocks when generating system state summaries
- Instruct JOI to always include a truth footer with `source_of_truth`, `integration_mode`, `evidence_level`, `confidence`

---

## Files to Create (4)
1. `src/core/joi/joiTypes.ts` — Formalized intelligence types
2. `src/components/joi/JOIContextRibbon.tsx` — Truth/context status bar
3. `src/components/joi/JOIInsightPanel.tsx` — Blockers/warnings/recommendations
4. `src/components/joi/JOITruthInspector.tsx` — Integration truth inspector panel

## Files to Update (3)
1. `src/core/joi/joiModes.ts` — Add `hardware_truth` mode
2. `src/components/FXKAssistant.tsx` — Integrate ribbon, insight panel, truth inspector, rich rendering (Mermaid, status cards, matrix blocks)
3. `supabase/functions/fxk-ai-chat/systemPrompt.ts` — Add hardware_truth mode, structured output instructions

## Dependencies
- `mermaid` npm package for inline diagram rendering (dynamic import to avoid bundle bloat)

## What This Delivers
- JOI displays provenance/confidence on every interaction via Context Ribbon
- Rich Mermaid diagrams render inline in chat
- System state matrices render as color-coded tables
- Truth Inspector shows honest integration status at a glance
- Insight Panel surfaces blockers and recommendations proactively
- Hardware Truth mode dedicated to provenance analysis
- All responses carry architectural honesty metadata

