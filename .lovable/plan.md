## Problema

No viewport mobile (440px), o botão **X** da janela do Joi (`FXKAssistant`) fica difícil de acertar porque o cabeçalho está superlotado:

- Avatar 40px + título flexível + 4 botões mobile (`Voice 36 + Clear 36 + Minimize 36 + Close 40 = 148px`) + gaps ≈ 212px reservados.
- O botão X tem `h-10 w-10` (40px) mas é o último de uma fila apertada, sem espaço extra ao redor.
- Abaixo do header ainda há **5 painéis sempre montados** (`JOIContextRibbon`, `JOIInsightPanel`, `JOITruthInspector`, `JOIExecutionTracePanel`, `JOIStylePanel`) que aumentam altura, custo de render e podem sobrepor a área quando expandidos.

Além disso, há código morto acumulado no `FXKAssistant.tsx`:

- Imports não utilizados: `OPERATIONAL_PRESETS`, `useProjectStore`, `EFFECT_LIBRARY`, `JOI_MODE_PRESETS`.
- State `glitching` e setter `setGlitching` (escrito, nunca lido).
- Const `joiState` calculada e nunca usada.
- Comentário “Sidebar hologram (expanded only)” sobrando, sem implementação.
- Comentário “Legacy …” obsoleto.

## O que vou fazer

### 1. Header mobile mais limpo e botão X destacado

No `src/components/FXKAssistant.tsx`, dentro do header (linhas ~896–964):

- Reordenar e priorizar **X (fechar)** e **Minimizar** como os botões mais à direita, com hit target maior no mobile.
- No mobile, mover **Voz** e **Limpar** para um menu “overflow” (`•••`) ou simplesmente ocultar o botão de limpar (a ação já existe via comando do usuário e via apagar histórico do navegador). Ficamos com: `Voz | Minimizar | X`.
- Aumentar o X mobile para `h-11 w-11` com `min-w-[44px]` (padrão Apple HIG de toque) e dar mais respiro (`ml-1` adicional).
- Garantir que o título use `truncate` corretamente para nunca empurrar os botões.

### 2. Painéis Joi colapsáveis por padrão / só quando relevantes

- `JOIContextRibbon` continua sempre visível (é o ribbon de verdade) mas com `overflow-x-auto` já tem.
- `JOIInsightPanel` já só renderiza quando há insights — manter.
- `JOITruthInspector`: condicionar a render a “há devices registrados”. Quando não há, retornar `null`.
- `JOIExecutionTracePanel`: já só renderiza com `trace !== null` — manter.
- `JOIStylePanel`: já tem modo colapsado quando não há estilo ativo — manter; garantir que continua `collapsed=true` por default.

Isso encurta o painel no mobile e libera espaço/atenção visual em torno do header.

### 3. Limpeza de código morto em `FXKAssistant.tsx`

- Remover imports: `OPERATIONAL_PRESETS`, `useProjectStore`, `EFFECT_LIBRARY`, `JOI_MODE_PRESETS`.
- Remover state `glitching` / `setGlitching` e as duas chamadas (`setGlitching(true)` e o `setTimeout(setGlitching(false), 800)`), mantendo o `playGlitchBurst()` (este é audio, não visual).
- Remover a const não utilizada `const joiState = ...`.
- Remover o comentário órfão `{/* Sidebar hologram (expanded only) */}` e o `{/* Legacy ... */}`.

### 4. Sem mudanças em outros arquivos

Não vou tocar em `JoiPanel.tsx` (rota `/joi`, painel separado de dev), nem em `useJoiSpeech`, nem nos serviços de voz/contexto. Escopo: somente cabeçalho do chat + remoção de código morto + condicionar render de 1 sub-painel.

## Detalhes técnicos

Arquivos editados:

- `src/components/FXKAssistant.tsx`
  - Imports enxugados.
  - `glitching` e `joiState` removidos.
  - Header: layout reorganizado, X com `min-w-[44px] min-h-[44px]` no mobile, gap extra antes do X.
  - Botão “Limpar” (Trash2) escondido no mobile (`hidden sm:flex`).

- `src/components/joi/JOITruthInspector.tsx`
  - `if (devices.length === 0) return null;` antes do JSX principal.

Sem novas dependências. Sem migração. Sem mudanças de rota.

## Aceitação

- No mobile (≤440px): cabeçalho do Joi mostra apenas avatar + título + Voz + Minimizar + **X grande (44×44)**, sem corte do título, X facilmente clicável.
- No desktop: comportamento inalterado (Voz, Limpar, Expand, Minimizar, X).
- `npm run build` (typecheck) passa sem warnings de imports/variáveis não usados nos pontos tocados.
- Janela do Joi continua abrindo, fechando (X), minimizando e os painéis de contexto/insights continuam funcionando.
