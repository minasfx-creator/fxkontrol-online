

# Plano: Modo Fly (WASD + Mouse) no Viewport 3D

## O que será feito

Adicionar um modo **Fly Camera** (estilo Unreal Engine / Blender) ao viewport 3D, onde o usuário:
- Clica no botão "Fly" (ao lado do "Look") para ativar
- **Mouse** controla a direção da câmera (yaw/pitch) via pointer lock
- **WASD** move para frente/trás/esquerda/direita
- **Q/E** sobe/desce
- **Shift** acelera o movimento (sprint)
- **Scroll** ajusta a velocidade base
- **ESC** ou clique no botão sai do modo fly

## Implementação

### 1. Novo componente `FlyControls` dentro de `SkyCanvas.tsx`

Componente R3F interno que:
- Usa `requestPointerLock()` no canvas ao ativar
- Escuta `mousemove` para rotação da câmera (yaw/pitch com sensibilidade ajustável)
- Escuta `keydown/keyup` para WASD+QE e calcula vetor de movimento
- No `useFrame`, aplica movimento na direção da câmera usando `camera.getWorldDirection()`
- Desabilita o `OrbitControls` quando ativo (já que `freeLook` já faz isso)

### 2. Estado `flyMode` no componente `SkyCanvas3DViewport`

- Novo state `flyMode` ao lado de `freeLook`
- Quando `flyMode=true`, renderiza `<FlyControls>` em vez de `<OrbitControls>`
- Botão "Fly" com ícone `Navigation` na barra de presets de câmera

### 3. HUD de velocidade

- Overlay pequeno mostrando velocidade atual (m/s) e controles (WASD/QE/Shift)
- Aparece apenas quando `flyMode` está ativo

## Arquivo modificado
- `src/components/editor/SkyCanvas.tsx` — adicionar `FlyControls` component, botão "Fly", e lógica de toggle

