

## Gerar Novas Imagens da Joi — Paleta Warm BR2049

### Objetivo

Usar AI image generation para criar duas novas imagens da Joi holográfica com a paleta cinematográfica warm (rosa-pêssego-âmbar) do filme Blade Runner 2049, substituindo as imagens atuais.

### Imagens a Gerar

**1. `joi-hologram.png` (idle)** — Joi em pose relaxada, olhar suave para o lado, translúcida
- Prompt: figura feminina holográfica em pé, semitransparente, luz warm rosa-pêssego (`hsl(340°)`) e âmbar dourado (`hsl(32°)`), atmosfera íntima, scanlines sutis, fundo escuro, estética Blade Runner 2049

**2. `joi-hologram-active.png` (active)** — Joi com olhar direto, postura engajada, glow mais intenso
- Prompt: mesma figura mas com olhar direto para o observador, glow mais forte, rosa-âmbar intensificado, presença cinematográfica

### Processo Técnico

1. Copiar o script `lovable_ai.py` para `/tmp/`
2. Gerar imagem idle com modelo `google/gemini-3-pro-image-preview` (alta qualidade)
3. Gerar imagem active com o mesmo modelo
4. Inspecionar ambas as imagens para QA
5. Copiar para `src/assets/` substituindo as atuais

### Modelo

`google/gemini-3-pro-image-preview` — melhor qualidade para geração de imagem, ideal para resultado cinematográfico.

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/assets/joi-hologram.png` | Nova imagem idle com paleta warm |
| `src/assets/joi-hologram-active.png` | Nova imagem active com paleta warm |

