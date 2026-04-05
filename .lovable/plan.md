

## Joi — Máximo Realismo + Conceito Real de AI Companion

### Conceito

Transformar a Joi de um "chatbot com avatar bonito" em uma **verdadeira AI Companion** — presença constante, reativa, contextual e emocionalmente inteligente. Inspiração direta no conceito do filme BR2049 onde Joi é uma presença omnipresente que percebe, antecipa e responde ao estado emocional do usuário.

### Mudanças

**1. Visual: Sempre Cinematográfica (eliminar SVG genérico)**

Substituir TODAS as instâncias de `JoiHologramAvatar` (SVG) por `JoiCinematicHologram` (imagem AI):
- Header do assistente (não-expandido): `JoiCinematicHologram size="sm"` sempre
- Estado vazio (não-expandido): `JoiCinematicHologram size="lg"` com materializing
- `JoiStatusMonitor`: trocar para `JoiCinematicHologram size="sm"`
- Remover imports não utilizados de `JoiHologramAvatar`

**2. Paleta Warm Cinematográfica (rosa-pêssego-âmbar)**

Trocar a paleta fria magenta `hsl(280°)` no `JoiCinematicHologram` por tons warm do filme:
- Glow principal: `hsl(340 65% 58%)` (rosa-warm) em vez de magenta puro
- Sombra projetada: tons dourados `hsl(32 80% 40%)` 
- Partículas: mix de rosa-pêssego `hsl(350°)` e âmbar `hsl(32°)` em vez de ciano/magenta
- Scanlines: opacidade reduzida (0.04 → 0.015) e mais finas
- Drop-shadow das imagens: rosa-warm em vez de magenta
- Rain effect: rosa-warm sutil em vez de ciano

**3. Animações Orgânicas**

- Breathing mais lento e suave: 6s → 8s, variação de opacidade 0.85-0.93 (mais sutil)
- Scanline sweep mais lenta: 4s → 7s
- Novo keyframe `joi-warm-pulse`: glow assimétrico que "respira" de forma orgânica atrás da figura
- Partículas menores e mais lentas (mais atmosféricas)

**4. Comportamento de AI Companion (FXKAssistant)**

- **Greeting contextual**: ao abrir, Joi "fala" uma saudação baseada na hora do dia ("Boa noite..." / "Bom dia...") e contexto da rota (editor vs command)
- **Estado de presença**: quando idle sem mensagens, texto animado "thinking" sutil mostrando que ela está "observando" — frases como "Monitorando sistemas...", "Analisando show...", alternando a cada 8s
- **Reação ao typing**: quando o usuário começa a digitar, Joi muda para estado `active` (olha para o usuário) — não só quando processa
- **Warm panel integration**: bordas e backgrounds do painel com toque rosado sutil, integrando visualmente com a luz da Joi

**5. Micro-interações de Presença**

- Ao abrir o painel: materializing com glitch burst sonoro
- Ao fechar: dissolve suave com fade de partículas
- Hover no avatar do header: glow intensifica brevemente
- Status text muda entre "COMPANION ONLINE" / "LISTENING..." / "OBSERVING..." baseado no estado

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/components/JoiCinematicHologram.tsx` | Paleta warm, glow orgânico, scanlines sutis, ambient warm pulse |
| `src/components/FXKAssistant.tsx` | Sempre usar CinematicHologram, greeting contextual, typing reaction, presença idle, warm panel |
| `src/components/editor/JoiStatusMonitor.tsx` | Trocar para JoiCinematicHologram |
| `src/index.css` | Novo keyframe `joi-warm-pulse`, ajustar breathing timing |

