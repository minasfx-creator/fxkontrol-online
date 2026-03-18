

# Plano: Melhorias na Geração por Vídeo

Após análise completa do pipeline atual (extração de frames → detecção de silhueta → formação de pontos → atribuição de drones → trajetórias), identifiquei 5 melhorias de alto impacto que vão elevar significativamente a qualidade da geração.

---

## 1. Sampling por Blue Noise (Poisson-Disk) em vez de Grid

**Problema atual**: `frameToFormationPoints` usa grid-based sampling que gera distribuição irregular — drones ficam agrupados em células ou com espaçamentos desiguais.

**Melhoria**: Implementar Bridson's Poisson-Disk Sampling real para distribuição uniforme sobre a silhueta detectada. Resultado: drones com espaçamento consistente, formações muito mais limpas e legíveis.

**Arquivo**: `src/lib/videoToFormation.ts`
- Nova função `poissonDiskSample(shapePixels, droneCount, minSpacing)` com aceleração por grid espacial.
- Substituir o sampling por grid na função `frameToFormationPoints`.

---

## 2. Morphological Cleanup da Máscara de Detecção

**Problema atual**: A máscara de threshold/edge gera pixels isolados e buracos que produzem pontos de drone "perdidos" fora da forma principal.

**Melhoria**: Aplicar operações morfológicas (erosion → dilation = opening) na máscara binária antes do sampling. Remove ruído e fecha gaps pequenos.

**Arquivo**: `src/lib/videoToFormation.ts`
- Nova função `morphologicalOpen(mask, width, height, kernelSize)`.
- Aplicar entre a detecção de shape e o sampling de pontos.

---

## 3. Multi-Scale Edge Detection (Canny-like)

**Problema atual**: Sobel edge detection usa um único threshold e não faz non-maximum suppression — gera bordas grossas e ruidosas.

**Melhoria**: Implementar pipeline Canny simplificado: Gaussian blur → Sobel gradients → Non-Maximum Suppression → Double threshold com hysteresis.

**Arquivo**: `src/lib/videoToFormation.ts`
- Nova função `cannyEdgeDetection(gray, width, height, lowThreshold, highThreshold)`.
- Substituir `sobelEdgeDetection` quando `detectionMode === 'edge'`.

---

## 4. Temporal Coherence na Atribuição de Drones

**Problema atual**: `greedyAssignment` é O(n²) e produz crossing paths — drone A vai para posição de B enquanto B vai para posição de A, gerando trajetórias que se cruzam.

**Melhoria**: Implementar auction algorithm (Bertsekas) que é mais rápido que Hungarian para grandes N e produz atribuições com menos cruzamentos. Adicionar penalização por crossing detection.

**Arquivo**: `src/lib/videoChoreoEngine.ts`
- Nova função `auctionAssignment(prev, curr, epsilon)` como alternativa ao greedy.
- Post-processing: detectar e resolver crossings com swap local.

---

## 5. Preview em Tempo Real com Interpolação

**Problema atual**: O preview 2D é estático — mostra pontos fixos por keyframe. O playback só troca entre keyframes discretos.

**Melhoria**: Preview com interpolação linear entre keyframes durante playback. Ao dar play, animar suavemente os pontos se movendo de uma formação para outra no canvas 2D, com trail de movimento.

**Arquivo**: `src/lib/videoChoreoEngine.ts`
- Nova função `interpolateKeyframes(kfA, kfB, t)` que retorna pontos intermediários.
- Atualizar `renderFramePreview` para aceitar `prevPoints` e desenhar linhas de trail.

**Arquivo**: `src/components/editor/VideoChoreoPanel.tsx`
- Substituir `setInterval` do playback por `requestAnimationFrame` loop com interpolação contínua entre keyframes.

---

## Resumo de Alterações

| Ação | Arquivo | Melhoria |
|------|---------|----------|
| Editar | `videoToFormation.ts` | Poisson-Disk sampling, morphological cleanup, Canny edges |
| Editar | `videoChoreoEngine.ts` | Auction assignment, interpolação de preview |
| Editar | `VideoChoreoPanel.tsx` | Playback com requestAnimationFrame + interpolação |

