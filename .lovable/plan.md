# Performance Hardening — Plano por Fases Medidas

## Diagnóstico (medido agora, sem alterar nada)

| Métrica | Valor | Status |
|---|---|---|
| Legacy stores ativos | 22 (em `src/store/`) | 🔴 0 migrados |
| `src/store/domains/` | Barrel re-export vazio (12 LOC úteis) | 🟡 ilusão de consolidação |
| Novos macro-stores | 4 scaffolds, **0 consumidores** | 🟡 não usados |
| `useStore()` sem selector | **0** | ✅ não é o problema |
| `useShallow` no codebase | 5 chamadas | 🔴 subutilizado |
| `React.memo` | 14 ocorrências | 🟡 baixo |
| Rotas lazy | 31/31 | ✅ |
| Heavy deps | three, drei, fiber, postprocessing, recharts, jspdf | 🟡 candidatas a split |
| `useProjectStore` consumidores | **182** | 🔴 maior risco de migração |
| `useSceneStore` consumidores | 55 | 🔴 |
| WebGPU buffer ops | `webgpuLoop`, `gpuComputeParticles`, 4× swarmgpt | precisa profile real |

## Limites desta sessão (read-only / sandbox)

- Não consigo medir bundle gzip real sem `vite build` (default mode).
- Não consigo rodar React Profiler nem WebGPU timing queries (sandbox sem GPU adapter).
- Migrar 22 stores em 1 sessão tocaria 335+ call sites — risco confirmado nas últimas 2 sessões; mantemos a regra "pequenas fases reversíveis".

## Plano de ataque (executar em sessões separadas, gated por evidência)

---

### **Fase P1 — Baseline mensurável** (30–45 min, baixo risco)

Sem otimizar nada ainda. Só tornar mensurável.

1. Rodar `vite build` e capturar `dist/assets/*.js` ordenados por tamanho (gzip + brotli).
2. Usar `rollup-plugin-visualizer` (já é devDep candidata) para gerar treemap → identificar top-10 chunks.
3. Rodar `knip` em modo report (não delete) → lista de exports/arquivos órfãos.
4. Snapshot atual em `docs/perf/baseline-2026-04-27.md`.

**Saída:** números concretos para "antes/depois" das próximas fases.

---

### **Fase P2 — Dead code surgical (8 stores baratos)** (1 sessão, médio risco)

Alvos com ≤4 consumidores cada — fácil migrar e deletar. Total ~22 call sites.

| Store | Consumidores | Destino |
|---|---|---|
| `useNetworkConfigStore` | 2 | `hardwareSyncStore` |
| `useDMXPanelPrefs` | 0 | deletar direto |
| `useDiagnosticsThresholds` | 3 | `uiWorkspaceStore.preferences` |
| `useAICoPilotStore` | 3 | `uiWorkspaceStore` (slice aiCoPilot) |
| `useAddressingStore` | 4 | `hardwareSyncStore` |
| `useGenerativeStore` | 4 | `simulationStore` |
| `useInventoryStore` | 4 | `missionStore` (project metadata) |
| `useMAVLinkStore` | 4 | `hardwareSyncStore` |

Política: deletar imediatamente após migrar (já aprovada nas sessões anteriores).
Também deletar `src/store/domains/` (barrel inútil que mascara o problema).

**Saída esperada:** 22 → 14 stores legacy. ~3–5KB gzip economizados (estimativa preliminar).

---

### **Fase P3 — Zustand hot path hardening** (1 sessão, baixo risco)

Sem migrar nada novo. Apenas tornar consumidores existentes mais baratos.

1. Auditar todos os componentes em `src/components/viewport/`, `src/components/timeline/`, `src/render_ultra/` que assinam stores. Medida atual: 5 `useShallow` no codebase inteiro — meta: ≥30 nos hot paths.
2. Converter selectors multi-campo para `useShallow(selector)` onde aplicável.
3. Para valores DMX/OSC em alta frequência: trocar `useStore(s => s.universe[u][c])` por **transient `store.subscribe`** dentro de `useEffect` + ref local — zero re-render.
4. Adicionar `React.memo` cirúrgico em itens de lista (timeline rows, device cards, cue items).
5. Documentar padrão em `docs/perf/zustand-hot-path.md`.

**Saída esperada:** redução mensurável de re-renders no React DevTools Profiler (precisa medição em browser real do usuário, não sandbox).

---

### **Fase P4 — Bundle splitting agressivo** (1 sessão, baixo risco)

1. Configurar `vite.config.ts` com `manualChunks`:
   - `vendor-three`: three + @react-three/*
   - `vendor-charts`: recharts
   - `vendor-pdf`: jspdf
   - `vendor-supabase`: @supabase/*
2. Garantir que rota pública (`Landing`) **não importa** nada de three/recharts/jspdf (verificar com visualizer).
3. Lazy-load `recharts` e `jspdf` apenas nos painéis que usam (ExecutiveReportConsole, charts).
4. Re-medir: meta `< 220KB gzip` na rota `/`.

---

### **Fase P5 — WebGPU resource hygiene** (1 sessão, alto risco — só com aprovação separada)

Não tocar agora. Requer:
- Profile real em browser do usuário (`browser--performance_profile` + start/stop profiling).
- Validação visual de cada compute pass (sandbox sem GPU não valida).
- Revisão pareada porque kernel WGSL v3 é a propriedade técnica mais crítica do produto.

Escopo previsto: auditar `device.destroy()` em rota changes, `buffer.destroy()` em recriação de pipelines, epoch counter em readbacks assíncronos (já documentado no useful-context).

---

### **Fases NÃO planejadas para próxima sessão (com motivo)**

| Item do pedido | Por que não agora |
|---|---|
| Migrar `useProjectStore` (182 sites) | Sozinho merece 3–4 sessões dedicadas |
| Migrar `useSceneStore` (55 sites) | Toca render path; precisa profile antes/depois |
| React 19 features (useTransition, Compiler) | Requer upgrade React+ToleranciaTipos; outra missão |
| Virtualização de listas longas | Depende de medir quais listas realmente custam |
| Performance budgets no CI | Faz sentido só após P1 estabelecer baseline |

---

## Recomendação

Aprovar **uma fase por vez**, na ordem P1 → P2 → P3 → P4. P5 fica sem agendamento até termos profile real. Cada fase entrega um Optimization Report parcial com números medidos, não estimativas.

Confirme qual fase rodar nesta próxima sessão (sugestão: **P1**, porque sem baseline as outras fases não têm como provar ganho).