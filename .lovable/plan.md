

# JOI Intelligence Consolidation — Full Show Control & Style Learning

## Findings from Testing

Mode switching works correctly across all visible modes:
- **SHOW** (gold accent, show design presets)
- **ARCH** (violet accent, architecture presets)
- **ANALYST** (cyan accent, ESTADO/GAP ANALYSIS/COMPARAR presets)
- **VERIFY** (amber accent, VERIFICAR/BLOCKERS/READINESS presets)
- **TRUTH** (green accent, PROVENANCE/INTEGRAÇÃO/STALE DATA/RISCO presets)
- **PLAN** (blue accent, FASES/PRIORIDADES/DEPENDÊNCIAS presets)

Context Ribbon, Insight Panel, and Truth Inspector all render. ESTADO preset successfully returns real system data with truth footer (source_of_truth, integration_mode, evidence_level, confidence). JOI executed commands autonomously (renamed project, added position).

## Issues Found

1. **BLUE and DOCS modes are hidden** — the mode bar has 8 modes but the panel is too narrow; they overflow off-screen
2. **Old PRESETS_DOCS clutter SHOW mode** — 10 legacy doc presets (ORÇAMENTO, LICENÇAS, etc.) still appear alongside the 8 new SHOW presets, making the preset area very long
3. **No style learning system** — JOI can create shows but cannot learn from past shows or remember user style preferences

## Plan

### Fix 1 — Mode Bar Overflow (joiModes.ts + FXKAssistant.tsx)

Make mode bar wrap or use two rows when 8 modes don't fit. Options:
- Use `flex-wrap` instead of single-row overflow
- Or reduce to 2-letter labels for compact fit (SH, AR, AN, VE, TR, PL, BL, DO)

I'll use flex-wrap with smaller text so all 8 modes are always visible.

### Fix 2 — Clean Up SHOW Mode Presets (FXKAssistant.tsx)

Move the legacy PRESETS_DOCS (ORÇAMENTO, LICENÇAS, etc.) into the DOCS mode presets in `joiModes.ts`. SHOW mode should only show show-design presets. This makes mode separation clean.

### Feature 3 — Show Style Learning System

Create a system where JOI can analyze completed shows, extract patterns, and use them as references for future designs.

**3a. Style Profile Storage** — New Supabase table `show_styles`:
- `id`, `user_id`, `name`, `description`  
- `style_data` (JSONB): extracted patterns (effect distribution, timing curves, position layouts, dramatic arc structure)
- `source_show_name`, `created_at`

**3b. Style Extraction Command** — New JOI command `learn_style`:
- Analyzes current ShowPlan
- Extracts: position layout pattern, effect density, timing distribution, dramatic arc shape, preferred effects, color palette
- Saves as a named style profile

**3c. Style Application Command** — New JOI command `apply_style`:
- References a saved style profile when creating new shows
- JOI receives style data in context and uses it to inform choreography decisions

**3d. Style Context Injection** — Update `JoiContextBuilder` to include saved styles in system context, so JOI can reference them when creating shows

**3e. New SHOW Mode Presets**:
- "APRENDER ESTILO" — extracts and saves style from current show
- "MEUS ESTILOS" — lists saved style profiles
- "APLICAR ESTILO" — creates a show using a saved style

---

## Files to Create (1)
- `src/core/joi/ShowStyleManager.ts` — Style extraction, storage, and retrieval

## Files to Update (4)
- `src/core/joi/joiModes.ts` — Move doc presets to DOCS mode, add style presets to SHOW mode
- `src/components/FXKAssistant.tsx` — Fix mode bar layout, remove inline PRESETS_DOCS, add style learning commands
- `src/utils/joiCommandExecutor.ts` — Add `learn_style`, `list_styles`, `apply_style` commands
- `src/core/joi/JoiContextBuilder.ts` — Inject saved styles into context
- `supabase/functions/fxk-ai-chat/systemPrompt.ts` — Add style learning instructions

## Database Migration
- Create `show_styles` table with RLS policies (user can only access own styles)

