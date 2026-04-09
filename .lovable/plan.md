

# Ciclo #72 — Sprint 18: Service Dependency Graph

## Problema

Serviços são tratados como independentes. Quando um serviço upstream (ex: `network`) tem seu circuit breaker ativado, os serviços que dependem dele (ex: `cluster`) continuam tentando operar normalmente, sem saber que sua dependência está indisponível. Não há propagação de degradação.

## Solução

Adicionar um grafo de dependências ao `ServiceRegistry`. Cada serviço declara opcionalmente seus `dependsOn` no registro. Quando o `AutoRecoveryService` detecta um circuit breaker tripped, propaga estado `degraded` aos dependentes. O `ClusterHealthTab` exibe visualmente as dependências e a propagação.

## Deliverables

### 1. Dependency Graph no ServiceRegistry

- Estender `HealthReporter` com campo opcional `dependsOn?: string[]`
- Novo método `getDependents(id: string): HealthReporter[]` — retorna serviços que dependem do `id`
- Novo método `getDependencies(id: string): HealthReporter[]` — retorna dependências de um serviço
- Novo método `getDependencyGraph(): Map<string, string[]>` — grafo completo para visualização

### 2. Propagação de Degradação no AutoRecoveryService

- Quando circuit breaker abre (`tripped`), chamar `serviceRegistry.getDependents(label)` para encontrar dependentes
- Para cada dependente, reportar incidente `warning` ao `ClusterHealthService` com mensagem clara: "Degraded: upstream dependency {label} is tripped"
- Novo método `getUpstreamStatus(label: string): { allHealthy: boolean; trippedUpstreams: string[] }` para consulta
- No `scheduleRecovery`, antes de tentar boot, verificar se upstreams estão saudáveis — se não, adiar retry e logar motivo

### 3. Registro de Dependências nos Reporters Existentes

- Atualizar os 3 reporter adapters existentes para declarar `dependsOn`:
  - `SafetyReporter`: sem dependências (raiz)
  - `PerformanceReporter`: sem dependências (raiz)  
  - `NetworkReporter`: sem dependências (raiz)
- Estrutura pronta para futuros serviços que declarem dependências reais

### 4. Dependency Indicators no ClusterHealthTab

- Nos subsystem cards, exibir chip "depends on: X" quando o serviço tem dependências
- Quando um upstream está tripped, o card dependente mostra badge "⚠ upstream degraded" em amarelo
- Na `RecoveryStatusSection`, serviços com upstream tripped mostram tooltip explicando o bloqueio

## Files

| Action | File |
|--------|------|
| Edit | `src/core/cluster/ServiceRegistry.ts` (add dependsOn, getDependents, getDependencyGraph) |
| Edit | `src/core/reliability/AutoRecoveryService.ts` (propagation + upstream check) |
| Edit | `src/components/editor/cluster/ClusterHealthTab.tsx` (dependency indicators) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Extend ServiceRegistry with dependency graph |
| 2 | Add propagation logic to AutoRecoveryService |
| 3 | Add dependency indicators to ClusterHealthTab |
| 4 | Build verification |

