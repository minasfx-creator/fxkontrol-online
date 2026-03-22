

# FXK Branding Strategy + UI/UX Refinement

## Branding Strategy — FXK Product Family

The system currently has inconsistent naming: "FXcommander™", "SHOWVEN®", "FireOne XL4+", "grandMA3", "Show Commander" — mixing third-party hardware brands with the platform's own identity. This creates confusion about what is FX KONTROL's product vs external hardware.

### Brand Architecture

```text
┌─────────────────────────────────────────────────┐
│              FX KONTROL (Platform)              │
│              by MinasFX                         │
├─────────────┬───────────┬──────────┬────────────┤
│  FXK-PYRO   │  FXK-DMX  │FXK-LIGHT │FXK-DRONES │
│  Fire Control│  SFX/DMX  │ Lighting │  Aerial   │
│  (red)      │  (blue)   │ (indigo) │  (cyan)   │
├─────────────┴───────────┴──────────┴────────────┤
│           FXK-LINK  (Mobile Remote)             │
│           FXK-NET   (Network/ArtNet)            │
└─────────────────────────────────────────────────┘
```

**Naming Map:**
| Old Name | New Name | Context |
|---|---|---|
| FXcommander™ | **FXK-PYRO** | Status bar header, toasts |
| SHOWVEN® · V2.0 | **FX KONTROL · V2.0** | Status bar subtitle |
| Show Commander (Dashboard hub) | **FXK-PYRO Hub** | Dashboard card |
| Super DMX | **FXK-DMX** | CommandCenter, sidebar, mode labels |
| Simple DMX | **FXK-DMX Lite** | CommandCenter, sidebar |
| Pyro XL4 | **FXK-PYRO** | All console labels |
| grandMA3 / MA3 | **FXK-LIGHT** | CommandCenter, MA3ControlPanel |
| Drones (category) | **FXK-DRONES** | Dashboard news filters |
| Mobile Link | **FXK-LINK** | CommandCenter, MobileLinkMode |
| FireOne XL4+ (controller name) | **FXK-PYRO** | Dashboard HW grid, VirtualControllerHub |
| IFMx-i32Q Module | **FXK-PYRO Module** | VirtualControllerHub |
| FireOne Systems (group) | **FXK Fire Systems** | VirtualControllerHub group label |

**Rules:**
- UI labels change (what user sees)
- Internal variable names stay (camelCase `fireone`, `ma3`, `pbus`)
- Protocol/hardware hooks keep original names (they represent real hardware APIs)
- Storage keys update with migration fallback

### Brand Colors (per product line)
- **FXK-PYRO**: `hsl(0 80% 55%)` — red, danger, fire
- **FXK-DMX**: `hsl(210 90% 55%)` — blue, control, precision
- **FXK-DMX Lite**: `hsl(150 70% 45%)` — green, simple, clean
- **FXK-LIGHT**: `hsl(250 60% 60%)` — indigo/violet, theatrical
- **FXK-DRONES**: `hsl(185 70% 50%)` — cyan, aerial, tech
- **FXK-LINK**: `hsl(250 50% 55%)` — purple, connectivity
- **FXK-NET**: `hsl(280 60% 50%)` — violet, network

## UI/UX Refinements

### 1. CommandCenter — Branding Pass
- Update all `CONSOLE_ACCENTS` labels to FXK names
- Update `MODE_SECTIONS` sidebar labels
- Comment header: `XL4 2.0` → `FXK 2.0`

### 2. LiveFiringPanel — Status Bar Rebrand
- Line 824: `'FXcommander™'` → `'FXK-PYRO'`
- Line 826: `'SHOWVEN® · V2.0'` → `'FX KONTROL · V2.0'`
- Mode labels in `MODE_CATEGORIES`: `'Pyro XL4'` → `'FXK-PYRO'`, `'MA3'` → `'FXK-LIGHT'`

### 3. Dashboard — Hub Cards + Hardware Grid
- `SHOW_COMMANDER_TOOLS`: `'Pyro XL4'` → `'FXK-PYRO'`
- HubCard title: `'Show Commander'` → `'FXK-PYRO Hub'`
- Hardware grid: `'FireOne XL4+'` → `'FXK-PYRO'`, `'IFM x32Q'` → `'FXK Module'`
- News categories: `'Drones'` → `'FXK-DRONES'`

### 4. VirtualControllerHub — Rebrand Controllers
- `'FireOne XL4+'` → `'FXK-PYRO'`
- `'IFMx-i32Q Module'` → `'FXK-PYRO Module'`
- Group `'FireOne Systems'` → `'FXK Fire Systems'`
- Manufacturer `'FireOne'` → `'FXK'`

### 5. MA3ControlPanel — Rebrand to FXK-LIGHT
- All UI labels `'MA3'` / `'grandMA3'` → `'FXK-LIGHT'`
- Keep internal OSC variable names

### 6. ShowvenEquipmentPanel — Toast Message
- `'FXcommander DMX'` → `'FXK-DMX'`

### 7. AppSidebar — Already good
- `'FX KONTROL'` stays, `'by MinasFX'` stays — no changes needed

## Files Affected

1. **Edit**: `src/pages/CommandCenter.tsx` — rebrand all labels in CONSOLE_ACCENTS and MODE_SECTIONS
2. **Edit**: `src/components/editor/LiveFiringPanel.tsx` — status bar branding + MODE_CATEGORIES labels
3. **Edit**: `src/pages/Dashboard.tsx` — hub card titles, hardware grid names, news categories
4. **Edit**: `src/components/editor/VirtualControllerHub.tsx` — controller names and group labels
5. **Edit**: `src/components/editor/MA3ControlPanel.tsx` — UI labels to FXK-LIGHT
6. **Edit**: `src/components/editor/ShowvenEquipmentPanel.tsx` — toast message

