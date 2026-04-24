# Integrar painel HTML do FXKONTROL e centralizar SwarmGPT

## Pré-requisito: enviar o HTML

Não consigo abrir o link de download externo. Para eu seguir, escolha **uma** opção ao aprovar este plano:

- **(A)** Cole o HTML completo na próxima mensagem, ou
- **(B)** Anexe o arquivo `.html` no chat, ou
- **(C)** Diga o caminho dele dentro do projeto (ex.: `public/fxkontrol-panel.html`).

Se nenhuma opção vier, eu sigo só com a parte de **centralização e limpeza de duplicações** (passos 2–4 abaixo), usando o layout SwarmGPT atual como base visual.

---

## Estado atual (mapeado)

SwarmGPT hoje aparece em **3 lugares diferentes**, gerando duplicação:

1. `src/components/editor/SwarmGPTPanel.tsx` — painel completo dentro do editor (`/editor`).
2. `src/pages/Dashboard.tsx` — atalho "SwarmGPT AI" que aponta para `panel: 'swarmgpt'`.
3. `src/components/editor/FullscreenCommandMenu.tsx` — entrada no menu de comandos.

Módulo backend isolado em `src/modules/swarmgpt/` (planner/critic/enhancer/repair) — esse fica intacto, é a "alma" do sistema.

## O que vai ser feito

### 1. Importar o painel HTML como referência visual (depende de A/B/C)

- Ler o HTML enviado, extrair: paleta, tipografia, blocos de seção (header, status strip, prompt area, formation grid, transition list, fidelity report), micro-interações.
- Mapear cada bloco do HTML para componentes React já existentes em `src/components/editor/` (reaproveitar `FidelityReport`, `TransitionPlannerPanel`, etc.) ou criar novos quando não houver equivalente.
- Não vou copiar `<script>` inline do HTML — toda lógica reusa o módulo `src/modules/swarmgpt/`.

### 2. Criar rota `/swarmgpt` como hub central

- Nova página `src/pages/SwarmGPT.tsx` registrada em `src/App.tsx` dentro do `MainLayout`.
- Layout baseado no HTML (após etapa 1) ou no `SwarmGPTPanel.tsx` atual (fallback).
- Reúne em um só lugar: prompt + opções → plano gerado → critique → fidelity → preview de cues prontas para o timeline.

### 3. Remover duplicações da UI

- **Dashboard**: o atalho "SwarmGPT AI" passa a navegar para `/swarmgpt` (em vez de abrir painel local).
- **Editor (`Index.tsx`)**: remover o lazy-load `SwarmGPTPanel` e o caso `activePanel === 'swarmgpt'`. O botão no editor passa a abrir `/swarmgpt` em nova rota (ou dentro do mesmo tab).
- **FullscreenCommandMenu**: comando "swarmgpt" passa a navegar para `/swarmgpt`.
- **Sidebar (`AppSidebar`)**: adicionar item "SwarmGPT" apontando para `/swarmgpt` (verificar antes se já existe).
- `SwarmGPTPanel.tsx` deixa de ser exportado como painel modal — ou vira o conteúdo da nova página, ou é removido.

### 4. Limpeza de código morto relacionado

- Remover imports de `SwarmGPTPanel` que ficarem órfãos.
- Remover entrada `activePanel: 'swarmgpt'` da união de tipos no editor.
- Confirmar que `panel.swarmgpt` em `i18n.ts` continua sendo usado (sidebar/rotas) — manter.

## Detalhes técnicos

- **Roteamento**: `<Route path="/swarmgpt" element={<SwarmGPT />} />` dentro do bloco `MainLayout` em `src/App.tsx`, lazy-loaded com `lazyRetry` seguindo padrão das outras rotas.
- **Estado**: hub usa o pipeline `generateSwarmGPTShow` de `src/modules/swarmgpt/pipeline/` — mesmo contrato de hoje.
- **Aplicar ao timeline**: botão "Aplicar" usa `applySwarmGPTCuesToTimeline` de `src/modules/swarmgpt/adapters/` — quando clicado fora de `/editor`, navega para `/editor` após aplicar.
- **Mobile (440×688)**: o hub respeita o padrão atual do projeto — header compacto, sem painéis flutuantes interceptando clique (regra que já corrigimos no Joi).
- **Sem alteração no módulo `src/modules/swarmgpt/`** — só consumo.

## Arquivos previstos

Criar:
- `src/pages/SwarmGPT.tsx`

Editar:
- `src/App.tsx` (rota nova)
- `src/pages/Dashboard.tsx` (atalho navega para `/swarmgpt`)
- `src/pages/Index.tsx` (remove painel modal SwarmGPT)
- `src/components/editor/FullscreenCommandMenu.tsx` (comando navega)
- `src/components/AppSidebar.tsx` (item de menu)
- `src/components/editor/SwarmGPTPanel.tsx` (vira conteúdo da página ou é removido)

## Fora de escopo

- Mexer no módulo `src/modules/swarmgpt/` (planner/critic/enhancer).
- Alterar pipeline de drones/VVIZ.
- Mais ajustes no Joi/FXKAssistant (já fechado).
