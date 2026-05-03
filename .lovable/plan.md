# SkyCanvas 2.0 — Continuação da implantação (hardening + adoção)

O núcleo já está pronto (`src/components/show3d/v2/`): 1 draw-call por layer, pool de bursts, time via ref, zero re-render por tick. Esta fase foca em **robustez de produção** e **adoção controlada**.

## Objetivos
1. Não quebrar a UI quando WebGL cai (context-loss, GPU reset, troca de aba).
2. Manter FPS estável em laptops modestos (DPR adaptativo + budget de partículas).
3. Liberar SkyCanvas 2.0 como engine padrão atrás de feature flag, com fallback ao mount atual em caso de erro.
4. Garantir limpeza determinística (dispose) e cobertura mínima de smoke test.

## Arquivos novos
```text
src/components/show3d/v2/
  SkyCanvas2ErrorBoundary.tsx        # boundary + UI fallback Vantablack
  WebGLContextRecovery.tsx           # hook+component que escuta webglcontextlost/restored
  AdaptiveDPRController.tsx          # ajusta dpr in-canvas via useThree
  PerfHUD.tsx                        # FPS/draw/particles overlay (toggle ?perf=1)
  __tests__/skyCanvas2.smoke.spec.tsx
```

## Arquivos modificados
```text
src/components/show3d/v2/SkyCanvas2.tsx        # boundary + recovery + adaptive DPR + onCreated dispose
src/components/show3d/v2/ExplosionsLayer.tsx   # dispose geom/material no unmount; freeze sem ativos
src/components/show3d/v2/LightPointsLayer.tsx  # dispose; skip frame quando count=0
src/components/show3d/v2/PyroPadsLayer.tsx     # InstancedMesh (1 draw call) em vez de map<mesh/>
src/lib/featureFlags.ts                        # add 'skycanvas_v2' (default false em prod, true em dev)
src/components/editor/SkyCanvasMount.tsx       # se flag ON → renderiza SkyCanvas2 dentro do mesmo container
src/pages/dev/SkyCanvas2Demo.tsx               # ?perf=1 mostra HUD; toggle stars/grid
```

## Detalhes técnicos

### 1. ErrorBoundary
Class component que envolve `<Canvas>`. Em `componentDidCatch` mostra card Vantablack/cyan com botão "Reiniciar viewport" (remonta com `key` incrementada). Loga via `logger.warn` (não crashea o editor).

### 2. WebGL context-loss recovery
Dentro do `<Canvas>` via `onCreated={({ gl }) => …}`:
- `gl.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); setLost(true); })`
- `addEventListener('webglcontextrestored', () => setLost(false))`
- Quando `lost`, suspendemos `useFrame` (componente nulo) e mostramos overlay "GPU recuperando…". Sem reload de página.

### 3. AdaptiveDPRController
Usa `useThree(state => state.gl)` + média móvel de FPS (10 frames). Regras:
- FPS < 35 por 2s → `setDpr(max(1, dpr-0.25))`
- FPS > 110 por 4s → `setDpr(min(1.75, dpr+0.25))`
- Limites do prop `dpr` respeitados.

### 4. Pool dinâmico em ExplosionsLayer
Hoje `POOL_SIZE = 256` é fixo. Adicionar prop opcional + downscale automático quando AdaptiveDPR atinge piso (POOL → 128). Limpeza: no unmount, `geometry.dispose()` e `material.dispose()`.

### 5. PyroPadsLayer → InstancedMesh
Substitui `pads.map(p => <mesh/>)` por uma `InstancedMesh` única (rings). Dispose ao desmontar. Ganho: N pads → 1 draw call.

### 6. PerfHUD (opt-in `?perf=1`)
Lê `gl.info.render` por frame, exibe: FPS médio, draw calls, triangles, dpr atual, bursts ativos (do pool). Sem `setState` por frame — escreve via ref no DOM.

### 7. Feature flag `skycanvas_v2`
- Default: `dev = true`, `prod = false` (toggle por localStorage `fxk.flag.skycanvas_v2`).
- `SkyCanvasMount` lê o flag; se ON e o boundary não tripou, usa `SkyCanvas2`. Se OFF ou houve erro → mantém o mount atual (zero risco).

### 8. Smoke test
`skyCanvas2.smoke.spec.tsx` (Vitest + jsdom): renderiza `<SkyCanvas2 />` com store mockado contendo 1 pad + 1 cue firework, garante que monta sem throw e que o boundary não foi acionado. Validamos selectors puros (já testáveis).

## Não-objetivos / fora do escopo
- Sem mudanças em `safetyStateMachine`, `commandBus`, `fieldBus`, `workMode`. Camada de apresentação apenas.
- Sem novas dependências (continua só `three`, `@react-three/fiber@^8.18`, `@react-three/drei@^9.122`).
- Sem alterações em `get-maps-key` / Google Tiles (out of scope desta fase).

## Critérios de aceite
- `/dev/skycanvas-2?perf=1` mostra HUD com FPS estável > 60 em laptop integrado.
- Forçar context-loss (`WEBGL_lose_context`) → overlay aparece, sem white screen, restaura ao recuperar.
- Flag OFF: comportamento idêntico ao atual. Flag ON com bug → boundary devolve fallback e loga.
- `bun vitest run skyCanvas2.smoke` verde.
- Sem warning novo no console em `/dev/skycanvas-smoke` e `/dev/skycanvas-2`.
