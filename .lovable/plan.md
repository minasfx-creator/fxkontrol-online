# Plano · Go-Live Center + Pacotes SaaS

## Objetivo

Transformar o roadmap dos 90 dias em produto vendável agora. O "Go-Live Center" hoje é só uma promessa nos textos — vou torná-lo o coração da demo: checklist com regras GO/NO-GO reais, anexos de evidência, signoffs, runbook de rollback e exportação de relatório.

A página /strategy continua sendo o GTM hub. /go-live é a tela operacional vendável: ela é o que o operador técnico vai usar todo dia, e o que sustenta os pacotes Previs / LiveOps / Enterprise.

## Escopo da rodada (R3 Pass 3)

### 1. Página `/go-live` (sidebar Office, ícone ShieldCheck)

```text
┌─ topbar: show name · platform badge · GO/NO-GO chip ──────────┐
│ left 280:                  center:                  right 320:│
│  Show selector             Checklist (blockers +    Signoffs  │
│  Bug list                   non-blockers, agrupados Engenharia│
│  Critical risks             por seção do PDF)       Operação  │
│                                                     Cliente   │
│  ─ rollback runbook         Evidence column:                  │
│    + validation status        prints, logs, vídeo, sig        │
│                                                               │
│ bottom: GO / NO-GO panel + reasons + "Export report (PDF)"    │
└───────────────────────────────────────────────────────────────┘
```

### 2. Modelo de dados (Lovable Cloud)

Quatro tabelas com RLS owner-scoped + admin read-all (mesmo padrão de demo_sessions):

- `go_live_checklists` — id, owner, show_name, venue, scheduled_at, platform_target, status (`draft|in_review|go|no_go|completed`), no_go_reasons jsonb
- `go_live_items` — checklist_id, section, label, is_blocker, is_critical, status (`pending|pass|fail|n_a|mitigated`), evidence_required boolean, notes
- `go_live_evidence` — item_id, kind (`screenshot|log|video|signature|other`), url, sha256, captured_at, captured_by
- `go_live_signoffs` — checklist_id, role (`engineering|operations|client`), signer_name, signer_email, signed_at, signature_text

Bucket de storage privado `go-live-evidence` com RLS por checklist owner.

### 3. Engine GO/NO-GO (`src/lib/goLiveEngine.ts`)

Função pura `evaluateChecklist(items, signoffs, openCriticalBugs)` retorna:

```ts
{ result: 'GO' | 'NO_GO', reasons: NoGoReason[] }
```

Aplica todas as regras do brief:
- bloqueador sem `pass` → NO-GO
- bloqueador `pass` com `evidence_required` mas sem evidência → NO-GO
- rollback runbook não validado → NO-GO
- signoff Engenharia ou Operação faltando → NO-GO
- bug crítico aberto → NO-GO
- item crítico `fail` sem `mitigated=true` → NO-GO

100% determinístico. Testável.

### 4. Seed do checklist (PDF do brief virou dados)

`src/lib/goLiveSeed.ts` com seções:
- Plataforma & Compatibilidade (links para `/ios-readiness`)
- Hardware Conectado (handshake, ACK em dummy load, heartbeat 5min)
- DMX/Art-Net Output (universos, refresh rate, timing budget)
- Pirotecnia (FXK16 ARM/DISARM, continuity check, exclusion zones)
- Drones (FAA 120m AGL, spacing 2m, swarm health)
- Segurança (E-STOP <50ms, lockout visual, audit log)
- Rollback (runbook responsável + validado pós-reversão)
- Signoffs (Engenharia, Operação, Cliente)

Cada item marca `is_blocker`, `is_critical`, `evidence_required`.

### 5. Painel de evidências

Por item: anexar screenshot/log/vídeo/assinatura. Upload para storage. SHA-256 client-side (Web Crypto) gravado para auditoria. Preview inline (img/video) ou link (log/sig).

### 6. Runbook de rollback

Componente dedicado com lista de passos editáveis, responsável por passo, e botão "Validar pós-reversão" que grava timestamp + signer. Sem isso, GO-Live engine retorna NO-GO.

### 7. Relatório PDF (reusa `src/lib/pdfRenderer.ts`)

`buildGoLiveReport(checklist, items, evidence, signoffs, evaluation)` gera PDF com:
- Capa: show, venue, data, GO/NO-GO + reasons
- Resumo: contagem pass/fail/pending por seção
- Lista completa de itens com status e evidências (thumbs ou hashes)
- Signoffs com nome/email/timestamp
- Bug list crítica e runbook de rollback
- Disclaimer de claim conforme `src/lib/claims.ts`

### 8. Pacotes SaaS na landing comercial

Em `/pricing` (ou seção em `/comercial`), três cards (Previs / LiveOps / Enterprise) com bullets exatos do brief e CTA "Solicitar demo" → `/comercial#demo-form`. Sem checkout real (sem Stripe nesta rodada — pricing inicial vem na rodada 4).

### 9. Polish + bug hunt (continua linha do Pass 2)

- Substituir tabs do Strategy por design system `.ds-segment-*-bar` (hoje usa botões custom).
- Converter `useState` arrays grandes (Strategy/AssetLibrary) para `useMemo` onde for derivado puro.
- Audit visual em `/strategy` viewport mobile 390×844 — cards muitos provavelmente quebram.
- Encontrar 3 bugs adicionais por `rg` em padrões comuns (setInterval sem clear, useEffect sem deps array, missing key prop).

## Detalhes técnicos

**Migration única** com 4 tabelas + bucket + RLS + trigger updated_at. Segue padrão das migrations existentes (`gen_random_uuid()`, `auth.uid()`, sem FK para `auth.users`, owner via uuid).

**Sem barrels** para o módulo go-live (regra de reliability). Imports diretos.

**Componentes em** `src/components/golive/`:
- `GoLiveChecklist.tsx` — render itens agrupados
- `GoLiveItemRow.tsx` — toggle status + abre painel evidência
- `EvidenceUploader.tsx` — file input + SHA-256 + upload
- `RollbackRunbook.tsx`
- `SignoffPanel.tsx`
- `GoNoGoPanel.tsx` — chamada para `evaluateChecklist`, mostra reasons
- `BugListPanel.tsx`

**Página** `src/pages/GoLive.tsx` orquestra dentro de `MainLayout`. Adiciona rota em `App.tsx` e item na sidebar (Office). Sem auto-arm, sem comando físico — apenas leitura de status + entrada de evidências/signoffs (consistente com hub GTM).

**Relatório PDF** com `pdf-lib` (já instalado). Usa fontes Helvetica/Courier. Vantablack na capa. Cyan/Amber/Red conforme tokens canônicos. Disclaimer claim em rodapé toda página.

**E-STOP global continua visível** (regra core) — não é escondido em /go-live.

## Fora de escopo (próxima rodada)

- Captura automática de evidências do hardware real (vai exigir adapters honestos por família — pesado).
- DockTwin telemetria mock — fica para rodada seguinte se você quiser priorizar.
- Stripe checkout dos pacotes — deixar como CTA até validar pricing nos pilots.
- Migração física dos `src/features/` (F5.B continua adiada).

## Ordem de entrega

1. Migration (tabelas + bucket + RLS).
2. Engine + seed + tipos.
3. Componentes + página `/go-live` + sidebar.
4. PDF report.
5. Pacotes SaaS na landing.
6. Polish/bugs (Pass 2 continuation).
7. Memory update.
