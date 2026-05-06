# Auditoria de Rotas e Páginas — Rodada 1

Base: `src/App.tsx` (49 rotas) × `src/pages/` (43 arquivos `.tsx` + 3 subpastas).
Convenção: **KEEP** mantém · **MERGE** funde em outra · **DELETE** remove fisicamente.

---

## Páginas a DELETAR (10) — execução na Rodada 2

| Arquivo | Rota viva? | Referenciada em | Recomendação |
|---|---|---|---|
| `pages/AIChoreography.tsx` | ❌ (rota → `Navigate /ai-builder`) | nenhuma | **DELETE** |
| `pages/AccreditationDashboard.tsx` | ❌ | nenhuma | **DELETE** |
| `pages/SwarmGPT.tsx` | ❌ (rota → `Navigate /ai-builder`) | nenhuma | **DELETE** |
| `pages/Admin.tsx` | ❌ (rota → `Navigate /office?tab=compliance`) | só `prefetchRoutes.ts` | **DELETE** + limpar prefetch |
| `pages/Agenda.tsx` | ❌ (rota → `Navigate /office?tab=agenda`) | só `prefetchRoutes.ts` | **DELETE** + limpar prefetch |
| `pages/Training.tsx` | ❌ | só `prefetchRoutes.ts` | **DELETE** + limpar prefetch (substituída por TrainingCenter) |
| `pages/Dashboard.tsx` | ❌ | só `features/shared/index.ts` re-export | **DELETE** + limpar barrel |
| `pages/DevicePairing.tsx` | ❌ (substituída por wizards) | `FXKNetPanel.tsx` (re-export legado) | **DELETE** + limpar import |
| `pages/FieldTest.tsx` | ❌ | `pages/__tests__/FieldTest.shell.test.tsx`, `CommandCenter.tsx` | **MERGE** → `/dev/fxk16?tab=field-test` então **DELETE** |
| `pages/FXK16ValidatePage.tsx` | ✅ (rota redireciona p/ `/dev/fxk16?tab=validate`) | `App.tsx` | **DELETE** (rota fica como `Navigate` direto) |
| `pages/FXK16CalibrationPage.tsx` | ✅ (mesma situação) | `App.tsx` | **DELETE** (idem) |

Total: **10 deleções** + ajustes em `prefetchRoutes.ts`, `features/shared/index.ts`, `FXKNetPanel.tsx`, `CommandCenter.tsx`, `App.tsx`.

---

## Páginas a MANTER (33)

**Auth/Core:** `Auth`, `NotFound`, `Office`, `Index`, `CommandCenter`, `Strategy`, `TrainingCenter`, `FieldOps`, `Settings`, `NetworkSettings`, `PlatformStatus`, `AIBuilder`, `IOSReadiness`, `Install`, `RealDiscoveryProbe`, `VideoEditor`.

**Onboarding/Pairing:** `UsbPairingWizard`, `BlePairingWizard`, `PairingWizard`.

**Create flow:** `Create`, `create/CreateBlank`, `create/CreateTemplate`, `create/CreateGenerate`.

**Comercial/Public:** `Pricing`, `Landing`, `Manifesto`, `Comercial`, `PitchUS`, `Unsubscribe`, `CheckoutSuccess`.

**Legal:** `legal/Terms`, `legal/Refund`, `legal/Privacy`.

**Dev (12):** `dev/DesignSystemShowcase`, `dev/E2ETestPage`, `dev/EditorShellPreview`, `dev/EditorShellOnboardingDialog`, `dev/FXK16Hub`, `dev/GoldenShows`, `dev/ModuleRoster`, `dev/ReadinessAudit`, `dev/SkyCanvas2Demo`, `dev/SkyCanvas3DDemo`, `dev/SkyCanvasSmoke`, `dev/UE5BridgePage`.

---

## Rotas redundantes (redirects existentes — manter como compat)

- `/dashboard*`, `/agenda`, `/training`, `/admin`, `/accreditation`, `/joi` → `Navigate /office?tab=…`
- `/dev/fxk16-validate`, `/dev/fxk16-calibrate` → `Navigate /dev/fxk16?tab=…`
- `/dev/libertadores` → `Navigate /dev/golden-shows`
- `/swarmgpt`, `/ai-choreography` → `Navigate /ai-builder`
- `/agenda`, `/admin`, `/joi` etc.

**Adicionar na Rodada 2** (URLs antigas em circulação):
- `/dashboard` → `/office?tab=overview` (verificar se já existe)
- `/field-test` → `/field#field-test` (já existe, manter)
- `/pairing` (sem transport) → `/field#pairing` (já existe, manter)

---

## Métricas

- Páginas hoje: **43**
- Após Rodada 2: **33** (-23%)
- Rotas hoje: **49**
- Após Rodada 2: **49** (rotas mantidas como redirects p/ compat; só os imports/arquivos somem)
