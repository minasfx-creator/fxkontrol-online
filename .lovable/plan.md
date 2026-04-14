

# Audit Report: Editor Component Consolidation

## Executive Finding

**207 of 229 top-level editor components (90%) are dead code** — never imported anywhere in the codebase. This represents **65,296 lines** of unused TypeScript/React code inflating the bundle and maintenance burden.

Only **22 top-level components** are actually imported and used. The subdirectory components (effects, dmx, live-firing, skycanvas, safety) are largely alive and well-connected.

## Dead Code by Scale (Top 20 largest unused files)

```text
FILE                          LINES   STATUS
SkyCanvas.tsx                 2,012   DEAD
LiveFiringPanel.tsx           1,486   DEAD
ScriptWindow.tsx              1,408   DEAD
Timeline.tsx                  1,274   DEAD
VideoChoreoPanel.tsx          1,255   DEAD
SwarmGPTPanel.tsx             1,177   DEAD
PyroLaunchAngle.tsx           1,063   DEAD
ShowCommanderPanel.tsx        1,011   DEAD
NiagaraVFXController.tsx        911   DEAD
MA3ControlPanel.tsx             881   DEAD
PositionPins.tsx                860   DEAD
AssetMarketplaceBrowser.tsx     819   DEAD
RemoteControlPanel.tsx          803   DEAD
ShowSettingsPanel.tsx           740   DEAD
EffectLibrary.tsx               728   DEAD
SceneEditorPanel.tsx            698   DEAD
CSVImporter.tsx                 683   DEAD
GoogleMapsPanel.tsx             682   DEAD
FleetManagementPanel.tsx        642   DEAD
QuickHardwarePanel.tsx          612   DEAD
```

## Duplicate/Overlapping Groups Identified

| Group | Components | Recommendation |
|---|---|---|
| **Battery** | BatteryPanel + BatteryPowerMonitor | Both dead — delete |
| **Addressing** | AddressingConsole + AddressingPanel | Both dead — delete |
| **DMX/ArtNet monitors** | ArtNetDMXMonitor + DMXArtNetConsole | Both dead (dmx/ subfolder versions are alive) |
| **Safety** | SafetyConsole + SafetyPanel + SafetySummaryBar | All dead (safety/ subfolder tabs are alive) |
| **Show Inspector** | ShowInspectorPanel + ShowPlanInspector | Both dead — merge if revived |
| **Performance** | PerformanceHUD + DiagnosticPanel + RenderDebugOverlay | All dead (PerformanceMonitor is the only used one) |
| **Export** | ExportModal + FiringExportPanel + FireOneExportConsole + ExportReadinessPanel | All dead — consolidate to 1 if revived |
| **MobileLink** | MobileLinkMonitor + MobileLinkPanel | Both dead (live-firing/MobileLinkMode is alive) |
| **Importers** (8 files) | CSV, GMA2, MVR, UE5×2, UAsset, Twinmotion, VVIZ | All dead — consolidate into unified ImporterHub if revived |

## Subdirectory Dead Code (minor)

- `effects/DemoFireworks.tsx` (97L) — dead
- `live-firing/PBusMonitorPanel.tsx` (350L), `ProceduralWidgets.tsx` (290L), `WiFiDirectControlPanel.tsx` (394L) — dead
- `skycanvas/ARDistanceMarkers.tsx` (71L) — dead

## Proposed Action Plan

### Phase 1: Delete Dead Code (immediate, ~65K lines removed)

Delete all 207 unused top-level components and 5 unused subdirectory components. This is safe because grep confirms zero imports across the entire codebase.

**Impact**: ~65,300 lines removed, dramatically reducing bundle size, IDE load, and cognitive overhead.

### Phase 2: Clean Barrel Exports

Update any `index.ts` barrel files that re-export deleted components (e.g., `effects/index.ts` for DemoFireworks).

### Phase 3: Consolidate Remaining Alive Components

The 22 surviving top-level components plus the subdirectory components are well-structured. Minor opportunities:
- `ConsoleBootSequence` + `ConsoleLogos` could merge into a single boot module
- `PanelTabBar` + `FullscreenablePanel` are generic utilities — move to `src/components/ui/`

## Technical Details

- **Total editor `.tsx` files**: 321
- **Dead (top-level)**: 207 files, 65,296 lines
- **Dead (subdirectories)**: 5 files, ~1,202 lines
- **Alive (top-level)**: 22 files, 4,896 lines
- **Alive (subdirectories)**: ~87 files (effects, dmx, live-firing, skycanvas, safety, etc.)
- **Deletion is safe**: verified via `grep -r` across entire `src/` — zero external references

