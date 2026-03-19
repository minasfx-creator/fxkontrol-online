

# Plano: Painel de Equipamentos Showven com Drag-to-3D

Criar um painel dedicado para equipamentos Showven (Flamers, Sparkulars, Fog, Confetti, Controllers) com drag-and-drop para a cena 3D, criando posições SFX automaticamente.

---

## 1. Novo Componente `ShowvenEquipmentPanel.tsx`

Painel com categorias colapsáveis (Flamers, Sparkulars, Fog, Confetti, Controllers) usando os dados reais de `showvenPresets.ts`. Cada item mostra:
- Nome, ícone por categoria, specs principais (altura, peso, DMX ch)
- Swatch visual (cor do efeito)
- Draggable com `dataTransfer` type `application/showven-equipment`

Ao **double-click**, cria posição pyro automaticamente no viewport (mesmo padrão do EffectLibrary) e vincula o efeito SFX correspondente na timeline.

Ao **drag**, seta `application/showven-equipment` com JSON `{id, category, effectType}`.

**Arquivo**: Novo `src/components/editor/ShowvenEquipmentPanel.tsx`

---

## 2. Registrar no PanelTabBar + Index

- Adicionar `'showven'` ao type `PanelId` no `PanelTabBar.tsx` (seção Hardware)
- Importar e renderizar `ShowvenEquipmentPanel` no `renderPanelContent()` do `Index.tsx`

**Arquivos**: `src/components/editor/PanelTabBar.tsx`, `src/pages/Index.tsx`

---

## 3. Drop Handler no SkyCanvas wrapper

Adicionar `onDragOver` + `onDrop` no div wrapper do Canvas em `SkyCanvas.tsx` (ou no wrapper em `Index.tsx`). Quando `application/showven-equipment` é detectado:
- Cria posição pyro no centro do viewport (ou posição raycasted se possível)
- Cria timeline item com o efeito SFX correspondente (flame → `FlameEffect`, sparkular → `SparkShower`, fog → `FogMachineEffect`)
- Mapeia equipamento Showven ao `effectType` do `effectTypeSystem.ts`

**Arquivo**: `src/pages/Index.tsx` (wrapper div do canvas)

---

## 4. Mapeamento Showven → Effect Pipeline

Função helper `showvenToEffect(presetId, category)` que retorna um `Effect` compatível com o `EFFECT_LIBRARY`, configurado com:
- Duration, height, spread baseados nos specs reais do preset
- `partType` mapeado (flame, sparkular, fog_low, confetti, cryo)
- Preset ID armazenado para que os renderers (`FlameEffect`, `SparkShower`, `FogMachineEffect`) apliquem constraints reais

**Arquivo**: `src/lib/showvenPresets.ts` (adicionar função de mapeamento)

---

## Resumo

| Ação | Arquivo | O que faz |
|------|---------|-----------|
| Criar | `ShowvenEquipmentPanel.tsx` | Painel com catálogo Showven, drag + double-click |
| Editar | `PanelTabBar.tsx` | Adicionar tab 'showven' na seção Hardware |
| Editar | `Index.tsx` | Importar painel + drop handler no viewport wrapper |
| Editar | `showvenPresets.ts` | Função `showvenToEffect()` de mapeamento |

