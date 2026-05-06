## Revisão v3 — Apple Glass + Floating Dock para `/skycanvas`

Terceira passada. Mantém v2 + cobre **gaps adicionais** identificados em produção/edge cases (input, sync, perf, segurança, regressão).

### Gaps adicionais cobertos

| # | Gap (não coberto na v2) | Solução |
|---|---|---|
| G17 | `pointermove` global durante drag pode travar input do canvas (orbit/pan WebGL) | Drag handler monta `pointer-events:none` no `<div data-fxk-viewport>` enquanto `dragging=true`; restaura on `pointerup`. |
| G18 | `setPointerCapture` em iOS Safari falha silenciosamente em alguns casos | Fallback para listeners em `window` + `releasePointerCapture` em `try/catch`; documentado em comentário. |
| G19 | Resize do painel pode esconder o conteúdo abaixo do safe-area no iPhone landscape (notch) | `useFloatingDock` clamp `y + h ≤ window.innerHeight - safeBottom`, `x + w ≤ window.innerWidth - safeRight`. Recalcula no `resize` e `orientationchange`. |
| G20 | Painel arrastado para fora da viewport vira inalcançável após reload | `clampPanelInsideViewport()` roda no `useEffect` de mount + após hidratação do localStorage. |
| G21 | Glass com fundo radial pode "cantar" sobre céu noturno (banding em 8-bit) | Adicionar `dither` via `background-image` SVG noise (já no plano) + `image-rendering: pixelated` no layer noise; alpha 0.04 mantém invisibilidade do ruído. |
| G22 | Foco visual do `cmdk` sobre glass pode sumir (low contrast) | Item ativo do palette: `bg-cyan-500/15 ring-1 ring-inset ring-cyan-400/40` + `ds-focus`. |
| G23 | Sem teste de guarda contra regressão (alguém pode reintroduzir `commandBus` em SkyCanvas) | Novo `src/__tests__/skycanvas.safetyImports.guard.spec.ts`: rg em `src/pages/SkyCanvas.tsx` + `src/components/skycanvas/**` proibindo `commandBus`, `fieldBus`, `safetyStateMachine`, `workMode.set`, `uiCommandGateway.fire`, `uiCommandGateway.arm`. |
| G24 | Master Menu palette pode disparar áudio decoder pesado e travar UI thread | `decodeAudioPeaks` já é async; ação `loadAudio` no palette delega ao input file existente (reusa pipeline + toast progress). |
| G25 | Sem batch de undo para drops de cue (cada drop é um commit isolado) | Fora de escopo desta entrega visual; **anotar no plan como follow-up** ("CueDrop undo via useUndoStore — separate task"). |
| G26 | Topbar transport sumindo no mobile sem aviso → operador perde controle | < 900px transport vira **FAB pill bottom-center** persistente (h-14, glass, 3 botões: prev/play/next, swipe-up expande timecode). |
| G27 | `prefers-reduced-transparency` ainda desconhecido em alguns navegadores antigos | Detecção defensiva: `window.matchMedia('(prefers-reduced-transparency: reduce)').matches` em try/catch, default `false`. |
| G28 | Chave de localStorage colide com testes (vitest jsdom mantém estado entre suítes) | Hook `useFloatingDock` usa `__resetForTests()` exposto em `import.meta.env.MODE === 'test'`. |
| G29 | Quando palette aberto + ⌘K novamente, deve **fechar** (toggle), não acumular | Estado controlado, `Cmd+K` chama `setOpen(o => !o)`. |
| G30 | Drag handle e botão collapse no mesmo header podem competir pelo `pointerdown` | `data-no-drag` no botão; handler ignora drag quando `event.target.closest('[data-no-drag]')`. |
| G31 | Sem feedback ao tocar pill colapsado (mobile) | Tap no pill expande com `animate-in zoom-in-95 fade-in` (300ms easing iOS); ARIA `aria-expanded`. |
| G32 | Glass falha visualmente sobre fundo branco (modo claro futuro) | CSS gates em `[data-theme="dark"]` (default no projeto). Modo claro = no-op (cai para DS surface). |
| G33 | `cmdk` lazy import pode bloquear primeiro `Cmd+K` por 200–400ms em conexões lentas | Pré-carregar palette via `link rel="modulepreload"` injetado on hover do Master Menu pill (intent-based prefetch). |
| G34 | Animações de drag interferem com RAF do WebGL (jank perceptível) | Drag usa `transform` puro (não muda layout), `will-change: transform` set on dragstart, removed on dragend. |
| G35 | Sem indicador "estado salvo" para o dock (operador não sabe se persistiu) | Toast silencioso `sonner` 1s "Layout salvo" ao primeiro snap após drag, debounced 800ms. |
| G36 | Ação "Reset dock" pode ser disparada acidentalmente | `⌘0` exige `Shift+⌘0`; menu palette mostra confirmação inline (botão "Reset" com hover destrutivo). |
| G37 | Painéis com `position:absolute` quebram tab order natural | Documentar tab order via `tabIndex={0}` no header de cada painel + ordem DOM: Library → Inspector → Timeline → Topbar (a11y "Skip to viewport" link `<a href="#viewport">` no topo, sr-only até foco). |
| G38 | Sem tratamento de visibility — Glass + animações continuam ao trocar de aba | `document.visibilitychange` pausa transições não-essenciais (CSS classe `.is-hidden-tab` com `animation-play-state: paused`). |
| G39 | Falta documentação de que `/skycanvas` é uma surface "Show/Experience" sem MainLayout | Adicionar header comment em `SkyCanvas.tsx` linkando `mem://arquitetura/v6-quatro-planos` + nota sobre E-STOP cosmético/redirect. |
| G40 | Bundle delta sem orçamento explícito vs `vite-plugin-bundle-budget.ts` | Declarar budget local: `/skycanvas` chunk +18KB gz max; CI fail se exceder. |

