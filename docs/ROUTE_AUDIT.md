# Auditoria de Rotas e Páginas — Rodada 2 (executada)

Base pós-execução. Conclusões iniciais da Rodada 1 foram **revisadas** após auditoria precisa de uso real.

---

## Páginas DELETADAS na Rodada 2 (5)

| Arquivo | Justificativa |
|---|---|
| `pages/AIChoreography.tsx` | Rota → `Navigate /ai-builder`; zero refs externas |
| `pages/SwarmGPT.tsx` | Rota → `Navigate /ai-builder`; zero refs externas |
| `pages/Admin.tsx` | Rota → `Navigate /office?tab=compliance`; substituída por placeholder em `Office` |
| `pages/Agenda.tsx` | Rota → `Navigate /office?tab=agenda`; substituída por placeholder em `Office` |
| `pages/Training.tsx` | Substituída por `TrainingCenter`; placeholder em `Office?tab=training` |

**Ajustes:** `src/lib/prefetchRoutes.ts` reescrito (rotas de páginas deletadas removidas; adicionadas `/office`, `/training/center`); `src/pages/Office.tsx` agora usa placeholders apontando pras rotas canônicas.

---

## Páginas RECLASSIFICADAS como KEEP (auditoria revisada)

A Rodada 1 marcou estas pra deleção, mas auditoria precisa mostrou uso ativo:

| Arquivo | Uso real descoberto |
|---|---|
| `pages/Dashboard.tsx` | Importada por `Office.tsx` como tab `overview` (default) |
| `pages/AccreditationDashboard.tsx` | Importada por `Office.tsx` como tab `documents` |
| `pages/FieldTest.tsx` | Importada por `CommandCenter.tsx` como tab `field_test` |
| `pages/FXK16ValidatePage.tsx` | Importada por `dev/FXK16Hub.tsx` como tab `validate` |
| `pages/FXK16CalibrationPage.tsx` | Importada por `dev/FXK16Hub.tsx` como tab `calibrate` |
| `pages/DevicePairing.tsx` | Importada por `FieldOps.tsx` e `FXKNetPanel.tsx` como sub-view |

Conclusão: 6 páginas erroneamente marcadas DELETE na Rodada 1 — agora reclassificadas como **KEEP** (são componentes-de-tab embora vivam em `pages/`).

---

## Métricas finais

- Páginas pré-rodada: **43**
- Deletadas: **5**
- Páginas pós-rodada: **38** (-12%)
- Rotas: **49** (mantidas; só removidos imports lazy de páginas inexistentes — App.tsx já não as importava)
- Refs órfãs corrigidas: 8 (`prefetchRoutes.ts`, `Office.tsx`)

---

## Pendência sugerida pra Rodada 3 (reorganização física)

As 6 páginas reclassificadas como "tab-de-outra-página" deveriam ser movidas pra `src/components/office/`, `src/components/command/`, `src/components/dev/fxk16/` etc. e deixar `src/pages/` só com **rotas reais**. Fica pra Rodada 3.
