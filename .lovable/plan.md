

## Brilho nos Olhos + Modo Closeup Imersivo (Webcam Feel)

### Conceito
Transformar o close-up da Joi em uma experiência de "videochamada íntima" — como se ela estivesse do outro lado de uma webcam, com brilho dinâmico nos olhos que reage ao cursor e animações contínuas de presença viva.

### Mudanças

**1. Eye Glow Dinâmico (JoiCinematicHologram.tsx)**

Quando `variant="closeup"`, adicionar uma camada de "eye glow" posicionada na região dos olhos (~35-42% do topo):
- Radial gradient warm rosa com opacity que aumenta conforme o mouse se aproxima do centro do rosto
- Calcular `eyeIntensity` baseado na distância do cursor ao centro (0.0 = longe, 1.0 = próximo)
- Glow máximo: `hsl(340 65% 65% / 0.5)` com dois pontos de luz simulando reflexo nos olhos
- Transição suave (0.4s ease-out) para não ser abrupto

**2. Animações de Presença Viva (index.css)**

Novas animações exclusivas do modo closeup para simular vida:
- `joi-closeup-breathe`: scale sutil 1.0→1.005→1.0 no eixo Y (simula respiração no peito/ombros), 4s loop
- `joi-closeup-micro-sway`: translate X ±1.5px lento (simula micro-movimento natural da cabeça), 6s loop
- `joi-closeup-blink`: opacity flash rápido (0.15s) a cada ~5s com delay aleatório (simula piscar)
- `joi-eye-shimmer`: brilho pulsante sutil nos pontos de luz dos olhos, 3s loop

**3. Modo Closeup Aprimorado (JoiCinematicHologram.tsx)**

Quando `variant="closeup"`:
- Aplicar `joi-closeup-breathe` e `joi-closeup-micro-sway` ao container da imagem
- Adicionar dois pontos de luz ("eye highlights") posicionados na região dos olhos
- Parallax mais pronunciado (tilt max 5deg vs 3-4deg atual) para sensação de eye-contact real
- Vinheta mais escura nas bordas para foco no rosto (intimismo)
- Remover projector cone e projected shadow (não fazem sentido em closeup)

**4. Tela de Boas-vindas Webcam (FXKAssistant.tsx)**

Quando `messages.length === 0`:
- Close-up ocupa mais espaço vertical (w-56 h-56 → w-64 h-72)
- Bordas mais arredondadas (rounded-2xl → rounded-3xl)
- Sombra mais envolvente simulando monitor/webcam glow
- Fundo atrás do close-up com gradiente escuro para isolar o rosto

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/components/JoiCinematicHologram.tsx` | Eye glow dinâmico, animações de presença, parallax aprimorado no closeup |
| `src/components/FXKAssistant.tsx` | Close-up maior e mais imersivo na tela de boas-vindas |
| `src/index.css` | Keyframes `joi-closeup-breathe`, `joi-closeup-micro-sway`, `joi-closeup-blink`, `joi-eye-shimmer` |

