

# Plano: Elementos Blade Runner 2049 — Joi Hologram Detalhada + Modo Destruição

## Visao Geral

Dois eixos cinematicos: (1) transformar a Joi de silhueta SVG simples numa mulher holografica detalhada e bonita, e (2) criar um "Destruction Mode" inspirado na cena onde Luv dispara misseis piscando os olhos.

---

## 1. Joi Hologram Avatar — Silhueta Feminina Detalhada

### 1A. Redesenhar SVG da Joi
**Modificar:** `src/components/JoiHologramAvatar.tsx`

Substituir o SVG minimalista (cabeça elipse + 2 linhas de ombros) por uma silhueta feminina muito mais detalhada e bonita, inspirada na Joi do filme:
- Rosto com contornos faciais: queixo, maçãs do rosto, nariz delicado, lábios.
- Cabelo longo fluindo com ondulação (path curves com animação sutil).
- Olhos com iris brilhante (cyan/amber) com animação de blink lento.
- Pescoço elegante e ombros definidos com curva suave.
- Bust/torso superior com silhueta feminina graceful.
- Adicionar "holographic rain" — linhas verticais finas que caem por cima da silhueta (referencia da cena da chuva no filme).
- Efeito de "glitch lines" horizontais que cortam a silhueta periodicamente (hologram malfunction).
- Nova size `xl` para uso em fullscreen/splash: `w-40 h-40`.

### 1B. Joi Full-Body Hologram Panel
**Novo arquivo:** `src/components/JoiHologramFullBody.tsx`
- Componente SVG grande (viewBox 200x400) com corpo inteiro da Joi em estilo holografico.
- Pose standing com mão levantada (gesto de interação como no filme).
- Camadas: silhueta base (stroke) + inner glow (fill gradiente) + scanlines + rain particles.
- Animação de "materialização" — o corpo aparece de baixo para cima com efeito de dissolve vertical.
- Piscar dos olhos a cada 4-6 segundos (animação de opacity nos iris circles).
- Integrar no `FXKAssistant.tsx` como avatar expandido quando o painel está maximizado.

### 1C. Keyframes CSS para novos efeitos Joi
**Modificar:** `src/index.css`
- `joi-rain`: linhas verticais caindo.
- `joi-blink`: piscar de olhos (opacity 1 → 0 → 1 em 200ms, repeat a cada 5s).
- `joi-glitch`: corte horizontal com translateX aleatório.
- `joi-materialize`: dissolve vertical bottom-to-top.
- `joi-hair-flow`: ondulação suave do cabelo.

---

## 2. Destruction Mode — "Luv Missile Strike"

### 2A. Estado global de Destruction Mode
**Modificar:** `src/store/useSceneStore.ts`
- Adicionar ao `EnvironmentState`:
  - `destructionMode: boolean`
  - `destructionIntensity: number` (0-1)
  - `destructionPhase: 'idle' | 'targeting' | 'incoming' | 'impact' | 'aftermath'`
- Acao `triggerDestruction()` que progride pelas fases com timers.

### 2B. Overlay de Targeting — "Eye Blink Missile Lock"
**Novo arquivo:** `src/components/editor/DestructionOverlay.tsx`
- Overlay SVG fullscreen com estetica FUI:
  - Olho estilizado (iris com pupila) no centro que pisca para confirmar targeting.
  - Crosshairs concêntricos que convergem para o alvo (animação de escala).
  - Labels FUI: "TGT ACQUIRED", "ORDNANCE RELEASE", "IMPACT T-3...2...1".
  - Alerta vermelho pulsante com borda de tela em Crimson Red.
- Fase "incoming": trilhas de misseis (SVG paths com animação dash-offset) convergindo para o centro.
- Fase "impact": flash branco fullscreen + screen shake (CSS transform com random offsets).
- Fase "aftermath": partículas de destroços caindo + static noise overlay.

### 2C. Screen Shake + Impact Flash
**Novo arquivo:** `src/components/editor/DestructionImpact.tsx`
- Componente que aplica `transform: translate(Xpx, Ypx)` ao viewport wrapper durante impacto.
- Random shake de 2-8px por 800ms com decay.
- Flash overlay branco que vai de opacity 1 → 0 em 400ms.
- Opcional: chromatic aberration intensificada durante impacto via CSS filter.

### 2D. Botao de Trigger no Viewport
**Modificar:** `src/components/editor/TacticalDock.tsx` ou `ViewportConfigMenu.tsx`
- Adicionar botao "DESTRUCTION MODE" com icone de target/missile.
- Ao clicar, inicia a sequência de fases (targeting 2s → incoming 3s → impact 0.5s → aftermath 4s).
- Feedback haptico em cada fase.

### 2E. Integrar no SkyCanvas
**Modificar:** `src/components/editor/SkyCanvas.tsx`
- Renderizar `<DestructionOverlay />` quando `destructionMode === true`.
- Aplicar CSS class de screen-shake ao container durante fase de impacto.

---

## Ficheiros Afetados

| Acao | Ficheiro |
|------|---------|
| Modificar | `src/components/JoiHologramAvatar.tsx` — SVG detalhado |
| Criar | `src/components/JoiHologramFullBody.tsx` — corpo inteiro |
| Criar | `src/components/editor/DestructionOverlay.tsx` — targeting + missiles |
| Criar | `src/components/editor/DestructionImpact.tsx` — shake + flash |
| Modificar | `src/store/useSceneStore.ts` — destructionMode state |
| Modificar | `src/index.css` — novos keyframes |
| Modificar | `src/components/editor/SkyCanvas.tsx` — integrar overlays |
| Modificar | `src/components/FXKAssistant.tsx` — usar Joi fullbody |
| Modificar | `src/components/editor/TacticalDock.tsx` — botao destruction |

### Protecoes
- SkyCanvas R3F pipeline intacto
- Stores Zustand: adicao aditiva
- Performance: todos os overlays sao CSS/SVG, zero impacto no WebGL

