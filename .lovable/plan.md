## Plano: Desktop SkyCanvas + Limpeza/Bugs

### Contexto
Você relatou que **SkyCanvas não abre no desktop**. Confirmei via browser tool que `/auth` em 1366×768 carrega normalmente (login renderiza com `min-h-[100dvh] w-full`). Como `/studio` é protegido, não consigo ver o sintoma direto sem login. Vou abordar em 3 frentes paralelas.

### 1) SkyCanvas desktop — diagnosticar e corrigir o boot

**Sintomas prováveis** (a confirmar com logs assim que o modo de build estiver ativo):
- Spinner infinito → `CanvasLoaderWithTimeout` (8s) deveria mostrar "Reload Studio". Se não aparece, o chunk falha silenciosamente.
- Tela preta sem erro → WebGPU pipeline aborta sem cair no `CanvasErrorBoundary`.
- Crash visível → Já capturado pelo boundary.

**Ações:**
1. Adicionar instrumentação leve no boot do `SkyCanvas` (console.info em fases: `mount → R3F created → first frame`). Isso aparece nos logs do preview na próxima mensagem.
2. Reduzir o timeout do `CanvasLoaderWithTimeout` de 8s para 5s e exibir o **motivo da espera** (qual chunk lazy ainda não resolveu) + botões `Reload` / `Skip GPU layers` / `Force WebGL2 fallback`.
3. Forçar o `useGpgpuBackend` a respeitar um override `?backend=webgl2` na URL (já temos a flag `gpgpu_webgl2_fallback`) — se for problema de WebGPU em desktop, você consegue testar imediatamente.
4. Logar o resultado de `navigator.gpu` + `WebGL2RenderingContext` no `skyCanvasDiagnostics` no mount, e exibir um banner discreto se ambos faltarem.

### 2) Bugs e warnings concretos já vistos

- **`fetchPriority` (camelCase) em `src/pages/Auth.tsx:164`** dispara warning React em produção. Trocar para o atributo lowercase `fetchpriority` via `{...{ fetchpriority: 'high' }}` ou remover (é apenas um logo de 64px).
- **`<meta name="apple-mobile-web-app-capable">` deprecado** em `index.html`. Adicionar também `<meta name="mobile-web-app-capable" content="yes">` mantendo o legacy.
- **Warnings `postMessage target origin mismatch`** vêm de `cdn.gpteng.co/lovable.js` — não é nosso código, ignorar.

### 3) Limpeza dos novos arquivos de cards (Auto-Controller Launcher)

Revisar os arquivos criados no último ciclo e aplicar:
- `AutoControllerLauncher.tsx` — confirmar que **não monta** quando a rota é `/auth`, `/install` ou `/landing` (overlay global em `MainLayout` já cobre isso, mas vou validar e adicionar guard de rota se faltar).
- `HoldToConfirmButton.tsx` — verificar `clearTimeout` no unmount e no `pointercancel` (memory mgmt rule).
- `tuyaOutletControl.ts` / `dmxQuickActions.ts` — garantir retorno honesto `NO_REAL_SENDER` quando não há transporte ativo (regra honest-hardware), e não logar telemetria sintética.
- `PyroControllerCard.tsx` — confirmar que `E-STOP` chama o caminho `<50ms` (CommandBus → SafetyStateMachine), não a API typed que passa pela ARM gate.
- Remover qualquer `console.log` esquecido nos 7 arquivos novos.

### 4) Aprimoramentos pequenos (sem mudar comportamento)

- `controllerRegistry.ts`: extrair os `Set<string>` (`PYRO_KINDS`, `TUYA_KINDS`, `DMX_KINDS`) para uma única fonte com tipo `ControllerFamily` (evita drift entre o launcher e o registry).
- `AutoControllerLauncher.tsx`: aplicar `React.memo` no `CardForKind` para evitar re-render quando outro device atualiza telemetria.
- `useActiveControllers.ts`: garantir cleanup do `deviceAggregator.watch` no unmount (provavelmente já tem, vou confirmar).

### O que não vou tocar
- `src/integrations/supabase/*`, `src/_quarantine/safety/*`, `supabase/config.toml` — protegidos.
- Qualquer reescrita do pipeline WebGPU em si — só instrumento e adiciono fallback opt-in via URL.

### Entregáveis após aprovar
- Você consegue abrir `/studio?backend=webgl2` no desktop como teste.
- Logs do mount do SkyCanvas aparecem no console com cada fase.
- Warning `fetchPriority` some.
- Cards do launcher mais limpos e tipados.

### Pergunta opcional
Se quando você abre `/studio` no desktop você vê **spinner infinito**, **tela preta**, **erro vermelho** ou **algo específico** (ex: chão sem terreno, sem fogos), me diga numa linha que ajusto a frente 1 antes de implementar.