

# Simulador 3D em Terceira Pessoa — Training Center

Transformar a página Training de um hub de missões estático em um **simulador 3D interativo** com câmera orbital, palco, equipamentos drag-and-drop e scoring em tempo real.

---

## Arquitetura

A página Training ganha dois modos: **Mission Hub** (lista atual) e **Simulator 3D** (ativado ao clicar "Jogar" em uma missão). O simulador é um componente R3F fullscreen com overlay de HUD/scoring.

```text
Training.tsx
├── Mission Hub (modo atual — lista de missões)
└── Simulator Mode (novo)
    ├── TrainingSimulator.tsx (canvas R3F + game state)
    │   ├── StageEnvironment3D.tsx (palco, treliças, chão, luzes)
    │   ├── TechnicianCharacter.tsx (personagem técnico 3a pessoa)
    │   ├── PlacedEquipment3D.tsx (equipamentos colocados na cena)
    │   └── SnapPoints.tsx (pontos de encaixe visuais no truss/chão)
    ├── EquipmentTray.tsx (inventário lateral draggable — HTML overlay)
    └── SimulatorHUD.tsx (timer, score, objetivos — HTML overlay)
```

---

## 1. TrainingSimulator — Canvas 3D Principal

Novo componente `src/components/training/TrainingSimulator.tsx`:
- Canvas R3F fullscreen com `OrbitControls` configurado para terceira pessoa (ângulo polar limitado 20°–80°, target no centro do palco, distância 15–50)
- Iluminação: ambient + directional + point lights no palco
- Chão com grid sutil + palco elevado (box geometry com materiais PBR escuros)
- Recebe a missão ativa e gerencia o game state (equipamentos colocados, timer, score)

## 2. StageEnvironment3D — Cenário do Palco

Novo `src/components/training/StageEnvironment3D.tsx`:
- Palco retangular elevado (8x4x0.5m) com material escuro metálico
- 4 pilares de truss verticais (cylinder geometry, material metálico) nos cantos
- 2 barras de truss horizontais conectando os pilares no topo
- Backdrop traseiro (plane com material escuro)
- Pontos de snap iluminados (esferas pequenas com glow) nos locais onde equipamentos podem ser colocados

## 3. TechnicianCharacter — Personagem em 3a Pessoa

Novo `src/components/training/TechnicianCharacter.tsx`:
- Personagem simples feito de geometrias básicas (capsule body, sphere head, box limbs) — estilo low-poly
- Posição fixa próxima ao palco (não controlável por enquanto — foco no drag-and-drop)
- Animação idle sutil (breathing: scale Y oscilante)
- Capacete de segurança amarelo (hemisphere no topo da cabeça)

## 4. EquipmentTray — Inventário Lateral

Novo `src/components/training/EquipmentTray.tsx`:
- Overlay HTML posicionado à esquerda sobre o canvas
- Lista dos equipamentos da missão ativa com ícones e nomes
- Cada item é draggable (HTML5 drag ou click-to-select)
- Ao clicar num equipamento, ativa "modo de colocação" — o próximo clique no canvas coloca o equipamento no snap point mais próximo
- Itens já colocados ficam com checkmark e desabilitados

## 5. SnapPoints + Colocação de Equipamentos

Novo `src/components/training/SnapPoints.tsx`:
- Pontos de encaixe definidos por missão (posições 3D no truss/chão)
- Visualizados como esferas pulsantes semitransparentes (verde quando disponível, azul quando hover)
- Raycasting via `useThree` + `onPointerDown` para detectar clique nos snap points
- Ao colocar: animação de scale-in + partículas de confirmação + som de "snap"

Novo `src/components/training/PlacedEquipment3D.tsx`:
- Renderiza cada equipamento colocado como geometria 3D simples:
  - Sparkular: cylinder fino + cone no topo (emissivo cyan)
  - Flamer: cylinder + torus (emissivo laranja)  
  - Moving Head: box + cylinder + sphere (emissivo branco)
  - Truss: box alongado (metálico)
  - Cryo: cylinder gordo (emissivo azul gelo)

## 6. SimulatorHUD — Interface de Jogo

Novo `src/components/training/SimulatorHUD.tsx`:
- Overlay HTML sobre o canvas com:
  - **Timer** countdown (canto superior direito)
  - **Score** em tempo real (canto superior esquerdo)
  - **Objetivos** checklist (lateral direita) — ex: "✓ Montar truss esquerdo" / "○ Instalar sparkular"
  - **Botão Sair** para voltar ao Mission Hub
  - **Barra de progresso** da missão (bottom center)
- Ao completar todos os objetivos: tela de vitória com XP ganho e estrelas

## 7. Integração com Training.tsx

Modificar `src/pages/Training.tsx`:
- Adicionar state `activeMission: Mission | null`
- Botão "Jogar" seta `activeMission` e renderiza `TrainingSimulator` no lugar do Mission Hub
- Ao completar missão: marca como completed, soma XP, desbloqueia próxima missão
- Botão "Sair" no HUD volta para o Mission Hub

---

## Resumo de Entregas

| Arquivo | Função |
|---------|--------|
| `src/components/training/TrainingSimulator.tsx` | Canvas R3F + game loop |
| `src/components/training/StageEnvironment3D.tsx` | Palco, truss, backdrop |
| `src/components/training/TechnicianCharacter.tsx` | Personagem low-poly |
| `src/components/training/EquipmentTray.tsx` | Inventário lateral draggable |
| `src/components/training/SnapPoints.tsx` | Pontos de encaixe interativos |
| `src/components/training/PlacedEquipment3D.tsx` | Equipamentos 3D colocados |
| `src/components/training/SimulatorHUD.tsx` | HUD com timer, score, objetivos |
| `src/pages/Training.tsx` | Integração hub ↔ simulador |

