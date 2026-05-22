# Refino UX da câmera no Editor 3D

## Diagnóstico

`CameraController` em `src/components/editor/SkyCanvas.tsx` (linhas 842–1188) tem 3 causas para a sensação de "drag/arrasto" após o usuário girar a visão:

1. **Velocidade subdimensionada** — `rotateSpeed={0.6} × sensitivityScale=0.7 ≈ 0.42`. Sensação de câmera "pesada". `panSpeed` e `zoomSpeed` idem.
2. **Auto-animação roubando o controle** — o `useEffect` (1020–1032) observa `presetKey = targetPosition+targetLookAt`. Qualquer re-render do pai que altere essas props depois do usuário girar dispara `animating.current = true` e o `useFrame` (1097–1099) começa a interpolar a câmera de volta ao preset com `lerp(0.06)` — é literalmente um "puxão" pós-rotação. O mesmo vale para `focus-camera-on-point` disparado por seleção.
3. **`clampToWorldBounds()` rodando todo frame** mesmo idle, com `controls.target.set(...)` quando algum eixo bate no limite — gera micro-saltos.

Sem damping (já `enableDamping={false}`), inércia não é a causa.

## Mudanças (somente `src/components/editor/SkyCanvas.tsx`, escopo UI)

### 1. Trava de auto-animação enquanto o usuário interage

Adicionar refs `userActive` + `lastUserInteractionAt` e listeners `start`/`end` do próprio OrbitControls:

```ts
useEffect(() => {
  const c = controlsRef.current; if (!c) return;
  const onStart = () => {
    userActive.current = true;
    animating.current = false;        // cancela preset/focus em andamento
    focusAnimating.current = false;
    cancelFlyTo();                    // cancela voo geo se ativo
  };
  const onEnd = () => {
    userActive.current = false;
    lastUserInteractionAt.current = performance.now();
  };
  c.addEventListener('start', onStart);
  c.addEventListener('end', onEnd);
  return () => { c.removeEventListener('start', onStart); c.removeEventListener('end', onEnd); };
}, []);
```

E no `useFrame` da animação de preset (linha 1093+), respeitar **grace period de 800 ms** após o último `end`:

```ts
const sinceUser = performance.now() - lastUserInteractionAt.current;
if (userActive.current || sinceUser < 800) {
  clampToWorldBounds();
  return;
}
```

O `useEffect` do `presetKey` (1020–1032) também passa a ignorar mudanças quando `userActive.current || sinceUser < 800` — câmera não é mais "puxada de volta" para o preset depois que o usuário girou.

### 2. Curvas de sensibilidade mais fluidas

```tsx
<OrbitControls
  ref={controlsRef}
  enableDamping={false}        // sem inércia/arrasto (mantém comportamento exigido)
  rotateSpeed={1.0}            // era 0.6 × 0.7 = 0.42
  panSpeed={1.1}               // era 0.8 × 0.7 = 0.56
  zoomSpeed={1.4}              // era 1.2 × 0.7 = 0.84
  screenSpacePanning           // pan respeita o plano da tela — mais previsível
  minPolarAngle={Math.PI * 0.02}
  maxPolarAngle={Math.PI * 0.85}
  minDistance={2}
  maxDistance={90000}
  enablePan
/>
```

Remove o `sensitivityScale = 0.7` global (linha 1107).

### 3. Clamp somente quando há mudança real

`clampToWorldBounds` só roda se `controls.target` ou `camera.position` diferirem do último frame por > 1e-3 (compara contra `_lastClampPos`/`_lastClampTarget` refs). Elimina micro-set por floating-point que cria "tremor".

### 4. Handlers de foco e frame-all respeitam interação ativa

`focus-camera-on-point` e `viewport-frame-all` viram **no-op** se `userActive.current` for true (ou descartam se `sinceUser < 300 ms`). UX: clique acidental durante rotação não interrompe o gesto.

### 5. Cancelamento de intro mais limpo

`cancelIntro` (912–939) passa a usar `controlsRef.current.addEventListener('start', ..., once)` no lugar do `pointerdown` no canvas — evita race com box-select e gizmo.

## Fora de escopo

- Safety state machine, uiCommandGateway, CommandBus/FieldBus, workMode, pairing, edge functions.
- `GeoCameraController` permanece (apenas honra o novo `cancelFlyTo` em `onStart`, que já existe).
- `FreeFlyCamera` (pointer-lock) intocado — é outro modo.

## Verificação

- `bunx vitest run` para garantir zero regressão (suíte 1280+ já existente).
- Smoke manual: girar com botão esquerdo, soltar — câmera para imediatamente, sem retorno a preset; trocar de aba lateral (que costuma re-renderizar SkyCanvas com `targetPosition` igual) não desloca mais a câmera; pan/zoom continuam responsivos.
