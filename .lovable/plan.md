

# Plan: Mission-Critical UX Refinement

## Current State

The platform has solid foundations: haptic feedback system, MobileHUD with transport controls, MobileQuickActions with touch targets, ShowCommanderPanel with ARM/SAFE logic, field-view high-contrast mode, and PANIC FAB. However, several gaps remain for real-world field operation.

## Gaps Identified

1. **No DESIGN/LIVE mode separation** — editor and live controls are mixed, no clear mode switch
2. **Transport buttons too small on mobile** — 48px Play/Stop, should be 56-64px for stressed operators
3. **No hold-to-confirm on critical actions** — START SHOW and E-STOP fire on single tap (accidental trigger risk)
4. **No inline quick-adjust sliders** — editing requires opening panels, not contextual