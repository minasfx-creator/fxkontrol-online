

# Plano: Motor Generativo Lightjams + Ajustes do Palco 3D

## Parte 1 — Correção do Palco (Stage)

O palco no Training Simulator está pequeno/deslocado. Ajustes:
- Recalibrar posições dos elementos internos do `StageEnvironment3D` (piso, treliças, LED walls) para ficarem proporcionais à escala 3x aplicada no `TrainingSimulator`
- Garantir que os snap points das missões estejam dentro do palco visível
- Ajustar posição da câmera inicial para enquadrar o palco corretamente
- Verificar se os NPCs e o técnico estão na escala correta

## Parte 2 — Motor Generativo Lightjams

Novo painel **GenerativeEffectsPanel** inspirado no Lightjams, com motor de efeitos visuais reativos a música e controle em tempo real.

### 2A. Motor de efeitos generativos (`src/lib/generativeEngine.ts`)
- Pipeline: Audio Input → Frequency Bands (bass/mid/high) → Moduladores → Output (cor, intensidade, posição, padrão)
- 8 generators built-in: Color Cycle, Strobe, Chase, Rainbow, Pulse, Sparkle, Wave, Gradient
- Cada generator tem parâmetros expostos (speed, intensity, spread, offset) moduláveis por áudio
- Sistema de layers: empilhar múltiplos generators com blend modes (add, multiply, screen, overlay)

### 2B. Pixel Mapping (`src/lib/pixelMapper.ts`)
- Mapear posições de drones/fixtures a uma grade 2D virtual (pixel map)
- Projetar os outputs dos generators na grade → cor por fixture/drone
- Suporte a múltiplas topologias: grid, circle, custom

### 2C. Painel UI (`GenerativeEffectsPanel.tsx`)
- Lista de layers com drag-reorder
- Por layer: seletor de generator, sliders de parâmetros, toggle de modulação por áudio (bass/mid/high)
- 2D Preview Canvas: grid colorido mostrando output em tempo real
- Presets salvos: 6 presets built-in (Concert, Festival, Gala, Club, Theater, Custom)
- Botão na Toolbar para abrir o painel

### 2D. Integração
- Conectar ao `musicReactiveEngine.ts` existente para dados de áudio em tempo real
- Aplicar output aos drones no viewport (cores LED) e fixtures DMX

---

**Arquivos a criar:**
- `src/lib/generativeEngine.ts`
- `src/lib/pixelMapper.ts`
- `src/components/editor/GenerativeEffectsPanel.tsx`

**Arquivos a modificar:**
- `src/components/training/StageEnvironment3D.tsx` (escala/posições)
- `src/components/training/TrainingSimulator.tsx` (câmera)
- `src/components/editor/Toolbar.tsx` (botão do painel)

