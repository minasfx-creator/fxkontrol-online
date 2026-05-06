## Objetivo
Adicionar tab **FXK32Q** em `/field` (FieldOps) que aparece somente quando:
- (a) o adapter `fxk32qModuleAdapter` foi promovido a LIVE-RO via `discoveryRegistryBridge` (handshake `MODEL:FXK32Q;CH:32` em qualquer dos 6 transports), **OU**
- (b) a flag `fxk.flag.fxk32q_fieldops` está ON (override pra preflight em bancada).

Mesma política do tab FireOne XL4-3 já existente.

---

## Mudanças

### 1. Feature flag
**`src/lib/featureFlags.ts`** — adicionar (logo após `isFireOneXL43RealOpsEnabled`):
```ts
export function isFxk32qFieldOpsEnabled(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const v = window.localStorage.getItem('fxk.flag.fxk32q_fieldops');
      if (v === '1' || v === 'true') return true;
      if (v === '0' || v === 'false') return false;
    } catch {}
  }
  return false;
}
```

### 2. Controller kind `fxk32q`
**`src/core/discovery/controllerRegistry.ts`** — único arquivo que decide `profile.kind`:
- Adicionar `'fxk32q'` ao tipo `ControllerKind`.
- Adicionar profile:
  ```ts
  fxk32q: {
    kind: 'fxk32q',
    label: 'FXK32Q 32ch Pyro Controller',
    capabilities: { arm:true, fire:true, eStop:true, safetyCritical:true },
    consoleRoute: '/field#fxk32q',
  }
  ```
- Adicionar regra **antes** das regras `fxk16` (mais específica primeiro):
  ```ts
  { test: /fxk[\s-]*32q?|ifmx[\s-]*i32q/i, kind: 'fxk32q' }
  ```

Sem essa mudança, `useActiveControllers().controllers.some(c => c.profile.kind === 'fxk32q')` é sempre falso e a tab nunca aparece (gap real).

### 3. Painel da tab
**Novo `src/components/field/FXK32QFieldPanel.tsx`** (~110 linhas, espelho do `FXK16FieldPanel`):
- Header: `Cable` icon, título "FXK32Q — 32ch Relay Module", descrição do ESP32-S3 + 2×16-relay e dos 6 transports.
- Status strip simples (LINK / MODEL / FW) lendo `useFXK32QBridge().status`.
- Embed do `FXK32QControlPanel` existente (`@/components/dev/fxk32q/FXK32QControlPanel`) — já tem connect/ARM/Hold-1s/E-STOP.
- Bloco "Operation" com regras (mapeamento 1:1 ch 1..32, hold-to-confirm, auto-disarm em link loss, comando real só via uiCommandGateway).
- Botão "FXK32Q Hub →" linkando `/dev/fxk32q?tab=adapter` *quando* o hub existir; até lá, link "Real Discovery →" pra `/dev/real-discovery`.

Nada toca `uiCommandGateway`/`SafetyStateMachine`/`workMode`.

### 4. Wiring em FieldOps
**`src/pages/FieldOps.tsx`**:
- Import: `isFxk32qFieldOpsEnabled` + `lazy(() => import('@/components/field/FXK32QFieldPanel'))`.
- `TabKey` += `'fxk32q'`.
- `ALL_TABS` ganha entrada `{ key:'fxk32q', label:'FXK32Q', sub:'PYRO 32CH', icon: Cable }` posicionada **entre `fxk16` e `fireone`**.
- Visibilidade:
  ```ts
  const fxk32qOnline  = controllers.some(c => c.profile.kind === 'fxk32q');
  const fxk32qVisible = isFxk32qFieldOpsEnabled() || fxk32qOnline;
  const TABS = ALL_TABS.filter(t =>
       (t.key !== 'fireone' || fireoneVisible)
    && (t.key !== 'fxk32q'  || fxk32qVisible)
  );
  ```
- `useEffect` snap-away se ficar invisível (mesmo padrão do FireOne).
- Render: `{tab === 'fxk32q' && fxk32qVisible && <FXK32QFieldPanel />}`.

### 5. Testes
**Novo `src/__tests__/fieldOpsFxk32qTab.spec.tsx`** (~60 linhas, vitest+RTL):
- Sem flag e sem controller → tab "FXK32Q" **não** está no DOM.
- Flag ON (mock `localStorage` antes do render) → tab visível.
- Mock `useActiveControllers` retornando `[{ profile:{ kind:'fxk32q', ... } }]` → tab visível.
- Tab visível mas adapter offline → ARM/FIRE do `FXK32QControlPanel` desabilitados (já vem do componente existente — só smoke check).

**Novo `src/__tests__/controllerRegistry.fxk32q.spec.ts`** (~40 linhas):
- `resolveControllerProfile({ links:{ 'serial-usb':{ family:'FXK32Q' }}, ... })` → `kind:'fxk32q'`.
- Variantes: `'fxk-32'`, `'fxk32q'`, `'IFMx-i32Q'`, `'fxk 32 q'` → todas mapeiam.
- `'fxk-16'` continua mapeando pra `'fxk16'` (não regride).

---

## Arquivos
**Criados (3)**: `src/components/field/FXK32QFieldPanel.tsx`, `src/__tests__/fieldOpsFxk32qTab.spec.tsx`, `src/__tests__/controllerRegistry.fxk32q.spec.ts`.
**Editados (3)**: `src/lib/featureFlags.ts`, `src/core/discovery/controllerRegistry.ts`, `src/pages/FieldOps.tsx`.

## Critérios de aceite
- `/field` sem flag e sem hardware: tabs `pairing · fxk16 · fireone? · field-test · mobile-link` (sem fxk32q).
- `localStorage.setItem('fxk.flag.fxk32q_fieldops','1')` + reload: tab `FXK32Q` aparece e renderiza painel completo (connect / ARM / Hold-1s / E-STOP).
- Quando `discoveryRegistryBridge` promove o adapter (handshake real ou emulator), tab aparece sem precisar da flag — graças ao novo `kind:'fxk32q'` em `controllerRegistry`.
- Snap-away: se controller cair e flag estiver OFF estando na tab fxk32q, FieldOps redireciona pra `pairing`.
- Zero alteração em `uiCommandGateway`, `SafetyStateMachine`, firmware, `workMode`, ou no `FXK32QControlPanel` (reusado as-is).
- Suíte verde + 2 specs novos passam.

## Fora de escopo (próximos rounds)
- `/dev/fxk32q` Hub + DevIndex card.
- Remoção de mocks no `MobileLinkMode` (Math.random/hwSimulated).
- Auditoria honesty dos 8 painéis em `live-firing/`.
- Correção dos `consoleRoute: '/studio?panel=...'` legacy.
