## Problem

`QuickJumpMenu` is fixed at `top-2 left-2 z-[60]`, sitting on top of the editor Toolbar's left side at `/studio` (file menu, transport, status pills). Same spot also collides with the mobile sidebar hamburger.

## Fix (single file: `src/components/QuickJumpMenu.tsx`)

1. **Reposition to top-right**: change container from `fixed top-2 left-2` → `fixed top-2 right-2`. The `/studio` Toolbar's right side is empty (it ends with the JOI / status cluster but leaves room), and on other routes the header right-side has space too.
2. **Flip dropdown anchor**: change `absolute top-full left-0` → `absolute top-full right-0` so the menu opens leftward and stays on-screen.
3. **Keep z-[60]** so it stays above Toolbar's z-50 menus, but no longer overlaps anything since it's now on the opposite side.
4. **No changes to `MainLayout.tsx`, `Toolbar.tsx`, or other files.**

## Why top-right (vs. just shifting left padding)

- The Tactical Dock + file menu + transport already crowd the **left** of the Toolbar — even a small offset would still collide on mobile (440px viewport).
- Top-right is consistently empty across `/studio`, `/index`, `/ai-choreography`.
- Avoids the mobile hamburger (top-left) entirely.

## Out of scope

No changes to active-state detection for `?panel=drones` or removing the redundant Studio NavLink in `MainLayout` — those were separate cosmetic items from the prior bug review and the user only asked about the overlay collision.
