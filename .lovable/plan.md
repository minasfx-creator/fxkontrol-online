

# Melhorias UI/UX + Motor de Renderização Químico-Realista

## Resumo

Quatro frentes de trabalho: (1) menus maximizáveis fullscreen, (2) ScriptWindow com colunas redimensionáveis, (3) correção do VDL generator (mine gerando morteiros), (4) integração química completa em todos os renderers de efeitos.

---

## 1. Menus Maximizáveis Fullscreen

**Problema**: Apenas o PyroFireOnePanel tem modo fullscreen. Os demais painéis usam DetachablePanel (pop-out para janela separada) mas não têm maximização inline.

**Solução**: Criar um wrapper `FullscreenablePanel` que qualquer painel pode usar.

- Botão Maximize2 no header de cada painel
- Ao clicar, renderiza o conteúdo como portal fixo sobre toda a viewport (`fixed inset-0 z-50`)
- ESC ou botão Minimize2 para sair
- Body scroll lock quando ativo
- Aplicar em: ScriptWindow, EffectLibrary, VDLPreviewPanel, GenerativeEffectsPanel, Timeline, PropertiesPanel, e todos os painéis do editor

**Arquivo**: `src/components/editor/FullscreenablePanel.tsx` (novo)
**Edições**: Cada painel principal envolto com `<FullscreenablePanel>`

---

## 2. ScriptWindow — Colunas e Células Customizáveis

**Problema**: Colunas com largura fixa via classes CSS, sem redimensionamento pelo usuário.

**Solução**:
- Estado `columnWidths` com larguras iniciais para cada coluna (Cue, Event Time, Effect Time, PFT, Size, Type, Description, Position, Pan, Tilt, Spin, ∠*, dP, dR, Dur, $, Chain, Notes)
- Drag handle entre headers para redimensionar colunas (mousedown → mousemove → mouseup)
- Persistência via localStorage
- Menu de contexto no header para show/hide colunas
- Células com double-click para editar inline (já existe parcialmente, expandir para Description e outros campos)

**Arquivo**: `src/components/editor/ScriptWindow.tsx` (editar)

---

## 3. Correção VDL: Mine Gerando Morteiros

**Problema**: O `vdlToEffect` em `vdlParser.ts` linha 931 classifica como `category: 'morteiros'` quando `caliber >= 4`, independente do `partType`. Uma Mine de 6" é categorizada como morteiro.

**Solução**:
- Corrigir `vdlToEffect` para usar `partType` na decisão de category:
  - `partType === 'mine'` → category `'mines'`
  - `partType === 'gerb'` → category `'gerbs'`
  - `partType === 'cake'` → category `'cakes_batteries'`
  - `partType === 'waterfall'` → category `'waterfalls'`
  - Shells: manter lógica por calibre
- Verificar que `TimelineEffects` no SkyCanvas roteia corretamente `pt === 'mine'` para `MineEffect` (já funciona na linha 948)
- Corrigir o SmartScriptAssistant para enviar `partType` correto ao criar itens via IA

**Arquivo**: `src/lib/vdlParser.ts` (editar `vdlToEffect`)

---

## 4. Motor Químico-Realista em Todos os Renderers

**Problema**: Apenas `ShellBurstRenderer` usa `getRealFormulation` e `particleChemistry`. Os demais renderers (MineEffect, GerbEffect, CometEffect, WaterfallEffect, CakeEffect, FanEffect, RomanCandleEffect, etc.) usam cores planas sem física química.

**Solução**: Integrar o sistema de química (`particleChemistry.ts`) em cada renderer:

### 4a. Propagação de formulationId
- `vdlToEffect` deve derivar `formulationId` automaticamente baseado em cor + tipo + calibre
- Lookup na tabela `REAL_FORMULATIONS` por matching (cor + tipo)
- Propagar via `effect.formulationId` no `TimelineEffects`

### 4b. Integração nos Renderers
Para cada renderer, adicionar:
- Prop `formulationId?: string`
- `getRealFormulation(formulationId)` → dados químicos reais
- `thermalColorRamp` para transições white-hot → saturated → ember → charcoal
- Temperatura de combustão do composto influencia brilho e duração
- Tipo de faísca (titanium → bright white sparks, charcoal → orange trails)

**Renderers a atualizar**:
| Renderer | Integração |
|---|---|
| `MineEffect` | Column jet usa temperatura do compound, spray stars usam cor química real, drip sparks usam charcoal/titanium do compound |
| `GerbEffect` | Temperatura do compound → intensidade da chama, tipo de faísca (Ti/Fe/Al) |
| `CometEffect` | Trail color do compound, velocidade de queima |
| `WaterfallEffect` | Charcoal chemistry → cor amber/gold real, burn rate |
| `CakeEffect` | Per-shot compound variation |
| `FanEffect` | Compound por shot no leque |
| `RomanCandleEffect` | Compound por estrela |
| `SparkShower` | Titanium vs iron vs aluminum spark behavior |

### 4c. Auto-Matching Químico
Criar função `autoMatchFormulation(color: string, type: string, caliber: number): string | undefined` em `particleChemistry.ts`:
- Mapeia cor VDL → compostos químicos (Red → Strontium Carbonate, Blue → Copper Oxide, Green → Barium Chlorate, etc.)
- Se não houver formulação exata, gera perfil químico derivado usando a enciclopédia de compostos existente
- Retorna `formulationId` ou gera um perfil inline

---

## Detalhes Técnicos

### Arquivos Criados
1. `src/components/editor/FullscreenablePanel.tsx` — wrapper fullscreen

### Arquivos Editados
1. `src/lib/vdlParser.ts` — fix category em `vdlToEffect`, adicionar `autoMatchFormulation`
2. `src/components/editor/ScriptWindow.tsx` — colunas redimensionáveis + show/hide
3. `src/components/editor/effects/MineEffect.tsx` — integrar chemistry
4. `src/components/editor/effects/GerbEffect.tsx` — integrar chemistry
5. `src/components/editor/effects/CometEffect.tsx` — integrar chemistry
6. `src/components/editor/effects/WaterfallEffect.tsx` — integrar chemistry
7. `src/components/editor/effects/CakeEffect.tsx` — integrar chemistry
8. `src/components/editor/effects/FanEffect.tsx` — integrar chemistry
9. `src/components/editor/effects/RomanCandleEffect.tsx` — integrar chemistry
10. `src/components/editor/effects/SparkShower.tsx` — integrar chemistry
11. `src/components/editor/SkyCanvas.tsx` — propagar `formulationId` nos renders
12. `src/render_ultra/fireworks/particleChemistry.ts` — adicionar `autoMatchFormulation`
13. Painéis principais — envolver com FullscreenablePanel

### Ordem de Execução
1. FullscreenablePanel (wrapper reutilizável)
2. Fix VDL category (mine ≠ morteiro)
3. ScriptWindow colunas redimensionáveis
4. `autoMatchFormulation` na particleChemistry
5. Integrar chemistry nos 8 renderers
6. Propagar formulationId no SkyCanvas

