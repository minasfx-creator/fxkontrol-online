

## Auditoria de Conformidade: Relatório Técnico vs. Codebase Atual

### RESUMO EXECUTIVO

| Área do Relatório | Status | Implementação Atual |
|---|---|---|
| Streaming JSON Parser (SAX-style) | ✅ Conforme | `vvizWorker.ts` — parser incremental para >5MB, brace-depth tracking |
| Web Worker off-thread | ✅ Conforme | `vvizWorker.ts` — processamento completo em Worker, ArrayBuffer transfer |
| Coordinate Z-flip | ✅ Conforme | `resolveCoordMode()` com `zSign = -1` para frames VVIZ/standard |
| InstancedMesh (1 draw call) | ✅ Conforme | `InstancedDroneSwarm.tsx` — 6 InstancedMesh (body/led/rotor/halo/nav/glow), useRef+useFrame direto |
| instanceColor buffer | ✅ Conforme | `setColorAt()` + `instanceColor.needsUpdate = true` em cada frame |
| instanceMatrix.needsUpdate | ✅ Conforme | Flag elevada corretamente para todos os meshes |
| VDL 25-color quantizer | ✅ Conforme | `vdlQuantizer.ts` — distância Euclidiana, 30 cores, impliesTrail/Tip/No Trail |
| VDL no export pipeline | ✅ Conforme | `exportEngine.ts` importa `rgbToVdlString` e aplica na exportação VVIZ |
| GC-friendly (nullify refs) | ✅ Conforme | Worker nullifica buffer e performance objects após processamento |
| Waypoint simplification | ✅ Conforme | Adaptive downsample baseado em count (4 tiers) |
| **TUS Resumable Upload** | ❌ Ausente | Uploads são `supabase.storage.upload()` padrão, sem `tus-js-client` |
| **EdgeRuntime.waitUntil** | ❌ Ausente | Edge Functions não usam background processing, mas o parsing já ocorre no Worker do frontend |
| **Backend streaming (req.body pipe)** | ⚠️ N/A | O VVIZ é parseado no frontend Worker, não na Edge Function — arquitetura alternativa válida |

### DESVIOS QUE REQUEREM AÇÃO

#### 1. Upload Resumível (TUS) — NÃO IMPLEMENTADO

O relatório especifica `tus-js-client` para uploads de VVIZ >50MB com retry automático e chunks de 6MB. Atualmente, o `VVIZImporter.tsx` lê o arquivo via `FileReader` localmente no browser e envia ao Worker. Para o fluxo de storage (bucket `assets`), uploads usam `supabase.storage.upload()` padrão, limitado a ~50MB sem retry.

**Correção proposta**: Implementar upload TUS no componente `VVIZImporter.tsx` para arquivos >20MB, utilizando `supabase.storage.createSignedUploadUrl()` + `tus-js-client`. Arquivos menores continuam no fast-path atual (FileReader → Worker direto).

#### 2. Parser Streaming — Melhoria de Memória

O parser streaming atual (`parseVvizStreaming`) faz `decoder.decode(buffer)` — decodifica o buffer inteiro em string antes de parsear. Para arquivos >100MB, isso duplica a memória (ArrayBuffer + String). O relatório especifica processamento chunk-by-chunk com `TextDecoderStream`.

**Correção proposta**: Refatorar o streaming parser para processar em chunks de 64KB usando `TextDecoderStream` pattern, mantendo apenas o chunk ativo em memória. Isso reduz o pico de memória de ~2x filesize para ~50MB fixo.

### CONFORMIDADES VERIFICADAS (sem ação necessária)

- **InstancedMesh**: 6 meshes instanciados (body, LED, rotor, halo, nav, glow), useRef direto, sem setState no useFrame
- **Z-axis flip**: `resolveCoordMode()` retorna `'flip'` para frames VVIZ/standard, aplica `zSign = -1` em dx/dz
- **VDL Quantizer**: Tabela de 30 cores (superset dos 25 canônicos), Euclidean distance em espaço normalizado 0-1, suporte a `impliesTrail`, `Tip`, `No Trail`
- **Color extraction**: Média ponderada por brightness×frames nas `payloadActions`
- **Dual parser**: SAX-style para >5MB, JSON.parse fast-path para <5MB
- **Worker protocol**: ArrayBuffer transfer, progressive nullification, progress events

### PLANO DE IMPLEMENTAÇÃO

| Passo | Arquivo | Mudança |
|---|---|---|
| 1 | `package.json` | Adicionar `tus-js-client` |
| 2 | `src/components/editor/VVIZImporter.tsx` | Upload TUS para arquivos >20MB com progress bar e retry |
| 3 | `src/lib/vvizWorker.ts` | Refatorar `parseVvizStreaming` para processar em chunks de 64KB em vez de decodificar o buffer inteiro |

### DETALHES TÉCNICOS

```text
Upload TUS flow (files >20MB):
  File selected → check size
  → >20MB: tus-js-client upload to storage bucket
     → 6MB chunks, auto-retry on disconnect
     → progress events → UI bar
     → on complete: download from storage → Worker
  → <20MB: FileReader.readAsArrayBuffer → Worker (existing fast-path)

Streaming parser refactor:
  Current: decoder.decode(fullBuffer) → scan string char-by-char
  Proposed: process ArrayBuffer in 64KB slices via TextDecoder.decode(slice, {stream: true})
  → accumulate partial JSON objects in a rolling buffer (~1MB max)
  → emit complete performance objects as before
  → memory: O(chunkSize) instead of O(fileSize)
```

