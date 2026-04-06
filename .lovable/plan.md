

# Auditoria de Conformidade: Código vs. Especificação Arquitetural

Avaliação sistemática do codebase atual contra os 10 pilares do relatório de arquitetura.

---

## RESUMO EXECUTIVO

| Área | Status | Nota |
|---|---|---|
| 1. Paleta de Cores | ⚠️ Parcial | Vantablack é `220 20% 4%` (~#0A0D12), não `#050505` |
| 2. Tipografia Híbrida | ✅ Conforme | JetBrains Mono para dados, Rajdhani/Inter para UI |
| 3. Chanfros (Beveled Corners) | ✅ Conforme | `.bevel-sm/md/lg` com clip-path polygon implementados |
| 4. Dark Glassmorphism | ✅ Conforme | `.glass`, `.glass-premium` com blur+saturate+border |
| 5. HUD Crosshairs SVG | ⚠️ Parcial | SVG implementado, mas falta `mix-blend-mode: screen` |
| 6. Virtualização de Telemetria | ❌ Não conforme | `react-window` referenciado mas NÃO utilizado — renderiza todos os drones |
| 7. SMPTE Drop-Frame | ✅ Conforme | Suporte completo 29.97 DF com semicolon separator |
| 8. Animações (circOut, sem spring) | ❌ Não conforme | Framer Motion não instalado. Animações são CSS puras |
| 9. Layout 100vh fixo | ✅ Conforme | `h-[100dvh]` com `overflow-hidden` |
| 10. Sparklines | ✅ Conforme | SVG puro sem eixos, exatamente como especificado |

---

## DESVIOS CRÍTICOS (requerem correção)

### 1. Virtualização de Telemetria — NÃO IMPLEMENTADA

**Especificação**: react-window FixedSizeList renderizando ~15 rows visíveis, complexidade O(1).

**Realidade**: `TelemetryDashboard.tsx` (linha 164-172) renderiza TODAS as rows via `Array.from({ length: rowCount })` dentro de um `overflow-y-auto` div. O `GridRow` callback existe mas é chamado sem virtualização real — é um map completo. Para 2000 drones (500 rows × 4 cols), isso gera ~2000 botões DOM simultâneos.

**Impacto**: Violação direta do KPI de 60 FPS para frotas massivas. Provável frame drop severo acima de 500 drones.

**Correção**: Importar `FixedSizeList` de `react-window` e substituir o div scrollável pelo componente virtualizado com `ROW_HEIGHT=35` e `height` dinâmico.

### 2. Cor de Fundo — Desvio do Vantablack

**Especificação**: `#050505` como piso absoluto do canvas.

**Realidade**: `--background: 220 20% 4%` → converte para ~`#0A0D12` (azulado escuro, não preto neutro). O Three.js renderer usa `0x0d0f14` (similar).

**Impacto**: Menor. O tom azulado é intencional para o tema FUI e funciona bem contra OLED smearing, mas diverge tecnicamente da spec `#050505`.

### 3. mix-blend-mode: screen — AUSENTE no HUD

**Especificação**: Crosshairs com `mix-blend-mode: screen` para iluminar sobre canvas 3D.

**Realidade**: `HUDCrosshairs.tsx` não aplica blend mode algum. As miras são renderizadas com opacidade fixa (0.6) sobre z-50.

**Correção**: Adicionar `style={{ mixBlendMode: 'screen' }}` ao container SVG.

### 4. Framer Motion — NÃO INSTALADO

**Especificação**: Animações com `type: "tween", ease: "circOut", duration: 0.3` para cinética mecânica.

**Realidade**: O projeto não usa framer-motion. Todas as animações são CSS puras (keyframes no tailwind.config.ts e index.css). As transições usam `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) e `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring).

**Avaliação**: As curvas CSS atuais (expo-out) produzem resultado similar ao circOut especificado. O spring com overshoot (1.56) viola a regra de "nenhum bounce". A decisão de não usar framer-motion reduz o bundle size (~30KB), mas limita animações imperativas.

---

## CONFORMIDADES VERIFICADAS

### Tipografia ✅
- `font-mono-code` → JetBrains Mono para dados telemetricos (timecodes, coordenadas, percentuais)
- `font-sans` → Rajdhani/Inter para UI estrutural
- `font-tactical` → JetBrains Mono uppercase com letter-spacing 0.08em

### Chanfros ✅
- `.bevel-sm` (8px), `.bevel-md` (12px), `.bevel-lg` (15px) implementados exatamente com clip-path polygon

### Glassmorphism ✅
- `.glass`: `blur(16px) saturate(1.4)` + `hsl(220 18% 6% / 0.85)` — conforme spec
- `.glass-premium`: `blur(32px) saturate(1.6)` + borda translúcida + box-shadow profundo

### SMPTE ✅
- Motor modular em `src/lib/smpte/` com Drop-Frame completo (29.97 fps)
- Omissão de frames 00/01 implementada corretamente
- Separador `;` para DF vs `:` para NDF
- UI no `SMPTEPanel.tsx` exibindo rate e modo DF/NDF

### Scanlines ✅
- Implementadas em 18+ componentes via CSS `repeating-linear-gradient` e animação `scan-move`

### Scrollbar Neon ✅
- Custom scrollbar com 3px width, thumb usando `--primary` com glow — variação sutil da spec (usa amber/primary em vez de cyan puro)

---

## PLANO DE CORREÇÃO (4 itens)

### Passo 1 — Virtualizar TelemetryDashboard
Substituir o loop `Array.from` pelo `FixedSizeList` de react-window. O `GridRow` callback já existe no formato correto — basta envolvê-lo no componente virtualizado. ~15 linhas de mudança.

### Passo 2 — Adicionar mix-blend-mode: screen ao HUD
Uma linha no `HUDCrosshairs.tsx`: adicionar `style={{ mixBlendMode: 'screen' }}` ao div container ou ao SVG.

### Passo 3 — Remover curva spring com overshoot
Substituir `'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)'` no tailwind.config.ts por uma curva circOut: `cubic-bezier(0, 0.55, 0.45, 1)` — elimina o bounce não-militar.

### Passo 4 — Ajustar background para Vantablack neutro (OPCIONAL)
Alterar `--background` e `--surface-0` para tons de preto neutro (#050505 / #080808) em vez do azulado atual. Decisão estética — o azulado funciona bem na prática.

