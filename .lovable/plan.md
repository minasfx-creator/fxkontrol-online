## Adoção seletiva dos arquivos anexados

Diagnóstico rápido: dos 10 arquivos anexados, 6 já existem no repo em versão **igual ou superior** (não mexer). 4 são adições reais.

### O que NÃO vou tocar (regressão)
- `SkyCanvasMount.tsx` anexado — versão atual tem engine selectable + memo + fallback v2→legacy. Trocar quebra `pages/SkyCanvas.tsx`, `UE5BridgePage`, `VideoEditor`, `SkyCanvasLab` e a memória `mem://funcionalidades/skycanvas-mount-canonical`.
- `SkyCanvasLab.tsx` — idêntico ao do repo.
- `SkyCanvas-2.tsx` — é o legacy `@/components/editor/SkyCanvas` que o Mount já carrega.
- `SkyCanvas.smoke.test.tsx` — idêntico.
- `skyCanvasDiagnostics.ts` — idêntico.
- `skybrushExport.ts` (stub honesto) — permanece como exporter v1 com claim `marketing_hypothesis`.

### O que vou implementar

**1. `src/lib/skycanvasCapability.ts`** (novo, ~120 linhas, puro)
- Detecção `WebGPU / WebGL2 / SwiftShader / coarse pointer / reduced-motion / saveData` → `{ renderer, tier: low|mid|high, reasons[] }`.
- Hook fino `useSkyCapability()` (memoiza resultado por sessão).
- Plugar em `SkyCanvas2` para auto-tier: `tier=low` força `hideStars+stageVariant='minimal'+perfHud=false`; `tier=high` libera tudo. Override manual via query string preservado.
- Zero import de CommandBus/FieldBus/SafetyStateMachine (validado pelo guard `skycanvas.safetyImports.guard.spec.ts`).

**2. `src/lib/skycanvasAudioPeaks.ts`** (novo, ~70 linhas, puro)
- `decodeAudioPeaks(file, buckets=1024) → { durationSec, peaks: Float32Array }` via `AudioContext.decodeAudioData`.
- Wire em `TransportAndLanesLegacy`: input file `<input type="file" accept="audio/*">` no header da timeline → seta `peaks` (já é prop tipada `Float32Array | null`) e `duration` no `useProjectStore`.
- Cache do último `peaks` em memória (sessão), fora do store (Float32Array não serializa bem).
- Botão "Limpar áudio" para liberar referência.

**3. `src/lib/exporters/skycExporterV2.ts`** (novo, adaptado do upload de 676 linhas)
- Adicionar como **segundo exporter** ao lado de `skybrushExport.ts`. Não substituir.
- **Claim policy: `marketing_hypothesis`** (escolha do usuário "não validei ainda"):
  - `_FXK_DISCLAIMER.txt` obrigatório no ZIP.
  - `validation.json` inclui `claim: "marketing_hypothesis"` e `note: "Format mirrors Skybrush conventions; not validated against real importer"`.
  - `ClaimBadge` no UI marca como `pilot/marketing_hypothesis` (amber).
- Validações reais ativas (NFPA-style sanity): MAX_DRONES 500, MIN_SPACING 2m, MAX_ALT 120m, MAX_LATERAL 8m/s, MAX_VERTICAL 4m/s.
- Adapter `ShowPlan → SkycFile` no `src/lib/exporters/showPlanToSkyc.ts`.
- Botão "Export .skyc (v2 preview)" em `EditorExportMenu` ao lado do exporter v1.
- Atualizar memória `mem://funcionalidades/round3-pass2-skybrush-smoke` para refletir a coexistência v1/v2 ambos honest.

**4. Auditoria + montagem do `SkyCanvasDiagnosticsPanel`**
- `rg` para mapear onde está montado hoje (provavelmente só `editor/SkyCanvas.tsx` legacy).
- Garantir presença em `pages/SkyCanvas.tsx` (já usa `SkyCanvasMount` v2) — adicionar como overlay opcional via prop `children` do Mount.
- Sem mudar contratos, só adição.

### Testes
- `skycanvasCapability.test.ts`: jsdom mock de `matchMedia` + `getContext('webgl2')` → cobertura tier low/mid/high.
- `skycanvasAudioPeaks.test.ts`: smoke (mock `AudioContext`) — `peaks.length === buckets * 2`.
- `skycExporterV2.test.ts`: validação rejeita drones>500, altitude>120m, spacing<2m. ZIP contém `_FXK_DISCLAIMER.txt` + `show.json` + `validation.json` com `claim: marketing_hypothesis`.
- Guard `skycanvas.safetyImports.guard.spec.ts` deve continuar verde.

### Arquivos
**Criar:**
- `src/lib/skycanvasCapability.ts`
- `src/hooks/useSkyCapability.ts`
- `src/lib/skycanvasAudioPeaks.ts`
- `src/lib/exporters/skycExporterV2.ts`
- `src/lib/exporters/showPlanToSkyc.ts`
- `src/__tests__/skycanvasCapability.test.ts`
- `src/__tests__/skycanvasAudioPeaks.test.ts`
- `src/__tests__/skycExporterV2.test.ts`

**Editar:**
- `src/components/show3d/v2/SkyCanvas2.tsx` — consumir `useSkyCapability` para defaults adaptativos.
- `src/components/skycanvas/legacy-2604/TransportAndLanesLegacy.tsx` — input de áudio + wire dos peaks.
- `src/pages/SkyCanvas.tsx` — montar `SkyCanvasDiagnosticsPanel` como overlay condicional (dev-only ou via flag).
- `src/components/editor/EditorExportMenu.tsx` (ou equivalente) — botão "Export .skyc v2".
- `.lovable/memory/funcionalidades/round3-pass2-skybrush-smoke.md` + `mem://index.md` — refletir v1+v2 honest coexistindo.

### Garantias
- Zero impacto em Safety / CommandBus / FieldBus / workMode.
- Guard `skycanvas.safetyImports.guard.spec.ts` cobre os novos arquivos automaticamente (estão em `src/lib/`, fora do path vigiado, mas adiciono assertion explícita no teste do exporter v2).
- Vantablack + cyan-dessat preservados (nada de tema novo).
- Claim badge `marketing_hypothesis` impede over-promise em vendas.
