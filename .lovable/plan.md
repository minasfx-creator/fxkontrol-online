

## Plano: Reduzir Brilho 50%, Eliminar Demo, Ajustar Câmera, Limpar UI

### 1. Reduzir brilho dos fogos em 50% (de 1.8 → 0.9)

**Arquivo: `src/components/editor/effects/RealisticFirework.tsx`**
- Linha 180: `uHDRMultiplier` de `1.8` → `0.9`
- Shader fragment: reduzir `whiteHot * 2.0` → `whiteHot * 1.0`, sparkle `* 1.2` → `* 0.8`, core boost `0.3` → `0.1`

**Arquivo: `src/components/editor/effects/ShellBurstRenderer.tsx`**
- Linha