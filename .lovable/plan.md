# Importar Show ANIVERSARIO_ANGRA + Exports completos (JSON / CSV / VVIZ)

## Objetivo
1. Adicionar o show **ANIVERSARIO_ANGRA** (do CSV anexado) como um **seed demo carregável** no editor, igual ao `festivalMainStageDemo`.
2. Garantir 3 botões de exportação completos a partir do show carregado: **JSON canônico**, **CSV Finale 3D (FIRING_HEADER/FIRING_DATA)** e **.VVIZ** (X/Y/Z/Heading).

> Os 3 arquivos anexados (.fir Access DB, .fin zip Finale, .csv firing-list) descrevem o **mesmo show**. O `.csv` é a fonte canônica legível (111 linhas, 109 cues, 2 posições P-01/P-02, módulos fireone_fm 01–04, ~3:30 de duração). `.fir` e `.fin` são binários proprietários e ficam fora de escopo de parse.

---

## O que será criado

### 1. Seed do show (parse do CSV → ShowPlan)
- **`scripts/build-aniversario-angra.mjs`** — script Node que lê o CSV anexado e gera:
  - **`src/data/demoShows/aniversarioAngra.generated.json`** — array de cues normalizado (time, posName, module, slat, pin, effectName, caliber, prefire, duration, x/y/z, vdl, notes).
- **`src/data/demoShows/aniversarioAngraDemo.ts`** — análogo a `festivalMainStageDemo.ts`:
  - `ANIVERSARIO_ANGRA_ID`, `ANIVERSARIO_ANGRA_DURATION_S` (≈ 220s, baseado no último `eventTime + duration`).
  - `buildAniversarioAngraShow(): ShowPlan` montando `positions` (P-01, P-02 a partir das coords X Y Z do CSV), `pyroCues` (1 por linha FIRING_DATA_ROW), `hardwareConfig` com 4 módulos `fireone_fm` (01–04), 32 pinos, slat=1.
  - `ANIVERSARIO_ANGRA_MANIFEST` com `provenance: 'pilot'` (vem de show real do usuário).

### 2. Registro no menu de Demos
- **`src/data/demoShows/index.ts`** (novo): exporta lista `DEMO_SHOWS` com `festivalMainStageDemo` + `aniversarioAngra`.
- **`src/components/editor/DemoShowMenu.tsx`** (novo): dropdown “Carregar Show Demo” na `Toolbar` do editor. Ao escolher, chama um helper que popula `useProjectStore` (positions, timelineItems convertidos do `pyroCues`, duration, projectName).

### 3. Exports completos unificados
Hoje existem peças separadas. Vou unificar em um único menu “**Exportar Show Completo**” no header do editor com 3 ações:

| Ação | Função usada | Arquivo |
|---|---|---|
| **JSON canônico** | nova `exportFullShowJSON(plan)` em `src/lib/exportEngine.ts` (serializa ShowPlan + timelineItems + positions + trajectories + droneFormations + metadata + versão de schema) | `<show>.fxk.json` |
| **CSV Finale 3D** | nova `exportFinaleFiringCSV(plan)` em `src/lib/exportEngine.ts` que emite cabeçalho `FIRING_HEADER_ROW` exato do anexo (28 colunas) + uma linha `FIRING_DATA_ROW` por pyroCue, montando a coluna `Coordinates` no formato `X Y Z h p r sx sy sz` com 6 casas decimais | `<show>.firing.csv` |
| **.VVIZ** | já existe `exportVVIZ(...)` (X/Y/Z/Heading) — apenas adicionar entrada no novo menu reusando `VVIZExportDialog` | `<show>.vviz` |

- **`src/components/editor/ExportShowMenu.tsx`** (novo): DropdownMenu com as 3 opções e ícones (`FileJson`, `FileSpreadsheet`, `Box`). Substitui/complementa o botão VVIZ isolado.

### 4. Testes mínimos
- **`src/data/demoShows/__tests__/aniversarioAngra.spec.ts`** — verifica: total de cues = 109, positions includes `P-01` e `P-02` com `x≈-49.15` e `x≈51.85`, módulos 01–04, duração coerente.
- **`src/lib/__tests__/exportFinaleFiringCSV.spec.ts`** — round-trip parse do CSV gerado tem mesmo número de linhas que o seed e cabeçalho idêntico ao do anexo.

---

## Arquivos tocados

**Criados**
- `scripts/build-aniversario-angra.mjs`
- `src/data/demoShows/aniversarioAngra.generated.json`
- `src/data/demoShows/aniversarioAngraDemo.ts`
- `src/data/demoShows/index.ts`
- `src/components/editor/DemoShowMenu.tsx`
- `src/components/editor/ExportShowMenu.tsx`
- `src/data/demoShows/__tests__/aniversarioAngra.spec.ts`
- `src/lib/__tests__/exportFinaleFiringCSV.spec.ts`

**Editados**
- `src/lib/exportEngine.ts` — adicionar `exportFullShowJSON` + `exportFinaleFiringCSV`.
- `src/components/editor/Toolbar.tsx` — montar `DemoShowMenu` + `ExportShowMenu` (remover botão VVIZ isolado se existir, ou reusar dialog dentro do novo menu).

## Fora de escopo
- Parse de `.fir` (MS Access Jet DB) e `.fin` (Finale ZIP) binários — fica para rodada futura.
- Importar o vídeo `TESTE_FINALE_drones.mp4` (sem pipeline de vídeo no editor hoje).
- Mudanças em safety/workMode/CommandBus — todos os exports rodam pela `ExportCoordinator` existente e respeitam readiness gates.
- Redesign visual — só novos componentes seguindo DS tokens (`ds-*`, `bg-background`, `border-border/30`).

## Riscos
- CSV usa caliber em milímetros (`44mm`) e polegadas (`3"`) misturado — o parser do script normaliza para mm (3" = 75mm).
- `Coordinates` do Finale tem 9 floats; só os 3 primeiros (X Y Z) são posicionais — heading vem da coluna `Angles` (vazia no CSV anexo, default 0).
- O VDL na coluna `Animation Description` é descritivo; mantido como string em `notes` (não re-parseado).
