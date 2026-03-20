

# Plan: Gap Fix + New Features + UI/UX Refinement

## Confirmed Gaps

### Critical Integration Gaps
1. **PanelTabBar missing MA3 panel** — No `'ma3'` entry in `PANEL_SECTIONS`. Users cannot access MA3 from the right sidebar — only from within LiveFiringPanel mode tabs.
2. **PanelTabBar missing sACN Monitor** — `SACNMonitorPanel` exists but has no panel entry for standalone access.
3. **Toolbar has no hardware status indicators** — Status area (line 639-654) only shows cue count, position count, and a static "SYNC" dot. No FireOne/PBUS/Radio/MA3 connection status.
4. **Auth page is bare** — No cinematic branding, no glassmorphism, no animated background. Just a white form on a dark background.
5. **Dashboard has no system status** — No hardware/bridge connection indicators. No "resume last session" quick action.
6. **Agenda has no production pipeline** — No status pipeline strip, no "days until" countdown, no "Open in Editor" link.
7. **Timeline has no LIVE/ARMED indicator** — Transport bar shows play/pause but no visual state for armed systems during live execution.
8. **PanelTabBar has no search/filter** — 70+ panels with no quick-find capability.

### Missing Features
9. **No "radio" panel in PANEL_SECTIONS Conexões section** — `radio` exists in Hardware section but not in Conexões where users expect connection-type panels.
10. **No delete event** in Agenda — Can duplicate but can't delete events.
11. **No event time field display** — `event_time` exists in the DB/type but is never shown on event cards.

## Changes

### 1. Edit `src/components/editor/PanelTabBar.tsx` — Add MA3 + sACN + Search
- Add `'ma3'` and `'sacnmonitor'` to `PanelId` type
- Add MA3 entry to Conexões section: `{ id: 'ma3', label: 'grandMA3', icon: Sliders }`
- Add sACN Monitor to Conexões: `{ id: 'sacnmonitor', label: 'sACN Monitor', icon: Activity }`
- Add search input at top of sidebar: small magnifying glass icon, filters panels in real-time
- Add favorites system: click star to pin panels (stored in localStorage), pinned section at top

### 2. Edit `src/components/editor/Toolbar.tsx` — Hardware Status Dots + ARMED Badge
- After the SYNC indicator (line 646-649), add hardware connection dots: FireOne (green/red), PBUS (green/red), Radio (green/red)
- Import `useFireOneHardware`, `usePBusHardware`, `useRadioLink`
- Each dot is clickable → calls `onOpenPanel?.('livefiring')` etc.
- When any system is armed, show pulsing red "ARMED" badge next to timecode

### 3. Edit `src/pages/Auth.tsx` — Cinematic Branded Login
- Add animated CSS gradient background with radial glow effects
- Wrap form in glassmorphism card with border glow
- Add "Professional Show Control Platform" tagline
- Add subtle grid pattern overlay

### 4. Edit `src/pages/Dashboard.tsx` — System Status + Quick Actions
- Add "System Status" row showing bridge connections (OSC/sACN/MVR) and hardware (FireOne/PBUS/Radio) with green/red dots
- Add "Resume Last Session" button (stores last project ID in localStorage)
- Add "Quick Launch" cards: "New Pyro Show", "New Drone Show", "New Mixed Show"
- Add "Days until next event" countdown in the events card

### 5. Edit `src/pages/Agenda.tsx` — Pipeline Strip + Delete + Editor Link
- Add horizontal pipeline strip at top showing event counts per status (Negotiation → Invoiced)
- Add "Open in Editor" button on each event card
- Add delete button with confirmation
- Add "Days until" countdown badge on upcoming events
- Show `event_time` when available

### 6. Edit `src/components/editor/Timeline.tsx` — LIVE Mode Indicator
- When armed (read from a shared state or prop), show pulsing red "● LIVE" badge in transport bar
- Increase play/stop button size to 48px touch targets when in armed/live mode
- Add show elapsed time display during live execution

### 7. Edit `src/index.css` — New Utility Classes
- Add `.status-dot-online` / `.status-dot-offline` with glow
- Add `.armed-pulse` animation (red pulsing glow)
- Add `.badge-live` for live operation badges
- Add `.glass-card-glow` for Auth page glassmorphism

### 8. Edit `src/layouts/MainLayout.tsx` — Global Status Footer
- Add 24px status bar at bottom (not on /editor route) showing: connected hardware count, next event countdown, and "PRE-FLIGHT" quick button

## Files Summary

| File | Key Change |
|------|------------|
| `PanelTabBar.tsx` | MA3 + sACN entries, search filter, favorites |
| `Toolbar.tsx` | Hardware status dots + ARMED badge |
| `Auth.tsx` | Cinematic glassmorphism login |
| `Dashboard.tsx` | System status + resume + quick launch |
| `Agenda.tsx` | Pipeline strip + delete + countdown |
| `Timeline.tsx` | LIVE badge + larger transport in armed mode |
| `index.css` | Status/live utility classes |
| `MainLayout.tsx` | Global status footer bar |

