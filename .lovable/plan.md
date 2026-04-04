

# Plano: Sons Cinematicos + Visual Nuclear no Destruction Mode

## 1. Novos Sons no AmbientSoundEngine (`src/lib/ambientSound.ts`)

Adicionar 4 novos tipos de som sintetizados via Web Audio API (zero ficheiros externos):

- **`alarm`** — Sirene de targeting: dois osciladores alternando 600Hz↔900Hz com LFO, duração ~2.5s, tom ameaçador
- **`missile`** — Whoosh de mísseis: ruído branco filtrado com frequency sweep descendente (2000→200Hz), duração ~1s por míssil
- **`explosion`** — Impacto: noise burst de baixa frequência com distortion, sub-bass rumble (40Hz), duração ~0.6s
- **`radiation`** — Aftermath: drone grave contínuo com tremolo, tom metálico decaindo lentamente (~3s)

Expandir o tipo `SoundType` para incluir estes 4 novos.

## 2. Integrar Sons na Sequência (`src/components/editor/DestructionOverlay.tsx`)

No `runSequence()`:
- **Targeting:** `ambientSound.play('alarm')` ao iniciar
- **Incoming:** `ambientSound.play('missile')` a cada tick do countdown (3x)
- **Impact:** `ambientSound.play('explosion')` no flash
- **Aftermath:** `ambientSound.play('radiation')` para o drone final

## 3. Efeito Visual Nuclear — Aftermath Expandido (`DestructionOverlay.tsx`)

Substituir/enriquecer a fase aftermath com visual de destruição nuclear:

- **Mushroom cloud SVG:** Coluna de fumaça ascendente com topo expandido, gradiente vermelho→laranja→cinza
- **Shockwave ring CSS:** Anel concêntrico expandindo radialmente do centro com blur (simula onda de choque)
- **Heat distortion:** Overlay com `backdrop-filter: blur()` pulsante que diminui gradualmente
- **Fallout particles:** Partículas de cinza caindo de cima para baixo (gravity, não radial como as atuais)
- **Radiation scan lines:** Linhas horizontais vermelhas translúcidas descendo pela tela

Duração aftermath aumentada de 4000ms para 5000ms para acomodar o visual nuclear.

## 4. Keyframes CSS Novos (`src/index.css`)

- `destruction-shockwave` — scale de 0 a 20 com opacity fade
- `destruction-mushroom-rise` — translateY ascendente com scale lateral
- `destruction-fallout` — partículas caindo com drift horizontal
- `destruction-heat-pulse` — blur pulsante decrescente

## Ficheiros a Modificar

| Acao | Ficheiro |
|------|---------|
| Modificar | `src/lib/ambientSound.ts` — 4 novos sons sintetizados |
| Modificar | `src/components/editor/DestructionOverlay.tsx` — sons + visual nuclear |
| Modificar | `src/index.css` — keyframes novos |

### Protecoes
- Sons usam Web Audio API puro, zero dependências externas
- Visuais são CSS/SVG overlay, zero impacto no pipeline WebGL/R3F
- Respeitam `masterGain` e `muted` do engine existente

