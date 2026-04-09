

# Ciclo #70 — Sprint 17: Circuit Breaker Pattern

## Problema

Quando um serviço atinge o limite de 5 tentativas de auto-recovery, ele fica marcado como `failed` permanentemente. Não há mecanismo para o operador tentar re-ativar manualmente, nem proteção contra tentativas de uso de um serviço em estado `failed`.

## Solução

Adicionar estado `tripped` ao `AutoRecoveryService` (circuit breaker aberto) com método `manualReset(label)` para re-ativar. O `ClusterHealthTab` ganha botão de reset manual nos serviços com estado `failed`.

## Deliverables

### 1. Circuit Breaker no AutoRecoveryService

- Novo estado `tripped` adicionado ao tipo `RecoveryState`: `'pending' | 'recovering' | 'recovered' | 'failed' | 'tripped'`
- Quando `attempts >= maxAttempts`, estado muda para `tripped` (circuit breaker aberto) em vez de `failed`
- Novo método `manualReset(label)`: reseta attempts para 0, muda estado para `pending`, e chama `scheduleRecovery(label)` para tentar novamente
- Novo método `isTripped(label): boolean` para consulta externa
- Incidente `critical` reportado ao `ClusterHealthService` quando circuit breaker abre
- Toast notifica operador com ação clara

### 2. Botão de Reset Manual no ClusterHealthTab

- `RecoveryRow` exibe botão "Reset" quando estado é `tripped`
- Botão chama `autoRecoveryService.manualReset(label)`
- Visual: ícone `RotateCcw` + badge vermelha pulsante para `tripped`

## Files

| Action | File |
|--------|------|
| Edit | `src/core/reliability/AutoRecoveryService.ts` (add tripped state + manualReset) |
| Edit | `src/components/editor/cluster/ClusterHealthTab.tsx` (add reset button + tripped visual) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Add circuit breaker logic to AutoRecoveryService |
| 2 | Add manual reset UI to ClusterHealthTab |
| 3 | Build verification |

