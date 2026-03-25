

# Plano: VVIZ Bulletproof + Mobile Editor Refinado

## Problema Identificado

### VVIZ - Ainda trava / OOM
O Web Worker resolve o parsing, mas o **gargalo real** esta no momento do `batchImportVVIZ`: ao chamar `set()` no Zustand com 300+ positions e 300+ trajectories (cada uma com ate 1500 waypoints), o React tenta re-render com **centenas de milhares de objetos** de uma vez. Isso congela a main thread e pode causar OOM no browser.

Alem disso, o `postMessage` do worker transfere o resultado inteiro como JSON estruturado — para 300 drones com 1500 waypoints cada, isso e ~100MB+ de dados serializados/desserializados.

### Mobile - Editor precisa rodar fluido
O layout mobile ja existe mas precisa de ajustes de performance: o SkyCanvas renderiza com o mesmo pixel ratio e qualidade do desktop, e os paineis flutuantes podem sobrepor controles criticos.

## Solucao

### 1. Streaming do Worker com Transferable Objects
**Arquivo:** `src/lib/vvizWorker.ts`
- Em vez de enviar o resultado inteiro de uma vez, enviar cada drone processado individualmente via `postMessage({ type: 'drone', pos, traj })` 
- Usar `Transferable` (ArrayBuffer) para waypoints quando possivel
- Resultado final envia apenas stats/errors, nao os dados

### 2. Importacao Incremental no Store
**Arquivo:** `src/components/editor/VVIZImporter.tsx` + `src/store/useProjectStore.ts`
- Acumular positions/trajectories em um array local (fora do React state)
- Fazer batch commit no store em chunks de 50 drones com `requestIdleCallback` entre cada chunk
- Usar `startTransition` para cada batch para nao bloquear input do usuario
- Adicionar `batchImportVVIZChunk` ao store que faz `push` em vez de spread (O(1) vs O(n))

### 3. Reducao de Memoria no Worker
**Arquivo:** `src/lib/vvizWorker.ts`
- Reduzir MAX_WP de 1500 para 800 no mobile (detectar via `navigator.deviceMemory` ou `navigator.hardwareConcurrency`)
- Aplicar simplificacao mais agressiva quando `deviceMemory < 4`
- Enviar string via `Transferable` para evitar copia de memoria

### 4. Mobile Performance no Editor
**Arquivo:** `src/pages/Index.tsx`, `src/components/editor/MobileFloatingPanel.tsx`
- Reduzir pixel ratio para `Math.min(devicePixelRatio, 1.5)` no mobile
- Lazy-load paineis dentro do `MobileFloatingPanel` (so montar quando ativo)
- Adicionar `will-change: transform` no floating panel para GPU compositing
- Desabilitar efeitos pos-processamento (bloom, SSAO) automaticamente no mobile

### 5. Deteccao de Capacidade do Device
**Arquivo:** `src/lib/deviceCapability.ts` (novo)
- Criar utility que detecta: `deviceMemory`, `hardwareConcurrency`, `maxTouchPoints`, GPU info
- Retornar perfil: `'low' | 'medium' | 'high'`
- Usar esse perfil para ajustar: MAX_WP no worker, pixel ratio, qualidade de tiles, efeitos visuais

## Detalhes Tecnicos

```text
FLUXO ATUAL (trava):
  Worker ──[100MB JSON]──> Main Thread ──[set() 300 drones]──> React re-render (FREEZE)

FLUXO NOVO (streaming):
  Worker ──[drone 1]──> accumulator
  Worker ──[drone 2]──> accumulator
  ...
  Worker ──[done]──> batchCommit(chunk 50) → idle → batchCommit(chunk 50) → idle → ...
```

### Arquivos a criar/editar:
1. `src/lib/deviceCapability.ts` — novo, detector de capacidade
2. `src/lib/vvizWorker.ts` — streaming por drone, adaptive MAX_WP
3. `src/components/editor/VVIZImporter.tsx` — acumulador + batch commit incremental
4. `src/store/useProjectStore.ts` — adicionar `batchImportVVIZChunk` (push-based)
5. `src/pages/Index.tsx` — lazy-load paineis mobile, pixel ratio adaptativo
6. `src/components/editor/MobileFloatingPanel.tsx` — GPU compositing hints

