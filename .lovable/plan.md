## Objetivo
Criar `/dev/fxk32q` como hub dev unificado pro FXK32Q (32ch ESP32-S3), com 2 tabs: **CONTROL** (painel de bancada já existente) e **SNAPSHOT** (read-only do adapter). Padrão idêntico ao `/dev/fxk16` (deep-link `?tab=`, lazy-load, sem mutação de workMode).

## Mudanças

### Novo: `src/pages/dev/FXK32QHub.tsx`
Shell idêntico ao `FXK16Hub`:
- `useSearchParams` → `tab=control|snapshot` (default `control`).
- Tabs: CONTROL (icon `Zap`, sub "BENCH") + SNAPSHOT (icon `Activity`, sub "READ-ONLY").
- Lazy import: `FXK32QControlPanel` (já existe) + `FXK32QAdapterPanel` (novo).
- Paleta cyan-dessat canônica (`hsl(190 70% 58%)`) — não copia o laranja do FXK16Hub (rejeitado por memory Design Decision Priority).

### Novo: `src/components/dev/fxk32q/FXK32QAdapterPanel.tsx`
Painel **read-only** (zero comando, zero mutation):
- Importa `fxk32qModuleAdapter` (singleton já exportado).
- `useEffect` polling 1s: `getSnapshot()` + `getProvenance()` + `getCapabilities()` + `runDiagnostics()` + `getState()`.
- Usa `useRef<NodeJS.Timeout>` p/ timer (clear on unmount — Core memory).
- Layout DS:
  - Header: `label`, `deviceId`, `firmwareModel`, `compatibleWith`, badge connection state (`ds-status-ok` quando online, `ds-status-warn` se simulação, `ds-status-fail` se disconnected).
  - Provenance card: `ProvenanceBadge` + `last_seen_at` + `data_freshness_ms` + `transport`.
  - Metrics grid 2×3: total/healthy/faults/ok/open/short.
  - Capabilities chips: `protocols[]` enumerados + read/write/diagnose/telemetry flags.
  - Diagnostics box: lista de `issues` ou green-check "all clear".
  - Channel matrix 4×8: cor por `continuity` (ok=green/open=amber/short=red/unknown=neutral) com tooltip de `resistance_ohms`.
- Banner amber se `getProvenance().is_simulated` (memory Honesty Layer).

### Editar: `src/App.tsx`
Adicionar lazy import + 2 rotas (logo abaixo de `/dev/fxk16`):
```tsx
const FXK32QHub = lazy(lazyRetry(() => import("./pages/dev/FXK32QHub")));
// ...
<Route path="/dev/fxk32q" element={<FXK32QHub />} />
<Route path="/dev/fxk32" element={<Navigate to="/dev/fxk32q" replace />} />
```
(O legacy `/dev/fxk32` já estava previsto mas nunca registrado — redirect evita 404.)

### Editar: `src/pages/dev/DevIndex.tsx`
Adicionar card no grupo Hardware logo abaixo do FXK16:
```ts
{ to: '/dev/fxk32q', title: 'FXK32Q Hub', desc: '32ch ESP32-S3 — bench control + adapter snapshot', Icon: Zap, status: 'LIVE' }
```

### Novo test: `src/__tests__/fxk32qHub.smoke.spec.tsx`
RTL smoke (~40 linhas):
- Render `<FXK32QHub />` com `MemoryRouter initialEntries={['/dev/fxk32q']}`.
- Assert: ambos botões "CONTROL" e "SNAPSHOT" no DOM.
- Click SNAPSHOT → URL muda pra `?tab=snapshot` e `FXK32QAdapterPanel` monta (await `findByText` de label do adapter, ex: "FXK32Q — 32ch").
- Click CONTROL → volta pro painel de controle.
- Sem mutação de workMode/SafetyStateMachine: spy em `safetyStateMachine.transition` confirma 0 calls.

### Editar: `src/__tests__/mocksErradicated.guard.spec.ts`
Adicionar `FXK32QAdapterPanel.tsx` ao array `FILES` (proibir `MOCK_/FAKE_/SIMULATED_DATA/mockData/fakeData`).

## Arquivos
**Novos (3)**: `src/pages/dev/FXK32QHub.tsx`, `src/components/dev/fxk32q/FXK32QAdapterPanel.tsx`, `src/__tests__/fxk32qHub.smoke.spec.tsx`.
**Editados (3)**: `src/App.tsx`, `src/pages/dev/DevIndex.tsx`, `src/__tests__/mocksErradicated.guard.spec.ts`.

## Critérios de aceite
- `/dev/fxk32q` carrega sem 404 (cobre `routesNo404.guard`).
- Tab CONTROL renderiza `FXK32QControlPanel` existente (sem regressão).
- Tab SNAPSHOT mostra dados reais do `fxk32qModuleAdapter` (snapshot/provenance/diagnostics) — sem mocks, sem `Math.random`, sem comandos.
- Polling 1s tem teardown limpo (sem leak).
- Smoke + guard verdes.

## Fora de escopo
- Telemetry write-back / firing pelo SnapshotPanel (read-only).
- Substituir o ControlPanel existente.
- Tabs adicionais (Calibrate/E2E) — futuras rondas.
