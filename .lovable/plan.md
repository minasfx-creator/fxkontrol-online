# Rodada 10 — UI Honesta + Discovery Inline

## Diagnóstico
Código já está limpo de telemetria sintética nas camadas críticas (deviceAggregator, FXK16, FireOne usam dados reais). Os pontos restantes de "informação enganosa" são puramente de chrome no `DashboardPanel.tsx`:

- **`MOCK_NEWS = []`** — feed Instagram-style dead code (nunca renderiza nada útil) ocupando 200+ linhas (FeedCard, filtros, estado liked/saved).
- **Hero "SYS::ONLINE"** — chip estático que mente: pisca verde mesmo sem hardware. `PROJ:`/`EVT:`/`T:` duplicam o que `OfficeKpiHero` já mostra honestamente acima.
- **`MOCK_NEWS` import paths** — `feedFilter`, `CATEGORY_FILTERS`, `FeedCard`, `Heart/Bookmark/Share2/MessageCircle/TrendingUp/TrendingDown/Minus/Circle` lucides, todos dead.
- **Sem empty state** quando 0 hardware: layout assume sempre que tem device, painéis Field Ops viram cliques sem destino.

`OfficeKpiHero` já é a fonte canônica honesta (Shows real do Supabase, devices via `deviceAggregator`, missions via localStorage, mode via `workMode.subscribe`).

## Mudanças

### 1. Novo: `src/components/office/EmptyHardwareHint.tsx`
Cartão de estado vazio que aparece quando `deviceAggregator.getDevices().filter(online).length === 0`:
- Texto honesto: "Nenhum hardware detectado · conecte FXK16/FireOne/Art-Net/DMX-USB"
- Botão **Iniciar Discovery** → chama `unifiedDiscovery.scanLight()` inline com spinner
- Link **Pareamento** → `/pairing`
- Subscribe ao `deviceAggregator.watch` — auto-some quando 1º device fica online

### 2. `src/components/office/DashboardPanel.tsx` — limpeza
- **Remove** `MOCK_NEWS`, `NewsItem`, `CATEGORY_FILTERS`, `FeedCard`, `feedFilter`, `filteredNews`, `visibleNews` e a coluna central "feed" inteira do grid (~250 linhas dead).
- **Remove** o bloco "telemetria readouts" (PROJ/EVT/T) duplicado — vive em `OfficeKpiHero`.
- **Substitui** chip estático "SYS::ONLINE / FXK v2.0" por:
  - Chip dinâmico que reflete `deviceAggregator` (verde "X DEVICES ONLINE" quando >0, cinza "OFFLINE" quando 0).
- **Monta** `<EmptyHardwareHint />` logo após o hero, dentro do contêiner principal.
- **Reduz grid** de `[1fr_420px_1fr]` para `[1fr_1fr]` (sem coluna central).
- Imports lucide enxutos (remove Heart/Bookmark/Share2/MessageCircle/Trending*/Minus/Circle).
- Corrige: rota `'/swarmgpt'` no `goToTool` agora aponta para `/ai-builder` (já redireciona, mas evita hop extra).

### 3. Tests
- Adicionar `src/__tests__/dashboardPanel.honesty.spec.tsx` (smoke):
  - garante zero `MOCK_NEWS` no DashboardPanel
  - garante presença de `EmptyHardwareHint` import
  - garante hero não contém string `'SYS::ONLINE'` literal estática

## Arquivos
- **Novo**: `src/components/office/EmptyHardwareHint.tsx` (~85 linhas)
- **Editado**: `src/components/office/DashboardPanel.tsx` (~808 → ~520 linhas)
- **Novo**: `src/__tests__/dashboardPanel.honesty.spec.tsx`
- **Memória**: `mem://funcionalidades/dashboard-honesty-empty-state` + index update

## Garantias
- Zero impacto em CommandBus/FieldBus/SafetyStateMachine/workMode.
- Zero mudança em rotas existentes.
- `OfficeKpiHero` permanece autoridade dos KPIs honestos.
- Golden shows, fxk16 emulator (gated por flag), workMode=simulation, smoke physics, weather particles — TODOS preservados (são prova/render legítimos, não UI enganosa).
- Tests existentes (1238/1238) devem continuar verde + 1-3 novos.

## Fora de escopo
- Não toca `fireoneModuleEmulator`/`indoorSimulation`/`grandMA3Node` (escopo "UI + emulators" foi rejeitado).
- Não força `real_only_mode` (escopo agressivo rejeitado).
- Não altera `simulationGuard` nem o trio de modos (design/simulation/real_operation continua intacto).