### Decisões consolidadas (v1 + v2 + v3)

**Layout**
- Edge-to-edge viewport, painéis `position:absolute` em layer isolado.
- 6 slots magnéticos (TL/TR/BL/BR/T/B) + free-float, snap 24px, ghost preview.
- Z-map: viewport=0, dock=40, topbar=50, palette=60, toast=70, GlobalEStop=9999.

**Glass**
- Default GPU-cheap (radial gradient + noise SVG, zero `backdrop-filter`).
- Upgrade automático para `backdrop-filter blur(24px) saturate(170%)` quando `prefers-reduced-transparency: no-preference` E `@supports (backdrop-filter)`.
- `prefers-reduced-transparency: reduce` → cai para `bg-ds-surface-deep` puro.
- Gated em `[data-theme="dark"]` (no-op em modo claro futuro).

**Master Menu**
- Pill central no topbar, abre `SkyCanvasCommandPalette` (cmdk + Radix Dialog) com `⌘K`/`⌘M` (toggle).
- Modulepreload em `mouseenter` (intent prefetch).
- Catálogo `SkyAction[]` com `safety: 'inert'` enforced; ações `sim-only` rejeitadas no registro.

**Painéis flutuantes**
- Pointer Events API (mouse/touch/pen unificado).
- Drag em `transform` puro + `will-change` toggle.
- `setPointerCapture` em try/catch + fallback window listeners.
- Resize 2 bordas, double-click resize-handle = reset.
- Clamp dentro da viewport pós-mount/resize/orientationchange.
- Persist `fxk.skycanvas.dock.v2` com migração silenciosa de v1 + `__resetForTests()`.
- Toast "Layout salvo" debounced 800ms.

**Mobile/Touch (< 900px)**
- Painéis viram bottom Sheet com swipe-down handle.
- Transport vira **FAB bottom-center** sempre visível.
- Hit targets ≥ 44px, safe-area respeitado.
- iOS `setPointerCapture` fallback ativo.

**Acessibilidade**
- `role="dialog"` + `aria-label` + `aria-expanded` por painel.
- Foco trap nos painéis expandidos via teclado.
- Skip-link sr-only "Pular para viewport".
- Reduced motion: drag instantâneo, sem snap animation.
- Contraste 7.1:1 mínimo sobre glass.
- Item ativo do palette com ring cyan visível.

