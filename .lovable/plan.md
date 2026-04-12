

# JOI Intelligence Redesign — Central Orchestration Intelligence for FX KONTROL

## Current State

JOI today is a **chatbot companion** (`FXKAssistant.tsx`, 1085 lines) with:
- Streaming AI chat via `fxk-ai-chat` edge function
- `[JOI_CMD]` command execution for show design (positions, effects, choreography)
- System prompt focused on "secretária executiva" — documents, budgets, licensing
- Voice recognition + TTS
- PDF/DOCX export per message
- KMZ aeronautical export
- Context injection from `useProjectStore` (positions, effects, timeline)

**What's missing**: JOI has zero awareness of the hardware/verification/readiness/safety/export pipeline built in recent phases. She cannot inspect ShowPlan, VerificationEngine, ReadinessEvaluator, HardwareRegistry, ExportCoordinator, AuditTrail, or CurrentStateMatrix.

---

## Plan

### Phase 1 — System Context Layer (`src/core/joi/JoiContextBuilder.ts`)

Create a module that assembles JOI's full system awareness by reading from all core modules:

- `showPlanManager.current` → pyro/DMX/drone counts, metadata, validation state
- `verificationEngine.run()` → check results, level, blockers
- `readinessEvaluator.evaluate()` → status, allowed ops, issues
- `unifiedHardwareRegistry.getSystemHealth()` → device states, online/offline, simulated count
- `unifiedHardwareRegistry.getAllProvenances()` → integration modes, evidence levels
- `exportCoordinator` → last export attempts, blocked reasons
- `deviceEventLog.getTimeline()` → recent events
- `operationalModeGuard.getCurrentMode()` → current operational mode

Output: a structured `JoiSystemContext` object serialized as a system message injected before every AI call.

### Phase 2 — Enhanced System Prompt (`supabase/functions/fxk-ai-chat/systemPrompt.ts`)

Rewrite the system prompt to define JOI as a **systems intelligence** operating in 6 modes:

1. **Architect** — module design, hierarchy, interfaces
2. **Analyst** — state analysis, gap analysis, inconsistency detection
3. **Verification** — interpret checks, explain blockers, suggest fixes
4. **Planner** — decompose objectives into phased plans
5. **Visual Blueprint** — generate Mermaid diagrams, module maps, pipeline flows
6. **Documentation** — matrices, checklists, reports, contracts

The prompt will include:
- All FX KONTROL domain types (ShowPlan, VerificationResult, ReadinessResult, HardwareStatusSnapshot, etc.)
- Provenance/truth rules (never call simulated "integrated")
- Safety restrictions (no firing logic, no ignition commands)
- Structured response format: Diagnosis → Solution → Risks → Artifacts → Next Steps
- New `[JOI_CMD]` commands for system inspection

### Phase 3 — New JOI Commands (`src/utils/joiCommandExecutor.ts`)

Add system-awareness commands:

| Command | Action |
|---------|--------|
| `inspect_showplan` | Return ShowPlan summary (metadata, cue counts, validation) |
| `run_verification` | Execute VerificationEngine, return results |
| `check_readiness` | Evaluate ReadinessEvaluator, return status + allowed ops |
| `inspect_hardware` | Return device registry state, health, provenances |
| `inspect_exports` | Return export readiness per channel |
| `get_system_state` | Full system state matrix (all subsystems) |
| `get_audit_log` | Recent events from DeviceEventLog |
| `generate_mermaid` | Generate architecture/pipeline diagram as Mermaid |

### Phase 4 — Mode Selector UI (`src/components/FXKAssistant.tsx`)

Add a mode selector bar in the JOI panel header with 6 mode chips:
- `ARCH` / `ANALYST` / `VERIFY` / `PLAN` / `BLUEPRINT` / `DOCS`

Each mode:
- Changes the context preset buttons shown
- Injects a mode-specific system instruction
- Adjusts JOI's visual accent color (architect=violet, analyst=cyan, verify=amber, plan=blue, blueprint=green, docs=gold)

Update the preset buttons per mode:
- **Architect**: "System Architecture", "Module Map", "Interface Design"
- **Analyst**: "System State", "Gap Analysis", "Compare Manual vs Code"
- **Verify**: "Run Verification", "Explain Blockers", "Check Readiness"
- **Planner**: "Phase Plan", "Priority Matrix", "Dependency Map"
- **Blueprint**: "Pipeline Diagram", "Hardware Topology", "Dashboard Layout"
- **Docs**: "Technical Report", "Checklist", "State Matrix", "Contract"

### Phase 5 — Rich Response Rendering

Enhance message rendering in `FXKAssistant.tsx`:
- Detect Mermaid code blocks and render them inline using a lightweight Mermaid renderer
- Render `[JOI_STATUS]` blocks as styled telemetry cards (readiness badge, health score, device count)
- Render `[JOI_MATRIX]` blocks as styled tables with color-coded status cells
- Render `[JOI_CHECKLIST]` blocks as interactive checklists

### Phase 6 — Context Presets Update (`src/components/JoiCommandPresets.tsx`)

Replace/augment current presets with system-aware presets organized by mode. Keep existing show-design presets but add:
- "Analyze System State" → runs `inspect_showplan` + `check_readiness`
- "Generate Architecture Diagram" → `generate_mermaid`
- "Run Full Verification" → `run_verification`
- "Export Readiness Report" → `inspect_exports`
- "Hardware Health Check" → `inspect_hardware`
- "Audit Trail Summary" → `get_audit_log`

---

## Files to Create (2)

1. `src/core/joi/JoiContextBuilder.ts` — System context assembler
2. `src/core/joi/joiModes.ts` — Mode definitions, presets per mode, mode-specific prompts

## Files to Update (4)

1. `supabase/functions/fxk-ai-chat/systemPrompt.ts` — Complete rewrite as systems intelligence
2. `src/utils/joiCommandExecutor.ts` — Add 8 new system inspection commands
3. `src/components/FXKAssistant.tsx` — Mode selector, rich rendering, context injection
4. `src/components/JoiCommandPresets.tsx` — Mode-organized system presets

## What This Delivers

- JOI becomes context-aware of the entire FX KONTROL pipeline
- She can inspect, diagnose, and explain any subsystem state
- She generates Mermaid diagrams, matrices, and reports on demand
- She distinguishes simulated vs live vs replay with architectural honesty
- She never suggests firing/ignition commands
- The 6 modes organize her capabilities into clear operational contexts
- All existing show-design functionality (choreography, effects, positions) is preserved

