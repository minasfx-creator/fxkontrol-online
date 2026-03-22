

# FXK-AI Assistant — Blade Runner 2049 Holographic Identity

## Concept

Replace the mock Messenger with a functional AI assistant ("FXK-AI · NEXUS") powered by Lovable AI Gateway. Visual identity inspired by Blade Runner 2049: amber/orange holographic glow, rain-streaked translucency, monospace terminal aesthetics on dark backgrounds.

## Changes

### 1. NEW: `supabase/functions/fxk-ai-chat/index.ts` — AI Backend

- Edge function using Lovable AI Gateway (`google/gemini-3-flash-preview`)
- System prompt: FXK platform expert — pyrotechnics, DMX, drones, grandMA3, show design, safety protocols
- Streaming SSE responses for real-time token rendering
- Handles 429 (rate limit) and 402 (credits) errors with proper messages
- Uses pre-configured `LOVABLE_API_KEY`

### 2. NEW: `src/components/FXKAssistant.tsx` — Blade Runner 2049 Chat UI

Replaces `Messenger.tsx`. Three states: floating bubble, minimized bar, expanded panel.

**Visual Identity:**
- Amber/orange accent color (`hsl(32 100% 50%)`) — holographic warmth
- Translucent dark panel with `backdrop-blur-xl` and amber border glow
- All text in JetBrains Mono, uppercase headers with wide tracking
- Header: "FXK-AI · NEXUS" with pulsing amber status dot
- Holographic scanline overlay (CSS animation, 3% opacity horizontal sweep)
- Subtle vertical rain-streak lines in background
- Terminal-style input with `>_` prompt prefix and amber cursor
- User messages: amber-tinted bubbles; AI responses: left amber border + markdown rendering via `react-markdown`
- Quick action presets: "Diagnóstico", "Script Help", "Safety Check", "Show Status"
- Streaming token-by-token with amber typing indicator ("PROCESSANDO...")

### 3. `src/layouts/MainLayout.tsx` — Swap Component

- Replace `<Messenger />` import/usage with `<FXKAssistant />`

### 4. `src/index.css` — Holographic Animations

Add CSS keyframes:
- `holographic-scan`: horizontal line sweeping top-to-bottom (4s loop, amber, 3% opacity)
- `rain-streak`: vertical lines falling (8s loop, amber, 2% opacity)
- `amber-pulse`: breathing glow for status indicator
- `terminal-cursor`: blinking block cursor

## Files

1. `supabase/functions/fxk-ai-chat/index.ts` — **NEW** streaming AI edge function
2. `src/components/FXKAssistant.tsx` — **NEW** Blade Runner AI chat component
3. `src/layouts/MainLayout.tsx` — swap Messenger → FXKAssistant
4. `src/index.css` — holographic/rain CSS animations

## Technical Notes

- Uses `LOVABLE_API_KEY` (already configured in secrets)
- Streaming SSE with line-by-line parsing and token-by-token rendering
- `react-markdown` already available for AI response rendering
- No database tables — conversation is session-only
- All visual effects pure CSS (no new dependencies)
- Touch targets 48px+ maintained

