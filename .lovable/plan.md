# Editor 3D + Joi como zona de criação pura

## Princípio
O Editor 3D deixa de representar realidade física. **Nada** no editor pode armar, disparar, conectar hardware, travar composição ou empurrar o usuário para o Command Center. Joi, dentro do editor, é assistente criativo — sem guardrails que neguem ações de design. **Hardware e disparos vivem exclusivamente em `/command`** (rota separada, já isolada). Esta mudança é só de chrome/UX no editor; nada toca CommandBus, SafetyStateMachine, uiCommandGateway, FieldBus, workMode ou Joi guardrail físico — esses continuam intactos protegendo o caminho real.

## Mudanças

### 1. `src/layouts/MainLayout.tsx` — remover chrome ARMED do editor
- Apagar banner **"⚠ SYSTEM ARMED — N CHANNELS HOT"** quando rota é `/editor` (ou simplesmente apagar global, já que ele só dispara de `useLiveSfxStore` que é preview de SFX, não de hardware).
- Apagar botão flutuante **PANIC** vermelho fixed bottom-right.
- Remover navegação `navigate('/command')` no clique do banner.
- Manter `clearAll()` disponível só onde for SFX preview (sem framing de "emergency").

### 2. `src/components/editor/Toolbar.tsx` — remover trio LIVE / ARM / E-STOP e atalhos de hardware
- Apagar bloco `{/* LIVE + ARM + E-STOP */}` (linhas ~632-656): três botões e o separator que os antecede.
- Apagar componente `HardwareStatusDots` da toolbar (linha 662) e seu import — dots de hardware (FO/MA/USB) não pertencem à barra de composição.
- Em `HardwareStatusDots.handleDotClick` (linhas 95-102): remover branch mobile que faz `navTo('/command?mode=hardware')`. Como o componente inteiro sai da toolbar, isso fica apenas como limpeza preventiva caso seja reusado.
- Apagar botão **"LIVE FIRING"** que abre `livefiring` panel (ARM) — fora do escopo do editor.
- Manter botão Command Palette `⌘K` (`FullscreenCommandMenu`) **apenas como busca de comandos UI** — auditar `FullscreenCommandMenu` para remover entradas que abram painéis de hardware/arm/firing/showcommander/safety/preflight.

### 3. `src/components/editor/MobileHUD.tsx` — remover atalho hardware
- Apagar botão Radio (linhas 146-158) que faz `navigate('/command?mode=hardware')`.
- Manter botão Geo (composição de palco).
- Apagar botão PANIC mobile do HUD se existir o equivalente (revisar linhas 125-136).

### 4. `src/components/editor/FullscreenCommandMenu.tsx` — auditar e podar
- Remover comandos: abrir Show Commander, Live Firing, Safety Console, Preflight, Hardware Sync, ARM, FIRE, E-STOP, Pairing, FXK16/FXK32Q test, Continuity Matrix, Field Diagnostics, AutoControllerLauncher.
- Manter: navegação de cena, busca de efeitos, inserir cue, snapshot, export, undo/redo, painéis de composição (timeline, library, layers, terrain, weather visual).

### 5. Painéis de hardware/safety que abriam **de dentro do editor** — desplugar
Não vamos deletar os componentes (eles continuam montados em `/command` e telas dev), só remover os triggers do editor:
- Toolbar não chama mais `onOpenPanel('showcommander')`, `onOpenPanel('livefiring')`, `onOpenPanel('safety')`, `onOpenPanel('easyconnect')`, `onOpenPanel('preflight')`, `onOpenPanel('hardwaresync')`.
- Em `EditorWorkspace`/host de painéis, comentar os `case`s que renderizam: `ShowCommanderPanel`, `LiveFiringPanel`, `SafetyConsole`, `EasyConnectPanel`, `USBConnectionPanel`, `PreflightPanel`, `HardwareSyncPanel`, `FieldDiagnosticsDock`, `GlobalSafetyBar`, `AutoControllerLauncher`, `CommandStatusIndicators`, `ExecutionStatusConsole`, `SystemOverviewConsole`, `ExportReadinessPanel` (advisory, mas remove o framing "BLOCKED"). Vou listar os arquivos exatos quando aplicar — escopo: tudo importado pelo editor que leia `safetyStateMachine.state`, `useWorkMode`, `useFleetStore.showState`, `useUnifiedDiscovery`, `useDeviceAggregator`.

### 6. Joi (FXKAssistant) dentro do editor — sem guardrails de design
- Em `src/utils/joiCommandExecutor.ts`: remover qualquer branch que recuse comandos criativos (insert cue, mover device, mudar cor, gerar formação, importar) por workMode/armed/preflight. Comandos físicos (`arm`, `fire`, `estop`, `connect_hardware`, `pair_device`) continuam **bloqueados pelo aiGuardrail central** — o caminho real não muda. Auditar e listar diff antes.
- Em `FXKAssistant.tsx`: nenhuma checagem de `safetyState` para habilitar/desabilitar input. Joi sempre disponível para conversar e compor.

### 7. SafetyStateMachine — não toca no editor
- `safetyStateMachine.setConditions(...)` em `ShowCommanderPanel` continua existindo (o painel mora em `/command`).
- Componentes que **só** liam estado de safety para gating visual no editor (badges ARMED, dots, locks) são removidos do editor.
- `useLiveSfxStore.activeEffects` é só preview de áudio SFX — desacoplar do conceito "armed" (renomear visualmente; sem CTA `/command`).

### 8. Memórias a atualizar (após implementar)
- `mem://arquitetura/ui-command-gateway-global-estop` → adicionar exceção explícita: **editor 3D NÃO mostra GlobalEStopButton nem ARMED banner**. E-STOP global continua em `/command` e onde quer que comando real seja iniciado.
- `mem://funcionalidades/safety-gate-opt-in` (Quarentena) → reforçar que editor é design-free-zone.
- Nova: `mem://arquitetura/editor-design-zone-no-hardware-ui` — Editor 3D = composição/simulação visual. Zero UI de hardware/arm/E-STOP/preflight/lockout. Hardware e disparos somente em `/command`. Joi no editor sem guardrails de design; guardrail físico central (`aiGuardrail`) continua protegendo comandos reais.

## Fora de escopo (intocado)
- `src/core/safety/SafetyStateMachine.ts`, `uiCommandGateway`, `CommandBus`, `FieldBus`, `safetyBlackBox`, `aiGuardrail` (camada física).
- `/command` (CommandCenter) e suas rotas/painéis — continuam armados com todos os intertravamentos.
- Pairing wizards (`/pairing/*`).
- `workMode` API (continua existindo; o editor simplesmente para de consultar).

## Verificação
- `rg "navigate\\('/command|onOpenPanel\\('(showcommander|livefiring|safety|easyconnect|preflight|hardwaresync)" src/components/editor src/pages/Editor*` → vazio.
- `rg "safetyStateMachine|GlobalEStop|GlobalSafetyBar|FieldDiagnosticsDock|AutoControllerLauncher" src/components/editor src/pages/Editor*` → vazio (exceto componentes que foram movidos exclusivamente para /command).
- Tests: rodar suite; ajustar/remover testes que afirmavam presença de chrome de safety no editor. NÃO mexer em testes do CommandBus/SafetyStateMachine.
- Smoke manual no preview `/editor`: sem banner ARMED, sem botões LIVE/ARM/E-STOP/PANIC, sem dots de hardware, ⌘K só com comandos de composição, Joi responde sem recusar comandos criativos.
