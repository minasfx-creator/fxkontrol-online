

# Plano: Crosshair Animado + "TAP TO PLACE" no Viewport

## O Que Muda

Quando `editorMode === 'add-pyro'` ou `'add-drone'`, um overlay CSS aparece no centro do viewport com um crosshair animado e texto "TAP TO PLACE" pulsante. Desaparece automaticamente ao sair do modo.

## Implementação

### 1. Novo: `src/components/editor/PlacingModeOverlay.tsx`

Componente leve que lê `editorMode` do store e renderiza:
- **Crosshair central SVG animado**: 4 linhas convergentes com animação `scale-in` + rotação lenta (1 rotação a cada 8s)
- **Círculo pontilhado externo** pulsando (scale 0.95↔1.05)
- **Texto "TAP TO PLACE"** abaixo do crosshair, `font-mono`, `text-[11px]`, uppercase, com opacity pulse
- **Badge de tipo** no topo: "PYRO" ou "DRONE" com cor correspondente (orange/cyan)
- **Hint "ESC to cancel"** discreto na base
- Tudo `pointer-events-none` para não bloquear toques no viewport

### 2. Modificar: `src/components/editor/SkyCanvas.tsx`

- Import `PlacingModeOverlay`
- Renderizar junto aos outros overlays (após `HUDCrosshairs`, antes de `DestructionOverlay`)

### 3. Modificar: `src/index.css`

- `@keyframes placing-crosshair-spin` — rotação lenta 360° em 8s
- `@keyframes placing-pulse` — scale 0.95↔1.05 em 2s

## Ficheiros

| Ação | Ficheiro |
|------|---------|
| Criar | `src/components/editor/PlacingModeOverlay.tsx` |
| Modificar | `src/components/editor/SkyCanvas.tsx` — adicionar overlay |
| Modificar | `src/index.css` — 2 keyframes |

