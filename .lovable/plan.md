

## Plano: Implementação das Lacunas do Relatório SkyCanvas Nexus

### Diagnóstico Completo (Relatório vs. Codebase)

O relatório completo (10 secções, obtido via link Gemini) especifica componentes concretos. Mapeamento:

| Especificação do Relatório | Estado Atual | Ação |
|---|---|---|
| Vantablack #050505 base | **Implementado** — `--surface-0: 220 22% 3%` | Nenhuma |
| Dark Glassmorphism (4 camadas) | **Implementado** — 8 variantes glass-* | Nenhuma |
| Tipografia mono/sans split | **Implementado** — JetBrains Mono + Rajdhani | Nenhuma |
| Scanlines animadas | **Implementado** — `.tactical-scanline`, `.dock-scanline` | Nenhuma |
| Tactical grid isométrico | **Implementado** — `.tactical-grid` | Nenhuma |
| **Beveled corners via `clip-path: polygon()`** | **NÃO EXISTE** | **Criar** |
| **`react-window` virtualização de telemetria 2000 drones** | **NÃO EXISTE** — TelemetryDashboard limita a 200 drones, sem windowing | **Criar** |
| **SVG HUD crosshairs (miras AR)** | **NÃO EXISTE** no editor | **Criar** |
| **SMPTE Drop-Frame 29.97** | Parcial — SMPTEPanel existe, sem lógica DF real | **Melhorar** |
| **Sparklines SVG** no painel SwarmGPT | **NÃO EXISTE** | **Criar** |
| Cores neon-amber/cyan/crimson | **Equivalentes existem** — `--primary`, `--fxk-cyan`, `--destructive` | Adicionar aliases |

### Implementação — 5 Módulos Cirúrgicos

---

**1. CSS Utilities: Beveled Corners + Neon Aliases** (`src/index.css`)

Adicionar ao `@layer utilities`:
- `.bevel-sm` — `clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)`
- `.bevel-md` — mesma lógica com 12px
- `.bevel-lg` — mesma lógica com 15px
- `.glow-neon-amber` / `.glow-neon-cyan` / `.glow-neon-crimson` — box-shadow neon matching report specs
- `.bg-scanline-anim` — animated repeating gradient (scan-move keyframe)

---

**2. Telemetria Virtualizada com react-window** (`src/components/editor/TelemetryDashboard.tsx`)

- Instalar `react-window` (já existe no package.json? Se não, adicionar)
- Substituir o loop limitado a 200 drones por `FixedSizeList` de até 2000 drones
- Cada row: 35px de altura, renderização O(1)
- Status dot com cores semânticas (nominal=cyan, warning=amber, error=crimson pulsante)
- Scrollbar custom com `.custom-scrollbar` neon

---

**3. SVG HUD Crosshairs Overlay** (`src/components/editor/HUDCrosshairs.tsx`)

Componente overlay `pointer-events-none` centrado no SkyCanvas:
- SVG 600x600 com `fill="none"`, `stroke="currentColor"` em Electric Cyan
- Linhas de mira (4 segmentos cruzados)
- Círculos concêntricos dashed
- Corner brackets (L-shapes nos 4 cantos)
- Texto técnico (P-Y/22, TGT-LOCK) em font-tactical
- `mix-blend-mode: screen` para iluminar fundos escuros
- Opacidade 40%, animação fade-in via framer-motion ou CSS
- Integrar no SkyCanvas com toggle via ViewportConfigMenu

---

**4. Sparklines SVG no SwarmGPT** (`src/components/editor/SwarmGPTPanel.tsx`)

Adicionar ao painel existente:
- Componente `<Sparkline>` que recebe array de valores e renderiza `<svg>` com `<path>` stroke-only
- Métricas: Signal Strength, Battery Trend, GPS Accuracy
- Stroke em cyan com `drop-shadow` glow
- Sem eixos, sem legendas — apenas o traçado puro (princípio FUI)

---

**5. SMPTE Drop-Frame Logic** (`src/lib/smpteUtils.ts` + `src/components/editor/SMPTEPanel.tsx`)

Criar utility function `formatSMPTE(seconds, fps, dropFrame)`:
- Modo NDF: separador `:`
- Modo DF (29.97): separador `;`, skip frames 00 e 01 no início de cada minuto exceto múltiplos de 10
- Integrar no SMPTEPanel existente e no TimelineBottomBar

---

### Ficheiros a criar/modificar

1. **Modificar** `src/index.css` — bevel utilities, neon glow aliases, scanline animation
2. **Modificar** `src/components/editor/TelemetryDashboard.tsx` — react-window virtualização
3. **Criar** `src/components/editor/HUDCrosshairs.tsx` — SVG overlay AR
4. **Modificar** `src/components/editor/SwarmGPTPanel.tsx` — Sparklines
5. **Criar** `src/lib/smpteUtils.ts` — Drop-Frame formatter
6. **Modificar** `src/components/editor/SMPTEPanel.tsx` — integrar DF logic
7. **Modificar** `src/components/editor/SkyCanvas.tsx` — mount HUDCrosshairs
8. **Modificar** `src/components/editor/ViewportConfigMenu.tsx` — toggle HUD crosshairs

### Proteções
- InstancedDroneSwarm / SwarmPlaybackEngine — intactos
- VVIZ Worker / Quantizer / Exporter — intactos
- Zustand stores — intactos
- Google APIs — intactas
- Layout existente (TacticalDock, JoiStatusMonitor, Toolbar) — intacto

