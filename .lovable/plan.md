

## Aprimorar Ícone da Joi + Voz e Comando de Voz Estilo Alexa

### Visão Geral

Três mudanças principais: (1) Substituir o FAB genérico pelo rosto closeup da Joi como ícone, (2) Adicionar Text-to-Speech para a Joi "falar" suas respostas, (3) Adicionar reconhecimento de voz (Speech-to-Text) via Web Speech API nativa para comandar a Joi por voz — criando uma experiência estilo Alexa.

### Mudanças

**1. Ícone FAB com Rosto da Joi (`FXKAssistant.tsx`)**

Substituir o `JoiCinematicHologram` genérico no botão FAB por uma imagem circular do rosto da Joi (`joi-hologram-closeup.png`), com:
- Borda circular com glow cyan pulsante
- Ring âmbar sutil de status
- Efeito de "respiração" (scale pulse suave)
- No mobile: 56px, desktop: 64px
- Manter o ping indicator de status

**2. Text-to-Speech — Joi Fala as Respostas (`FXKAssistant.tsx`)**

Usar a API nativa `SpeechSynthesis` do browser (sem dependências externas):
- Botão toggle de voz no header do painel (ícone Volume2/VolumeX)
- Quando ativado, cada resposta da Joi é lida em voz alta automaticamente
- Voz feminina em pt-BR (seleção automática da melhor voz disponível)
- Indicador visual de "falando" (wave animation no header)
- Botão de play individual em cada mensagem para re-ouvir
- Persistir preferência de voz no localStorage

**3. Comando de Voz — Estilo Alexa (`FXKAssistant.tsx`)**

Usar Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`):
- Botão de microfone no campo de input (ícone Mic/MicOff)
- Ao pressionar: iniciar escuta contínua com feedback visual
- Visual: ring pulsante cyan ao redor do FAB enquanto ouvindo (estilo Alexa listening)
- Transcrição em tempo real aparece no campo de input
- Auto-envio após pausa na fala (1.5s de silêncio)
- Status visual: LISTENING → PROCESSING → SPEAKING
- Feedback sonoro sutil ao iniciar/parar escuta (usar `playGlitchBurst` existente)
- Fallback gracioso em browsers sem suporte

**4. Aprimorar UX de Interação**

- Estado "Listening" com animação no FAB (ring pulsante como Alexa)
- Estado "Speaking" com wave bars animadas no header
- Transição suave entre estados: idle → listening → processing → speaking → idle
- Quando voz ativa e painel fechado, mostrar mini-indicator no FAB

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/FXKAssistant.tsx` | FAB com rosto, TTS, Speech Recognition, estados visuais |
| `src/hooks/useVoiceRecognition.ts` | **Novo** — Hook para Web Speech API recognition |
| `src/hooks/useJoiSpeech.ts` | **Novo** — Hook para SpeechSynthesis TTS |

### Detalhes Técnicos

```text
Fluxo de voz estilo Alexa:
  Toque no mic → glitch sound → ring pulsante (LISTENING)
  → Fala capturada em tempo real (texto no input)
  → Pausa 1.5s → auto-submit → ring para (PROCESSING)  
  → Resposta chega → SpeechSynthesis fala (SPEAKING)
  → Fim da fala → volta a idle

Web APIs usadas (sem dependências):
  - SpeechRecognition / webkitSpeechRecognition (input)
  - SpeechSynthesis (output)
  - Ambas nativas do browser, sem API key necessária
```

