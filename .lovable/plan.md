# Implantação 100% — Roadmap, Limpeza & Reorganização

Você pediu "tudo em sequência", "deletar páginas antigas" e "todo hardware no roadmap". Vou executar em **3 rodadas separadas**, com você aprovando entre elas. Esta aprovação cobre só a **Rodada 1**; rodadas 2 e 3 voltam pra revisão.

Sobre "criar nova pasta atualizada do projeto": **não vou duplicar o repositório** (quebra git, CI, Lovable Cloud, memórias e 1000+ tests). O que faz sentido é reorganizar `src/` in-place — feito na Rodada 3.

---

## Rodada 1 — Roadmap mestre + auditoria (esta entrega)

### 1.1 `docs/ROADMAP_MASTER.md`
Documento único cruzando estado real (do código + memórias) com pendências até produção. Estrutura:

- **Status atual** por subsistema, com checklist verificável (arquivo/teste que prova):
  - Safety core (uiCommandGateway, SSM, GlobalEStop, BlackBox, P0 hardening) — ✅
  - WorkMode 3-mode + Phase 1/2 gates — ✅
  - FXK16 firmware + bridge + commandApi + sync — ✅
  - FXK32Q firmware v1.1 + adapter + bridge + diagnose CLI — ✅
  - Discovery multi-transport + portRegistry + auto-fallback — ✅
- **Hardware roadmap completo** (todo o projeto, conforme você escolheu):
  | Família | Firmware | Adapter | Discovery | Bridge UI | Field-tested |
  |---|---|---|---|---|---|
  | FXK16 | ✅ | ✅ | ✅ | ✅ | parcial |
  | FXK32Q ESP32 | ✅ v1.1 | ✅ | ✅ | ✅ | ❌ |
  | FXK XL4 Gateway | rascunho .ino | ❌ | ❌ | ❌ | ❌ |
  | FXK M1 | rascunho .ino | ❌ | ❌ | ❌ | ❌ |
  | Showven Sonicboom/SPARKULAR/PyroAdaptor | mem ref | parcial | ✅ ArtPoll | parcial | ❌ |
  | FireOne FXK-PYRO 2.0 | ext | ✅ | ✅ | ✅ | parcial |
  | FX Commander Pro (PBUS) | ext | parcial | parcial | parcial | ❌ |
  | CubeMesh RE168 | ext | parcial | parcial | parcial | ❌ |
  | Tuya outlets (BLE/Wi-Fi) | ext | ✅ | ✅ | ✅ | ❌ (banido p/ pyro) |
  | Skybrush drones | ext | export ✅ | n/a | parcial | ❌ |
  | Maiman lasers 16/39CH | mem ref | ❌ | parcial DMX | ❌ | ❌ |
  | DMX/Art-Net/sACN nexus | n/a | ✅ | ✅ | ✅ | parcial |
  | Radio CC1101/SX127x | ext | rascunho | ❌ | ❌ | ❌ |

- **Fases até 100%**:
  - **Fase 0** Readiness audit (✅ pronto, /dev/readiness-audit)
  - **Fase 1** Golden show simulado completo (✅ Libertadores+Maracanã)
  - **Fase 2** Hardware-sync simulado (✅ gate pronto)
  - **Fase 3** Bench-test físico FXK16+FXK32Q (pendente — checklist no doc)
  - **Fase 4** Integração XL4 Gateway + M1 (pendente — firmware p/ produção, adapter, discovery, bridge)
  - **Fase 5** Field-test full stack com FireOne + Showven em sítio fechado (pendente)
  - **Fase 6** Show real autorizado (pendente — depende de Fase 5 verde + oath produção)

- **Critério "100%"**: tabela hardware toda ✅ + Fases 0-6 verdes + 0 testes vermelhos + safety blackbox íntegra.

### 1.2 `docs/ROUTE_AUDIT.md`
Auditoria das 43 páginas em `src/pages/` × 49 rotas em `App.tsx`. Para cada página: rota(s) ativa(s), referências externas, recomendação (KEEP / MERGE / **DELETE**). Achados preliminares já confirmados:

- **Órfãs (zero referência fora do próprio arquivo):** `AIChoreography.tsx`, `AccreditationDashboard.tsx`, `SwarmGPT.tsx` → DELETE
- **Só referenciadas em `prefetchRoutes.ts`** (sem rota viva): `Admin.tsx`, `Agenda.tsx`, `Training.tsx` → DELETE + limpar prefetch
- **Substituídas por `Office` tabs** (rotas viraram `Navigate`): `Dashboard.tsx` → DELETE
- **Substituídas por wizards específicos**: `DevicePairing.tsx`, `FieldTest.tsx`, `FXK16ValidatePage.tsx`, `FXK16CalibrationPage.tsx` → MERGE em `/dev/fxk16` + DELETE
- **Manter:** Auth, NotFound, Office, Index, CommandCenter, Strategy, TrainingCenter, FieldOps, Settings, NetworkSettings, PlatformStatus, AIBuilder, IOSReadiness, Install, Pairing wizards (USB/BLE/genérico), RealDiscoveryProbe, Pricing, Landing, Manifesto, Comercial, PitchUS, Unsubscribe, CheckoutSuccess, VideoEditor, Create+3 subs, legal/3, dev/12.

Total proposto p/ Rodada 2: **~10 páginas deletadas**, ~6 redirects/imports limpos.

### 1.3 Atualização do diagrama
Atualizar `FXK_System_Status_Report.mmd` e `FXKontrol_Module_Dependencies.mmd` (em `/mnt/documents/`) refletindo o estado pós-roadmap.

---

## Rodada 2 — Limpeza de rotas e páginas (após você aprovar Rodada 1)

- Deletar fisicamente as ~10 páginas marcadas DELETE.
- Remover imports lazy correspondentes em `src/App.tsx`.
- Limpar `src/lib/prefetchRoutes.ts`.
- Adicionar redirects 301-style (`<Navigate replace>`) pras URLs antigas que possam estar em emails/bookmarks (ex.: `/dashboard` → `/office`, `/swarmgpt` já existe).
- Rodar suite de testes; corrigir quebras.
- Atualizar `docs/ROADMAP_MASTER.md` marcando "Limpeza ✅".

## Rodada 3 — Reorganização física (após você aprovar Rodada 2)

In-place, sem nova pasta-projeto:
- `src/pages/` → agrupar por domínio: `pages/operacional/`, `pages/comercial/`, `pages/dev/`, `pages/legal/`, `pages/onboarding/`.
- Mover restos de `src/components/editor/` para `src/features/<bucket>/` (continuar F5.B já na memória).
- Atualizar todos os imports via codemod (`rg`+`sed` controlado).
- Validar com testes + typecheck antes de commitar.

---

## Detalhes técnicos (Rodada 1)

- **Sem mudanças em código de runtime** — só docs (`docs/ROADMAP_MASTER.md`, `docs/ROUTE_AUDIT.md`) e diagramas em `/mnt/documents/`.
- **Sem mudanças de rota, safety, workMode, CommandBus, FieldBus**.
- **Sem migrations Supabase**.
- **Memória nova:** `mem://implantacao/roadmap-master-v1` referenciando o doc, e atualização do índice.

---

## O que fica fora desta rodada (intencionalmente)

- Implementação de adapter/discovery pros hardwares ainda em rascunho (XL4 Gateway, M1, Maiman, Radio) — entram na Fase 4 do roadmap, não nesta rodada.
- Field-tests reais — exigem hardware físico + autorização Phase 2 fresca.
- Mover arquivos físicos — Rodada 3.

Aprovar pra eu começar pela Rodada 1?