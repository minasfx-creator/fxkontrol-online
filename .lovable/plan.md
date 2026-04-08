

# Ciclo #37 — Catalog Import Bug Fixes & Conformidade Finale 3D

## Bugs Identificados

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **handleReparse ignora mapeamento do usuário** — Chama `parseCatalogFile(rawText)` que usa auto-detect interno. Depois sobrescreve `result.columns[i].mappedTo` com as escolhas do usuário, mas os `result.effects` já foram parseados com os mapeamentos auto-detectados. O re-parse com mapeamento manual **não funciona** | `CatalogImportDialog.tsx` L85-96 | Crítico — botão Re-parse não aplica mudanças do usuário |
| 2 | **CSV parser não suporta campos entre aspas com delimitador** — `lines[i].split(delimiter)` quebra `"Red, Green"` em dois campos quando delimiter=`,`. Catálogos Finale 3D reais usam CSV RFC 4180 com aspas | `catalogImporter.ts` L242, L257 | Alto — importação de catálogos reais falha |
| 3 | **FIELD_OPTIONS desatualizado** — Dialog UI tem 15 campos mapeáveis, mas `COLUMN_ALIASES` agora tem 7 campos novos (fuseDelay, devices, exNumber, ceNumber, unNumber, subtype, rackType) que não aparecem no dropdown | `CatalogImportDialog.tsx` L21-37 | Médio — campos Finale não podem ser mapeados manualmente |
| 4 | **`__customEffects` no window é dead code** — Armazenado mas nunca lido em lugar nenhum. Ocupação de memória sem propósito | `CatalogImportDialog.tsx` L117-120 | Baixo — código morto |
| 5 | **effectLibraryMap cache invalidation frágil** — Usa `_map.size !== EFFECT_LIBRARY.length` mas se um efeito é removido e outro adicionado (same length), cache não invalida | `effectLibraryMap.ts` L8 | Baixo — edge case raro |
| 6 | **`calculatePFT` é wrapper trivial** — Após Ciclo #36, `calculatePFT(caliber)` apenas chama `getLiftTime(parseInt(caliber))`. Função desnecessária, adiciona indireção | `exportEngine.ts` L355-360 | Baixo — clareza de código |

## Plano de Implementação

### Arquivo 1: `src/lib/catalogImporter.ts`

**Fix 2 — CSV RFC 4180 parser:**
- Adicionar função `parseCSVLine(line: string, delimiter: string): string[]` que respeita campos entre aspas (handles `"field with, comma"`, `"field with ""escaped"" quotes"`)
- Substituir `lines[0].split(delimiter)` e `lines[i].split(delimiter)` por chamadas a `parseCSVLine`
- Aplicar em L242 e L257

**Nova export: `parseCatalogFileWithMappings(text, mappings)`:**
- Variante de `parseCatalogFile` que aceita um array de `CatalogColumnMapping[]` como override
- Se `mappings` fornecido, usa esses mapeamentos em vez do auto-detect
- Isso resolve o bug #1 sem alterar a API existente

### Arquivo 2: `src/components/editor/CatalogImportDialog.tsx`

**Fix 1 — handleReparse com mapeamentos do usuário:**
- Importar `parseCatalogFileWithMappings` e usar no handleReparse passando `columns` atuais
- Resultado: re-parse agora aplica as seleções manuais do usuário

**Fix 3 — FIELD_OPTIONS completo:**
- Adicionar 7 entradas novas ao FIELD_OPTIONS:
  - `fuseDelay` → "Fuse Delay (s)"
  - `devices` → "Devices / Chain Count"
  - `exNumber` → "EX Number"
  - `ceNumber` → "CE Number"
  - `unNumber` → "UN Number"
  - `subtype` → "Subtype"
  - `rackType` → "Rack Type"

**Fix 4 — Remover dead code `__customEffects`:**
- Eliminar linhas 117-120 (window.__customEffects)

### Arquivo 3: `src/data/effectLibraryMap.ts`

**Fix 5 — Cache invalidation robusta:**
- Adicionar `_version` counter que é incrementado quando efeitos são adicionados
- Ou simplesmente usar um `_lastLength` check + rebuild se EFFECT_LIBRARY was mutated (trocar size check por rebuild sempre que `_map` exists but length differs OR any ID lookup misses)

### Arquivo 4: `src/lib/exportEngine.ts`

**Fix 6 — Inline calculatePFT:**
- Substituir `calculatePFT(caliber)` por `getLiftTime(parseInt(caliber) || 0)` inline em L379
- Remover a função `calculatePFT` (L355-360)

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | CSV RFC 4180 parser + parseCatalogFileWithMappings (catalogImporter.ts) |
| 2 | Fix handleReparse + FIELD_OPTIONS + remove dead code (CatalogImportDialog.tsx) |
| 3 | Cache invalidation fix (effectLibraryMap.ts) |
| 4 | Inline calculatePFT (exportEngine.ts) |
| 5 | Build verification |

