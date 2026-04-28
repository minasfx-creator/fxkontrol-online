# Fix: Viewport 3D preto no modo desktop (`/studio`) — `THREE.WebGLRenderer: Context Lost`

## Diagnóstico

O console confirma o sintoma reportado:

```
[AdaptiveLOD] FPS 138 → raising to ULTRA
THREE.WebGLRenderer: Context Lost.
```

Sequência do bug:
1. `/studio` carrega → `SkyCanvas` cria `<Canvas>` com `dpr={[1.5, 2]}`, `shadows`, `logarithmicDepthBuffer`, `powerPreference: 'high-performance'`.
2. AdaptiveLOD detecta 138 FPS e **promove para ULTRA** muito cedo (segundos após boot, antes do mundo terminar de carregar).
3. A escalada para ULTRA dispara: shadow map maior, mais luzes com `castShadow`, GI/LensFlare/ContactShadows montados via `DelayedMount(400)`, GPGPU em alta resolução. O driver perde o contexto WebGL.
4. `ContextLossGuard` chama `reportCrash()` — após 3 perdas em janela curta entra em **cooldown de 10s** e suprime o remount: `console.error('[FXK] WebGL context lost — in cooldown, suppressing remount')`. Resultado: canvas fica preto permanentemente, mas o HUD continua atualizando o FPS (~144) porque é DOM puro — exatamente o que vemos no session replay.
5. O `silentCanvasFailure` probe (3s) não dispara porque o `<canvas>` existe e tem dimensões — só está sem contexto. Logo o `SimplifiedSkyFallback` nunca aparece e o usuário fica sem saída.

## Causas raiz (4 bugs)

1. **Promoção precoce para ULTRA**: AdaptiveLOD reage ao FPS do splash/cena vazia (138 fps fácil), aumenta carga e crasha o GPU.
2. **DPR agressivo em desktop**: `dpr=[1.5, 2]` em monitor 1067×672 com `devicePixelRatio=1.25` força ~2.6 megapíxels efetivos somados aos render targets de bloom/SSR/GPGPU.
3. **Cooldown sem fallback visível**: quando `reportCrash` entra em cooldown, o usuário não recebe mensagem nem pode fazer retry — o `SimplifiedSkyFallback` só responde a `webglIssue`/`silentCanvasFailure`, não a context-loss em cooldown.
4. **Falta detecção de "canvas sem contexto"**: o probe verifica dimensões mas não `gl.isContextLost()`.

## Plano de implementação

### 1. Reduzir pressão inicial sobre o GPU (`src/components/editor/SkyCanvas.tsx`)
- Cap de DPR desktop: `dpr={isMobile ? [1, 1.25] : [1, Math.min(window.devicePixelRatio, 1.5)]}` (era `[1.5, 2]`).
- Aumentar `DelayedMount` de heavy lighting de **400 ms → 1500 ms** para dar tempo do mundo estabilizar antes de adicionar GI/LensFlare/ContactShadows.
- Adicionar `failIfMajorPerformanceCaveat: false` ao `gl` config (evita falha em GPUs marginais).

### 2. Aquecer AdaptiveLOD (`src/hooks/useFXKUltraRefinement.ts` ou onde mora a promoção)
- Ignorar amostras de FPS nos primeiros **5 segundos** após mount (warm-up window). Hoje promove para ULTRA com 138 fps medidos antes do mundo carregar.
- Exigir 3 amostras consecutivas acima do threshold para promover (debounce já parece existir para descer; aplicar simétrico para subir).

### 3. Tornar context-loss cooldown visível e recuperável (`src/components/editor/skycanvas/watchdogs.tsx` + `SkyCanvas.tsx`)
- `ContextLossGuard.onLost`: quando `isInCooldown()` for true, **propagar** o estado para o componente pai via callback `onUnrecoverable(reason)`.
- `SkyCanvas` recebe esse callback, seta `setSilentCanvasFailure('WebGL context lost repeatedly — entering safe mode. Click retry to attempt recovery.')` e renderiza o `SimplifiedSkyFallback` existente.
- Botão "Retry" do fallback: zerar `_crashRecord` em `runtimeSafety.ts` (exportar `resetCrashRecord()`) antes de `setWebglRetryKey(k+1)`.

### 4. Detectar canvas sem contexto no probe silencioso
- Em `silentCanvasFailure` probe: além de checar dimensões, chamar `gl?.isContextLost?.()` no renderer R3F (acessível via ref do `onCreated`). Se contexto perdido aos 3s, acionar fallback.

### 5. Reduzir shadow casters (alinhado com memória de boas práticas R3F)
- `src/components/editor/skycanvas/sceneLighting.tsx`: garantir que apenas a `moon` directional cast shadow (já é o caso). Verificar `GroundSystem.tsx:1197` (`<mesh castShadow>` em altura 50m) — desnecessário para um helper, remover `castShadow`.

## Arquivos afetados

```text
src/components/editor/SkyCanvas.tsx              (DPR cap, DelayedMount delay, gl flag, callback prop)
src/components/editor/skycanvas/watchdogs.tsx    (onUnrecoverable callback no ContextLossGuard)
src/components/editor/skycanvas/GroundSystem.tsx (remover castShadow do helper mesh)
src/hooks/useFXKUltraRefinement.ts               (warm-up window de 5s antes de promover qualidade)
src/lib/hardening/runtimeSafety.ts               (exportar resetCrashRecord)
```

## Validação pós-fix

- Recarregar `/studio` → canvas 3D renderiza mundo (skybox + ground) dentro de 1s.
- Console não mostra `WebGL context lost` no boot.
- Forçar perda manual via DevTools (`gl.getExtension('WEBGL_lose_context').loseContext()`) → fallback aparece com botão Retry funcional.
- Bundle size inalterado (somente lógica).

Sem mudanças em backend, rotas ou store. Mudanças isoladas ao pipeline de render do `SkyCanvas`.