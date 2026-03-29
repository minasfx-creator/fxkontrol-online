

## Plano: Correção de Bugs e Melhorias no Importador VVIZ

### Bugs Encontrados

**Bug 1 — Normalização de cor errada no fallback** (`vvizImporter.ts:99-104`)
`normalizeColorComponent` trata valores 0-1 como floats e multiplica por 255. VVIZ Finale 3D usa inteiros 0-255. Um drone com `r:1` (quase preto) vira `r:255` (vermelho máximo). O worker está correto, o fallback não.

**Bug 2 — Cor sem peso por frames** (`vvizImporter.ts:108-130`)
Seleciona a cor mais brilhante ignorando duração (`frames`). Um flash branco de 1 frame vence sobre azul sustentado de 500 frames. O worker usa `brightness * frames` corretamente.

**Bug 3 — `timeOffsetSecs` ignorado** (ambos: worker e importer)
Campo `vviz.timeOffsetSecs` nunca é aplicado — shows com offset temporal ficam dessincronizados.

**Bug 4 — Importação duplicada sem proteção** (`useProjectStore.ts:618`)
`batchImportVVIZ` appende ao estado existente. Reimportar o mesmo arquivo duplica todos os drones sem aviso.

**Bug 5 — Erros genéricos no catch** (worker e importer)
`catch {}` descarta a mensagem de erro real, dificultando diagnóstico.

---

### Correções

**Arquivo 1: `src/lib/vvizImporter.ts`**
- Substituir `normalizeColorComponent` por `normColor` (clamp255 direto, sem detecção float)
- Adicionar peso por `frames` na extração de cor (alinhar com worker)
- Aplicar `timeOffsetSecs` ao tempo acumulado dos waypoints
- Capturar `(e as Error).message` nos catches

**Arquivo 2: `src/lib/vvizWorker.ts`**
- Aplicar `timeOffsetSecs` ao tempo dos waypoints (passar como parâmetro para `processPerf`)
- Capturar `(e as Error).message` no catch genérico
- Adicionar validação de campos obrigatórios (`version`, `defaultPositionRate`)

**Arquivo 3: `src/components/editor/VVIZImporter.tsx`**
- Antes de importar, verificar se já existem posições `drone-pad` no projeto
- Se existirem, mostrar toggle "Substituir show atual" / "Adicionar ao show"
- Default: substituir (mais intuitivo)

**Arquivo 4: `src/store/useProjectStore.ts`**
- Adicionar action `replaceImportVVIZ` que limpa posições/trajetórias tipo `drone-pad` antes de importar
- Manter `batchImportVVIZ` para modo "adicionar"

### Arquivos modificados: 4

