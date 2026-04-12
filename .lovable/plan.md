

# Revisão e Correções — Ronda 3

## Falhas Confirmadas (Não Corrigidas das Rondas Anteriores)

As correções das Rondas 1 e 2 **não foram aplicadas** aos ficheiros. Todos os bugs identificados anteriormente persistem.

### 1. `_shared/auth.ts` — `getClaims` inexistente (Bug Crítico)
Linha 24: `supabase.auth.getClaims(token)` não existe no SDK. Quebra toda autenticação.
**Fix**: `supabase.auth.getUser()` → extrair `user.id`.

### 2. `fxk-ai-chat/index.ts` — Modelo idêntico nos dois ramos (Bug)
Linha 20: `hasImages ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash"` — ternário inútil.
**Fix**: Usar `"google/gemini-2.5-pro"` para imagens.

### 3. `satellite-tile/index.ts` — Stack overflow em btoa (Bug)
Linha 23: `btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))` — spread em arrays grandes causa crash.
**Fix**: Encoding em chunks. Adicionar type guard no catch (linha 27: `err.message` sem verificação).

### 4. `google-places-search/index.ts` — `err.message` sem type guard
Linha 47: `err.message` assume que `err` é Error.
**Fix**: `err instanceof Error ? err.message : String(err)`.

### 5. `google-geo-intelligence/index.ts` — Importa helpers mas não os usa
Linhas 3, 11-13, 20-22, 94-96, 97-100: Importa `jsonOk`/`jsonError` mas constrói respostas manualmente.
**Fix**: Usar `jsonOk(results)` e `jsonError(...)` consistentemente.

### 6. `warehouse-download/index.ts` — Import duplicado
Linhas 1-2: `handleCors` e `corsHeaders` importados em linhas separadas do mesmo módulo.
**Fix**: Consolidar numa linha.

### 7. `useVoiceRecognition.ts` — Stale closures e double-fire
- Linha 113: `state === 'listening'` capturado no closure de `startListening`, fica stale no `onend`.
- Linhas 89, 97, 114: `onTranscript`/`onFinalTranscript` nas deps causam re-criação desnecessária.
- Linhas 97+114: `onFinalTranscript` pode ser chamado duas vezes (timer + onend).
**Fix**: Usar refs para callbacks e state; limpar `finalTextRef` após envio.

### 8. `FXKAssistant.tsx` — Stale closure no send + PRESETS duplicados
- Linha 295: `send(text)` capturado no closure da voice recognition, fica stale.
- Linhas 59-83: `PRESETS_COMMAND` e `PRESETS_EDITOR` têm 10 labels idênticos com prompts quase iguais.
**Fix**: `sendRef` para referência fresca; unificar presets num `PRESETS_DOCS` com `promptCommand`/`promptEditor`.

## Plano de Implementação

### Fase 1 — Edge Functions (5 ficheiros)
1. **`_shared/auth.ts`**: Substituir `getClaims` por `getUser()`
2. **`fxk-ai-chat/index.ts`**: Corrigir modelo para `gemini-2.5-pro` quando há imagens
3. **`satellite-tile/index.ts`**: Chunked btoa + type guard no catch
4. **`google-geo-intelligence/index.ts`**: Usar `jsonOk`/`jsonError` em todas as respostas
5. **`warehouse-download/index.ts`**: Consolidar import + type guard no catch
6. **`google-places-search/index.ts`**: Type guard no catch

### Fase 2 — Frontend (2 ficheiros)
1. **`useVoiceRecognition.ts`**: Refs para callbacks/state, prevenir double-fire
2. **`FXKAssistant.tsx`**: `sendRef`, consolidar PRESETS_COMMAND + PRESETS_EDITOR

### Fase 3 — Deploy e Teste
Deploy das edge functions corrigidas e validação via curl.

## Ficheiros Afetados
| Ficheiro | Ação |
|---|---|
| `_shared/auth.ts` | Fix getClaims → getUser |
| `fxk-ai-chat/index.ts` | Fix modelo imagens |
| `satellite-tile/index.ts` | Fix btoa + type guard |
| `google-geo-intelligence/index.ts` | Usar response helpers |
| `warehouse-download/index.ts` | Consolidar imports |
| `google-places-search/index.ts` | Type guard catch |
| `useVoiceRecognition.ts` | Refs + fix double-fire |
| `FXKAssistant.tsx` | sendRef + consolidar presets |

