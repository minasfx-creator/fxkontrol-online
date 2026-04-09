

# Ciclo #74 — Retenção Automática de health_snapshots (cleanup > 24h)

## Abordagem

Duas camadas complementares:

1. **Client-side cleanup** — No `HealthPersistenceService`, a cada 10º flush (~5min), executar um DELETE dos registros do próprio usuário com `created_at < now() - 24h`. Simples, sem infraestrutura extra.

2. **Database-level scheduled cleanup (pg_cron)** — Criar um cron job que roda a cada hora e deleta snapshots e incidents com mais de 24h para todos os usuários. Garante limpeza mesmo se o client não estiver aberto.

Vou implementar ambos para máxima robustez.

## Deliverables

### 1. Edit `HealthPersistenceService.ts`
- Adicionar contador `flushCount`
- A cada 10 flushes, executar cleanup client-side:
  - `DELETE FROM health_snapshots WHERE user_id = X AND created_at < now() - interval '24 hours'`
  - `DELETE FROM health_incidents WHERE user_id = X AND created_at < now() - interval '24 hours'`
- Log do número de rows removidas

### 2. Scheduled cleanup via pg_cron
- Habilitar extensões `pg_cron` e `pg_net`
- Criar cron job hourly que deleta registros > 24h de ambas as tabelas

## Files

| Action | File |
|--------|------|
| Edit | `src/core/cluster/HealthPersistenceService.ts` |
| SQL | Enable pg_cron + create scheduled cleanup job |

## Execution Order
1. Edit HealthPersistenceService with client-side cleanup
2. Create pg_cron scheduled job
3. Build verification

