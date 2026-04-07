

# Refatoracao Desktop UI/UX — Eliminar Travas, Redundancia e Integrar World Shows AR

## Problemas Identificados

| Problema | Causa |
|---|---|
| World Shows inacessivel | Escondido dentro de 80+ icones no PanelTabBar direito, sem atalho na Toolbar |
| Floating panel com scroll pessimo | Container `overflow-y-auto` sem `h-full` — conteudo corta ou nao scrolla |
| Redundancia entre Left Dock e Right Dock | Effects, Scene e Settings aparecem em ambos os lados |
| VenueIntelOverlay nunca aparece | Usuarios nao encontram o caminho ate o panel World Shows |
| Panel direito `max-w-[30vw]` muito estreito | 380px com max 30vw comprime conteudo do VenueIntelOverlay |

## Mudancas

### 1. Adicionar botao "World Shows" direto na Toolbar (acesso imediato)

Em `Toolbar.tsx`, adicionar um botao Globe na barra superior (proximo ao ADD+) que abre diretamente `activePanel: 'worldshows'`. Isso elimina a necessidade de procurar no dock direito.

### 2. Corrigir layout do Floating Panel direito (Index.tsx)

O container do panel flutuante (Layer 3, linha 477-499) tem problemas:
- Adicionar `h-full` ao container interno para que `overflow-y-auto` funcione
- O container precisa de height explicito: ja tem `top` e `bottom` absolutos, mas o div interno nao propaga height
- Mudar `max-w-[30vw]` para `max-w-[40vw]` para paineis com conteudo denso como VenueIntelOverlay
- Garantir que o `ScrollArea` dentro de `WorldShowPresetsPanel` e `VenueIntelOverlay` receba height correta

Mudanca especifica em Index.tsx linhas 488-498:
```tsx
// DE:
<div className="h-full overflow-y-auto">

// PARA:  
<div className="h-full overflow-hidden flex flex-col">
```

E no container (linha 479):
```tsx
// DE: max-w-[30vw]
// PARA: max-w-[40vw]  
```

### 3. Corrigir propagacao de height nos paineis

Em `WorldShowPresetsPanel.tsx` e `VenueIntelOverlay.tsx`:
- Garantir que o root div usa `h-full` (ja usa ✓)
- O `ScrollArea` precisa de `flex-1 min-h-0` para funcionar dentro de flex containers

VenueIntelOverlay.tsx linha 136:
```tsx
// DE: <ScrollArea className="flex-1">
// PARA: <ScrollArea className="flex-1 min-h-0">
```

WorldShowPresetsPanel.tsx linha 129:
```tsx  
// DE: <ScrollArea className="flex-1">
// PARA: <ScrollArea className="flex-1 min-h-0">
```

### 4. Auto-load + Apresentacao AR ao selecionar cidade

Modificar `WorldShowPresetsPanel.tsx`:
- Ao clicar no ShowCard, o VenueIntelOverlay abre (ja implementado ✓)
- Adicionar auto-scroll suave nas secoes do overlay
- No VenueIntelOverlay, apos o usuario ver os dados, o botao DEPLOY SHOW carrega automaticamente (ja implementado ✓)
- Verificar que o fluxo funciona end-to-end

### 5. Eliminar redundancia Left Dock vs Right Dock

O Left Dock (Effects/Scene/Settings) duplica entradas do PanelTabBar direito. Solucao:
- Manter o Left Dock como acesso rapido (esta correto como esta)
- Remover `effects`, `scene`, `showsettings` da secao "Ambiente" do PanelTabBar direito para evitar confusao
- Isso nao quebra nada porque a logica de exclusao mutua (`SHARED_PANEL_IDS`) ja existe

### 6. Melhorar VenueIntelOverlay com estetica AR cinematografica

Refinar o overlay com:
- Borda `border-cyan-500/20` e sutil scanline animation no header
- GPS coords com animacao typewriter (incremento progressivo dos digitos)
- Botao DEPLOY com glow pulsante ciano
- Secoes com icone de "scanning" antes de revelar (transicao atual de 120ms esta boa, mas adicionar um sutil border-left accent)

## Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/components/editor/Toolbar.tsx` | Adicionar botao Globe "World Shows" na toolbar |
| `src/pages/Index.tsx` | Fix container height + max-width do floating panel |
| `src/components/editor/WorldShowPresetsPanel.tsx` | Fix ScrollArea min-h-0 |
| `src/components/editor/VenueIntelOverlay.tsx` | Fix ScrollArea min-h-0 + refino AR visual |
| `src/components/editor/PanelTabBar.tsx` | Remover duplicatas da secao Ambiente |

## Ordem de Execucao

| Passo | Tarefa |
|---|---|
| 1 | Fix layout do floating panel (Index.tsx) — desbloqueia todos os paineis |
| 2 | Fix ScrollArea nos paineis World Shows e Intel Overlay |
| 3 | Adicionar botao World Shows na Toolbar |
| 4 | Remover duplicatas do PanelTabBar |
| 5 | Refinar estetica AR do VenueIntelOverlay |
| 6 | Build verification |

