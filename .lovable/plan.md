

## Diagnóstico Refinado: Viewport Branco ao dar Play

### Causa Raiz Confirmada

O problema é **saturação HDR acumulativa** no framebuffer. Quando o Play inicia e múltiplos efeitos detonam simultaneamente, várias camadas de luz se somam sem controle:

1. **FireworkBurst** — partículas com `AdditiveBlending` + cores térmicas HDR (emissiveIntensity até 10x)
2. **Break Flash** — esferas `AdditiveBlending` com cor branca (opacity 0.4)
3. **LensFlareController** — sprites aditivas em pool de 10
4. **SparkTrailController** — 1600 sparks máximas com HDR scale até 2.6
5. **GlobalIlluminationController** — probes de luz com `emissionIntensity * 0.6`
6. **SmokeController** — partículas adicionais por burst
7. **Explosion sky scatter** — acumula cor sem cap

Todos esses valores passam pelo PostProcessing com ACES Filmic, mas o renderer usa `THREE.NoToneMapping` — ou seja, o framebuffer acumula HDR sem nenhum clamp intermediário. ACES satura para branco puro quando a luminância de entrada excede ~8-10.

A `_adaptiveExposure` é calculada mas **nunca aplicada ao renderer** (linha 1876: "exposure is consumed by particle HDR scaling") — porém o scaling de partículas (hdrScale) é clampado a 2.4 máximo, insuficiente para compensar a acumulação aditiva de TODAS as outras fontes.

### Plano de Correção (3 arquivos, 5 mudanças)

#### 1. `src/components/editor/SkyCanvas.tsx`

**A. Aplicar exposure adaptativa ao renderer** (dentro de `AdaptiveExposureController`):
- Mudar o renderer de `NoToneMapping` para continuar sem tonemap interno MAS aplicar `gl.toneMappingExposure = _adaptiveExposure` como um multiplicador global que o PostProcessing ACES vai consumir
- Adicionar na useFrame: `gl.toneMappingExposure = THREE.MathUtils.clamp(_adaptiveExposure, 0.3, 1.5);`

**B. Clampar acumulação de luminância** no `AdaptiveExposureController`:
- Atualmente luminância cresce sem limite (`luminance += 3.0` por item, sem cap)
- Adicionar: `luminance = Math.min(luminance, 15);` após o loop
- Tornar o dampening mais agressivo: `1.2 / (1 + luminance * 0.5)` em vez de `0.3`

**C. Reduzir flash intensity dos Break Flash meshes**:
- Linha 624: opacity de `0.4` para `0.2`
- Linha 630: opacity base de `0.15` para `0.08`

**D. Cap no SparkTrailController hdrScale**:
- Linha 2087: clamp máximo de `2.6` para `1.8`

**E. Cap scatter intensity**:
- Linha 1863: `intensity * 0.3` → `Math.min(intensity * 0.3, 0.15)`

#### 2. `src/components/editor/PostProcessing.tsx`

**Baixar thresholds de bloom para reagir menos a acumulação:**
- Layer 1 threshold: `2.0` → `2.5` (captura menos da cena)
- Layer 3 threshold: `4.0` → `6.0` (só extremos)

#### 3. `src/render_ultra/postprocessing/exposure.ts`

**Tornar a resposta de flash mais agressiva:**
- `updateExposure`: mudar fator de dampening de `0.3` para `0.5` na fórmula de targetExposure
- `flashEvent`: limitar redução máxima — `intensity * 0.3` → `intensity * 0.5` mas cap a `state.minExposure`

### Resumo

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `SkyCanvas.tsx` | Aplicar `gl.toneMappingExposure` adaptativo | Multiplica todo o framebuffer pela exposure antes do ACES |
| `SkyCanvas.tsx` | Cap luminância + flash + sparks + scatter | Reduz input HDR acumulado |
| `PostProcessing.tsx` | Subir thresholds de bloom | Bloom não amplifica saturação |
| `exposure.ts` | Dampening mais agressivo | Exposure cai mais rápido em bursts densos |

