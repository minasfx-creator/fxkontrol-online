

# Plano: Ultra-Refinamento Mobile — Conceitos Finale 3D + UX Jogabilidade

## Visao Geral

Transformar o editor mobile numa experiencia de "jogabilidade tactil" inspirada no Finale 3D profissional: tap-to-place com feedback visual imediato, FAB central de criacao, gestos intuitivos para angulos HPR, e HUD refinado com informacoes contextuais.

---

## 1. FAB Central de Criacao no MobileTabBar

Inserir um botao FAB (Floating Action Button) elevado no centro da tab bar que abre um wizard de criacao guiado.

**MobileTabBar.tsx:**
- Reorganizar tabs: Timeline | Assets | **[FAB +]** | Live FX | More (5 visiveis, resto em more)
- FAB: `w-14 h-14`, `bg-primary`, `rounded-full`, `-translate-y-5` para flutuar acima da barra
- Glow pulsante com `box-shadow` animado
- Ao tocar: abre `AddPositionWizard` como bottom sheet

## 2. AddPositionWizard — Fluxo Guiado 4 Etapas

**Novo: `src/components/editor/AddPositionWizard.tsx`**

```text
Step 1: Tipo          Step 2: Posicionar      Step 3: Angulos HPR     Step 4: Efeito
┌──────────────┐     ┌──────────────────┐    ┌──────────────────┐    ┌──────────────┐
│ ○ Nova Pyro  │     │ Toque no viewport│    │ H: [──●──] 0°    │    │ [Grid efeitos│
│ ○ Novo Drone │     │ para posicionar  │    │ P: [──●──] 85°   │    │  com cores e │
│ ○ Efeito em  │     │                  │    │ R: [──●──] 0°    │    │  categorias] │
│   existente  │     │ Criadas: 3       │    │ [SVG preview]    │    │              │
│              │     │ [Proximo →]      │    │ [Pular][OK →]    │    │ [Concluir ✓] │
└──────────────┘     └──────────────────┘    └──────────────────┘    └──────────────┘
```

- Step 2 ativa `editorMode = 'add-pyro'` ou `'add-drone'` para tap-to-place no viewport
- Escuta evento `position-placed` do GroundClickPlane para contar posicoes criadas
- Step 3 usa sliders horizontais com preview SVG de direcao (Finale 3D HPR)
- Step 4 mostra grid filtrada por categoria do EFFECT_LIBRARY

## 3. AngleQuickEditor — Sliders HPR com Preview SVG

**Novo: `src/components/editor/AngleQuickEditor.tsx`**

- 3 sliders: Heading (0-360°), Pitch (0-90°), Roll (-180 a 180°)
- SVG circular mostrando vetor de direcao em tempo real
- Labels com tipografia mono (JetBrains Mono) para valores precisos
- Botao "Reset" para defaults Finale 3D (H:0, P:85, R:0)
- Reutilizavel: usado no wizard E acessivel via botao Compass no MobileQuickActions

## 4. MobileQuickActions — Refinamento Tactil

**Modificar: `src/components/editor/MobileQuickActions.tsx`**
- Remover botao "Add" redundante (substituido pelo FAB central)
- Aumentar touch targets de `w-10 h-10` para `w-11 h-11` (44px minimo Apple HIG)
- Adicionar labels contextuais que aparecem brevemente ao tocar (tooltip tactil de 800ms)
- Botao Compass abre `AngleQuickEditor` inline no MobileFloatingPanel
- Agrupar acoes em "modo": quando ha selecao, mostrar Edit/Angle/Dup/Del; sem selecao, Sel/Undo/Redo

## 5. MobileHUD — Info Contextual Finale 3D

**Modificar: `src/components/editor/MobileHUD.tsx`**
- Adicionar badge de contagem de posicoes (ex: "24 POS") no canto esquerdo junto ao timecode
- Quando em modo `add-pyro`: substituir timecode pill por "PLACING MODE" com cor accent e animacao pulse
- Quando posicao selecionada: mostrar mini-info (nome + HPR) no centro do HUD
- Botao de modo (Select/Place/Angle) como pill toggleable no centro

## 6. MobileFloatingPanel — Snap Points Refinados

**Modificar: `src/components/editor/MobileFloatingPanel.tsx`**
- Adicionar snap "peek" (25% da tela) para preview rapido sem ocupar espaco
- Melhorar thresholds: swipe down 60px (era 80) para dismiss mais responsivo
- Adicionar indicador de scroll na borda direita (thin scrollbar glow)
- Header compacto: title + close inline, sem botao de toggle de altura separado

## 7. PositionPins — Evento position-placed

**Modificar: `src/components/editor/PositionPins.tsx`**
- No `GroundClickPlane.handleClick`, apos criar posicao, emitir:
  `window.dispatchEvent(new CustomEvent('position-placed', { detail: { id, type } }))`
- O wizard escuta este evento para incrementar contador e auto-avancar

## 8. CSS — Animacoes FAB

**Modificar: `src/index.css`**
- `@keyframes fab-glow-pulse` — box-shadow pulsante no FAB central
- `@keyframes mode-indicator-pulse` — pill de modo no HUD
- `.fab-button` — classe utilitaria com gradiente e sombra

---

## Ficheiros

| Acao | Ficheiro |
|------|---------|
| Criar | `src/components/editor/AddPositionWizard.tsx` |
| Criar | `src/components/editor/AngleQuickEditor.tsx` |
| Modificar | `src/components/editor/MobileTabBar.tsx` — FAB central |
| Modificar | `src/components/editor/MobileQuickActions.tsx` — remove Add, 44px targets |
| Modificar | `src/components/editor/MobileHUD.tsx` — info contextual |
| Modificar | `src/components/editor/MobileFloatingPanel.tsx` — snap peek |
| Modificar | `src/components/editor/PositionPins.tsx` — evento position-placed |
| Modificar | `src/index.css` — keyframes FAB |

### Protecoes
- Desktop: TacticalDock e Toolbar intactos (FAB e wizard sao mobile-only)
- GroundClickPlane: logica existente preservada, apenas adiciona dispatchEvent
- EFFECT_LIBRARY: read-only, sem alteracoes
- Stores Zustand: nenhuma alteracao de schema
- SkyCanvas/R3F pipeline intacto

