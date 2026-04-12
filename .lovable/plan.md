

# Implementação do Diagrama Arquitectural + Consoles UI em Falta

## Estado Actual vs Diagrama

Todos os módulos core do diagrama **já existem** no código:
- ShowPlan, VerificationPass, Hardware drivers, Protocols, Safety, Execution — implementados
- CommandRelay, NetworkHealth, AutoRecovery, Profiler, SnapshotManager — implementados

## O que Falta

### 1. Gerar o Diagrama Mermaid como Artefacto
Converter o grafo TD fornecido pelo utilizador para um ficheiro `.mmd` persistente em `/mnt/documents/`, com styling por domínio (cores por bloco: vermelho=safety, ciano=hardware, verde=execution, etc.).

### 2. Consoles UI Command-Grade (Planeados mas Nunca Criados)

| Console | Descrição |
|---|---|
| `VerificationBar.tsx` | Barra horizontal no topo do editor com status binário do VerificationPass (READY/BLOCKED) + drill-down |
| `ContinuityMatrix.tsx` | Grid 32 canais com status OK/OPEN/SHORT por pino, consumindo `ContinuityCheckService` |
| `ShowPlanInspector.tsx` | Árvore navegável do ShowPlan: contadores por domínio (pyro cues, dmx cues, drone paths, hardware modules) |

### 3. Integração no CommandCenter
Adicionar dois novos modos ao `CommandCenter.tsx`:
- `verification` → renderiza VerificationBar + checks list
- `continuity` → renderiza ContinuityMatrix

Adicionar na secção HARDWARE do sidebar do CommandCenter.

### 4. VerificationBar no Index.tsx
Barra fina no topo do editor principal mostrando o resultado de `verificationPass.run()` com cor por nível.

## Ficheiros a Criar
- `/mnt/documents/FXK_Architecture_v3.mmd` — Diagrama Mermaid completo
- `src/components/editor/VerificationBar.tsx` — Barra de status binário
- `src/components/editor/ContinuityMatrix.tsx` — Grid 32 canais
- `src/components/editor/ShowPlanInspector.tsx` — Árvore ShowPlan

## Ficheiros a Modificar
- `src/pages/CommandCenter.tsx` — Adicionar consoles verification + continuity
- `src/pages/Index.tsx` — Montar VerificationBar no topo

## Prioridade
1. Diagrama Mermaid (artefacto visual imediato)
2. VerificationBar (impacto visual em todas as views)
3. ContinuityMatrix (alinhamento com hardware real)
4. ShowPlanInspector (visibilidade do estado do show)
5. Integração CommandCenter

