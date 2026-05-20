## Continuação: otimização de efeitos & livrarias

Estado atual (baseline): 380/397 routed, 17 unrouted documentados (6 drones, 7 formations, 4 architectural lights). 4/4 E2E verde. Vamos atacar o resíduo + qualidade visual.

### Escopo proposto (3 frentes paralelas)

**Frente A — Zerar o KNOWN_UNROUTED (renderers reais para drones/formations/lights)**
- `DroneLightRenderer`: ponto aditivo com pulso 2Hz, cor VDL-quantizada, drift Y mínimo. Cobre `drone-01..06` (type='drone').
- `FormationStubRenderer`: spawn de N LightPoints arranjados em formação canônica (heart/circle/wave) lendo `public/formations/*.csv` já existentes. Cobre `form-01..06,08`.
- `ArchRingRenderer`: anel additive 32 segmentos pulsante. Cobre `aring-01/02`. `light-05/06` → `MovingHeadEffect` mesmo sem `beamType` (fallback beam=spot).
- Atualizar `effectRouter.ts` (novos kinds: `drone-point`, `formation-stub`, `arch-ring`) + `FireworkRenderer.tsx`.
- Resultado: `KNOWN_UNROUTED` → 0; baseline removida do spec (test passa a exigir 100% routing).

**Frente B — Qualidade visual por categoria (silhouette-driven, brief P0)**
Estender o padrão `mineSilhouettes` (já canônico) para 3 famílias com baixa fidelidade hoje:
- `cakeSilhouettes.ts`: 4 perfis (uniform-row, fan-out, V-shape, W-shape) consumidos por `CakeEffect` quando `vdl.firingPattern` resolver via `vdlFiringPatterns.ts` (já existe).
- `gerbSilhouettes.ts`: 3 perfis (narrow-jet 8°, wide-spray 22°, twin-jet) lidos por `GerbEffect`.
- `flameSilhouettes.ts`: 2 perfis (pillar, fan) lidos por `FlameEffect` (sustento para Showven `SVCFLM` + set-pieces).
- Flag canônica `r_silhouette_all` (já reservada no memory) passa de placeholder → ON.

**Frente C — Harness `/dev/effects-e2e` upgrade**
- Adicionar **filter por manufacturer** (Curated/FWsim/Showven/Lidu/Magic/Winda/Amazon) usando `MergedEffectsCatalog.byManufacturer`.
- Adicionar **diff visual contra baseline persistida** (L2 pixel já existe — só expor coluna Δ ordenável + botão "Show regressions only").
- Adicionar **export CSV** do score por effect (id, kind, score, Δ-baseline) → `/mnt/documents/effects-e2e-report.csv` via download link.
- Sem mudar pipeline de captura nem dwell (1500ms continua canônico).

### Fora de escopo
- Choreography engine real para drones (Frente A entrega stub honesto, claim=`pilot`).
- Pipeline GPU/shader change (HDR/bloom inalterados).
- Qualquer toque em safety/workMode/CommandBus.

### Critério de aceite
- `effectsLibraryE2E.spec` passa com `KNOWN_UNROUTED.size === 0`.
- Histograma do test loga ≥6 kinds novos vs hoje (drone-point/formation-stub/arch-ring/cake-silhouette/gerb-silhouette/flame-silhouette).
- 945+ suite mantém verde.
- `/dev/effects-e2e` carrega filtro + export sem regressão de perf (>30fps no scroll).

### Ordem de execução (loops futuros)
1. Frente A (zera baseline) — menor risco, maior sinal.
2. Frente C (harness) — sem dependência de render, paralelizável.
3. Frente B (silhuetas) — última, requer QA visual no harness já melhorado.

Confirme se quer começar pela **Frente A** ou se prefere outra ordem / recortar escopo.
