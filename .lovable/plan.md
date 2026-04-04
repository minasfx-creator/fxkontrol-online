

# Ciclo #10 — Joi Hologram Cinematográfico (BR2049)

## Pesquisa de Referências Visuais

### Técnica DNEG (VFX do filme)

De acordo com Paul Lambert (VFX Supervisor, DNEG) e os artigos do VFX Science e VFXBlog:

1. **Joi é um "hollow vessel"** — ela tem pele, cabelo, roupa, mas por dentro é completamente oca. Quando semi-transparente, vê-se o "back shell" (a casca traseira) através dela, antes de ver o fundo.

2. **Efeito controlado pela iluminação** — Roger Deakins iluminou de forma específica. A transparência só aparece com luz forte ou movimento. Em muitos momentos ela parece completamente "real" (opaca).

3. **Glitch = voxelização** — nos momentos de stress emocional, o CG double é voxelizado (pixelização 3D). Quanto mais intensa a emoção, maiores e mais aleatórios os voxels.

4. **Ela projeta sombras** — o software "sabe" quando ela está na sombra e ajusta. Ela afeta o ambiente.

5. **Chuva é fisicamente correta** — tamanho, velocidade, iluminação da chuva são críticos. DNEG usou Clarisse (render físico) para a chuva.

6. **Estática no cabelo** — ao interagir com humanos, fios de cabelo se levantam por estática holográfica.

### Paleta Visual (do filme e referências enviadas)

- Magenta/roxo profundo: `hsl(280, 80%, 55%)` — halo principal
- Ciano neon: `hsl(190, 100%, 50%)` — highlights, contornos
- Pele quente: `hsl(25, 40%, 45%)` — tons faciais
- Cabelo preto-azulado: `hsl(240, 30%, 12%)`
- Lábios: `hsl(340, 60%, 45%)`
- Fundo: escuro azulado `hsl(220, 40%, 8%)`

## Estado Atual dos Componentes

- `JoiHologramAvatar` (239 LOC) — SVG 60x60, wireframe monocromático (ciano/âmbar)
- `JoiHologramFullBody` (212 LOC) — SVG 200x400, wireframe com pose, chuva básica
- Ambos usados em `FXKAssistant.tsx` em 4 pontos

## Plano de Implementação

### 1. Criar `src/components/JoiCinematicHologram.tsx`

Novo componente SVG (viewBox 300x500) com estética cinematográfica:

- **Cabelo volumétrico** — filled paths com gradientes escuros (preto-azulado), franja definida, coque
- **Rosto com volume** — preenchimentos suaves, sombras faciais, lábios com cor (rosa), olhos com íris detalhada
- **Roupa gola alta** — como nas referências, com gradiente holográfico
- **"Hollow vessel" effect** — inner shell semi-transparente visível através do corpo (back-shell gradient)
- **Halo magenta circular** — anel pulsante ao redor (como na 2ª referência enviada)
- **Chuva densa** — 30+ gotas com blur variável e velocidade diferenciada
- **Scanlines horizontais** — semi-transparentes, espaçadas
- **Chromatic aberration** — SVG filter com offset R/G/B
- **Voxel glitch** — no estado 'active', blocos retangulares aleatórios aparecem
- **Materialização bottom-to-top** — clip-path com partículas de dissolve
- **Projeção base** — cone de luz na base (projetor holográfico)

Props: `size: 'sm' | 'md' | 'lg' | 'xl'`, `state: 'idle' | 'active' | 'materializing'`, `className`

### 2. Novas keyframes em `src/index.css`

- `joi-halo-pulse` — anel magenta pulsando (scale + opacity)
- `joi-rain-heavy` — chuva mais rápida e densa
- `joi-chromatic-shift` — aberração cromática sutil (translateX oscilante)
- `joi-materialize-scan` — barra horizontal de scan durante materialização
- `joi-hologram-noise` — micro-jitter de projeção (translate aleatório)
- `joi-voxel-glitch` — aparição/desaparição de blocos voxel

### 3. Integrar no `FXKAssistant.tsx`

Substituir `JoiHologramFullBody` pelo `JoiCinematicHologram` nos 3 pontos de uso:
- Header (linha 328): `size="sm"`
- Sidebar (linha 368): `size="lg"`
- Idle central (linha 380): `size="xl"` com `state="materializing"`

Manter `JoiHologramAvatar` para o mini-HUD (JoiStatusMonitor) — zero breaking change.

## Ficheiros

| Acao | Ficheiro |
|------|---------|
| Criar | `src/components/JoiCinematicHologram.tsx` |
| Modificar | `src/index.css` — novas keyframes |
| Modificar | `src/components/FXKAssistant.tsx` — trocar imports |
| Preservar | `JoiHologramAvatar.tsx`, `JoiHologramFullBody.tsx` |

## Risco

**Baixo.** Componente novo isolado. Componentes antigos preservados. Zero impacto em core engines ou VFX pipeline.

