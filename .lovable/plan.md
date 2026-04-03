

## Diagnóstico: Relatório Técnico vs. Estado Real do Codebase

O relatório é extenso mas muitas das suas recomendações **já estão implementadas** ou são irrelevantes para a arquitetura atual. Aqui está o mapeamento preciso:

### O que JÁ EXISTE (superior ao proposto)

| Recomendação do Relatório | Estado Atual | Ficheiro |
|---|---|---|
| InstancedMesh (abolir mesh iterativo) | **Implementado** — 6x InstancedMesh PBR + tri-tier LOD | `InstancedDroneSwarm.tsx`, `droneLOD.ts` |
| Web Worker para VVIZ (off-main-thread) | **Implementado** — ArrayBuffer + streaming por drone via postMessage | `vvizWorker.ts` (280 linhas) |
| Tabela VDL 25 cores com impliesTrail | **Implementado** — 25 cores canónicas + extensões | `vdlParser.ts` (linhas 92-136) |
| useRef + useFrame (sem setState no loop) | **Implementado** — em ambos os renderers | `InstancedDroneSwarm.tsx`, `SwarmPlaybackEngine.tsx` |
| instanceMatrix.needsUpdate + instanceColor | **Implementado** — em todos os InstancedMesh | Múltiplos ficheiros |
| Zero-GC com objetos estáticos | **Implementado** — `_O`, `_C`, `_M` pré-alocados | `SwarmPlaybackEngine.tsx`, `droneLOD.ts` |

### O que NÃO EXISTE (lacunas reais)

| Lacuna | Impacto | Complexidade |
|---|---|---|
| **1. RGB→VDL Euclidean Quantizer para exportação** | Cores perdem-se ao exportar para Finale 3D | Média |
| **2. Streaming JSON Parser no Worker** (atualmente usa `JSON.parse()` monolítico) | OOM em ficheiros VVIZ >100MB com 2000+ drones | Alta |
| **3. Coordinate frame transform (VVIZ→Three.js Z-flip)** | Trajetórias espelhadas em Z quando `coordinateFrame` difere | Baixa |
| **4. VVIZ Export pipeline** (não existe nenhum exportador) | Impossível exportar coreografias para Finale 3D | Alta |

### Plano de Implementação — 3 Módulos Cirúrgicos

---

**Módulo 1: RGB→VDL Euclidean Quantizer** (`src/lib/vdlQuantizer.ts`)

Criar função `rgbToNearestVdl(r, g, b)` que:
- Importa a tabela `VDL_COLORS_TABLE` do `vdlParser.ts` existente
- Calcula distância Euclidiana no espaço RGB normalizado (0-1) contra as 25 cores canónicas
- Retorna `{ name: string, hex: string, impliesTrail: boolean }`
- Função `rgbToVdlString(r, g, b, noTrail?: boolean)` que gera a string VDL completa (e.g., `"Gold No Trail"`)

Expor ambas para uso futuro pelo exportador VVIZ e por qualquer componente que precise mapear cores arbitrárias para o vocabulário Finale 3D.

---

**Módulo 2: Streaming JSON no vvizWorker** (modificar `src/lib/vvizWorker.ts`)

Substituir o `JSON.parse()` monolítico (linha 201) por parsing incremental:
- Usar um SAX-style JSON tokenizer leve (implementado inline, ~80 linhas, sem dependência externa) que processa o ArrayBuffer em chunks de 64KB
- Emite cada `performance` individual assim que o `}` de fecho é detectado
- Mantém memória O(1) — cada drone é processado e enviado via `postMessage` antes de avançar
- Fallback: se o ficheiro for <5MB, manter `JSON.parse()` como fast-path (já funciona bem para shows pequenos)

---

**Módulo 3: Coordinate Frame Guard** (modificar `src/lib/vvizWorker.ts`)

Na função `processPerf()` (linha 115), após acumular `x += s.dx; y += s.dy; z += s.dz`:
- Ler `coordinateFrame` do cabeçalho VVIZ
- Se ausente ou `"standard"`: aplicar `z = -z` para converter de VVIZ (Z-forward) para Three.js (Z-toward-viewer)
- Se `"threejs"` ou `"opengl"`: sem transformação
- Aplicar a mesma lógica ao `homeZ`

---

### Ficheiros a criar/modificar

1. **Criar** `src/lib/vdlQuantizer.ts` — Quantizador Euclidiano RGB→VDL
2. **Modificar** `src/lib/vvizWorker.ts` — Streaming parser + coordinate frame guard

### Fora de Escopo (para iteração futura)
- **VVIZ Export pipeline completo** — requer decisão de formato e UI de exportação
- **TUS resumable upload** — requer mudança no `VVIZImporter.tsx` e integração com Supabase Storage
- **Edge Function streaming** — o Worker atual no frontend já resolve o problema de parsing; mover para Edge Function é uma otimização de segundo nível

### Proteções
- `InstancedDroneSwarm.tsx` — intacto
- `SwarmPlaybackEngine.tsx` — intacto
- `vdlParser.ts` — intacto (apenas importado pelo novo quantizer)
- Zustand stores — intactos
- Google APIs — intactas

