

# Refatoracao Total — World Shows como Experiencia Cinematica no Viewport

## Problema Central

O sistema atual forca o usuario a navegar por um painel lateral generico (WorldShowPresetsPanel) para encontrar shows. Isso e um padrao de "app de lista" — nao de editor 3D cinematografico. O usuario quer selecionar uma praca no viewport e o show carregar automaticamente com uma apresentacao imersiva AR diretamente sobre o canvas 3D.

## Nova Arquitetura UX

```text
ANTES (generico):
  Toolbar → SHOWS btn → Side Panel → Lista → Card → Intel Overlay → Deploy

DEPOIS (cinematografico):  
  Viewport → Seleciona Praca → Fade-to-black → GPS flyTo → AR Intel HUD overlay no viewport → Auto-deploy show
```

## Mudancas

### 1. Novo componente `VenueShowOverlay.tsx` — HUD fullscreen no viewport

Substituir o painel lateral por um overlay transparente que se projeta SOBRE o viewport 3D (como um HUD de game AAA). Componente absoluto `inset-0 z-30` com `pointer-events-none` nos areas do canvas e `pointer-events-auto` apenas nos elementos interativos.

Layout cinematografico:
- **Canto superior esquerdo**: Nome da cidade + bandeira + GPS typewriter
- **Lateral esquerda**: Intel sections com reveal sequencial (scanline + fade-in)
- **Centro inferior**: Barra de stats (posicoes, cues, calibres, duracao)
- **Canto inferior direito**: Botao DEPLOY pulsante ciano
- **Background**: Sem fundo opaco — glassmorphism ultra-transparente, o canvas 3D e visivel atras

Inclui typewriter GPS animation (30ms/char com cursor `|` piscante).

### 2. Novo componente `VenueQuickSelector.tsx` — Seletor compacto de pracas

Em vez do painel lateral com lista, um seletor compacto flutuante (estilo command palette) que aparece ao clicar no botao SHOWS da toolbar:
- Input de busca com filtro por continente (chips horizontais)
- Grid compacto de cards (flag + nome + cidade) — max 6 visiveis, scroll
- Ao clicar em uma praca: fecha o seletor, inicia sequencia cinematografica

### 3. Fluxo cinematografico ao selecionar praca

Sequencia automatica ao selecionar uma praca no `VenueQuickSelector`:
1. Fechar seletor
2. Trigger `ViewportTransitionOverlay` (fade-to-black existente) com nome da cidade
3. Executar `setGpsOrigin()` + `updateSettings()` (camera voa para o local)
4. Mostrar `VenueShowOverlay` com intel AR sobre o viewport
5. Auto-deploy do show (generate + inject positions/timeline) — sem botao manual
6. Apos 3s de intel reveal, overlay faz fade-out gradual deixando apenas o show carregado

### 4. Modificar `Index.tsx`

- Remover renderizacao de `WorldShowPresetsPanel` do floating panel lateral
- Adicionar estado `venueOverlay: WorldShowPreset | null`
- Renderizar `VenueShowOverlay` como layer sobre o canvas (z-30, abaixo da toolbar)
- Renderizar `VenueQuickSelector` como modal central (z-50)
- Manter botao SHOWS na toolbar — agora abre `VenueQuickSelector` em vez do painel lateral

### 5. Remover `WorldShowPresetsPanel.tsx` e `VenueIntelOverlay.tsx`

Substituidos pelos novos componentes. Logica de `handleLoad` migra para `VenueShowOverlay`.

## Estetica — PhD Design + Hollywood + Rockstar

- **Tipografia**: Font mono para GPS/stats, font sans bold para titulos — tracking ultra-wide
- **Cores**: Ciano dominante (`cyan-400/500`) sobre vantablack, com accents amber para alertas
- **Animacoes**: Typewriter GPS, scanline reveal nas sections, glow pulsante no deploy, fade-in sequencial com `circOut` easing
- **Glassmorphism**: `bg-black/20 backdrop-blur-md` — o 3D e sempre visivel
- **Scanlines**: Overlay sutil de linhas horizontais 1px no header
- **Crosshair**: Icone de mira pulsante no GPS
- **Auto-dissolve**: Overlay desaparece sozinho apos reveal completo, deixando o editor limpo

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/components/editor/VenueShowOverlay.tsx` | CRIAR — HUD fullscreen AR |
| `src/components/editor/VenueQuickSelector.tsx` | CRIAR — Seletor compacto |
| `src/pages/Index.tsx` | MODIFICAR — Integrar overlay + seletor, remover panel lateral |
| `src/components/editor/WorldShowPresetsPanel.tsx` | REMOVER |
| `src/components/editor/VenueIntelOverlay.tsx` | REMOVER |
| `src/components/editor/PanelTabBar.tsx` | MODIFICAR — Remover entry `worldshows` |

## Ordem de Execucao

| Passo | Tarefa |
|---|---|
| 1 | Criar `VenueQuickSelector.tsx` — seletor compacto com busca e filtro |
| 2 | Criar `VenueShowOverlay.tsx` — HUD AR cinematografico com typewriter GPS e auto-deploy |
| 3 | Integrar em `Index.tsx` — novo fluxo, remover painel lateral |
| 4 | Remover `WorldShowPresetsPanel.tsx` e `VenueIntelOverlay.tsx` |
| 5 | Limpar entry `worldshows` do `PanelTabBar.tsx` |
| 6 | Build verification |

