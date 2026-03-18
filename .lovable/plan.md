

# Plano: Melhorias Avançadas em Fogos e Efeitos Especiais

Três frentes: (1) novos comportamentos de burst (pistil, multi-break, color-change), (2) novos renderizadores 3D para efeitos ausentes, (3) melhorias de realismo e UI/UX.

---

## 1. Pistil, Multi-Break e Color-Change Stars

**Arquivo: `src/components/editor/effects/ShellBurstRenderer.tsx`**

- **Pistil**: Quando `hasPistil=true` no VDL, gerar um segundo grupo de partículas (20-30% da contagem) no centro do burst com cor diferente (`pistilColor`), velocidade 40% menor e lifetime 80% do principal. Renderizar como segundo `<points>` dentro do mesmo grupo, usando o mesmo shader mas com `uColor` = pistilColor.

- **Color-Change Stars**: Adicionar uniform `uColor2` e `uColorChangePoint` (0-1) ao fragment shader. Quando `colorTransition === 'to'`, interpolar de `uColor` para `uColor2` baseado em `lifeRatio` ao redor do ponto de troca. Modificar a seção de thermal color para:
  ```glsl
  vec3 baseHue = mix(uColor, uColor2, smoothstep(uColorChangePoint - 0.1, uColorChangePoint + 0.1, rawRatio));
  ```

- **Multi-Break**: Novo componente `MultiBreakShell` no `ShellExplosionManager.tsx`. Quando `numDevices > 1`, disparar N bursts escalonados em altitudes decrescentes (breakHeight * 1.0, * 0.7, * 0.5) com delays de 0.3-0.5s entre cada break. Cada break é um `ShellBurstRenderer` independente.

**Arquivo: `src/lib/pyroPhysics.ts`**
- Adicionar `createMultiBreakTimings(caliber, breakCount)` que retorna array de `{height, delay, starCount}`.

---

## 2. Novos Renderizadores de Efeitos

**Novo: `src/components/editor/effects/SaluteEffect.tsx`**
- Flash esférico branco intenso (0.1s), ring shockwave expansivo, sem estrelas visíveis. Usar `<mesh>` com `sphereGeometry` + rápido scale-up e fade. Adicionar camera shake sutil via ref ao Three.js camera (deslocamento de 0.02 unidades por 0.15s).

**Novo: `src/components/editor/effects/TourbillonEffect.tsx`**
- Partículas em espiral ascendente: trajetória helicoidal (sin/cos * raio crescente + velocidade Y constante). Trail de faíscas por trás. No topo, mini-burst opcional. Usar o particle system existente com velocidades pré-calculadas em espiral.

**Novo: `src/components/editor/effects/SetPieceEffect.tsx`**
- Grade de lances (pontos luminosos estáticos) formando texto/imagem. Recebe array de coordenadas 2D (do `positions` ou gerado por SVG). Cada lance acende sequencialmente com jitter de timing. Usar `InstancedMesh` com emissive material.

**Novo: `src/components/editor/effects/WheelEffect.tsx`**
- Partículas emitidas radialmente de pontos que giram em torno de um eixo central. Velocidade angular configurável. Trail de gerb em cada braço. Usar `useFrame` para rotacionar o grupo emissor.

**Atualizar: `src/components/editor/effects/index.ts`**
- Exportar os 4 novos componentes.

---

## 3. Realismo na Renderização

**Arquivo: `src/components/editor/effects/ShellBurstRenderer.tsx`**
- **Glitter trail**: Quando `trailType === 'glitter'`, emitir micro-partículas (2-3 por frame por estrela ativa) na posição atual de cada estrela com velocidade herdada * 0.1 e lifetime curto (0.3s). Usar segundo `<points>` com tamanho menor e opacidade reduzida.
- **Falling leaves**: Quando `fallingLeaves=true`, adicionar componente sinusoidal à velocidade X/Z (oscilação lateral lenta: `vx += sin(time * 2 + seed) * 0.5`) e reduzir gravidade para 30%.

**Arquivo: `src/lib/pyroPhysics.ts`**
- `createGlitterTrailParticle(parent: ParticleState)`: gera partícula-filha na posição do pai.
- Ajustar `stepParticle` para aceitar modificadores opcionais `{fallingLeaves, reducedGravity}`.

---

## 4. Melhorias UI/UX do Editor de Efeitos

**Arquivo: `src/components/editor/EffectEditor.tsx`**
- Adicionar toggles visuais para `hasPistil` (com color picker para pistilColor), `colorTransition` (selector: none/to/changing) e segundo color picker quando transition !== none.
- Adicionar slider para `numBreaks` (1-4) quando partType === 'shell'.
- Preview visual: mini-canvas animado (128x128) mostrando silhueta do burst pattern selecionado com as cores escolhidas.

**Arquivo: `src/components/editor/EffectLibrary.tsx`**
- Adicionar badges visuais na tabela: ícone de pistil, ícone de multi-break, ícone de color-change quando o efeito tem esses atributos.
- Filtro rápido por tipo de burst pattern (peony, willow, kamuro, etc.) como chips clicáveis.

---

## Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `ShellBurstRenderer.tsx` — pistil, color-change shader, glitter, falling leaves |
| Editar | `ShellExplosionManager.tsx` — multi-break orchestration |
| Editar | `pyroPhysics.ts` — multi-break timings, glitter particles, falling leaves modifier |
| Criar | `SaluteEffect.tsx` — flash + shockwave |
| Criar | `TourbillonEffect.tsx` — espiral ascendente |
| Criar | `SetPieceEffect.tsx` — lances formando imagens |
| Criar | `WheelEffect.tsx` — roda giratória |
| Editar | `effects/index.ts` — exportar novos |
| Editar | `EffectEditor.tsx` — UI pistil/color-change/multi-break |
| Editar | `EffectLibrary.tsx` — badges + filtros de pattern |

