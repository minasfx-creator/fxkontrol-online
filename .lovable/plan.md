

# Refinamento Arquitetural — Falhas Concretas e Melhorias Acionáveis

## Contexto

O relatório descreve a arquitetura ideal para a plataforma FXK: renderização instanciada zero-GC, física GPU-driven, streaming serverless, e interface HUD/AR. Ao comparar com o código real, identifico falhas concretas que violam os próprios princípios que o documento estabelece.

---

## Falhas Críticas Identificadas

### 1. GC Pressure no Hot Loop do InstancedDroneSwarm (BUG GRAVE)

**Ficheiro:** `src/components/editor/InstancedDroneSwarm.tsx`, linhas 185-186 e 230

O documento exige "Zero-GC in hot path", mas dentro do `useFrame` (60fps) existem **alocações por frame**:

```typescript
// Linha 185 — DENTRO do useFrame, DENTRO de loop for (count * 4 iterações)
_mat4.premultiply(new THREE.Matrix4().makeRotationY(...));
_mat4.scale(new THREE.Vector3(s, s, s));

// Linha 230 — DENTRO do useFrame
const rotMat = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
```

Para 2000 drones com 4 rotores cada = **8000 `new Matrix4()` + 8000 `new Vector3()` por frame** = ~480.000 alocações/segundo. Isto causa GC stutters visíveis.

**Fix:** Pre-alocar `_rotMat` e `_scaleVec` como singletons module-level, reutilizando-os no loop.

### 2. `_color.set(ledColor)` com String Parse no Loop (PERFORMANCE)

**Ficheiro:** `InstancedDroneSwarm.tsx`, linha 189

`_color.set(ledColor)` dentro do loop do rotor faz parse de string hex por iteração. Já existe `hexToRGB()` para o LED, mas o rotor usa o setter genérico. Deveria reusar o cache.

### 3. PyroSafetyZones — Alocações Dentro de Função Chamada Frequentemente

**Ficheiro:** `src/components/editor/skycanvas/PyroSafetyZones.tsx`, linhas 218-232

```typescript
const origin = new THREE.Vector3(...);
const vel = new THREE.Vector3(0, mortarVel, 0);
vel.applyAxisAngle(new THREE.Vector3(1, 0, 0), ...);
vel.applyAxisAngle(new THREE.Vector3(0, 1, 0), ...);
```

4 alocações Vector3 por trajeto calculado. Se chamado para centenas de posições, gera pressão de GC significativa.

**Fix:** Singletons module-level `_origin`, `_vel`, `_axisX`, `_axisY`.

### 4. FireworkRenderer — 1467 Linhas, Monólito Massivo

O documento prega separação ECS com sistemas isolados. O FireworkRenderer concentra:
- Burst particle physics (513+ linhas de switch/case)
- Trail rendering
- Pistil sub-systems
- Crossette sub-breaks
- Timeline orchestration
- Live SFX effects

**Melhoria:** Não propor refactor total agora, mas documentar que os pattern branches (peony, willow, crossette, etc.) poderiam ser extraídos para um módulo `burstPatterns.ts` que retorna configs de velocidade/lifetime, eliminando o switch gigante.

### 5. `instancedParticleRenderer.ts` — `depthTest: false` Global

**Ficheiro:** `src/render_ultra/fireworks/instancedParticleRenderer.ts`, linha 114

`depthTest: false` faz com que partículas de spark renderizem **por cima de tudo**, incluindo terreno e drones. O documento recomenda `depthWrite: false` (correto) mas manter `depthTest: true` para preservar oclusão correta com a cena.

**Fix:** Remover `depthTest: false`, manter apenas `depthWrite: false`.

### 6. `_colorCache` sem Limite de Tamanho

**Ficheiro:** `InstancedDroneSwarm.tsx`, linha 20

```typescript
const _colorCache = new Map<string, [number, number, number]>();
```

Cresce infinitamente. Em shows com cores dinâmicas (generative engine), pode acumular milhares de entradas.

**Fix:** Limitar a 256 entradas com eviction simples.

---

## Plano de Implementação

### Fase 1 — Eliminar GC no Hot Loop do Drone Swarm
- Pre-alocar `_rotMat`, `_scaleVec` como singletons module-level
- Substituir `new THREE.Matrix4()` e `new THREE.Vector3()` dentro do `useFrame`
- Usar `_color` pré-alocado com dados do cache RGB em vez de `.set(string)` no loop dos rotores
- Limitar `_colorCache` a 256 entradas

### Fase 2 — Corrigir depthTest no Instanced Renderer
- Remover `depthTest: false` do `instancedParticleRenderer.ts`
- Manter `depthWrite: false` (correto para blending aditivo)

### Fase 3 — Eliminar Alocações no PyroSafetyZones
- Pre-alocar `_origin`, `_vel`, `_axisX`, `_axisY` como singletons

### Fase 4 — Type Safety e Build Verification
- Verificar compilação com `tsc --noEmit`

## Ficheiros Afetados

| Ficheiro | Ação |
|---|---|
| `src/components/editor/InstancedDroneSwarm.tsx` | Eliminar ~16.000 alocações/frame |
| `src/render_ultra/fireworks/instancedParticleRenderer.ts` | Fix depthTest |
| `src/components/editor/skycanvas/PyroSafetyZones.tsx` | Singletons para cálculos de trajeto |

## Impacto Esperado

- Redução de GC pauses de ~2-5ms/frame para ~0ms no swarm renderer
- Oclusão correta de partículas com cena 3D
- Menor pressão de memória em shows longos com cores dinâmicas

