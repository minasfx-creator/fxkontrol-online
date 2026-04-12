

# Limpeza e Correção de Bugs — Ronda 2

## Falhas Identificadas

### 1. Stale Closure no Voice Recognition → send()
**Ficheiro: `FXKAssistant.tsx` (linha 290-296)**

`onFinalTranscript` chama `send(text)` via `setTimeout`, mas `send` é definido com `useCallback([messages, loading, attachment])`. Como `voiceRecognition` captura `onFinalTranscript` no momento do `startListening`, se o utilizador falar enquanto `messages` muda, `send` usa estado stale.

**Fix**: Usar um `useRef` para manter referência fresca de `send`:
```typescript
const sendRef = useRef(send);
sendRef.current = send;
// Na callback: sendRef.current(text)
```

### 2. Stale `state` no useVoiceRecognition
**Ficheiro: `useVoiceRecognition.ts` (linha 113)**

`recognition.onend` verifica `state === 'listening'` mas `state` é capturado no closure de `startListening`. Quando `onend` dispara, `state` pode já ter mudado. Deve usar um ref.

**Fix**: Adicionar `stateRef` que acompanha `state`:
```typescript
const stateRef = useRef(state);
stateRef.current = state;
// Em onend: stateRef.current === 'listening'
```

### 3. PRESETS_COMMAND e PRESETS_EDITOR — Duplicação de 10 labels
**Ficheiro: `FXKAssistant.tsx` (linhas 59-83)**

Ambos arrays têm os mesmos 10 labels (ORÇAMENTO, LICENÇAS, DECLARAÇÃO, etc.) com prompts quase idênticos. Deviam ser consolidados num único array com variações por contexto.

**Fix**: Unificar num único `PRESETS_DOCS` com campo `promptEditor` e `promptCommand`, usando `getContextPresets()` para selecionar o prompt correto.

### 4. `onFinalTranscript` e `onTranscript` em useVoiceRecognition deps
**Ficheiro: `useVoiceRecognition.ts` (linha 122)**

`startListening` tem `[onTranscript, onFinalTranscript]` nas deps, mas estas são inline arrow functions no FXKAssistant — mudam a cada render, causando re-criação desnecessária de `startListening` e `toggle`. Deviam ser estabilizadas com refs no hook.

**Fix**: Dentro de `useVoiceRecognition`, usar refs para callbacks:
```typescript
const onTranscriptRef = useRef(onTranscript);
onTranscriptRef.current = onTranscript;
// Usar onTranscriptRef.current() nos event handlers
```
Remover `onTranscript` e `onFinalTranscript` da dep array de `startListening`.

### 5. `recognition.onend` dispara `onFinalTranscript` duplicado
**Ficheiro: `useVoiceRecognition.ts` (linhas 95-101 + 111-118)**

`onFinalTranscript` pode ser chamado **duas vezes**: uma pelo `autoSubmitTimer` (linha 97) e outra pelo `onend` handler (linha 114). Se o timer dispara e depois `onend` é acionado, o texto é enviado em duplicata.

**Fix**: Limpar `finalTextRef.current` após envio em ambos os caminhos:
```typescript
onFinalTranscript(finalTextRef.current);
finalTextRef.current = ''; // Prevent double-fire
```

## Plano de Correções

### Fase 1 — Fix stale closures no FXKAssistant
- Adicionar `sendRef` com referência fresca de `send`
- Usar `sendRef.current(text)` no `onFinalTranscript`

### Fase 2 — Fix useVoiceRecognition
- Usar refs para `onTranscript`, `onFinalTranscript` e `state`
- Remover callbacks instáveis da dep array de `startListening`
- Prevenir dupla invocação de `onFinalTranscript` limpando `finalTextRef`

### Fase 3 — Consolidar PRESETS duplicados
- Unificar `PRESETS_COMMAND` e `PRESETS_EDITOR` num único array com prompts contextuais
- Simplificar `getContextPresets()`

## Ficheiros Afetados
| Ficheiro | Ação |
|---|---|
| `FXKAssistant.tsx` | sendRef, consolidar PRESETS |
| `useVoiceRecognition.ts` | Refs para callbacks/state, fix double-fire |

