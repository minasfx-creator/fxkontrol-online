
Objetivo: consolidar a fundação visual do editor desktop em dark mode com três zonas claras e operacionais: viewport 3D central (`SkyCanvas`), biblioteca de efeitos lateral esquerda (`EffectLibrary`) e timeline/waveform fixa na base (`Timeline` + `AudioWaveform`), mantendo a estética command-grade já existente e reduzindo a sensação de “muitos painéis soltos”.

1. Reestruturar o shell do editor em `src/pages/Index.tsx`
- Transformar o layout desktop atual em uma composição explícita de 3 áreas persistentes:
  - centro: `SkyCanvas`
  - esquerda: painel foundation da `EffectLibrary`
  - base: timeline foundation com waveform
- Manter `Toolbar` no topo e preservar `ViewportNavControls`, mas ajustar offsets para respeitar a nova largura da sidebar esquerda e a altura fixa da timeline.
- Continuar usando `timelineCollapsed` e `viewportMaximized`, porém com comportamento previsível:
  - colapsar timeline reduz só a base
  - maximizar viewport esconde painéis foundation
  - sidebar esquerda continua recolhível em modo mini, não desaparece sem trigger

2. Promover a `EffectLibrary` de “dock opcional” para sidebar foundation
- Substituir o left dock atual por uma sidebar persistente com:
  - header compacto “Effect Library”
  - busca
  - chips/filtros
  - lista/tabela rolável
- Manter os componentes já existentes da `EffectLibrary`, mas adaptar o container para largura fixa e altura total entre toolbar e timeline.
- Preservar a possibilidade de recolher para mini-rail com ícones, seguindo a regra do sidebar: sempre deve existir forma visível de expandir novamente.
- Manter os outros painéis compartilhados (`scene`, `showsettings`) fora da foundation principal, como overlays/drawers, para não competir com a biblioteca.

3. Refinar o container do `SkyCanvas` como palco central
- Enquadrar o `SkyCanvas` dentro de um “viewport frame” premium:
  - fundo Vantablack
  - bordas suaves / glass dark
  - fade e overlays existentes preservados
- Garantir que o canvas ocupe todo o espaço restante entre sidebar esquerda e timeline inferior sem sobreposição acidental.
- Manter a estratégia Synthetic First e os parâmetros visuais premium já definidos em memória.
- Não introduzir novos controles pesados sobre o canvas nesta fase; foco é base estrutural.

4. Consolidar a timeline inferior como barra de composição principal
- Reforçar a `Timeline` como painel bottom-docked de largura total, com altura desktop mais estável e leitura melhor.
- Preservar a transport bar atual, playhead, grupos de tracks e `AudioWaveform`.
- Ajustar o visual do container da timeline para dark mode premium:
  - contraste mais alto entre header, régua e tracks
  - borda superior sutil
  - superfícies translúcidas consistentes com a sidebar
- Garantir que a waveform fique claramente integrada ao rodapé e não pareça um bloco separado.

5. Unificar o sistema visual dark mode
- Aplicar os tokens e memórias existentes:
  - base Vantablack / superfícies escuras
  - ciano para sync/timecode
  - âmbar/laranja para pyro
  - verde/vermelho só para estados críticos
- Harmonizar sidebar, viewport frame e timeline com a mesma linguagem:
  - blur controlado
  - bordas de baixa opacidade
  - tipografia mono para dados operacionais
  - microcontraste para leitura em ambiente escuro
- Evitar cyberpunk excessivo; manter linguagem mission-control.

6. Ajustar comportamento de overlays e painéis secundários
- Verificar `activePanel` e painéis flutuantes da direita para que não conflitem com a nova foundation.
- Regras:
  - foundation sempre visível por padrão
  - painéis secundários continuam contextuais
  - nenhum painel pode ocultar o trigger de reabertura da sidebar/timeline
- Manter a regra de UI: nunca aninhar botões dentro de triggers Radix/Shadcn.

7. Preservar performance e estabilidade
- Reutilizar componentes existentes em vez de recriar:
  - `SkyCanvas`
  - `EffectLibrary`
  - `Timeline`
  - `AudioWaveform`
- Evitar adicionar lógica nova no hot path do canvas.
- Manter lazy loading onde já existe, mas garantir que a foundation apareça com skeletons/fallbacks consistentes.
- Respeitar as memórias de gestão de recursos e zero-GC nas áreas críticas.

8. Validar responsividade do desktop e não quebrar mobile
- Implementar a foundation apenas no branch desktop do `Index.tsx`.
- Não alterar a arquitetura mobile com `MobileFloatingPanel` e `MobileTabBar`, exceto se algum ajuste de import/container for necessário.
- Garantir que os estados compartilhados (`timelineCollapsed`, `viewportMaximized`, `activePanel`) continuem compatíveis com ambos os modos.

9. QA funcional e visual
- Verificar:
  - `/editor` abre com Sky Canvas central, Effect Library à esquerda e Timeline/Waveform na base
  - colapso/expansão da timeline funciona
  - sidebar esquerda pode recolher e reabrir
  - drag/drop/import no viewport continua funcionando
  - timeline continua selecionando, scrubando e exibindo waveform
  - overlays do canvas não ficam cobertos incorretamente
- Fazer uma passada visual para contraste, espaçamento e consistência em dark mode.

Arquivos principais a editar
- `src/pages/Index.tsx` — reestruturação do shell desktop
- `src/components/editor/EffectLibrary.tsx` — adaptação do container para sidebar foundation
- `src/components/editor/Timeline.tsx` — refinamento visual/layout do rodapé timeline
- Opcionalmente algum arquivo de estilos/tokens já usado pelo editor, se necessário para superfícies dark/shared chrome

Detalhes técnicos
- O projeto já tem os três blocos principais implementados; o trabalho é consolidar o layout foundation, não criar novos módulos do zero.
- A sidebar esquerda atual já abre `EffectLibrary`, mas como painel flutuante estreito; a mudança principal é torná-la estrutural e persistente.
- A timeline já possui waveform integrada (`AudioWaveform`) e trilhas operacionais; o foco é hierarquia visual e docking estável.
- O `SkyCanvas` já está compatível com a direção visual premium do projeto; o ajuste é de moldura/layout, não de engine 3D.
