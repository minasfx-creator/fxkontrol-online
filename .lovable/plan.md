

# Diagnóstico: Flash Branco nos Efeitos Pyro

## Causa Raiz: Triple Tone Mapping

O pipeline de cores está aplicando tone mapping **3 vezes consecutivas**, comprimindo as cores das partículas ao ponto de ficarem invisíveis. Apenas o flash esférico de detonação (meshBasicMaterial branco com AdditiveBlending) sobrevive visível.

```text
Pipeline ATUAL (quebrado):
  thermalColor() → HDR (até 10x)
       ↓
  JS: lumaTonemapScale() [Reinhard #1] → comprime para ~0.3-0.5
       ↓
  GLSL: tonemapLuma() [Reinhard #2] → comprime para ~0.2-0.35
       ↓
  PostProcessing: ACES Filmic [Tonemap #3] → comprime para ~0.1-0.25
       ↓
  RESULTADO: partículas quase invisíveis, só o flash branco aparece
```

## Pipeline Corrigido

```text
Pipeline CORRETO:
  thermalColor() → HDR moderado (1.5x max)
       ↓
  JS: cores passadas direto como vertex colors (sem tonemap manual)
       ↓
  GLSL: cores usadas direto, sem tonemapLuma()
       ↓
  PostProcessing: ACES Filmic [ÚNICO tonemap] → compressão natural HDR→SDR
       ↓
  RESULTADO: cores químicas visíveis com transição térmica completa
```

## Mudanças Necessárias

### 1. SkyCanvas.tsx — FireworkBurst (componente ativo para timeline)

- **Remover** `lumaTonemapScale()` do cálculo de cores por partícula (linhas ~527-530)
- **Reduzir** hdrMult passado para `thermalColor()` de `1.0` para `0.35` (a PostProcessing ACES já amplifica)
- **Passar** cores diretamente como vertex colors sem compressão manual
- **Reduzir** opacidade do break flash sphere de `0.7` para `0.4` e o segundo flash de `0.3` para `0.15`
- **Aumentar** baseSize ligeiramente (+30%) para melhor visibilidade

### 2. SkyCanvas.tsx — STAR_FRAGMENT_SHADER

- **Remover** a função `tonemapLuma()` e a linha `vec3 mapped = tonemapLuma(col)`
- **Usar** `col` diretamente no `gl_FragColor` — o PostProcessing ACES faz a compressão
- O shader já produz valores moderados (~1.0-1.5) via core/outer/youth blending

### 3. ShellBurstRenderer.tsx — BURST_FRAGMENT

- **Remover** `tonemapLuma()` do fragment shader
- **Reduzir** `whiteHot` multiplier de `(0.55 + uHDRMultiplier * 0.4)` para `(0.4 + uHDRMultiplier * 0.15)` — mantém ignição visível sem saturar
- **Reduzir** `saturated = uColor * 1.25` para `uColor * 1.0`
- **Usar** `thermalColor * glow` direto no `gl_FragColor`

### 4. SkyCanvas.tsx — SparkTrailController

- **Remover** `lumaTonemapScale()` do cálculo de cores dos sparks (linhas ~2068-2070, 2104-2107)
- **Reduzir** hdrMult de `2.5` para `0.5`

### 5. SkyCanvas.tsx — CrossetteSubBurst colors

- **Remover** tonemapping inline do CrossetteSubBurst no ShellBurstRenderer (linhas ~452-457)
- Usar cores diretas com fade simples

### 6. PostProcessing.tsx — Manter como único tonemap

- Manter `<ToneMapping mode={ToneMappingMode.ACES_FILMIC} />` — este é o ÚNICO ponto de tone mapping
- Nenhuma alteração necessária aqui

### 7. Reduzir burstFlashIntensity default

- No `useSceneStore.ts`, reduzir `burstFlashIntensity` default de `1.0` para `0.6`

## Arquivos Afetados

| Arquivo | Tipo de mudança |
|---|---|
| `src/components/editor/SkyCanvas.tsx` | Remover Reinhard duplo do FireworkBurst, SparkTrails, e shaders |
| `src/components/editor/effects/ShellBurstRenderer.tsx` | Remover tonemapLuma do BURST_FRAGMENT |
| `src/store/useSceneStore.ts` | Reduzir burstFlashIntensity default |

