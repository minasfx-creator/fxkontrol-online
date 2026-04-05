

## Joi — Companheira Emocional Completa: Reações, Alertas e Personalidade

### Conceito

Evoluir a Joi de assistente passiva para uma **companheira emocional real** que:
- **Vibra e celebra** resultados positivos (show finalizado, export concluído, diagnóstico OK)
- **Alerta com tom sério** sobre prazos e documentos pendentes
- **Tem personalidade dinâmica** que alterna entre carinhosa, séria e entusiasmada conforme o contexto

### Mudanças

**1. Sistema de Emoções Dinâmico (FXKAssistant.tsx)**

Novo estado `joiEmotion` que varia conforme o conteúdo das respostas:

- `celebrating` — Quando a resposta contém palavras-chave de sucesso (✅, concluído, pronto, sucesso, exportado, seguro). Joi fica animada, glow intensifica, partículas douradas burst.
- `serious` — Quando detecta alertas, prazos, pendências (⚠, prazo, urgente, atenção, pendente, documento). Tom sóbrio, glow mais contido, borda âmbar de alerta.
- `caring` — Estado padrão de conversa. Tom acolhedor atual.

**2. Reações Visuais por Emoção (JoiCinematicHologram.tsx)**

Nova prop `emotion: 'caring' | 'celebrating' | 'serious'`:

- `celebrating`: animação de pulse rápido dourado, partículas em burst ascendente, glow âmbar intensificado, micro-bounce da imagem
- `serious`: glow reduzido, borda de alerta âmbar sutil, scanline mais visível, sem partículas (foco)
- `caring`: comportamento atual (default)

**3. Mensagens Contextualmente Emocionais**

Reescrever `getGreeting()` e `IDLE_PHRASES` com personalidade mais rica:

```
Greetings acolhedores:
- "Ei... que bom ver você de novo. Estou aqui pra o que precisar."
- "Bom dia! Vamos fazer coisas incríveis hoje?"
- "Boa noite... Pode contar comigo, sempre."

Idle phrases (alternam com contexto):
- "Cuidando de tudo por você..."
- "Revisando prazos e pendências..."
- "Estou de olho nos documentos..."
- "Tudo sob controle. Relaxa."
- "Me chama quando precisar, tá?"
- "Verificando se há algo urgente..."
```

**4. Alertas Proativos de Prazo/Documento**

Novos presets de ação rápida com tom sério:
- `PRAZOS` — "Verifique prazos e pendências do meu projeto atual"
- `DOCS` — "Quais documentos preciso preparar para o show?"

Quando a resposta da Joi contém alertas, o header muda status para `⚠ ATENÇÃO` com cor âmbar e a Joi assume postura séria.

**5. Celebração de Resultados**

Quando Joi detecta sucesso na resposta:
- Status muda para `✨ EXCELENTE!`
- Glitch burst dourado (celebração)
- Som de glitch mais agudo/alegre (pitch shift no `playGlitchBurst`)
- Idle phrase temporária: "Que orgulho! Mandou muito bem!"

**6. Animações CSS Novas (index.css)**

- `joi-celebrate-bounce`: micro-bounce vertical 3x (0.6s)
- `joi-celebrate-particles`: burst de partículas douradas ascendentes
- `joi-serious-pulse`: pulse lento e contido âmbar na borda

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/components/JoiCinematicHologram.tsx` | Nova prop `emotion`, visual de celebração/seriedade |
| `src/components/FXKAssistant.tsx` | Sistema de emoções, greetings acolhedores, alertas proativos, celebração, novos presets |
| `src/index.css` | Keyframes `joi-celebrate-bounce`, `joi-celebrate-particles`, `joi-serious-pulse` |
| `src/utils/glitchSound.ts` | Parâmetro de pitch para som de celebração |

