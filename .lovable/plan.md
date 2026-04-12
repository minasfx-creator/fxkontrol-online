

# Ciclo #83 — Bundle Analysis & Optimization

## Findings

Since `rollup-plugin-visualizer` cannot be run in this environment, I performed a manual static analysis of all imports, `manualChunks` config, and `package.json`. Here are the results:

### 1. Dead dependency: `html2pdf.js` (~80KB gzipped)
- Listed in `package.json` but **zero imports** anywhere in `src/`. Pure dead weight — gets bundled into a default chunk by Vite even without explicit usage if any transitive dep pulls it.
- **Action**: Remove from `package.json`.

### 2. Missing from `manualChunks`: 5 libraries leak into the main bundle
| Library | Size (est.) | Used in | Should be |
|---------|------------|---------|-----------|
| `jszip` | ~90KB | 4 files (all export utilities) | `vendor-export` |
| `3d-tiles-renderer` | ~60KB | 1 file (GoogleTilesEngine) | own chunk `vendor-tiles` |
| `tus-js-client` | ~30KB | 1 file (VVIZImporter) | `vendor-misc` or own |
| `react-window` | ~6KB | 1 file (TelemetryDashboard) | `vendor-misc` |
| `postprocessing` | ~120KB | 2 files | own chunk `postprocessing-core` |

Currently these end up in unnamed shared chunks or worse, the main entry chunk.

### 3. `@capacitor/*` packages (~15KB) — only used in `haptics.ts`
Listed 3 Capacitor packages in `package.json`. Only `@capacitor/core` and `@capacitor/haptics` are imported (1 file). `@capacitor/android`, `@capacitor/ios`, `@capacitor/cli` are build/native tooling — harmless for web bundle but `@capacitor/core` + `@capacitor/haptics` should get their own chunk to avoid polluting vendor-misc.

### 4. `next-themes` — only used in `sonner.tsx`
Tiny (~2KB) but should be in `vendor-misc` to avoid unnamed chunk.

### 5. Dynamic import opportunity: `jszip`, `3d-tiles-renderer`, `tus-js-client`
All are used in single-purpose utility files that run on user action (export, import). Converting to `await import()` would defer them entirely from initial load (**~180KB saved**).

## Plan

### Step 1 — Remove dead dependency
Remove `html2pdf.js` from `package.json`.

### Step 2 — Expand `manualChunks` in `vite.config.ts`
Add missing libraries to chunk map:
```
'vendor-export': ['jspdf', 'docx', 'jszip'],
'vendor-tiles': ['3d-tiles-renderer'],
'vendor-misc': [...existing, 'tus-js-client', 'react-window', 'next-themes'],
'postprocessing-core': ['postprocessing'],
'vendor-capacitor': ['@capacitor/core', '@capacitor/haptics'],
```

### Step 3 — Dynamic imports for heavy export utilities
Convert static imports to dynamic `await import()` in:
- `joiAeroKmzExport.ts` → `const { default: JSZip } = await import('jszip')`
- `mvrParser.ts` → same pattern
- `kmzExporter.ts` → same pattern  
- `geoToolsKmlExporter.ts` → same pattern
- `VVIZImporter.tsx` → `const tus = await import('tus-js-client')`

### Step 4 — Build verification
Run `tsc --noEmit` + `vite build` to confirm no regressions.

## Estimated Impact
| Optimization | Savings |
|-------------|---------|
| Remove `html2pdf.js` | ~80KB |
| Dynamic `jszip` (4 files) | ~90KB deferred |
| Dynamic `tus-js-client` | ~30KB deferred |
| Proper chunking (avoid duplication) | ~50KB fewer unnamed chunks |
| **Total initial load reduction** | **~250KB** |

## Files

| Action | File |
|--------|------|
| Edit | `package.json` (remove html2pdf.js) |
| Edit | `vite.config.ts` (expand manualChunks) |
| Edit | `src/utils/joiAeroKmzExport.ts` |
| Edit | `src/lib/mvrParser.ts` |
| Edit | `src/lib/kmzExporter.ts` |
| Edit | `src/lib/geoToolsKmlExporter.ts` |
| Edit | `src/components/editor/VVIZImporter.tsx` |

