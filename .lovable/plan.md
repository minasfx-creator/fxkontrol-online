

# Plan: Fix Mobile Command Deep-Link + Staggered Animations + UI/UX Polish

## Bug Found: Mobile Command Doesn't Work

**Root cause**: When navigating from Dashboard via `?panel=remotecontrol`, the deep-link `useEffect` in `Index.tsx` sets `activePanel('remotecontrol')` and `appPhase('editor')`, but on mobile `mobileTab` stays `null` and `mobilePanelHeight` stays `'collapsed'`. The mobile panel rendering condition (line 447) requires `mobilePanelHeight !== 'collapsed'` — so the panel never appears.

**Fix**: In the deep-link `useEffect`, detect mobile and also set `mobileTab` + `mobilePanelHeight('full')`.

## Changes

### 1. `src/pages/Index.tsx` — Fix mobile deep-link

Update the deep-link `useEffect` (line 189-198) to also set mobile state:
```tsx
useEffect(() => {
  const panelParam = searchParams.get('panel');
  if (panelParam) {
    setActivePanel(panelParam as PanelId);
    setSearchParams({}, { replace: true });
    setAppPhase('editor');
    // On mobile, also open the floating panel
    if (isMobile) {
      setMobileTab(null); // null + activePanel triggers the fallback panel
      setMobilePanelHeight('full');
    }
  }
}, [searchParams, setSearchParams, isMobile]);
```

### 2. `src/pages/Dashboard.tsx` — Staggered entry animations on hub cards + tools

**HubCard component**: Accept a `delay` prop and apply `style={{ animationDelay: delay, opacity: 0 }}` to the card. Each tool button inside also gets staggered delay (index * 50ms).

**Dashboard layout**: Pass stagger delays:
- Show Commander hub: `delay="0.1s"`
- Mobile Command: `delay="0.2s"`
- System Status: `delay="0.3s"`
- Events: `delay="0.35s"`
- Feed column: `delay="0.15s"` (already has 0.1s)
- Master Editor hub: `delay="0.2s"`
- Stats grid: `delay="0.3s"`
- Projects: `delay="0.35s"`
- Editor CTA: `delay="0.4s"`

**Tool buttons inside HubCard**: Each button gets `style={{ animationDelay: \`${0.05 * index + baseDelay}s\`, opacity: 0 }}` with `animate-fxk-fade-up` class for cascading reveal.

### 3. `src/index.css` — Add stagger-compatible animation variant

Add a new utility that starts with `opacity: 0` so staggered elements don't flash:
```css
.animate-fxk-stagger { 
  opacity: 0; 
  animation: fxk-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
}
```

### 4. `src/pages/Dashboard.tsx` — UI/UX Polish

- **Hub card headers**: Add a subtle animated gradient shimmer on hover (using existing `fxk-shimmer` keyframe)
- **Tool buttons**: Add `group-hover:scale-105` on icons for micro-interaction feedback
- **Mobile Command card**: Add a pulsing dot indicator (like "ready to connect")
- **Stats cards**: Add stagger delays per card (index * 80ms)
- **Feed column**: Stagger each FeedCard by index * 100ms

## Files Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Fix deep-link to set mobile panel state |
| `src/pages/Dashboard.tsx` | Staggered animations on all cards/tools, UI micro-interactions |
| `src/index.css` | Add `animate-fxk-stagger` utility class |

