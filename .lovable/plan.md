

# Implementação: Live Cards AR/HUD + Menu Radial + Timeline ECS

## Visão Geral

Implementar três paradigmas de UX descritos no relatório de Realidade Aumentada: (1) Live Cards contextuais que flutuam ao selecionar objetos no viewport 3D, (2) Menu Radial holográfico substituindo o context menu linear atual, e (3) Refatoração da Timeline para arquitetura ECS/DOD.

---

## 1. Live Cards AR/HUD (Cartões Vivos Contextuais)

Componente `LiveCard.tsx` que aparece ao selecionar uma posição ou drone no viewport 3D. Mostra telemetria em tempo real e dissolve-se automaticamente ao deselecionar.

**Arquivo novo**: `src/components/editor/LiveCard.tsx`
- Card semi-transparente glass flutuante posicionado adjacente ao objeto 3D selecionado (projeta coordenadas 3D → tela via `project()` do Three.js)
- Conteúdo: nome, coordenadas XYZ, heading, canais DMX, efeito vinculado, status de segurança
- Animação de entrada `scale-in` + `fade-in`, saída `fade-out` (curva circOut)
- Auto-dismiss: dissolve após 5s de inatividade ou ao mudar seleção
- Estética: `.glass-premium`, cantos chanfrados `.bevel-md`, scanlines, tipografia `font-mono-code` para dados

**Integração**: Renderizar dentro do `SkyCanvas` usando `Html` do `@react-three/drei` para posicionamento 3D → 2D automático. Escutar `selectedPositionId` do `useProjectStore`.

---

## 2. Menu Radial Holográfico

Substituir o `PositionContextMenu.tsx` linear por um menu radial FUI ativado por clique direito no viewport 3D.

**Arquivo novo**: `src/components/editor/RadialMenu.tsx`
- Layout circular com 6-8 setores (rotate, move, delete, duplicate, link effect, assign section, properties, align)
- Cada setor é um arco SVG com ícone Lucide centralizado
- Ativação: clique direito no viewport → menu aparece centrado no cursor
- Seleção: mover mouse na direção do setor desejado + soltar (ou clicar)
- Estética: fundo glass circular com borda ciano pulsante, setores com hover amber
- Suporte a sub-menus radiais (ex: "Rotate" abre segundo anel com eixos X/Y/Z)
- Feedback haptic sonoro sutil ao selecionar

**Integração**: Substituir o event listener `position-context-menu` existente. Manter fallback keyboard shortcuts intactos.

---

## 3. Timeline ECS/DOD

Refatorar o gerenciamento de dados da Timeline de OOP (objetos individuais com métodos) para arrays contíguos tipados, otimizando cache locality.

**Arquivo novo**: `src/lib/timelineECS.ts`
- **Entidades**: IDs numéricos simples (index no array)
- **Componentes** (TypedArrays contíguos):
  - `startTimes: Float64Array` — tempo de início
  - `durations: Float64Array` — duração
  - `effectIds: Uint16Array` — índice na biblioteca de efeitos
  - `positionIds: Uint16Array` — índice na lista de posições
  - `flags: Uint8Array` — bitfield (selected, locked, muted, linked)
- **Sistemas** (funções puras que varrem arrays):
  - `translateSystem(indices, deltaTime)` — move N itens sem dispatch dinâmico
  - `snapSystem(bpm)` — quantiza todos os tempos ao beat grid
  - `collisionSystem()` — detecta sobreposições em O(n log n)
  - `renderSystem(scrollLeft, viewportWidth, pxPerSec)` — retorna apenas itens visíveis (virtualização)

**Integração**: Manter a interface Zustand atual (`timelineItems[]`) como camada de compatibilidade. O ECS opera internamente e sincroniza com o store via `syncToStore()` apenas em commit (mouseup/keyup), evitando re-renders durante drag. A Timeline.tsx consulta o ECS diretamente durante operações de drag em massa.

---

## Ordem de Implementação

| Passo | Tarefa | Arquivos |
|---|---|---|
| 1 | Criar `RadialMenu.tsx` | Novo componente + CSS |
| 2 | Integrar RadialMenu ao viewport | `PositionContextMenu.tsx` refatorado, `SkyCanvas.tsx` |
| 3 | Criar `LiveCard.tsx` | Novo componente |
| 4 | Integrar LiveCard ao SkyCanvas | `SkyCanvas.tsx` ou componente filho R3F |
| 5 | Criar `timelineECS.ts` | Novo módulo de dados |
| 6 | Conectar ECS à Timeline | `Timeline.tsx`, operações de drag em massa |

---

## Detalhes Técnicos

```text
LiveCard projection:
  Three.js camera.project(position3D) → normalized device coords
  → multiply by (viewportWidth/2, viewportHeight/2) → screen px
  → position card at screenX + offset, screenY
  → clamp to viewport bounds

RadialMenu geometry:
  8 sectors × 45° each
  Inner radius: 40px, outer radius: 120px
  Each sector: SVG <path> arc segment
  Hit detection: atan2(dy, dx) → sector index

ECS memory layout (2000 items):
  startTimes: 16KB (2000 × 8 bytes)
  durations: 16KB
  effectIds: 4KB
  positionIds: 4KB
  flags: 2KB
  Total: ~42KB contiguous → fits in L1 cache
  vs OOP: ~400KB+ scattered heap objects
```

