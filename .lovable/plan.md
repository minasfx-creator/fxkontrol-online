

# Plano: Todas as Melhorias de Rastreio de Vídeo

Implementar 6 sistemas avançados no engine de vídeo-coreografia: Optical Flow, Kalman Filter, Keyframe Inteligente, Color Tracking Regional, Estimativa de Profundidade via IA, e Segmentação de Objetos via IA.

---

## Arquitetura

```text
videoChoreoEngine.ts (existing)
        │
        ▼
videoTrackingAdvanced.ts (NEW) ─── Client-side algorithms
  ├── Optical Flow (Lucas-Kanade)
  ├── Kalman Filter per drone
  ├── Smart Keyframe Detection (histogram diff)
  └── Regional Color Extraction (K-means lite)

video-choreo-ai/index.ts (UPDATE) ─── AI-powered features
  ├── Depth Estimation prompt
  └── Object Segmentation prompt
```

---

## 1. Novo arquivo: `src/lib/videoTrackingAdvanced.ts`

Contém todos os algoritmos client-side:

**Optical Flow (Lucas-Kanade simplificado)**
- Compara pixels entre frames consecutivos para detectar vetores de movimento
- Calcula gradientes Ix, Iy, It em janelas 5x5
- Retorna campo de velocidade (vx, vy) por região da imagem
- Usado para orientar transições de drones na direção do movimento real do vídeo

**Kalman Filter por drone**
- Estado: [x, y, z, vx, vy, vz] — posição + velocidade
- Predict/Update cycle por frame
- Elimina flickering entre frames consecutivos
- Suaviza trajetórias sem perder responsividade a mudanças reais

**Smart Keyframe Detection**
- Calcula histograma de luminância (256 bins) por frame
- Compara via chi-squared distance entre frames consecutivos
- Marca como keyframe se diff > threshold adaptativo (média + 1.5σ)
- Reduz frames redundantes, mantém apenas transições significativas

**Regional Color Extraction (K-means lite)**
- Divide frame em grade 4x4 (16 regiões)
- Extrai cor dominante por região via quantização
- Mapeia cor de cada região para grupo de drones correspondente
- Suaviza paleta entre frames via interpolação HSL

## 2. Atualizar `src/lib/videoChoreoEngine.ts`

- Adicionar opções: `useOpticalFlow`, `useKalmanFilter`, `useSmartKeyframes`, `useRegionalColor`, `useDepthEstimation`, `useObjectSegmentation`
- No pipeline `extractEnhancedFrames`: aplicar smart keyframe filtering
- No pipeline `generateVideoChoreo`:
  - Usar optical flow para influenciar atribuição de drones (bias na direção do movimento)
  - Aplicar Kalman filter nos waypoints finais de cada drone
  - Usar regional color para atribuir cores por grupo de drones (não cor única global)
- Novas interfaces: `OpticalFlowField`, `KalmanState`, `RegionalColorMap`

## 3. Atualizar `supabase/functions/video-choreo-ai/index.ts`

- Adicionar modo `depth-estimation`: prompt que pede ao modelo para estimar profundidade relativa de objetos na cena (foreground/midground/background) e retornar multiplicadores de altura Y por região
- Adicionar modo `object-segmentation`: prompt que pede ao modelo para identificar objetos distintos na imagem e retornar bounding boxes + labels, permitindo formações multi-camada

## 4. Atualizar `src/components/editor/VideoChoreoPanel.tsx`

- Seção "Rastreio Avançado" com toggles para cada feature:
  - Optical Flow (ícone Move3d)
  - Kalman Smoothing (ícone Zap)
  - Smart Keyframes (ícone Film)
  - Regional Colors (ícone Palette)
  - Depth Estimation IA (ícone Layers)
  - Object Segmentation IA (ícone Eye)
- Preview overlay mostrando vetores de optical flow quando ativo
- Badge indicando quantos keyframes foram selecionados vs total de frames
- Visualização da paleta regional (grid 4x4 de cores) no preview

---

## Detalhes Técnicos

**Optical Flow** — Implementação 100% client-side em ImageData, sem dependências externas. Amostra pontos de interesse (corners via Harris simplificado), calcula gradientes com Sobel, resolve sistema 2x2 por janela.

**Kalman Filter** — Modelo de velocidade constante, matrizes F/H/Q/R fixas com noise adaptativo baseado na distância entre frames.

**Smart Keyframes** — Chi-squared histogram comparison é O(256) por par de frames, muito eficiente. Threshold adaptativo evita configuração manual.

**Depth/Segmentation** — Reutiliza o edge function existente com novos modos de prompt. Gemini 2.5 Pro já suporta análise visual de profundidade e segmentação via prompt engineering.

