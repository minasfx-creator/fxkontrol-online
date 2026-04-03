

## Plano: Resolução de Sobreposições Desktop — Mapa Completo de Overlays

### Conflitos Identificados

Após auditoria de todos os overlays absolutos no SkyCanvas e componentes filhos:

```text
┌─────────────────────────────────────────────────────────┐
│  TOP LEFT                    TOP CENTER        TOP RIGHT│
│  ┌─────────────┐             TelemetryBar      ┌──────┐│
│  │ViewportCfg  │ z-30        z-30              │Mini- ││
│  │AICoPilot    │ z-40 ⚠️                       │Dock  ││
│  └─────────────┘                               │z-20  ││
│                                                └──────┘│
│  top-14 left-3              top-14 center    right-14  │
│  CameraBookmarks            AlignmentTools   JoiStatus │
│  (no z)                     z-50             z-30      │
│                             SiteModelToolbar ViewGeoTls│
│                             z-40 ⚠️          z-30 ⚠️   │
│                                                        │
│  LEFT CENTER                                           │
│  TacticalDock z-30                                     │
│                                                        │
│  BOTTOM                                                │
│  bottom-28 center: Fly/Ground HUD z-40                 │
│  bottom-24 center: GoogleTilesLoading z-40             │
│  bottom-20 left-3: StressTest z-40                     │
│  bottom-14 left-3: SelectionStatusBar (no z)           │
│  bottom-3 left-3: ViewportTerminal z-10                │
│  bottom-3 right-3: Debug info                          │
└─────────────────────────────────────────────────────────┘
```

### 5 Conflitos a Resolver

| # | Conflito | Severidade |
|---|---|---|
| 1 | **AICoPilotOverlay** (`top-3 left-3 z-40`) sobrepõe **ViewportConfigMenu** (`top-3 left-3 z-30`) | 🔴 Crítico |
| 2 | **ViewportGeoTools** (`top-3 right-14 z-30`) sobrepõe **JoiStatusMonitor** (`top-3 right-14 z-30`) | 🔴 Crítico |
| 3 | **AlignmentTools** (`top-14 center z-50`) e **SiteModelTransformToolbar** (`top-14 center z-40`) podem aparecer juntos | 🟡 Médio |
| 4 | **PerformanceHUD** button (`top-3 right-3`) conflita com **Mini-Dock** (`top-3 right-3`) quando debug está ativo | 🟡 Médio |
| 5 | **SelectionStatusBar** (`bottom-14 left-3`) pode sobrepor a parte inferior do **TacticalDock** (left-3, centrado verticalmente) | 🟢 Menor |

---

### Implementação

**1. Mover AICoPilotOverlay para não conflitar com ViewportConfigMenu**

Em `AICoPilotOverlay.tsx`, mover de `top-3 left-3` para `top-12 left-3` (abaixo do ViewportConfigMenu). Mantém z-40.

**2. Mover ViewportGeoTools para não conflitar com JoiStatusMonitor**

Em `ViewportGeoTools.tsx`, mover de `top-3 right-14` para `top-12 right-3` (abaixo do Mini-Dock). Ajustar layout para não colidir com o Mini-Dock vertical.

**3. Evitar sobreposição AlignmentTools vs SiteModelTransformToolbar**

Ambos são condicionais (AlignmentTools aparece quando há seleção múltipla, SiteModelToolbar quando há site model selecionado). Adicionar guard: se `selectedSiteModelId` estiver ativo, esconder AlignmentTools (ambas não devem estar ativas simultaneamente). Se por algum motivo ambas estiverem, mover AlignmentTools para `top-24` quando SiteModelToolbar estiver visível.

**4. Mover PerformanceHUD dentro do Mini-Dock**

O botão de PerformanceHUD (`top-3 right-3`) conflita com o Mini-Dock que já tem o `RenderDebugToggle`. Como o Mini-Dock já contém o toggle de debug, o PerformanceHUD expandido deve renderizar abaixo do Mini-Dock em vez de `top-10 right-3` → usar `top-3` com offset calculado baseado na altura do Mini-Dock. Alternativa mais simples: mover o panel expandido do PerformanceHUD para `top-3 right-16` (à esquerda do Mini-Dock).

**5. Ajustar SelectionStatusBar para evitar TacticalDock**

Mover SelectionStatusBar de `bottom-14 left-3` para `bottom-14 left-16` (à direita do TacticalDock que tem ~44px de largura).

---

### Ficheiros a modificar: 5

1. **`src/components/editor/AICoPilotOverlay.tsx`** — `top-3 left-3` → `top-12 left-3`
2. **`src/components/editor/ViewportGeoTools.tsx`** — `top-3 right-14` → `top-12 right-3`
3. **`src/components/editor/AlignmentTools.tsx`** — adicionar guard contra SiteModelTransformToolbar
4. **`src/components/editor/PerformanceHUD.tsx`** — mover panel expandido para `right-16` (à esquerda do Mini-Dock)
5. **`src/components/editor/SelectionStatusBar.tsx`** — `left-3` → `left-16` para evitar TacticalDock

### Proteções
- Nenhuma alteração funcional — apenas posicionamento CSS
- Stores Zustand, APIs, renderers intactos
- Mobile guards existentes mantidos

