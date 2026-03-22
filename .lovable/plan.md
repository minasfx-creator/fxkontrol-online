

# Refinamentos e Correção de Falhas — FXcommander Live FX

## Problemas Identificados

### 1. Tipografia Ilegível (Crítico — UX)
125+ ocorrências de `text-[5px]` e `text-[6px]` em `LiveFiringPanel.tsx`. Texto de 5-6px é impossível de ler em qualquer dispositivo. Minimum legível: `text-[8px]` em desktop panel, `text-[10px]` em mobile/fullscreen.

**Arquivos**: `LiveFiringPanel.tsx` (125 ocorrências)

### 2. Redundância de Layout Mobile
O bloco `if (mob)` (linhas 1413-1430) e o bloco `if (isFullscreen)` (linhas 1382-1408) renderizam conteúdo quase idêntico. Como `isMobile` já seta `isFullscreen = true` no `useEffect`, o bloco `if (mob)` é código morto na prática (o `isFullscreen` sempre é true quando `mob` é true). Deve ser removido para evitar confusão.

### 3. `globalThis.Map` Workaround Frágil
Linhas 396 e 521 usam `globalThis.Map` para contornar um shadowing de tipo. Isso indica que existe algum tipo `Map` importado ou declarado que conflita. A solução correta é identificar e renomear o tipo conflitante, ou usar type assertion.

### 4. MobileModeTabs — Labels `text-[8px]` Ilegíveis
O grid de modos mobile (linha 155) usa `text-[8px]` nos labels e `text-[8px]` nos headers de categoria (linha 141). Touch targets de 56px estão OK, mas labels precisam ser maiores.

### 5. Swipe Interfere com Scroll
O swipe handler (linhas 460-500) na raiz do painel captura gestos horizontais com threshold de 60px, o que pode conflitar com scroll horizontal dentro de painéis filhos (sliders, scroll areas).

### 6. `ArtNetModulePanel` não Recebe `fs` prop
Na linha 1373, `<ArtNetModulePanel />` é renderizado sem a prop `fs`, então ele não adapta layout entre panel e fullscreen mode.

### 7. `relay_server_url` Não Persiste
O campo `relay_server_url` existe na tabela DB mas `configToDb` no hook de persistence não o mapeia — módulos WAN/Relay perdem a URL do relay entre sessões.

### 8. `addModule` Gera IDs Novos Sempre
Quando `useArtNetModulePersistence` carrega módulos do DB e chama `addModule(dbToConfig(row))`, o `addModule` gera um novo `id` em vez de usar o `id` do banco. Isso causa duplicatas se o módulo já existir com ID diferente.

## Plano de Correção

### Correção 1 — Tipografia Mínima
Em `LiveFiringPanel.tsx`, substituir todas as ocorrências de `text-[5px]` por `text-[8px]` e `text-[6px]` por `text-[8px]` no contexto panel (não-fullscreen). Em contexto mobile/fullscreen, garantir mínimo `text-[9px]`.

### Correção 2 — Remover Bloco `if (mob)` Redundante
Remover linhas 1413-1430 (`if (mob)` block). O `useEffect` já força `isFullscreen = true` em mobile.

### Correção 3 — Map Type Fix
Substituir `globalThis.Map` por `new Map` com type assertion explícita, ou adicionar alias `type MapType = typeof Map` se necessário.

### Correção 4 — Mobile Mode Labels
Aumentar labels de `text-[8px]` para `text-[10px]` e headers de categoria de `text-[8px]` para `text-[9px]` em `MobileModeTabs`.

### Correção 5 — Swipe Guard
Adicionar check: ignorar swipe se o touch start foi dentro de um `ScrollArea`, `Slider`, ou input interativo.

### Correção 6 — Pass `fs` to ArtNetModulePanel
Adicionar prop `fs` ao componente `ArtNetModulePanel` e passá-lo na chamada (linha 1373).

### Correção 7 — Persistir `relay_server_url`
Adicionar mapeamento de `relayServerUrl` ↔ `relay_server_url` em `configToDb` e `dbToConfig` no `useArtNetModulePersistence.ts`.

### Correção 8 — Preservar IDs do DB
No `addModule` do service, se `config.id` for fornecido, usar esse ID em vez de gerar novo. Já existe lógica similar para `moduleAddress`.

## Arquivos Afetados
1. **Editar**: `src/components/editor/LiveFiringPanel.tsx` — tipografia, remover bloco morto, swipe guard, Map fix
2. **Editar**: `src/hooks/useArtNetModulePersistence.ts` — mapear relay_server_url
3. **Editar**: `src/services/artnetModuleService.ts` — preservar ID fornecido em addModule
4. **Editar**: `src/components/editor/live-firing/ArtNetModulePanel.tsx` — aceitar prop `fs`

