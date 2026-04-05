
## Animações de Transição Fluidas entre Estados da Joi + Animação de Fala

### Problema Atual
As transições entre estados (idle → listening → processing → speaking) são abruptas. O FAB não reflete o estado "speaking". A `ThinkingWave` e `SpeakingWave` são simples e sem transição de entrada/saída. Não há animação labial/visual durante a fala.

### Mudanças

**1. Novas Keyframes CSS (`src/index.css`)**

| Keyframe | Descrição |
|---|---|
| `joi-state-glow` | Transição suave de cor do ring do FAB entre estados (cyan→âmbar→cyan) |
| `joi-speaking-pulse` | Pulsação orgânica no FAB durante fala (simula "respiração de fala") |
| `joi-speaking-wave-enter` | Fade-in + scale das barras de wave ao iniciar fala |
| `joi-processing-orbit` | Dots orbitando o FAB durante processamento |
| `joi-listening-ripple` | Ondas concêntricas saindo do FAB no modo escuta (estilo Alexa) |
| `joi-mouth-speak` | Animação de "boca" no indicador do FAB durante speaking |

**2. FAB com Estado Visual Distinto (`FXKAssistant.tsx`)**

O FAB fechado refletirá cada estado com visual diferente:
- **Idle**: Breathing cyan suave (atual)
- **Listening**: Ripples concêntricos cyan expandindo (3 ondas) + borda mais intensa
- **Processing**: Ring com dots orbitantes (3 dots pequenos girando ao redor) + brilho âmbar
- **Speaking**: Pulsação orgânica âmbar (simula fala) + mini wave bars ao redor

**3. Header com Transições Suaves**

- Status text muda com `animate-fade-in` (fade cross entre textos)
- `SpeakingWave` ganha entrada com scale stagger por barra
- Adicionar `JoiSpeakingAvatar` — no header, quando speaking, a foto da Joi ganha:
  - Ring âmbar pulsando em sincronia com wave  
  - Glow sutil que "respira" indicando fala ativa
  - Micro-scale (1.02) no ritmo da wave

**4. ThinkingWave Aprimorada**

- Entrada staggered: barras aparecem uma a uma com delay
- Cores variam de cyan escuro → cyan claro com gradiente
- Adicionar label com dots animados: "Processando..." com 3 dots cycling

**5. SpeakingWave Aprimorada**

- Mais barras (8 em vez de 5)
- Variação de altura mais orgânica (usar sin com offsets diferentes)
- Cor âmbar com gradiente para gold
- Entrada com scale-in staggered

**6. Indicador de Fala na Mensagem**

- Quando Joi está falando uma mensagem específica, highlight sutil na borda esquerda (pulso âmbar)
- A mensagem atualmente sendo falada ganha um pequeno ícone de wave ao lado

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/index.css` | 6 novas keyframes, melhorar `voice-wave` existente |
| `src/components/FXKAssistant.tsx` | FAB multi-estado, header speaking avatar, ThinkingWave/SpeakingWave aprimoradas, indicador de fala em mensagem |
