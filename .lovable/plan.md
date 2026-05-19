# Refino UI/UX — Overlays do Viewport 3D

Escopo travado pelas suas escolhas: **overlays do viewport** (chrome flutuante por cima do canvas Three.js), glass **médio**, limpeza de **imports/dead code**, auditoria focada de **leaks + z-index + nested buttons**.

Tudo fora dessa lista (Toolbar, painéis laterais, Timeline, telas mobile dedicadas, FieldMode) **não muda**.

---

## 1. Token novo: `.glass-hud-md`

Adiciono UMA classe utilitária em `src/index.css` (não toco tokens existentes — `.glass`, `.glass-hud`, `.glass-premium` ficam intactos para não quebrar nada):

```css
.glass-hud-md {
  background: hsl(220 18% 6% / 0.14);              /* surface 14% */
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid hsl(190 70% 58% / 0.22);       /* cyan-dessat 22% */
  box-shadow:
    0 8px 24px -8px hsl(220 30% 1% / 0.55),
    inset 0 1px 0 hsl(190 70% 70% / 0.06),
    0 0 12px -4px hsl(190 70% 58% / 0.18);          /* halo cyan leve */
  border-radius: var(--radius);
}
.glass-hud-md.is-pressed { transform: translateY(1px); }
@media (prefers-reduced-transparency: reduce) {
  .glass-hud-md { backdrop-filter: none; background: hsl(220 18% 6% / 0.92); }
}
```

Sem inline `bg-card/90 backdrop-blur-md` espalhado: troca por `.glass-hud-md` nos componentes-alvo.

---

## 2. Componentes do escopo (overlays)

Auditar e refinar — **só estes**:

| Arquivo | Mudança |
|---|---|
| `SelectionModeBar.tsx` | substitui `bg-card/90 backdrop-blur-md border-border/40` pelo `.glass-hud-md`; converte cor hardcoded `SECTION_COLORS` para `style={{...}}` (já está, mantém); fix **possível listener leak** no `keydown` handler (verifico via re-read) |
| `TelemetryBar.tsx` | glass-hud-md no container; remove imports não usados |
| `ViewportBar.tsx` | glass-hud-md; consolida chips em `<div role="group">` |
| `ViewportNavControls.tsx` | glass + tooltip via `<button title>` (sem Radix Tooltip aninhado) |
| `ARCompassHUD.tsx` | glass-hud-md; remove magic numbers em const |
| `HUDCrosshairs.tsx` | só limpa imports; visual já é mira pura |
| `RadialMenu.tsx` | glass-hud-md no anel; **verifica nested button em Radix** (memória) |
| `PerformanceHUD.tsx` | glass + collapse animation; corrige `setInterval` sem cleanup se houver |
| `GeoHUD.tsx` | glass-hud-md |
| `PlacingModeOverlay.tsx` | glass + halo cyan no banner |
| `GoogleTilesLoadingOverlay.tsx` | glass-hud-md + barra de progresso `--status-sync` |
| `CommandStatusIndicators.tsx` | glass; agrupa chips |
| `PositionTransformGizmo.tsx` (Html badge) | só o pill `heading°·pitch°` herda `.glass-hud-md`; gizmo 3D não muda |
| `ARScanEffect.tsx` | dead-code sweep apenas |
| `AROverlayPanel.tsx` | glass-hud-md no painel flutuante |
| `MobileHUD.tsx` | glass; respeita safe-area iOS |

`SelectionStatusBar.tsx` fica fora (é statusbar inferior, não overlay viewport — ela tem refino separado se você quiser depois).

---

## 3. Auditoria focada de bugs (read-only primeiro, fix depois)

Faço um sweep com `rg` sobre os 16 arquivos acima procurando:

**(a) Listener / timer leaks** — padrão `addEventListener` / `setInterval` / `setTimeout` sem cleanup no return do `useEffect`. Para cada hit:
- timers → migrar pra `useInterval` / `useTimeout` do `src/hooks/useInterval.ts` (canônico da memória).
- listeners → `useRef` + `removeEventListener` no return.

**(b) Z-index conflitos** — mapeio os z-index hoje:
- `GlobalEStopButton`: `z-[9999]` (sagrado, não toco).
- `SelectionModeBar`: `z-40`.
- Outros: variados (`z-10`, `z-50`, inline).
- Padronizo num bloco comentado no topo de `src/index.css`:
  ```
  /* Z-Index Map (viewport overlays):
     50  → modais (createPortal)
     45  → RadialMenu, CommandStatusIndicators
     40  → SelectionModeBar, ViewportBar, TelemetryBar
     30  → PlacingModeOverlay, GoogleTilesLoadingOverlay
     20  → HUDs (Compass, Geo, Performance)
     10  → Crosshairs, AR effects
  */
  ```
- Aplico nos componentes do escopo.

**(c) Nested interactive (Radix)** — `rg "CollapsibleTrigger|DialogTrigger|PopoverTrigger" src/components/editor/{lista-acima}.tsx -A 5` e reporto cada `<button>` aninhado sem `asChild`. Fix: extrair onClick para o trigger pai ou usar `asChild`.

**(d) Keyboard traps** — `useEffect` com `keydown` global que não checa `e.target instanceof HTMLInputElement` (já vi um certo em `SelectionModeBar` — ele já checa, ótimo; vou validar os outros).

**(e) Imports não usados + dead code** — passo `tsc --noEmit` mental + `rg "^import" arquivo` cruzando com uso. Removo o que sobrar. Sem mover arquivos, sem refactor de assinatura.

---

## 4. Verificação ao final

- `bun run build` (typecheck implícito).
- `bunx vitest run` — confirmar que nada quebrou (suite atual ~1k+ tests).
- Screenshot do `/index` (preview atual) antes/depois pra você ver o glass aplicado.
- Lista textual dos bugs encontrados (categorizados por a/b/c/d/e) e quais foram corrigidos vs. apenas reportados.

---

## Fora de escopo (explícito)

- Nada de mudar tokens canônicos (`--ds-*`, `--field-*`, `--status-*`).
- Nada de tocar `GlobalEStopButton`, `MainLayout`, `uiCommandGateway`, safety state.
- Nada de migrar cores hardcoded fora dos 16 arquivos (você escolheu só "imports/dead code" pra limpeza).
- Sem testes novos (você escolheu auditoria sem teste extra).
- Sem mexer em FieldViewMode/FieldMode — alto contraste outdoor preservado.

## Critério de pronto

1. 16 overlays usando `.glass-hud-md` consistentemente.
2. Z-index map documentado e aplicado.
3. Lista de bugs entregue (com diff aplicado para os triviais).
4. `bun run build` verde, suite verde.

Posso prosseguir?
