

## Add Geo-Location Button to Toolbar

### What
Add a "Geo" button in the Toolbar's **Location** dropdown menu that dispatches a custom event to reopen the `GeoLocationSetup` overlay. Index.tsx listens for this event and sets `showGeoSetup(true)`.

### Changes

**File 1: `src/components/editor/Toolbar.tsx`** (lines 542-549)
- Add a new item to the existing "Location" dropdown: `{ label: 'Geo-Location Setup', icon: Navigation, onClick: () => window.dispatchEvent(new Event('open-geo-setup')) }`
- Import `Navigation` from lucide-react

**File 2: `src/pages/Index.tsx`**
- Add a `useEffect` that listens for the `'open-geo-setup'` custom event and calls `setShowGeoSetup(true)`
- Cleanup listener on unmount

### Files Changed
- `src/components/editor/Toolbar.tsx` — add menu item + import
- `src/pages/Index.tsx` — add event listener

