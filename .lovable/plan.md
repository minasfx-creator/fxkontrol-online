

# Plan: Capacitor Haptic Feedback Integration

## What
Replace all 155+ `navigator.vibrate()` calls across 12 files with a unified haptic feedback service that uses **Capacitor Haptics plugin** on native iOS/Android and falls back to `navigator.vibrate()` on web.

## Changes

### 1. Install dependencies
- `@capacitor/core`, `@capacitor/cli` (dev), `@capacitor/haptics`
- Initialize Capacitor with `npx cap init` (appId: `app.lovable.98b5e02e4ef047eeafa0148a304fb6c2`, appName: `fxkontrol`)
- Configure server URL for hot-reload: `https://98b5e02e-4ef0-47ee-afa0-148a304fb6c2.lovableproject.com?forceHideBadge=true`

### 2. Create `src/lib/haptics.ts` — Unified Haptic Service
Abstraction layer with typed presets mapped to show control actions:

| Method | Native (Capacitor) | Web Fallback | Use Case |
|--------|-------------------|--------------|----------|
| `tap()` | `ImpactStyle.Light` | `vibrate(10)` | UI button press |
| `fire()` | `ImpactStyle.Heavy` | `vibrate(30)` | Cue fire |
| `arm()` | `NotificationType.Warning` + pattern | `vibrate([50,30,50])` | System arm |
| `panic()` | `NotificationType.Error` + long pattern | `vibrate([100,50,100,50,200])` | Emergency stop |
| `unlock()` | `ImpactStyle.Medium` × 2 | `vibrate([50,20,50])` | Safety unlock |
| `success()` | `NotificationType.Success` | `vibrate(50)` | Connection success |
| `select()` | `SelectionChanged` | `vibrate(15)` | Selection change |

Auto-detects Capacitor native platform via `Capacitor.isNativePlatform()`. On web, gracefully falls back.

### 3. Update 12 files — Replace `navigator.vibrate` with haptics service
All files with existing vibration calls get updated to import and use the new service:

- `MobileHUD.tsx` — `haptics.panic()` on panic button
- `MobileTabBar.tsx` — `haptics.tap()` on long-press
- `MobileQuickActions.tsx` — (no vibrate currently, but add `haptics.tap()`)
- `MobileMoreMenu.tsx` — `haptics.select()` on panel select
- `MobileLinkPanel.tsx` — `haptics.tap()` on add/remove, `haptics.fire()` on fire
- `MobileLinkMode.tsx` — `haptics.fire()` on fire, `haptics.arm()` on arm, `haptics.panic()` on panic
- `VirtualFXButton.tsx` — `haptics.unlock()` on slide unlock, `haptics.fire()` on fire
- `VirtualZK6200.tsx` — `haptics.arm()` on arm, `haptics.fire()` on fire, `haptics.panic()` on estop
- `USBConnectionPanel.tsx` — `haptics.success()` on connect
- `NewsTicker.tsx` — `haptics.select()` on filter change
- `ShowCommanderPanel.tsx` — `haptics.fire()` on GO, `haptics.panic()` on panic
- `MobileFloatingPanel.tsx` — `haptics.tap()` on snap points

### 4. Create `capacitor.config.ts`
Standard Capacitor config with hot-reload server URL pointing to the Lovable preview.

## Architecture
```text
src/lib/haptics.ts
├── Capacitor.isNativePlatform()?
│   ├── YES → @capacitor/haptics (iOS Taptic / Android VibrationEffect)
│   └── NO  → navigator.vibrate() fallback
│
├── haptics.fire()    → ImpactStyle.Heavy
├── haptics.panic()   → NotificationType.Error + pattern
├── haptics.arm()     → NotificationType.Warning + pattern
├── haptics.tap()     → ImpactStyle.Light
├── haptics.select()  → SelectionChanged
└── haptics.unlock()  → ImpactStyle.Medium × 2
```

## Post-Implementation
User will need to:
1. Export to GitHub, clone locally
2. `npm install` → `npx cap add ios` / `npx cap add android`
3. `npm run build` → `npx cap sync` → `npx cap run ios/android`

