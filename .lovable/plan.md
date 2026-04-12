

# Auditoria de Componentes — Falhas Identificadas e Correções

## Falhas Encontradas

### 1. Componentes Mortos (Dead Code)
- **`JoiHologramAvatar.tsx`** — exportado mas nunca importado em nenhum outro ficheiro (0 referências)
- **`JoiHologramFullBody.tsx`** — exportado mas nunca importado em nenhum outro ficheiro (0 referências)
- Ambos somam ~450 linhas de código morto com SVGs complexos, animações e hooks de estado

### 2. FXKAssistant.tsx — Bugs e Problemas (1102 linhas)
- **Hook `useEffect` sem dep completa** (linha 308): `joiSpeech.enabled` na dep array mas `joiSpeech.speak` é chamado — se `speak` mudar referência sem `enabled` mudar, fica desatualizado
- **`useEffect` com dep `[open]`** (linha 392-396): `playGlitchBurst` dispara quando `open` muda para `false` também (closing), deveria verificar `if (open && !minimized)`
- **Preset duplicação** (linhas 982-1015): `OPERATIONAL_PRESETS` aparece duas vezes na barra inferior — primeiro sozinho, depois dentro de `presets` que já inclui `OPERATIONAL_PRESETS` (via `getContextPresets` linha 133). Resultado: botões duplicados
- **`send` chamado em `onFinalTranscript`** com referência estática (linha 295): `send(text)` captura closure inicial, pode ficar stale
- **Variável `pos0`** (linha 101 de AddPositionWizard): declarada mas nunca usada

### 3. AlignmentTools.tsx — Module-level Mutable State
- **`clipboard`** (linha 10-11): variável mutável no nível do módulo (`let clipboard: Position[] = []`). Funciona, mas é um anti-pattern que não sobrevive a HMR e partilha estado entre instâncias. Deveria usar `useRef` ou um store

### 4. DockBar.tsx — Label Ternário Excessivo
- **Linha 185**: cadeia de ternários de 6 níveis para abreviar labels mobile — difícil de manter. Deveria usar um mapa de abreviações

### 5. Acessibilidade
- **FXKAssistant FAB** (linha 564): botão sem `aria-label` — é o ponto de entrada principal da Joi
- **AddPositionWizard close button** (linha 184): sem `aria-label`
- **AddressingPanel close button** (linha 129): usa `✕` como texto sem `aria-label`
- **AngleQuickEditor reset** (linha 54): sem `aria-label`
- **AICoPilotPanel enable toggle** (linha 69): sem `aria-label`

### 6. FXKAssistant — Tamanho Excessivo
- 1102 linhas num único ficheiro. Sub-componentes internos (`ThinkingWave`, `SpeakingWave`, `TypewriterGreeting`) deviam ser extraídos

## Plano de Correções

### Fase 1 — Eliminar Código Morto
- Deletar `src/components/JoiHologramAvatar.tsx`
- Deletar `src/components/JoiHologramFullBody.tsx`

### Fase 2 — Corrigir Bugs no FXKAssistant
- Remover duplicação de presets na barra inferior (linhas 982-1015): mostrar apenas `presets` (que já inclui `OPERATIONAL_PRESETS`)
- Corrigir `useEffect` do `playGlitchBurst` para só disparar quando `open` é `true`
- Remover variável `pos0` não utilizada no AddPositionWizard

### Fase 3 — Melhorar DockBar
- Substituir cadeia de ternários por um mapa `Record<string, string>` para labels mobile

### Fase 4 — Acessibilidade
- Adicionar `aria-label` ao FAB da Joi, botões de fechar no wizard/addressing, reset do AngleQuickEditor, e toggle do AICoPilotPanel

### Fase 5 — Mover clipboard para useRef
- Converter `clipboard` de variável de módulo para `useRef` no AlignmentTools

### Ficheiros Afetados
| Ficheiro | Ação |
|---|---|
| `JoiHologramAvatar.tsx` | Deletar |
| `JoiHologramFullBody.tsx` | Deletar |
| `FXKAssistant.tsx` | Fix presets duplicados, fix useEffect |
| `AddPositionWizard.tsx` | Remover `pos0`, aria-label |
| `DockBar.tsx` | Refactor label map |
| `AlignmentTools.tsx` | clipboard → useRef |
| `AngleQuickEditor.tsx` | aria-label |
| `AICoPilotPanel.tsx` | aria-label |
| `AddressingPanel.tsx` | aria-label |

