

## Recolorir Joi — Substituir Rosa por Cores da Plataforma

### Problema
A Joi usa extensivamente `hsl(340 65% ...)` (rosa/magenta), que destoa da paleta oficial da plataforma FX KONTROL (cyan, âmbar, gold, orange).

### Estratégia de Cores
Substituir todas as referências rosa `hsl(340 ...)` e `hsl(350 ...)` por tokens da plataforma:

| Uso atual (rosa) | Novo (plataforma) |
|---|---|
| Glow principal, borders, shadows | **Cyan** `hsl(190 100% 50%)` / `var(--fxk-cyan)` |
| Texto de label, status, accents | **Âmbar** `hsl(38 100% 50%)` / `var(--fxk-amber)` |
| Partículas, detalhes secundários | **Gold** `hsl(45 100% 50%)` / `var(--fxk-gold)` |
| Celebração | **Gold/Orange** (já usa `hsl(42 ...)`, manter) |
| Seriedade | **Âmbar** `hsl(32 80% ...)` (já usa, manter) |

### Arquivos Modificados

**1. `src/components/FXKAssistant.tsx`** (~30 substituições)
- FAB gradient: `hsl(340 ...)` → cyan + âmbar
- Borders, shadows do painel: rosa → cyan com baixa opacidade
- Textos "JOI · COMPANION": rosa → âmbar
- Status dot, ícones de ação: rosa → cyan/âmbar
- Typewriter cursor color: rosa → âmbar
- VoiceWave bars: rosa → cyan
- Minimized bar border: rosa → cyan

**2. `src/components/JoiCinematicHologram.tsx`** (~20 substituições)
- Ambient glow: rosa → cyan
- Halo, projector cone: rosa → cyan
- Eye shimmer: rosa → âmbar (warmth para intimismo)
- Drop-shadows das imagens: rosa → cyan
- Scanline sweep: rosa → cyan
- Chromatic aberration hue-rotate: ajustar para cyan spectrum
- Micro-particles: rosa → alternar cyan e âmbar

**3. `src/index.css`** (cursor typewriter)
- `.joi-typewriter-cursor`: rosa → âmbar
- Qualquer keyframe com `hsl(340 ...)` → cyan ou âmbar conforme contexto

