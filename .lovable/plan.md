
## Objetivo

Encerrar a implantação do `/skycanvas` (surface canônica DS v1) com três frentes:
1. **Refinar o mundo 3D** (Environment + ExplosionsLayer) sem regredir performance.
2. **Corrigir bugs reais** identificados na auditoria.
3. **Aplicar glassmorphism** consistente nos painéis dock (left/right/timeline) — hoje só topbar e FAB usam `glass-pane`.

Tudo respeita: Vantablack `#050810` + cyan-dessat `190 70% 58%` (Core memory), `WorkMode: design/simulation = sem bloqueios`, zero CommandBus/FieldBus/uiCommandGateway.fire. Páginas operacionais (`/command`, `/pairing/*`) intocadas.

---

## 1 · Refino do mundo 3D (`src/components/show3d/v2/`)

### Environment.tsx
- **Sky gradient suave**: substituir `<color>` flat por `<color>` Vantablack + adicionar um plano hemisférico (`sphereGeometry` invertida com `BackSide` + shader gradiente vertical Vantablack → cyan-dessat 6%) para dar profundidade ao horizonte sem custo (1 draw, depthWrite=false).
- **Hemisphere light** (`hemisphereLight` cyan-dessat ↓ ground `#0a0f1a`) para iluminar o palco com tom frio sem somar custo de directional shadows.
- **Stars**: subir `count` para 8000 e `speed` para 0.25 (mais cinemático sem afetar FPS — drei `<Stars>` é 1 draw).
- **GroundPlane**: adicionar leve `meshStandardMaterial` com `emissive` Vantablack reflectance + `roughness=0.95` para o grid cyan brilhar sutilmente.

### ExplosionsLayer.tsx (bug + refinamento)
- **Bug**: o `cursor` para alocação de slot só avança quando o slot está ocupado; quando o cursor encontra um slot livre, ele atribui mas não incrementa, fazendo o **próximo spec do mesmo frame** colidir e sobrescrever (linha 162-167). Fix: `cursor++` após atribuir.
- **Bug**: ao evict (pool cheio), o evicted slot pode ser reusado **no mesmo frame** sem zerar `sizes/alphas` do slot anterior (resíduo visual de 1 frame). Fix: zerar buffers do slot evicted antes de reusar.
- **Refino**: adicionar leve "shimmer" pré-calculado no fragment shader (`falloff * (1.0 + 0.15*sin(d*40.0))`) para faíscas mais ricas sem custo de uniform extra.

### SkyCanvas2.tsx (bug)
- **Bug menor**: `dpr` do `<Canvas>` recebe `[1, 1.75]` mas o `AdaptiveDPRController` recalcula em runtime; o DPR inicial pode ficar travado no `1.75` em mobile high-DPI antes do primeiro probe. Fix: passar `dpr={[minDpr, maxDpr]}` (já é o caso) e iniciar `dprRef.current = minDpr` em mobile (`window.devicePixelRatio > 2.5 ? minDpr : maxDpr`).

### SkyCanvas.tsx (bug de cleanup)
- **Bug**: `URL.revokeObjectURL(audioUrl)` no unmount lê `audioUrl` via closure stale (eslint-disable presente). Fix: usar `useRef<string|null>` para o último URL e revogar via ref no unmount, removendo o disable.
- **Bug**: efeito de playback (linha 493) tem dependência `setPlaying`/`setCurrentTime` mas **não inclui `setPlaying` chamado no `tick` final** quando vídeo termina — pode causar tick continuar rodando se duration mudar a meio. Fix: ler `duration` via `useProjectStore.getState()` dentro do tick (já é o padrão do projeto) e remover `duration` da dep array.

---

## 2 · Glassmorphism nos painéis dock

### TabbedDockPanel.tsx
- Wrappar o `<Tabs>` em um container `glass-pane glass-pane-strong rounded-2xl mx-1.5 my-1.5 h-[calc(100%-12px)]`.
- TabsList: substituir `bg-white/[0.03] border border-white/[0.06]` por `glass-chip bg-transparent border border-white/[0.08]`.
- TabsTrigger active state: `data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-100 data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(189_94%_55%/0.6)]` (rim cyan-dessat).

### EditorShell áreas (não tocar no `EditorShell.tsx` — apenas wrappers)
- Em `SkyCanvas.tsx`, envolver as 3 `<section>` (library/inspector/timeline) com `className` adicional `p-1.5` para dar respiro pro vidro.
- Tabs (segment strip) já usa `DsSegmentTabs`; aplicar glass-pane via prop wrapper externo no JSX `tabs={…}` (`<div className="h-full glass-pane mx-3 my-1 rounded-xl flex items-center px-ds-4">`).

### Performance guard
- Glass-pane já tem fallback radial-gradient quando `prefers-reduced-transparency` ou sem `backdrop-filter` → mobile baixo-end não paga blur (Core memory respeitada).

---

## 3 · Testes & QA

- Adicionar caso ao `skyCanvas2.smoke.spec.tsx`: simular 300 specs ativos e verificar `slotOwner` não colide (cobre o bug do cursor).
- Adicionar `skyCanvasGlass.guard.spec.ts`: regex garante que `TabbedDockPanel.tsx` contém `glass-pane` (evita regressão).
- Rodar suite completa.

---

## Detalhes técnicos

### Arquivos editados
```text
src/components/show3d/v2/Environment.tsx        — sky gradient + hemiLight + stars 8000
src/components/show3d/v2/ExplosionsLayer.tsx    — fix cursor++, fix evict-zero, shimmer
src/components/show3d/v2/SkyCanvas2.tsx         — DPR inicial mobile-aware
src/components/skycanvas/TabbedDockPanel.tsx    — glass wrapper + cyan rim
src/pages/SkyCanvas.tsx                         — audio URL via ref, glass tabs strip
src/components/show3d/v2/__tests__/skyCanvas2.smoke.spec.tsx  — cursor case
src/__tests__/skyCanvasGlass.guard.spec.ts      — novo guard
```

### Não tocar
- `src/components/ds/EditorShell.tsx` (DS canônico, compartilhado).
- `src/index.css` (tokens glass já existem — `glass-pane`, `glass-pane-strong`, `glass-pill`, `glass-chip`).
- Qualquer rota operacional, `uiCommandGateway`, `safetyStateMachine`, `fieldBus`.
- `src/store/useProjectStore.ts`.

### Critério de aceite
- `/skycanvas` carrega em mobile (`/index` → preview 440×798) com painéis vidrados, viewport 3D estável.
- ExplosionsLayer dispara 100+ bursts simultâneos sem flicker.
- Suite de testes verde (1 caso novo + 1 guard).
- Sem warning novo no console além dos já listados (React Router future flags).
