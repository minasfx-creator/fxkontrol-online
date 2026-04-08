

# Ciclo #36 — Conformidade 100% com Manual Finale 3D (MANUAL_FINALE-19)

## Dados Extraídos do Manual

| Seção Manual | Dado-Chave | Gap no FXK |
|---|---|---|
| **Tabela 2 (p.37)** | Prefire para shells = break time, NÃO afeta apex height. Prefire para cakes (blank/0) = auto-calculate lift time do primeiro sub-shell. Prefire para comets/mines = "não afeta simulação, mas afeta timing do script" | ✅ Já implementado em `getTypedPrefire` |
| **Tabela 2 (p.37)** | Duration para shells = star lifetime. Duration para cakes = "primeiro lançamento até último break". Duration para comets/mines = star lifetime | ✅ Já implementado em `getTypedDuration` |
| **Tabela 2 (p.37)** | Height para shells = "altura do vértice da trajetória em metros". Para comets: "Para fazer cometas ultrarrápidos/laser, configure altura alta e duração pequena" | Comets sem lógica de ultra-fast (height alto + duration baixo) |
| **Importação (p.30)** | Colunas Finale: `HeightMeters` (internal: `heightMeters`), `PreFire` (internal: `internalDelay`), `Devices` (internal: `numDevices`), `FuseDelay` (internal: `fuse`), `SafetyDistanceMeters` (internal: `safetyDistance`), `ExNumber`, `CeNumber`, `UnNumber`, `RackType`, `Subtipo` | `catalogImporter.ts` COLUMN_ALIASES faltam vários: `height_meters`, `internal_delay`, `num_devices`, `ex_number`, `ce_number`, `un_number`, `fuse`, `subtipo` |
| **Importação (p.30)** | Tipo Finale: `shell, comet, mine, cake, candle, other effect, single shot, ground, rocket, flame, not an effect, rack, sfx, light` | `PART_TYPE_MAP` falta: `other effect`, `not an effect`, `proyectiles/shells` (Finale Inventory variant) |
| **Cadenas (p.47-50)** | `Devices` = número de shells na cadeia. `chainsCountAsOne` config. Preço pode ser por cadeia ou por shell | `catalogImporter` não importa `numDevices`, `fuseDelay`, `exNumber`, `ceNumber`, `unNumber` |
| **Prefire Cake (p.34)** | Prefire 0.3s em cake aérea 3" → breaks at 0.3s = "parece um géiser" (RUIM). Blank/0 = auto-calculate correto | ✅ `getCakePrefire` já clamp com `liftTime * 0.7` |
| **Export PFT (exportEngine)** | `calculatePFT` usa hardcoded table {2:1.2, 3:1.8...} em vez de `getLiftTime()` da pyroPhysics — duplicação e desalinhamento | Bug: devia usar `getLiftTime` |

## Bugs & Gaps

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **catalogImporter missing Finale column aliases** — Faltam: `height_meters`, `heightmeters`, `internal_delay`, `internaldelay`, `num_devices`, `numdevices`, `ex_number`, `ce_number`, `un_number`, `fuse`, `subtipo`, `subtype`, `rack_type` | `catalogImporter.ts` L14-28 | Importação de catálogos Finale ignora colunas |
| 2 | **catalogImporter missing Finale Inventory type names** — `proyectiles`, `other`, `not an effect`, `otro efecto`, `no coreografiado` não mapeados | `catalogImporter.ts` L32-61 | Tipos incorretos para catálogos Finale Inventory |
| 3 | **catalogImporter não importa campos extras** — `fuseDelay`, `exNumber`, `ceNumber`, `unNumber`, `devices`, `subtipo` não são capturados nem passados para o Effect | `catalogImporter.ts` L80-97, L240-260 | Metadados Finale perdidos |
| 4 | **exportEngine.calculatePFT duplica pyroPhysics** — Hardcoded lookup table em vez de usar `getLiftTime()` | `exportEngine.ts` L354-362 | Valores desalinhados com física calibrada |
| 5 | **catalogToEffects height fallback simplista** — `caliber * 20` é uma fórmula arbitrária. Deveria usar `getBreakHeight()` de pyroPhysics | `catalogImporter.ts` L270 | Alturas de importação erradas vs tabela física |
| 6 | **Comet "ultra-fast" behavior missing** — Manual diz "Para fazer cometas ultrarrápidos, configure altura alta e duração pequena". Não há lógica que detecte isso e ajuste a velocidade de saída | `vdlParser.ts` / `pyroPhysics.ts` | Cometas laser impossíveis de criar |

