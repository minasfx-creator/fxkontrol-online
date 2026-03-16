

## Plano: Aplicar Pipeline de Renderização do Blender (Corrigir Viewport Branco)

### Causa Raiz Definitiva

O renderer usa `THREE.NoToneMapping` (linha 2978 do SkyCanvas). Com essa configuração, `gl.toneMappingExposure` **não tem nenhum efeito** — o Three.js ignora esse valor completamente quando NoToneMapping está ativo. O PostProcessing adiciona ACES Filmic como efeito separado, mas ele não tem acesso ao `toneMappingExposure` do renderer. Resultado: a exposure adaptativa é calculada mas **nunca aplicada a nada**. Todo o HDR aditivo acumula sem controle.

No Blender, a pipeline é: `Scene HDR → Exposure (EV multiplier) → View Transform (Filmic/AgX) → Display`. O exposure é aplicado **antes** do tone mapping, controlando a luminância total.

### Correção (2 arquivos)

#### 1. `src/components/editor/SkyCanvas.tsx`

**A. Ativar ACES Filmic no renderer** (linha 2978):
```
toneMapping: THREE.NoToneMapping  →  toneMapping: THREE.ACESFilmicToneMapping
```
Isso faz com que `gl.toneMappingExposure` realmente funcione como multiplicador global antes do tone mapping — exatamente como Blender.

**B. Aplicar exposure adaptativa ao renderer** (no `AdaptiveExposureController`, dentro do useFrame, após linha 1877):
```tsx
const { gl } = useThree();
// ...inside useFrame:
gl.toneMappingExposure = THREE.MathUtils.clamp(_adaptiveExposure, 0.3, 1.8);
```
Isso conecta o sistema de exposure ao renderer real.

**C. Precisa de acesso ao `gl`**: O componente já usa useFrame mas não tem `useThree`. Adicionar `const { gl } = useThree();` no corpo do componente, e usar `gl` dentro do useFrame via closure ou via o argumento `state` do useFrame:
```tsx
useFrame(({ gl }, delta) => {
  // ... existing code ...
  gl.toneMappingExposure = THREE.MathUtils.clamp(_adaptiveExposure, 0.3, 1.8);
});
```

#### 2. `src/components/editor/PostProcessing.tsx`

**Remover o `<ToneMapping>` duplicado** (linha 77):
```tsx
// REMOVER esta linha — tone mapping agora está no renderer
<ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
```
Com ACES no renderer E no PostProcessing, haveria double-tonemapping (compressão dupla, cores lavadas). Removendo do PostProcessing, o pipeline fica limpo como no Blender.

### Resultado Esperado

```text
ANTES (quebrado):
  Particles(HDR) → AdditiveBlending → Framebuffer(sem clamp) → Bloom → ACES(PostProc) → BRANCO

DEPOIS (Blender-style):
  Particles(HDR) → AdditiveBlending → Framebuffer → ACES(Renderer, com exposure) → Bloom → Display
                                                      ↑
                                         gl.toneMappingExposure = _adaptiveExposure
                                         (clamped 0.3-1.8)
```

O ACES no renderer comprime TODOS os pixels HDR antes do bloom, impedindo saturação. A exposure adaptativa funciona como EV no Blender — reduz automaticamente quando muitos efeitos explodem.

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `SkyCanvas.tsx` | `NoToneMapping` → `ACESFilmicToneMapping` + aplicar `gl.toneMappingExposure` no AdaptiveExposureController |
| `PostProcessing.tsx` | Remover `<ToneMapping>` duplicado |

