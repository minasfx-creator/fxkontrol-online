# FX KONTROL — Resumo Executivo de Alertas
**Data:** 2026-04-23
**Ciclo:** Hardening v3 (post rate-limit)
**Status global:** 🟢 OPERACIONAL — sem bloqueadores críticos

---

## 🔴 Críticos (ação imediata)

_Nenhum bloqueador crítico no momento._

---

## 🟠 Alto (próximo PR)

### A1 — `fxk-ai-chat` OPTIONS preflight falhando (CORS)
- **Sintoma:** chamadas do browser à edge function `fxk-ai-chat` rejeitadas no preflight CORS.
- **Provável causa:** `Access-Control-Allow-Headers` não inclui todos os headers enviados pelo cliente (`authorization`, `apikey`, `x-client-info`, `content-type`, `x-supabase-client-*`).
- **Ação:** importar `corsHeaders` de `@supabase/supabase-js/cors` e garantir que **todas** as respostas (incluindo erros) carreguem o header.
- **Owner:** Edge Functions
- **Janela alvo:** próximo PR (antes do Transport Emulator)

---

## 🟡 Médio (planejado, não-bloqueante)

### M1 — 84 violações de design tokens
- **Sintoma:** cores hardcoded (`text-white`, `bg-black`, hex literais) em componentes ao invés de tokens semânticos (`bg-primary`, `text-foreground`).
- **Impacto:** quebra parcial de tema dark/light e da paleta Vantablack/Cyan/Green/Amber/Red.
- **Ação:** ciclo dedicado de refactor visual (não misturar com PRs de hardware/safety).
- **Janela alvo:** sprint visual independente.

### M2 — NFPA Operator Credential UI parcial
- **Sintoma:** fluxo de credenciamento NFPA do operador implementado parcialmente na UI (backend e validação OK).
- **Ação:** completar formulário + upload de certificado + expiração.
- **Janela alvo:** após Transport Emulator.

---

## 🟢 Baixo (observação)

- Bridge diagnostics agora expõem `retryByCommandType`, `retryByKey`, `rateLimitedByKey`, `rateLimitedTotal`. Recomenda-se dashboard simples consumindo esses campos antes de qualquer build history view.

---

## 📌 Próximo PR técnico

**`Add hardware transport emulator and integration bridge tests`**

Escopo:
- Emulator simulando: frame parcial, frame duplicado, latência variável, disconnect, reconnect, `STATUS BAT/RSSI`, respostas fora de ordem.
- Testes de integração bridge ↔ emulator validando todos os hardenings já entregues (sessão, ordering, retry, rate limit).
- Sem alterações em hot path de produção.

**Pré-requisitos:** A1 (CORS fix) resolvido para não bloquear o ciclo de QA via UI.

---

## Histórico de Hardening (4 PRs consecutivos verdes)

| PR | Tema | Testes |
|----|------|--------|
| 1 | Session hardening | 13/13 |
| 2 | Pending response matching | 18/18 |
| 3 | Safe retry layer | 27/27 |
| 4 | Retry observability + policy | 33/33 |
| 5 | Retry rate limiting | **39/39** |

Próximo: **Transport Emulator + Integration Tests** → meta 50+/50+.
