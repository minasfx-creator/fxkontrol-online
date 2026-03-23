

## Plan: Adicionar Presets Ethereal ao NiagaraVFXController

### O que será feito

Adicionar 4 novos presets de fogo etéreo com paleta fria (cyan/purple/white) e glow sobrenatural, espelhando os assets UE5 Ethereal uploadados.

### Mudanças

**Arquivo: `src/components/editor/NiagaraVFXController.tsx`**

1. **Expandir o tipo `StylizedFirePreset`** (linha 411) para incluir:
   - `'stylized-fire-01-ethereal'`
   - `'stylized-fire-02-ethereal'`  
   - `'stylized-fire-radial-01-ethereal'`
   - `'stylized-fire-radial-02-ethereal'`

2. **Adicionar 4 entradas no `STYLIZED_FIRE_PROFILES`** (após linha 475) — mesma física dos presets base correspondentes, mas com ajustes etéreos:
   - Lifetime ligeiramente maior (+20%) para sensação flutuante
   - Drag reduzido para partículas mais leves
   - GravityScale mais negativo (partículas sobem mais)

3. **Modificar `createStylizedFireEmitter`** (linha 478-520):
   - Detectar se o preset contém `'ethereal'` no nome
   - Se ethereal: usar **paleta de cores fria** no `colorOverLife`:
     - `t:0` → branco brilhante (1.5, 1.5, 2.0)
     - `t:0.15` → cyan intenso (0.2, 1.2, 1.8)
     - `t:0.35` → azul-roxo (0.4, 0.3, 1.5)
     - `t:0.55` → purple escuro (0.3, 0.05, 0.8)
     - `t:0.75` → índigo (0.1, 0.02, 0.3)
     - `t:1` → preto-azulado (0.02, 0.01, 0.05)
   - Aumentar `curlNoiseStrength` em 50% para movimento mais orgânico/mágico
   - Usar cor base padrão cyan `(0.1, 0.8, 1.0)` em vez de laranja quando ethereal e sem cor custom

4. **Adicionar ao `niagaraColorPresets.ts`** 4 novos presets correspondentes com `autoMatchColors: ['ethereal', 'magic', 'spirit']` para integração com o SuperVDL

### Presets Ethereal — Perfis Físicos

| Preset | Particles | Lifetime | SpawnRadius | GravityScale | Drag |
|--------|-----------|----------|-------------|--------------|------|
| fire-01-ethereal | 60 | [0.5, 1.5] | 0.5 | -0.45 | 0.4 |
| fire-02-ethereal | 80 | [0.4, 1.2] | 0.8 | -0.35 | 0.5 |
| radial-01-ethereal | 120 | [0.25, 1.0] | 0.3 | -0.15 | 0.7 |
| radial-02-ethereal | 150 | [0.2, 0.75] | 0.2 | -0.08 | 0.9 |