**Safety / contrato**
- Zero import de `commandBus`, `fieldBus`, `safetyStateMachine`, `workMode`, `uiCommandGateway.{arm,fire,disarm}`.
- Badge `SIM · ADVISORY` permanente no topbar.
- Botão E-STOP visual no topbar redireciona para `/command` (cosmético, não dispara nada local).
- **Guard test** `skycanvas.safetyImports.guard.spec.ts` previne regressão.

**Performance**
- Glass overhead ≤0.5ms/frame.
- Drag em refs (zero re-render durante move).
- Palette code-split + modulepreload on intent.
- `visibilitychange` pausa animações em background.
- Bundle budget local: +18KB gz max.

**Keyboard**
- `Space` play/pause, `←/→` seek frame, `Home/End` start/end (já existe).
- `⌘K` / `⌘M` toggle Master Menu.
- `⌘1/2/3` foco Library/Inspector/Timeline.
- `Shift+⌘0` reset dock (com confirmação destrutiva).
- `⌘\` modo cinema (toggle todos painéis).
- `Esc` fecha palette / sai modo cinema.

### Arquivos finais

**Novos (7)**
1. `src/components/skycanvas/FloatingPanel.tsx` — wrapper Pointer Events + glass + drag/resize/snap/persist.
2. `src/components/skycanvas/SkyCanvasCommandPalette.tsx` — Dialog + cmdk + ações `inert`.
3. `src/components/skycanvas/skyActions.ts` — catálogo tipado `SkyAction[]`.
4. `src/components/skycanvas/GlassTopbar.tsx` — topbar + Master Menu pill + transport responsivo + FAB mobile.
5. `src/hooks/useFloatingDock.ts` — Zustand slice v2 + migração v1 + clamp + `__resetForTests`.
6. `src/hooks/useReducedMotion.ts` — wrap `matchMedia` defensivo.
7. `src/__tests__/skycanvas.safetyImports.guard.spec.ts` — guard regressão.

**Editados (2)**
- `src/index.css` — tokens `.glass-pane` (radial+noise default, backdrop-filter upgrade gated).
- `src/pages/SkyCanvas.tsx` — abandona `EditorShell`, monta layout absolute + GlassTopbar + 3 FloatingPanel + palette + skip-link + header comment.

### Aceitação consolidada (12)

1. Viewport edge-to-edge; 4 ilhas glass arrastáveis em 6 slots + free.
2. Master Menu pill central, `⌘K/⌘M` toggle, modulepreload on intent.
3. Layout persiste em `fxk.skycanvas.dock.v2`; clamp pós-resize garante painéis sempre alcançáveis.
4. Touch/Pencil/mouse unificados via Pointer Events; iOS fallback ativo.
5. `prefers-reduced-motion` desabilita transições; `prefers-reduced-transparency` cai para sólido; sem `backdrop-filter` → radial+noise idêntico GPU-free.
6. FPS WebGL2 não cai >2fps com painéis abertos (low-tier mobile aferido).
7. Mobile <900px: painéis viram bottom Sheets; transport vira FAB persistente.
8. Tab order coerente, skip-link funciona, contraste WCAG AA+ sobre glass.
9. Guard test impede regressão de imports de safety; **zero** `commandBus`/`fieldBus`/`workMode`/`uiCommandGateway.fire`.
10. Badge `SIM · ADVISORY` sempre visível; E-STOP cosmético redireciona `/command`.
11. Bundle delta `/skycanvas` ≤18KB gz; CI guarda.
12. Paleta canônica Vantablack + cyan-dessat preservada — glass é linguagem de superfície, não troca de paleta.

### Follow-ups fora de escopo (anotar)

- F1. CueDrop undo via `useUndoStore` (atualmente cada drop é commit isolado).
- F2. Modo cinema (⌘\) com auto-hide topbar após 3s sem mouse.
- F3. Compartilhar layout dock entre dispositivos via Lovable Cloud (sync `fxk.skycanvas.dock.v2`).
- F4. Migrar `/skycanvas/*` para subrotas (clip editor, render queue) reusando o mesmo shell glass.
