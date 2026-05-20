## Escopo (3 frentes paralelas, ordenadas por risco)

Os 4 HTMLs analisados (Relatório v1, Matriz PLG, Roadmap 12m, Checklist Safety) convergem num único pedido técnico: **transformar capacidades hoje abertas em gates server-side**. Hoje a tabela `subscriptions` (Paddle) existe mas **nada no app a consulta** — `useSubscription`, `has_active_subscription` e `useEntitlement` não estão em uso, e nenhuma rota comercial (`/pricing`, `/comercial`, `/strategy`) está montada em `App.tsx` (memória estava desatualizada).

---

### Frente 1 — Paywall PLG inquebrável (núcleo)

**1.1 Schema (migration única)**
- Nova tabela `public.entitlements` (canônica por plano):
  `plan_key text PK` ('free' | 'pro' | 'enterprise'), `features jsonb`, `limits jsonb`
  Seed: free = `{artnet_universes:1, drones_sim:50, fir_export:false, mavlink:false, smpte:false, blackbox_export:false, ai_choreo_runs_month:5}`, pro = 10x, enterprise = ilimitado.
- Nova tabela `public.subscription_features` (cache derivado, 1:1 com user): `user_id PK`, `plan_key`, `expires_at`, `synced_at`. Trigger `AFTER INSERT/UPDATE on subscriptions` recomputa.
- Função SECURITY DEFINER `public.user_plan_key(uid uuid) returns text`, `public.user_has_feature(uid uuid, feat text) returns bool`, `public.user_within_limit(uid uuid, lim text, val int) returns bool`.
- Custom JWT hook `public.jwt_plan_claims(event jsonb)` injetando `plan_key` + `features` no token via `before_user_signed_in` (configurada via `configure_auth` se suportado; senão lemos de `subscription_features` no frontend e edge functions).

**1.2 RLS gates nas operações críticas existentes**
- `projects.insert`: free → CHECK count <= 3 via `user_within_limit`.
- Nova tabela `export_jobs` (kind: 'fir'|'mavlink'|'skyc'|'vviz'|'csv', status, payload_url): policy INSERT exige `user_has_feature(auth.uid(), kind || '_export')`.
- Refator dos exporters atuais (`exportEngine.ts`, `firingSystemExports.ts`, `goldenShowExport.ts`) para passar por edge function `request-export` que **(a)** insere em `export_jobs` (RLS rejeita server-side se sem feature) **(b)** gera o blob **(c)** retorna signed URL do bucket `go-live-evidence`. Falha no servidor, nunca na UI.

**1.3 Edge functions com guard**
- `_shared/requireFeature.ts`: helper que lê JWT, chama `user_has_feature`, retorna 402 padronizado.
- Aplicado em `request-export`, e nas chamadas LLM (`xai-generate`, etc.) cobrindo `ai_choreo_runs_month`.

**1.4 UI**
- `src/hooks/useEntitlement.ts` (puro UX, jamais autoridade): lê `subscription_features`, expõe `{plan, has(feat), within(lim,val), upgradeUrl}`.
- `<Paywall feature="fir_export">` wrapper que renderiza child OU upsell card com CTA → `/pricing` (futura).
- Aplicado em: botão Export Skybrush, Export FireOne, Export MAVLink, Export BlackBox PDF, Art-Net universes >1, sliders de drones >50.
- Banner global `PlanStatusChip` na `GlobalSafetyBar` (chip cinza `FREE` / amber `PAST_DUE` / verde `PRO`).

**1.5 Telemetria de paywall**
- Tabela `plg_events` (`event_type`, `feature`, `plan_key`, `created_at`). Insert via RPC `track_plg_event`. Eventos: `paywall.shown`, `paywall.clicked`, `feature.gated`, `upgrade.intent`.

---

### Frente 2 — Demo show "Araruama" (drones)

Mesmo padrão dos demos Angra/Festival:
- `scripts/build-araruama.mjs` — script auxiliar (extrai narrativa do vídeo via descrição manual no JSON-seed, sem dependência de mídia em runtime).
- `src/data/demoShows/araruama.generated.json` — formações (intro lakeshore wave → letreiro "ARARUAMA" → bandeira RJ → finale), ~120 drones, ~180s.
- `src/data/demoShows/araruamaDemo.ts` — builder `ShowPlan` (provenance: `marketing_hypothesis`, claim badge).
- Registro em `DEMO_SHOWS` (`src/data/demoShows/index.ts`) — aparece no menu Demos da Toolbar.
- Test snapshot em `__tests__/araruama.spec.ts`.

Nota: o `.mp4` é referência criativa só; **não fica em runtime**, só uso para extrair beats das formações (informo via comentários no .ts).

---

### Frente 3 — Docs internos servidos

- Copio os 4 HTMLs (`fxk-report.html`, `fxk-plg-matrix.html`, `fxk-roadmap.html`, `fxk-safety-compliance.html`) para `public/docs/internal/`.
- Nova rota autenticada `/docs/internal/:slug` → `src/pages/InternalDocs.tsx` renderiza via `<iframe sandbox>` (isola CSS dos HTMLs do design system).
- Index `/docs/internal` lista os 4 com cards.
- Sidebar ganha item "Docs" (ícone `BookOpen`) → linka ao index. Visível só para `has_role(admin)` ou `plan_key in ('pro','enterprise')`.

---

### Out of scope (não toco)

- Renderer 3D, GPGPU, Show3DEngine, FXK16 bridge, CommandBus, Safety StateMachine, workMode, BlackBox.
- Nenhuma migração de rotas existentes; nenhuma remoção de página.
- VVIZ math, VDL parser, Finale libs.
- Templates de show Itaguaí (continuam pendentes do plano anterior).

---

### Ordem de execução

1. Migration única (Frente 1.1 + 1.2 schema) + seed.
2. Edge functions `request-export` + `_shared/requireFeature`.
3. Hook `useEntitlement` + componente `Paywall` + chip.
4. Refator dos botões Export para usar `Paywall` + `request-export`.
5. Demo Araruama (Frente 2) — independente.
6. Rotas `/docs/internal/*` (Frente 3) — independente.

### Critério de pronto
- Free user no DevTools tentando POST `/functions/v1/request-export?kind=fir` recebe **402** mesmo bypassando UI.
- `console.log('checking RLS')` em DB confirma que `INSERT` em `export_jobs` falha sem feature.
- Demo Araruama aparece no menu Demos e carrega `ShowPlan` válido.
- `/docs/internal/report` renderiza o HTML completo dentro do MainLayout.