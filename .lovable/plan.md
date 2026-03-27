
Objetivo: eliminar o bug de “editor abre só uma parte” (desktop/mobile) tornando o layout do `/editor` deterministicamente full-area dentro do container disponível do app.

1) Isolar a causa no encadeamento de layout
- Revisar o fluxo `MainLayout -> main -> wrapper de transição -> Index`.
- Confirmar dois pontos frágeis já visíveis no código:
  - `useIsMobile()` inicia como `undefined` (vira `false`), renderizando branch desktop no primeiro frame em mobile.
  - O `/editor` depende de `h-full` em cadeia + wrapper com key/animação de rota, o que pode gerar clipping/intermitência em telas específicas.

2) Corrigir a base de detecção mobile (evitar render errado no primeiro paint)
- Arquivo: `src/hooks/use-mobile.tsx`
- Ajustar `useIsMobile` para iniciar com valor síncrono (`window.innerWidth < 768`) em vez de `undefined`.
- Usar `matchMedia(...).matches` no listener para manter estado consistente.
- Resultado esperado: mobile não renderiza desktop layout no frame inicial.

3) Fortalecer o container do editor no MainLayout
- Arquivo: `src/layouts/MainLayout.tsx`
- Para `/editor` e `/command`, garantir `main` com `relative flex-1 min-h-0 overflow-hidden`.
- Evitar que o wrapper de transição (dissolve/materialize com `key={displayedPath}`) interfira no editor imersivo; manter transição para páginas comuns e usar render direto para editor/command.
- Preservar padding/docks apenas onde aplicável (não editor/command).

4) Tornar o Index independente de “height chain” frágil
- Arquivo: `src/pages/Index.tsx`
- Trocar raiz do editor para estratégia de preenchimento absoluto (`absolute inset-0`) dentro do `main` relativo.
- Aplicar `min-h-0`/`overflow-hidden` nos wrappers que hospedam canvas e painéis para impedir corte vertical.
- Manter timeline/painéis absolutos sem alterar comportamento funcional (apenas robustez de dimensionamento).

5) Ajuste mobile complementar do painel flutuante (se necessário para corte percebido)
- Arquivo: `src/components/editor/MobileFloatingPanel.tsx`
- Substituir altura fixa `88dvh/50dvh` por limite calculado com safe-area e barra inferior (`calc(...)`) para não ultrapassar viewport útil.
- Garantir que conteúdo interno continue scrollável sem empurrar/cortar canvas.

6) Validação (incluindo teste end-to-end obrigatório)
- Desktop:
  - Abrir `/editor` direto e via Dashboard.
  - Confirmar canvas ocupando toda a área disponível do editor (sem cortar topo/rodapé/lateral).
  - Testar com painel direito aberto, timeline colapsada/expandida e modo maximize.
- Mobile:
  - Abrir `/editor` em largura de telefone.
  - Confirmar ausência de flash de layout desktop e canvas totalmente visível.
  - Testar abertura/arraste/fechamento de painel flutuante sem clipping.
- Regressão:
  - Verificar `/command` e `/dashboard` sem quebra visual.
  - Verificar que transições de página continuam nas rotas não imersivas.

Detalhes técnicos (resumo de arquivos)
- `src/hooks/use-mobile.tsx`: inicialização e listener robustos.
- `src/layouts/MainLayout.tsx`: container imersivo e bypass de transição para editor/command.
- `src/pages/Index.tsx`: raiz absoluta (`inset-0`) + `min-h-0/overflow-hidden`.
- `src/components/editor/MobileFloatingPanel.tsx` (opcional mas recomendado): altura adaptativa com safe-area.
