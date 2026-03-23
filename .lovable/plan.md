

## Plan: Refine Joi Holographic Assistant

### Issues Found

1. **Mobile overlap**: Bubble fixed at `bottom-5 right-5` overlaps the Free Fire mobile dock and Command Center HUD
2. **No mobile responsiveness**: Panel is fixed 360/560px width — clips off-screen on small phones
3. **Missing "Joi" identity**: Header says "FXK-AI · NEXUS" but lacks the holographic avatar personality the user wants (referencing BR2049 Joi)
4. **No mobile fullscreen mode**: On mobile, the chat panel should expand to near-fullscreen for usability

### Changes

#### File: `src/components/FXKAssistant.tsx`

**Mobile positioning fix:**
- Bubble: mobile → `bottom-20 right-3` (above dock), desktop → keep `bottom-5 right-5`
- Minimized bar: same mobile offset

**Mobile panel adaptation:**
- On mobile: panel becomes `fixed inset-3 bottom-20` (near-fullscreen, above dock)
- On desktop: keep current fixed bottom-right positioning
- Use `useIsMobile()` hook for detection

**Joi identity enhancement:**
- Rename header from "FXK-AI · NEXUS" to "JOI · NEXUS"
- Add subtitle "HOLOGRAPHIC COMPANION" 
- Replace Terminal icon in bubble with Sparkles icon (more Joi-like)
- Add a subtle amber holographic shimmer to the avatar circle when idle

**Polish:**
- Add `will-change: transform` to bubble for smoother hover animation
- Ensure panel z-index is above Command Center HUD elements (z-50 → z-[60])

#### File: `src/index.css`
- Add `.joi-bubble-shimmer` keyframe: subtle scale pulse (1.0 → 1.05) with glow intensity change, 3s infinite

### Build verification
- TypeScript check for 0 errors

