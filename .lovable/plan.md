

# Diagnóstico: SkyCanvas e LOD — Problemas Encontrados

## Problema Crítico: DUPLO ACES Tone Mapping (AINDA PERSISTE)

A correção anterior removeu o Reinhard manual mas **não resolveu** o tone mapping duplo que ainda existe:

```text
Pipeline ATUAL (ainda com duplo tonemap):
  1. Canvas gl config: toneMapping: THREE.ACESFilmicToneMapping ← ACES #1
  2. AdaptiveExposureController: gl.toneMappingExposure ← modifica #1
  3. PostProcessing: <ToneMapping mode={ACES_FILMIC} /> ← ACES #2
  
  Resultado: cores passam por ACES duas vezes → compressão excessiva
```

O Three.js renderer aplica ACES na renderização de cada objeto, e depois o EffectComposer aplica ACES novamente no framebuffer final. Isto é a causa real do "flash branco" — as cores HDR intermediárias ficam comprimidas demais antes do bloom ter chance de capturá-las.

**Correção**: Desabilitar o tone mapping do renderer (`THREE.NoToneMapping`) e manter APENAS o `<ToneMapping>` do PostProcessing como ponto único. O `AdaptiveExposureController` precisa ser adaptado para trabalhar com o pipeline do EffectComposer.

## LOD — Análise vs Referências Finale/Skybrush

Os thresholds do LOD estão corretos para a escala do mundo:

| Tier | Distância | Break heights cobertos | Status |
|------|-----------|----------------------|--------|
| ULTRA | 0-200m | Câmeras close-up (150m) | OK — cobre altitude máxima de shells 3"-4" |
| HIGH | 200-600m | Audience (400-600m) | OK — câmera padrão de plateia |
| MEDIUM | 600-1500m | Aerial/Top (600-1200m) | OK — vistas aéreas |
| LOW | 1500m+ | Satellite view | OK — zoom out extremo |

As break heights do Finale (3"=55m a 12"=280m) e os presets de câmera (audience=500m, front=600m) estão bem alinhados com os tiers. **Nenhuma mudança necessária no LOD.**

## Camera far plane e fog

- `far: 20000` — OK para o skybox de 9000 unidades
- `fogNear: 500, fogFar: 6000` — OK, não corta explosões a distâncias típicas
- `logarithmicDepthBuffer: true` (desktop) — correto para evitar z-fighting na escala grande

## Mudanças Necessárias

### 1. SkyCanvas.tsx — Canvas gl config (CRÍTICO)
- Mudar `toneMapping: THREE.ACESFilmicToneMapping` para `toneMapping: THREE.NoToneMapping`
- Manter `toneMappingExposure: 1.2` (usado como fallback)
- Isto elimina o ACES duplo que está esmagando as cores

### 2. SkyCanvas.tsx — AdaptiveExposureController
- A linha `gl.toneMappingExposure = exposure` não fará nada com `NoToneMapping`
- Alternativa: O AdaptiveExposure deve controlar uma uniform ou o `exposure` do ToneMapping effect via ref
- Solução pragmática: manter o controller mas usar `gl.toneMappingExposure` somente como variável interna, e aplicar o exposure scaling diretamente nas cores das explosões (multiplicar vertex colors pelo exposure value)
- OU: simplesmente remover o AdaptiveExposureController temporariamente — o ACES do PostProcessing já faz rolloff natural de HDR

### 3. PostProcessing.tsx — Manter como está
- `<ToneMapping mode={ToneMappingMode.ACES_FILMIC} />` permanece como ÚNICO ponto de tone mapping

### 4. SkyCanvas.tsx — Aumentar hdrMult de thermalColor
- Com apenas 1 passo de ACES (em vez de 2), as cores terão mais headroom
- Aumentar hdrMult de `0.35` para `1.0` no FireworkBurst
- Aumentar hdrMult dos sparks de `0.5` para `1.5`
- Isto restaura as intensidades HDR que o ACES único processará corretamente

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/components/editor/SkyCanvas.tsx` | `NoToneMapping` no Canvas, ajustar hdrMult, simplificar AdaptiveExposure |
| `src/components/editor/PostProcessing.tsx` | Nenhuma (já está correto) |

