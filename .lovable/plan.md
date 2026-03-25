

# Plano: Fix VVIZ — Gaps e Bugs Criticos

## Bugs Encontrados

### BUG 1: Main thread ainda carrega arquivo como string (OOM)
**Arquivo:** `VVIZImporter.tsx` linha 93
`file.text()` carrega o JSON inteiro como string na main thread (~100MB). Depois `postMessage({ text })` **copia** essa string para o worker (+100MB). Total: ~200MB na main thread antes do worker sequer começar.

**Fix:** Usar `file.arrayBuffer()` + `Transferable` (zero-copy). Decodificar no worker com `TextDecoder`.

### BUG 2: normColor trata valor 1 como float → vira 255
**Arquivo:** `vvizWorker.ts` linha 57-61
```
v >= 0 && v <= 1 ? Math.round(v * 255) : Math.round(v)
```
Se o VVIZ usa inteiros 0-255, o valor `1` (azul escuro quase preto) é interpretado como float `1.0` → `255` (branco). Cores escuras ficam totalmente erradas.

**Fix:** VVIZ do Finale 3D usa **inteiros 0-255**. Remover branch float. Apenas clamp 0-255.

### BUG 3: extractColor pega cor mais brilhante, ignora duração
**Arquivo:** `vvizWorker.ts` linhas 63-76
Um flash branco de 1 frame ganha de uma cor azul com 500 frames. Resultado: cores não batem com o Finale.

**Fix:** Ponderar pelo campo `frames` (duração acumulada). Cor dominante = maior `(r+g+b) * frames`.

### BUG 4: Sem timeout de segurança no worker
Se o worker crashar silenciosamente (OOM interno), a UI fica presa em "parsing" para sempre.

**Fix:** Adicionar timeout de 120s com fallback de erro.

### BUG 5: Worker protocol desatualizado
O comentário diz `text: string` mas precisa aceitar `buffer: ArrayBuffer` também.

## Plano de Execução

### 1. `src/lib/vvizWorker.ts`
- Aceitar `ArrayBuffer` via `e.data.buffer`, decodificar com `TextDecoder` (fallback para `e.data.text` para compatibilidade)
- Fix `normColor`: remover branch float, tratar tudo como inteiro 0-255 com clamp
- Fix `extractColor`: ponderar por `frames`, usar cor com maior peso acumulado
- Atualizar comentário do protocol

### 2. `src/components/editor/VVIZImporter.tsx`
- Trocar `file.text()` por `file.arrayBuffer()`
- Enviar via `worker.postMessage({ type: 'parse', buffer }, [buffer])` — zero-copy Transferable
- Adicionar timeout de 120s que cancela o worker e mostra erro
- Limpar timeout on success/error

### Diagrama de memoria

```text
ANTES (bug):
  Main: file.text() [100MB] → postMessage cópia [100MB] → Worker
  Pico main thread: ~200MB

DEPOIS (fix):
  Main: file.arrayBuffer() [100MB] → Transferable [0 cópia] → Worker
  Pico main thread: ~0MB (buffer transferido)
```

