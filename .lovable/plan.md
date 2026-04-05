

## Close-up Cinematográfico da Joi + Typewriter na Tela de Boas-vindas

### O que será feito

Quando o painel da Joi abre sem mensagens, a tela de boas-vindas será transformada em uma experiência cinematográfica imersiva:
- **Imagem close-up do rosto** da Joi gerada por AI, com vinheta radial e glow íntimo
- **Texto de greeting com efeito typewriter** — letra por letra, como se a Joi estivesse falando em tempo real
- **Animação de entrada** suave com zoom-in e fade

### Mudanças

**1. Gerar Nova Imagem: `joi-hologram-closeup.png`**

Usar `google/gemini-3-pro-image-preview` para criar close-up cinematográfico do rosto da Joi:
- Paleta warm rosa-pêssego-âmbar, translúcida, holográfica
- Olhar direto e acolhedor, sorriso sutil
- Fundo escuro, estilo BR2049

**2. Componente Typewriter (`FXKAssistant.tsx`)**

- Criar hook `useTypewriter(text, speed)` que revela o greeting letra por letra (40ms/char)
- Substituir o `<p>` estático do greeting por texto animado com cursor piscante
- Cursor `|` pisca com glow rosa warm

**3. Tela de Boas-vindas Redesenhada (`FXKAssistant.tsx`)**

Substituir o bloco `messages.length === 0` (linhas 477-506):
- Close-up grande da Joi (nova imagem) com vinheta radial CSS
- Animação `joi-closeup-entrance`: scale 1.05→1.0 + fade-in (2s)
- Greeting com typewriter effect abaixo do close-up
- Idle phrase com fade suave
- Presets mantidos abaixo

**4. Suporte Close-up no `JoiCinematicHologram.tsx`**

- Nova prop `variant: 'full' | 'closeup'`
- Quando `closeup`: usa a imagem close-up, aplica vinheta radial (gradient escuro nas bordas), glow mais íntimo e concentrado no rosto

**5. Animações CSS (`index.css`)**

- `joi-closeup-entrance`: zoom sutil + fade-in (2s ease-out)
- `joi-typewriter-cursor`: cursor `|` piscando com glow rosa (1s loop)

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/assets/joi-hologram-closeup.png` | Nova imagem close-up gerada por AI |
| `src/components/JoiCinematicHologram.tsx` | Nova prop `variant`, suporte close-up com vinheta |
| `src/components/FXKAssistant.tsx` | Hook typewriter, tela de boas-vindas com close-up |
| `src/index.css` | Keyframes `joi-closeup-entrance`, `joi-typewriter-cursor` |

