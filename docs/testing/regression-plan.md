# FX KONTROL — Plano de Testes Automatizados de Regressão

**Versão:** 1.0 · **Data:** 2026-04-25
**Origem:** `FXK_Critical_Bugs_Audit_2026-04-25.pdf`

## Princípio

Cada bug crítico/alto recebe **pelo menos um teste guardião** que falha *antes* da correção e passa *depois*. Nenhum PR de fix entra na main sem o seu teste correspondente.

## Camadas

| Camada | Tooling | Localização | O que cobre |
|---|---|---|---|
| **L1 — Smoke unitário** | Vitest + RTL | `src/**/__tests__/*.test.ts(x)` | Funções puras, gates de safety, parsers |
| **L2 — Integração frontend** | Vitest + jsdom | `src/**/__tests__/*.integration.test.tsx` | Stores + componentes + adapters honestos |
| **L3 — Integração edge** | `deno test` | `supabase/functions/<fn>/*_test.ts` | CORS, auth gate, response shape |
| **L4 — RLS/DB** | `psql` migrations + scanner | `supabase/migrations/` | Policies INSERT/UPDATE/DELETE |
| **L5 — E2E manual guiado** | Browser tool sob demanda | — | Flows críticos: ARM→FIRE→E-STOP |

## Mapa Bug → Teste Guardião

| Bug | Sev | Camada | Arquivo de teste | Status |
|---|---|---|---|---|
| BUG-01 bridge_pairings RLS | CRÍTICO | L4 | `supabase/migrations/<ts>_bridge_pairings_policies.sql` + scanner re-run | **a criar** |
| BUG-02 marketplace bucket público | CRÍTICO | L4+L3 | migration privatize bucket + `warehouse-download_test.ts` | **a criar** |
| BUG-03 fxk-ai-chat CORS | ALTO | L3 | `supabase/functions/fxk-ai-chat/cors_test.ts` | ✅ adicionado |
| BUG-04 E-STOP / Tuya path | ALTO | L1 | `src/core/safety/__tests__/estopHardGate.test.ts` | ✅ adicionado |
| BUG-05 SkyCanvas opacity gate | ALTO | L2 | `src/components/editor/__tests__/SkyCanvas.smoke.test.tsx` | ✅ adicionado |
| BUG-06 get-maps-key auth gate | MÉDIO | L3 | `supabase/functions/get-maps-key/auth_test.ts` | ✅ adicionado |
| BUG-07 VerificationLog persistence | MÉDIO | L1 | `src/core/verification/__tests__/VerificationLog.persistence.test.ts` | ✅ adicionado |
| BUG-08 command_journal index | MÉDIO | L4 | migration + `EXPLAIN` smoke | **a criar** |
| BUG-09 design tokens | BAIXO | L1 | `designTokens.guard.test.ts` (já existe) | ✅ existente |
| BUG-10 edge logs vazios | BAIXO | observabilidade | log structured assertion no `cors_test` | ✅ embutido |

## Comando de execução

- **Frontend (todos):** `bunx vitest run`
- **Edge Deno (todos):** via tool `supabase--test_edge_functions`
- **Smoke por bug:** `bunx vitest run -t "BUG-04"` (filtro por nome)

## Critério de merge

1. Suite frontend verde (`vitest run`).
2. Suite Deno verde para a função tocada.
3. Scanner Supabase sem novos warnings.
4. Smoke guardião do bug **fazendo parte do diff** quando o PR menciona um BUG-XX.

## Próximos incrementos

- **CI hook**: rodar `vitest run` + `deno test` em cada PR (não bloqueante até v1.1).
- **Coverage gate**: 80% em `src/core/safety/**` e `src/lib/__tests__/fireone*`.
- **Mutation testing** (Stryker) na camada de safety após estabilização.
