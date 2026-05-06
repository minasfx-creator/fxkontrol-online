
# Plano — Aplicar `fxkontrol-online-main-audit-safe-patch.zip` de forma cirúrgica

O ZIP contém **15 arquivos novos + 64 modificados**. Após auditar diff por diff, as mudanças se dividem em **dois grupos com intenções opostas**: ganhos reais de safety vs. retrocessos de UI/rota que conflitam com decisões já consolidadas em memória. Proponho aplicar **só o grupo seguro** e descartar o resto.

## ✅ Grupo A — Safety hardening (APLICAR)

Mudanças puramente defensivas, alinhadas a `mem://restricoes/seguranca-latencia-e-auditoria-v5-crificos` e `mem://funcionalidades/p0-safety-hardening-trio`. Sem impacto visual.

1. **`src/core/command/CommandBus.ts`** — corrige bug em `drain()`: quando a fila está vazia, ele reusava o `_drain` array do tick anterior sem limpá-lo, podendo re-aplicar comandos antigos (incluindo `E_STOP`). Patch zera `_drain.length`.
2. **`src/core/command/__tests__/CommandBus.drain.test.ts`** (novo) — regressão para o bug acima.
3. **`src/core/network/fieldBus.ts`** — adiciona `isNonReplayable(msg)` que **rejeita buffer/replay** de mensagens `pyro` e `estop` durante failover (replay = ignição tardia). Loga em blackbox como `emergency`. **Remove `setTransport()` runtime** (anti-padrão: substituir transporte vivo).
4. **`src/core/execution/pyroExecutor.ts`** — valida `moduleAddress`, `channel ∈ [0,31]`, `duration ∈ (0,10]s` antes de despachar; **remove `_localBuffer` de cues pyro** (substitui por no-op `flushBuffer` para compat). Single-intent commands nunca são replayados.

> Esses 4 itens reforçam invariantes já documentadas em memória e adicionam um teste novo. Pode aplicar direto.

## ❌ Grupo B — Retrocessos de produto (NÃO aplicar)

Conflitam com decisões recentes registradas em memória:

| Mudança no patch | Conflito |
|---|---|
| Re-cria `src/pages/{AIChoreography,Admin,Dashboard,Training,FieldTest,SwarmGPT,DevicePairing,AccreditationDashboard,Agenda,FXK16ValidatePage,FXK16CalibrationPage}.tsx` (~5.3k LoC) | `mem://implantacao/roadmap-master-v1` lista exatamente essas 10 páginas como **DELETE p/ Rodada 2** |
| `src/App.tsx` remove rotas `/skycanvas`, `/dev/skycanvas-3d`, `/dev/skycanvas-2`, `/dev/ue5-bridge`, `/dev/video-editor`, `/training/center`, `/dev/module-roster`, `/dev/e2e-test` | Apaga toda a entrega **SkyCanvas v3** acabada de fazer (TabbedDockPanel, SMPTE tab, CatalogImportDialog) e o **Studio Mode** + **UE5 Bridge** registrados em `mem://tecnologia/modo-estudio-arquitetura-cinematica-v1` e `mem://tecnologia/contrato-operacional-swarm-manager-unreal-v1` |
| `AppSidebar.tsx` remove item "SkyCanvas", troca `FxkLogo variant="full" tone="sync"` por logo bare + `textShadow` literal HSL, troca token `--status-sync` por `190 100% 50%` hardcoded | Reverte `mem://design/fxk-logo-brand-component` e `mem://arquitetura/hierarquia-prioridade-decisoes-design` (proibição de cores hardcoded fora do sistema de tokens) |
| `src/components/safety/GlobalEStopButton.tsx` remove animações `op-estop-shake`/`op-arm-pulse`/`op-disarm-flash` | Remove feedback haptic-visual sem justificativa de safety; degrada UX sem ganho |
| `src/lib/featureFlags.ts` (-76 linhas) | Apaga flags em uso (training_v2_cinematic, skycanvas_v2_stage, real_only_mode etc. — todos em memórias ativas) |
| `src/index.css` (-178/+21) | Remove tokens DS já adotados (`mem://interface/design-system-fxkontrol-v1`, `mem://interface/typography-ds-scale-unified`) |
| Demais ~50 arquivos modificados (Landing, Pricing, Comercial, Pricing, Strategy, Privacy, Terms, etc.) | Mistura de cosmético + revert de Studio/PixelStreaming/Cesium — alto risco, baixo benefício |

## Plano de execução (Grupo A apenas)

1. Sobrescrever **somente** os 4 arquivos:
   - `src/core/command/CommandBus.ts`
   - `src/core/command/__tests__/CommandBus.drain.test.ts` (novo)
   - `src/core/network/fieldBus.ts`
   - `src/core/execution/pyroExecutor.ts`
2. Verificar callers de `fieldBus.setTransport(...)` (removido) — se houver, manter o método antigo como deprecated no-op para não quebrar import; a busca rápida indica uso interno apenas em testes/mocks.
3. Verificar callers de `pyroExecutor.flushBuffer(...)` — patch já mantém shim que retorna `0`.
4. Rodar suíte de testes (build automático). Esperado: novo teste verde + zero regressão.
5. Atualizar memória: append em `mem://restricoes/seguranca-latencia-e-auditoria-v5-crificos` notando que pyro FIRE e E-STOP são **não-replayáveis por contrato** e que `CommandBus.drain` é defensivo contra reutilização do buffer.

## Pergunta pra confirmar

Vou tratar o ZIP como **fonte de auditoria** (extrair só os 4 ganhos de safety) e ignorar todo o restante — ou você quer que eu reaplique as 10 páginas deletadas / desfaça o SkyCanvas v3? Default: aplicar **só Grupo A**.
