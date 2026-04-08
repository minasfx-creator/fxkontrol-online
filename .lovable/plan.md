

# Ciclo #53 — Calibração Física: Decay Exponencial + Wind por Tipo de Partícula

## Auditoria: Especificação vs Implementação Atual

| Parâmetro | Especificação | Atual | Status |
|-----------|--------------|-------|--------|
| Gravidade 9.81 m/s² | ✅ | `GRAVITY = -9.81` | OK |
| Drag quadrático k*v² | ✅ | Implementado em `stepParticle` e `fireworkEngine` | OK |
| Drag ranges (spark 0.08-0.15, ember 0.04-0.08, heavy 0.01-0.04) | ✅ | `DRAG_TABLE` correto | OK |
| Shell velocities (3"→70, 4"→85, 5"→95, 6"→110) | ✅ | `MORTAR_VELOCITY` correto | OK |
| Break heights (3"→105, 4"→140, 5"→190, 6"→260) | ✅ | Dentro dos ranges | OK |
| Burst velocity 30-70 m/s | ✅ | `BREAK_SPEED` 35-65 | OK |
| Star lifetime escalado por calibre | ✅ | `STAR_LIFETIME` correto | OK |
| Fuse ±5% | ✅ | `FUSE_VARIANCE = 0.05` | OK |
| Velocity ±10%, angle ±5°, timing ±3%, brightness ±15% | ✅ | L692-712 | OK |
| Gerb emission 5-20 m/s | ✅ | `createGerbStream` L744 | OK |
| Thermal color ramp (white→yellow→orange→red→charcoal) | ✅ | `thermalColorRamp` | OK |
| **Brightness decay I=I0*e^(-kt)** | k=2.0/1.2/0.6 | **Gaussian: e^(-1.2*t²*3)** | **BUG** |
| **Wind por tipo** (smoke 100%, ember 60%, shell 20%) | Diferenciado | **Flat 0.5 para todos** | **BUG** |

## Bugs a Corrigir

### Bug 1 — Brightness decay usa modelo Gaussiano em vez de Exponencial

**Arquivo:** `src/lib/pyroPhysics.ts` L580

**Atual:** `p.brightness = Math.max(0, Math.exp(-1.2 * lifeRatio * lifeRatio * 3.0));`

Isso é `e^(-3.6*t²)` — decaimento Gaussiano que cai muito rápido no meio e fica plano no início. Estrelas reais têm decaimento exponencial puro `I = I0 * e^(-k*t)` onde t é o ratio de vida.

**Fix:** Aceitar `decayRate` como parâmetro em `stepParticle` e `ParticleState`:
```
// Add to ParticleState interface:
decayRate?: number;  // k in I=I0*e^(-kt). Default 1.2 (medium)

// In stepParticle L580:
const k = p.decayRate ?? 1.2;
p.brightness = Math.max(0, p.brightness * Math.exp(-k * lifeRatio));
// Correct formula: brightness based on absolute life ratio
p.brightness = Math.max(0, Math.exp(-k * lifeRatio));
```

Atualizar `createShellBurst` para atribuir `decayRate` baseado no padrão:
- Dahlia, crossette → k=2.0 (rápido)
- Peony, chrysanthemum, sphere → k=1.2 (médio)
- Willow, kamuro, horsetail, brocade → k=0.6 (lento)

### Bug 2 — Wind influence flat 0.5 para todos os tipos de partícula

**Arquivo:** `src/lib/pyroPhysics.ts` L540-542

**Atual:** Todas as partículas recebem `wind * 0.5` independente do tipo.

**Fix:** Adicionar `windInfluence` ao `ParticleState` e usar em `stepParticle`:
```
// Add to ParticleState:
windInfluence?: number;  // 0-1 factor. Default 0.6 (ember)

// In stepParticle:
const windFactor = p.windInfluence ?? 0.6;
p.vx += wind[0] * dt * windFactor;
p.vy += wind[1] * dt * windFactor;
p.vz += wind[2] * dt * windFactor;
```

Atribuir nos criadores:
- `createShellBurst` → 0.6 (stars = embers médios)
- `createGerbStream` → 0.8 (sparks leves)
- `createMineBurst` → 0.7
- `createWaterfallParticle` → 0.9 (partículas leves, alto wind influence)
- Glitter trails → 0.5 (pequenas mas densas)

### Bug 3 — Shell wind no fireworkEngine usa hardcoded 0.20 mas ignora wind Y

**Arquivo:** `src/core/engine/fireworkEngine.ts` L77-78

Shell bodies corretamente ignoram `wind[1]` (vento vertical quase não afeta shells pesados). Isto está OK — 20% é correto para shells. Sem mudança necessária.

## Arquivos Afetados

- `src/lib/pyroPhysics.ts` — ParticleState interface + stepParticle + criadores de burst
- Nenhum outro arquivo precisa mudar (todos usam `stepParticle` via pyroPhysics)

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Adicionar `decayRate` e `windInfluence` ao ParticleState |
| 2 | Corrigir `stepParticle` para usar exponencial puro e wind por tipo |
| 3 | Atribuir valores corretos em todos os criadores de partículas |
| 4 | Build verification |

