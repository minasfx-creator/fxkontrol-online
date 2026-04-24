
## Make JOI panel fluid across mobile widths

Adapt the panel so it scales cleanly from 320px phones up to desktop, never clips content, and keeps the close button comfortably tappable.

### Changes (all in `src/components/editor/SmartScriptAssistant.tsx`)

1. **Fluid width & position**
   - Replace fixed `w-[340px] max-w-[calc(100vw-1.5rem)]` + `right-3` anchor with a responsive rule:
     - Mobile (`< sm`): full-width sheet — `left-2 right-2`, no fixed width, anchored above the bottom dock (`bottom-[calc(64px+env(safe-area-inset-bottom))]`).
     - Desktop (`sm+`): `sm:left-auto sm:right-3 sm:w-[360px] sm:bottom-20`.
   - Add `safe-area-inset` padding so the close button is never under a notch / home indicator.

2. **Fluid height — no clipping**
   - Drop the hard `max-h-[460px]` and the inner messages `min-h-[180px] max-h-[280px]` cap.
   - Use `max-h-[min(70dvh,560px)]` on the shell, and let the messages area become `flex-1` with `overflow-y-auto`. Header and input stay pinned (`shrink-0`) so the form never gets pushed off-screen on short viewports (e.g. landscape phones).

3. **Thumb-friendly close**
   - Keep the 44×44 hit area but ensure it sits inside safe area on mobile by adding `pr-[max(0.5rem,env(safe-area-inset-right))]` to the header row.
   - Slightly enlarge the visible icon target on mobile only (`w-5 h-5 sm:w-4 sm:h-4`) for easier tapping without changing desktop look.
   - Move the mobile drag-grabber out of the header's flex row (currently `absolute top-1` overlapping the title) into its own `shrink-0` strip above the title row, so it never overlaps the close button or title text on narrow widths.

4. **Header layout hardening**
   - Use `flex-wrap`-safe layout: title block gets `min-w-0 flex-1`, close button `shrink-0`. Already mostly there — verify after grabber repositioning.
   - Ensure `truncate` still works inside the new flex structure.

5. **Input row on tiny screens**
   - Allow input to shrink: `min-w-0` on the `<input>`; keep send button `shrink-0`. Prevents overflow on 320px viewports.

### Out of scope
- Logic, AI calls, swipe-to-close, ESC handling, examples list — all unchanged.
- No styling tokens or new dependencies.

### Validation
- Verify at 320, 360, 375, 390, 414, 768, 1280 viewports: no horizontal scroll, close button fully visible and tappable, messages list scrolls internally, input always reachable.
- `tsc --noEmit` clean.
- Existing JOI smoke flow (open → prompt → swipe close → ESC) unchanged.
