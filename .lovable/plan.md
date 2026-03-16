

## Root Cause

The `App.tsx` file wraps `App`, `ProtectedRoute`, and `AuthRoute` in `forwardRef`. These components pass refs down to `BrowserRouter`, `Routes`, and other React Router components that **do not accept refs**. This triggers React's `safelyDetachRef` → `setRef` → `dispatchSetState` loop on every render, causing the "Maximum update depth exceeded" crash and white screen.

The console logs confirm: *"Function components cannot be given refs. Check the render method of ForwardRef(App)."*

## Fix

**File: `src/App.tsx`** — Remove all `forwardRef` wrappers. These are plain components that never need forwarded refs:

- `ProtectedRoute`: change from `forwardRef<HTMLDivElement, ...>(function ProtectedRoute(...))` to a simple function component
- `AuthRoute`: same treatment
- `App`: same treatment — just `function App()` returning JSX

This is a 3-component change in a single file. No other files need modification.

