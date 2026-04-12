

# Limpeza de Código e Otimização — FX KONTROL

## Diagnóstico

Após análise completa do codebase, identifiquei os seguintes problemas:

### Dependências
- **Plugin React duplicado**: `@vitejs/plugin-react` E `@vitejs/plugin-react-swc` — só um é usado (o primeiro)
- **Capacitor platform deps sem uso direto**: `@capacitor/android`, `@capacitor/cli`, `@capacitor/ios` — são deps de build mobile, mas `@capacitor/core` e `@capacitor/haptics` são usados em `haptics.ts`
- **`@types/google.maps`** — tipo sem importação direta (pode ser usado implicitamente)
- **`tus-js-client`** — usado apenas em `VVIZImporter.tsx` (1 ficheiro)

### Bundle (produção)
- **Total precache**: 8.5 MB (253 ficheiros) — excessivo para PWA
- **vendor-export**: 871 KB (jspdf + docx + jszip) — deveria ser lazy-loaded sob demanda
- **three-core**: 970 KB — inevitável, mas ok por ser lazy
- **html2canvas**: 201 KB — chunk separado, usado apenas em exportação
- **1420 exports mortos** (ts-prune) — código não utilizado infla o bundle

### Ficheiros grandes (>800 linhas)
- 32 ficheiros com >800 linhas; top: SkyCanvas (1926), PyroFireOnePanel (1642), LiveFiringPanel (1486)
- Candidatos a decomposição em sub-componentes

### Código morto
- Componentes como `JoiHologramAvatar`, `JoiHologramFullBody` com exports não utilizados
- Hooks como `useCamera`, `useDMXWorker`, `useRemoteRelay`, `useTiles` potencialmente órfãos

## Plano de Execução

### Fase 1 — Remover dependências desnecessárias
- Remover `@vitejs/plugin-react-swc` do `package.json` (duplicado, não usado no vite.config)
- Remover `@capacitor/android`, `@capacitor/cli`, `@capacitor/ios` (deps de build nativo, não afetam web)
- Remover `@types/google.maps` se não houver uso implícito

### Fase 2 — Otimizar chunks pesados
- Mover `vendor-export` (jspdf/docx/jszip) para import dinâmico lazy — só carrega quando utilizador exporta
- Separar `html2canvas` do bundle principal (já está separado, verificar se é lazy)
- Adicionar tree-shaking hints para `lucide-react` (118 KB de ícones)

### Fase 3 — Limpar exports mortos (top 50)
- Remover funções/tipos exportados mas nunca importados nos módulos mais críticos:
  - `src/lib/artnet4Engine.ts` (8 exports mortos)
  - `src/lib/chainEngine.ts` (5 exports mortos)
  - `src/lib/cueNumbering.ts` (5 exports mortos)
  - `src/lib/dmxEngine.ts` (6 exports mortos)
  - `src/hooks/` (vários hooks órfãos)

### Fase 4 — Reduzir precache PWA
- Excluir chunks lazy (vendor-export, html2canvas, postprocessing-core) do precache do workbox
- Reduzir de 8.5 MB para ~4 MB de precache
- Adicionar runtime caching para chunks 3D/export em vez de precache

### Fase 5 — Decomposição dos ficheiros maiores (incremental)
- `SkyCanvas.tsx` (1926 linhas) → extrair sub-sistemas para `skycanvas/` (já parcialmente feito)
- `LiveFiringPanel.tsx` (1486 linhas) → extrair secções em componentes dedicados
- `FieldTest.tsx` (1466 linhas) → separar lógica de teste de UI

## Impacto Esperado
- **Bundle inicial**: -200-400 KB (lazy vendor-export + dead code)
- **Precache PWA**: -4 MB (de 8.5 para ~4 MB)
- **node_modules**: -30 MB (deps removidos)
- **Manutenibilidade**: menos 1400+ exports mortos, ficheiros mais legíveis

## Detalhes Técnicos
- Todas as remoções são incrementais e retrocompatíveis
- Nenhum módulo novo criado — apenas limpeza e reorganização
- Lazy imports usam o padrão `React.lazy()` já existente no projeto
- Workbox config ajustada em `vite.config.ts` via `globIgnores`

