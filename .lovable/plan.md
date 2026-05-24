# Effect Behavior Map — vetor + cinemática canônica por família

## Diagnóstico

Hoje cada renderer em `src/components/editor/effects/` (Comet, Mine, Shell/Salute, FallingLeaves dentro de Shell, RomanCandle, Cake, Gerb, etc.) **inventa seus próprios vetores**: alguns usam Pan/Tilt da effect lib, outros ignoram, outros usam ângulo do parent. Resultado: comet sai pra direção errada, mine não respeita fan, salute estoura redondo demais, falling leaves cai reto sem swirl.

Já existem fontes canônicas **subutilizadas**:
- `src/lib/finalePanTiltSpin.ts` — PTS canônico Finale 3D
- `src/render/silhouettes/{mineSilhouettes,bengalSilhouettes}.ts` — só Mine+Bengal cobertos
- `src/data/fwsimGraphicsConfig.json` — curvas FWsim (já wired em flashes/bloom/tonemap, **não** em cinemática)
- `src/lib/vdlFiringPatterns.ts` — fan/angle resolver (não consumido pelos renderers)

## Solução: 1 mapa canônico + adapter por renderer

### 1. Criar `src/render/behavior/effectBehaviorMap.ts`

Tabela pura, data-in/data-out (zero Three.js), por `RendererKind` do `effectRouter`:

```ts
type EffectBehavior = {
  kind: RendererKind;
  // Vetor de lançamento (local frame, +Y = up audience-facing)
  launch: { mode: 'pts' | 'pattern-fan' | 'parent-vector' | 'omni'; jitterDeg: number };
  // Cinemática de cada partícula/projétil pós-eject
  motion: {
    gravity: number;          // m/s² (9.81 padrão, 4.5 falling-leaves)
    drag: number;             // exp(-k·dt)
    initialSpeed: [min, max]; // m/s
    spread: { coneDeg: number; bias: 'uniform'|'gaussian'|'silhouette' };
    swirl?: { axis: 'y'|'tangent'; rpm: number };   // falling leaves, willow
    bouquetSplit?: { atLifeRatio: number; childCount: number }; // crossette, peony-with-pistil
  };
  // Tail/trail
  tail: { type: 'none'|'glitter'|'glitter-strobe'|'willow-drag'|'comet-thick'; lengthMul: number };
  // Apagamento
  decay: { lifeMul: number; colorPhase: 'newton'|'planckian'|'flat' };
};
```

Cobrir: `comet`, `mine`, `shell-peony`, `shell-dahlia`, `shell-chrysanthemum`, `shell-willow`, `shell-palm`, `shell-crossette`, `shell-ring`, `shell-salute/salute`, `falling-leaves`, `bombette`, `roman-candle`, `cake-bombette`, `gerb`, `whistle`, `farfalle`, `tourbillon`, `bengal`, `lancework`, `setpiece`.

Valores ancorados em: `fwsimGraphicsConfig` (sparks/flashes), `mineSilhouettes` (fan), Piroex/Skyking ballistics (já em memória) e Finale `finalePanTiltSpin` para resolução de vetor.

### 2. Helper `resolveEffectVector(effect, behavior, parent)`

`src/render/behavior/resolveEffectVector.ts`: combina `effect.pan/tilt/spin` (PTS canônico) + `parent.heading` + `behavior.launch.jitterDeg` → `THREE.Vector3` unit + speed. Um único helper, todos os renderers chamam.

### 3. Wiring por renderer (rodada por família, não tudo de uma vez)

Pass A (esta rodada): **Comet, Mine, Salute/Salute-shell, FallingLeaves** (os 4 que o usuário citou).
- `CometEffect.tsx`: passa a usar `resolveEffectVector` (hoje usa apenas tilt fixo); thickness do tail vem de `behavior.tail.lengthMul`.
- `MineEffect.tsx`: já usa silhuetas — adicionar `pattern-fan` do behavior pra escolher 5/7/9 jets via `vdlFiringPatterns` ao invés do hardcode.
- `SaluteEffect.tsx` + branch salute do `ShellBurstRenderer`: corrigir spread (hoje cone 360°/uniform) pra `silhouette` bias com expansão hard-stop curta e flash branco-azul do `fwsimGraphicsConfig.flashes.explosion`.
- Falling leaves (hoje dentro de `ShellBurstRenderer`/peony branch): isolar em behavior `shell-willow`/`falling-leaves` com `gravity: 4.5` + `swirl.tangent 22rpm` + `tail: willow-drag` + lifetime 2.6× peony.

Pass B (rodadas seguintes, fora desta tarefa): demais 17 famílias, atrás de flag `r_behavior_map_v1`.

### 4. Flag + testes

- Flag `r_behavior_map_v1` (default ON) — fallback OFF preserva renderers atuais bit-equivalent.
- 4 specs novos em `src/render/behavior/__tests__/`:
  - `effectBehaviorMap.spec.ts` — toda família coberta, valores finitos, ranges sãos.
  - `resolveEffectVector.spec.ts` — PTS Fig2/Fig3 do `finale-pan-tilt-spin.md` (pan=90/tilt=45 → vetor canônico).
  - `cometVector.spec.ts` — comet a 30° de tilt sai a 30°, não vertical.
  - `fallingLeavesSwirl.spec.ts` — swirl positivo e gravity reduzida vs peony.

### 5. Out-of-scope nesta rodada

- Sem mudar `vdlQuantizer` (Finale 3D spec).
- Sem mexer em `PostProcessing` (FWsim steps 3/4 ficam intocados).
- Sem renderizar drone — só pyro families.
- Sem mover arquivos de renderer; só adicionar import do helper.

## Arquivos novos
- `src/render/behavior/effectBehaviorMap.ts`
- `src/render/behavior/resolveEffectVector.ts`
- `src/render/behavior/__tests__/effectBehaviorMap.spec.ts`
- `src/render/behavior/__tests__/resolveEffectVector.spec.ts`
- `src/render/behavior/__tests__/cometVector.spec.ts`
- `src/render/behavior/__tests__/fallingLeavesSwirl.spec.ts`

## Arquivos editados (Pass A)
- `src/components/editor/effects/CometEffect.tsx`
- `src/components/editor/effects/MineEffect.tsx`
- `src/components/editor/effects/SaluteEffect.tsx`
- `src/components/editor/effects/ShellBurstRenderer.tsx` (branch falling-leaves só)
- `src/lib/featureFlags.ts` (+ `r_behavior_map_v1`)

## Memory
Salvar `mem://funcionalidades/effect-behavior-map-v1` ao concluir.