## Plano de Implementação

### Arquivo 1: `src/lib/catalogImporter.ts`

**Fix 1 — Adicionar aliases Finale (L14-28):**
- `height`: adicionar `'height_meters'`, `'heightmeters'`, `'medidores_de_altura'`, `'effect_height'`
- `prefire`: adicionar `'internal_delay'`, `'internaldelay'`, `'pre_fire_time'`, `'prefire_time'`
- Novo campo `fuseDelay`: `['fuse_delay', 'fuse', 'fusedelay', 'visco_delay']`
- Novo campo `devices`: `['devices', 'numdevices', 'num_devices', 'chain_devices']`
- Novo campo `exNumber`: `['ex_number', 'exnumber']`
- Novo campo `ceNumber`: `['ce_number', 'cenumber']`
- Novo campo `unNumber`: `['un_number', 'unnumber', 'material']`
- Novo campo `subtype`: `['subtipo', 'subtype', 'effect_subtype', 'sub_type']`
- Novo campo `rackType`: `['rack_type', 'racktype']`

**Fix 2 — Adicionar tipos Finale Inventory (L32-61):**
- `'other effect'` → `'sfx'`
- `'other'` → `'sfx'` (Finale Inventory variant)
- `'not an effect'` → `'marker'` (need to add 'marker' to PartType or map to 'sfx')
- `'proyectiles'` → `'shell'` (Spanish Finale Inventory)
- `'otro efecto'` → `'sfx'`
- `'no coreografiado'` → `'sfx'`
- `'pasteles'` → `'cake'`
- `'velas'` → `'candle'`
- `'minas'` → `'mine'`
- `'cometas'` → `'comet'`
- `'cohetes'` → `'rocket'`
- `'llamas'` → `'flame'`
- `'tierra'` → `'ground'`
- `'bastidor'` → `'sfx'` (rack)

**Fix 3 — ParsedCatalogEffect + Effect extras (L80-97, L240-260):**
- Adicionar `fuseDelay`, `devices`, `exNumber`, `ceNumber`, `unNumber`, `subtype` a `ParsedCatalogEffect`
- Capturar esses campos no parsing CSV e XML
- Passar `fuseDelay` e `devices` para a conversão `catalogToEffects`

**Fix 4 — catalogToEffects height fallback (L270):**
- Trocar `caliber ? caliber * 20 : undefined` por `caliber ? getBreakHeight(caliber) : undefined`
- Importar `getBreakHeight` de pyroPhysics

### Arquivo 2: `src/lib/exportEngine.ts`

**Fix 5 — Eliminar calculatePFT duplicado (L354-362):**
- Trocar `calculatePFT(caliber)` por `getLiftTime(parseInt(caliber))` de pyroPhysics
- Remover a função `calculatePFT` inteira
- Importar `getLiftTime` de pyroPhysics

### Arquivo 3: `src/lib/vdlParser.ts`

**Fix 6 — Comet ultra-fast detection (~L700):**
- Após aplicar adjustments, se `partType === 'comet'` e `height > 80` e `duration < 0.8`:
  - Multiplicar `breakSpeed` por `1.8` (laser comet velocity)
  - Adicionar modifier `'laser'` se não presente

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | catalogImporter: aliases + types + campos extras + height fix |
| 2 | exportEngine: eliminar calculatePFT duplicado |
| 3 | vdlParser: comet ultra-fast |
| 4 | Build verification |

