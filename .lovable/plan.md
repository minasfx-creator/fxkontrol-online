

# Ciclo #69 — Sprint 16: Recovery Status Panel

## Objetivo

Adicionar uma seção "Recovery Status" no `ClusterHealthTab` que exibe o estado de auto-recovery de cada serviço registrado, com estado visual (pending/recovering/recovered/failed), contagem de tentativas, e countdown para o próximo retry.

## Deliverables

### 1. RecoveryStatusSection — inline no ClusterHealthTab

Nova seção entre Subsystem Cards e Incident History:

- Lê `autoRecoveryService.getStatus()` no mesmo poll de 1s
- Cada serviço exibe: label, estado com badge colorida, barra `attempts/maxAttempts`, countdown "next retry in Xs"
- Estados visuais: `pending` (yellow pulse), `recovering` (blue spin), `recovered` (green check), `failed` (red skull)
- Seção só aparece se há pelo menos 1 serviço com estado diferente de `pending` com 0 attempts (i.e., só mostra quando houve atividade de recovery)

### 2. Poll integration

O `useEffect` existente já faz refresh a cada 1s — adicionar `autoRecoveryService.getStatus()` ao mesmo ciclo.

## Files

| Action | File |
|--------|------|
| Edit | `src/components/editor/cluster/ClusterHealthTab.tsx` (add recovery section + import) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Add recovery status section to ClusterHealthTab |
| 2 | Build verification |

