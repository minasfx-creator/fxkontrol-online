

# Joi Operacional — Comando de Plataforma via Chat

## Visão Geral

Transformar a Joi de assistente documental em **co-piloto operacional** que executa ações diretas na plataforma: adicionar posições, criar coreografias, manipular timeline, controlar playback e gerenciar o projeto inteiro — tudo via linguagem natural no chat.

## Arquitetura

```text
┌─────────────────────┐     ┌──────────────────────┐
│  Joi AI (Edge Fn)   │     │  FXKAssistant.tsx     │
│                     │     │                       │
│ System Prompt with  │────▶│ Response Parser       │
│ [JOI_CMD] blocks    │     │ detecta [JOI_CMD]     │
│                     │     │ executa via store      │
└─────────────────────┘     └───────┬───────────────┘
                                    │
                           ┌────────▼────────┐
                           │ joiCommandExec   │
                           │ (novo módulo)    │
                           │                  │
                           │ addPosition()    │
                           │ addTimelineItem()│
                           │ addFormation()   │
                           │ setWind()        │
                           │ play/pause/seek  │
                           │ setProjectName() │
                           └──────────────────┘
```

## Arquivos a Criar/Editar

### 1. `src/utils/joiCommandExecutor.ts` (NOVO)

Motor de execução de comandos. Parseia blocos `[JOI_CMD]{...}[/JOI_CMD]` das respostas da Joi e despacha para o `useProjectStore`.

**Comandos suportados:**
- `add_position` — cria posição pyro/drone/light com coordenadas
- `add_effect` — adiciona efeito na timeline (effectId, startTime, positionId)
- `remove_position` / `remove_effect` — remoção
- `update_position` — edita coordenadas/ângulos
- `add_formation` — cria formação de drones
- `set_wind` — configura vento
- `play` / `pause` / `seek` — controle de playback
- `set_project_name` — renomeia projeto
- `add_cue_marker` — marca cue na timeline
- `create_choreography` — macro que cria múltiplas posições + efeitos de uma vez

### 2. `src/components/JoiCommandFeedback.tsx` (NOVO)

Widget inline no chat que mostra confirmação visual de cada comando executado (ícone + descrição + status ✅/❌).

### 3. `supabase/functions/fxk-ai-chat/index.ts` (EDITAR)

Expandir SYSTEM_PROMPT com seção de comandos operacionais:
- Documentar formato `[JOI_CMD]{"action":"...","params":{...}}[/JOI_CMD]`
- Listar todos os comandos disponíveis com parâmetros
- Instruir a Joi a usar comandos quando o usuário pedir ações operacionais
- Incluir lista de effectIds válidos do EFFECT_LIBRARY

### 4. `src/components/FXKAssistant.tsx` (EDITAR)

- Importar `joiCommandExecutor`
- No `streamChat` callback `upsert`, após acumular texto completo, detectar e executar blocos `[JOI_CMD]`
- Renderizar `JoiCommandFeedback` inline nas mensagens que contêm comandos executados
- Strip `[JOI_CMD]` blocks do texto visível (similar ao `[KMZ_READY]`)

### 5. `src/components/JoiCommandPresets.tsx` (NOVO)

Presets operacionais adicionais para o chat:
- `CRIAR SHOW` — "Crie um show de 3 minutos com 20 posições e efeitos variados"
- `POSIÇÕES` — "Adicione 10 posições pyro em linha espaçadas 5m"
- `COREOGRAFIA` — "Crie uma coreografia de chrysanthemum em sequência com 0.5s de intervalo"
- `FORMAÇÃO` — "Crie uma formação de 50 drones em espiral"

## Detalhes Técnicos

### Formato de Comando
```json
[JOI_CMD]{"action":"add_position","params":{"name":"P1","type":"pyro","x":0,"y":0,"z":0}}[/JOI_CMD]
```

### Macro `create_choreography`
```json
[JOI_CMD]{"action":"create_choreography","params":{
  "positions":[{"name":"P1","type":"pyro","x":-10,"y":0,"z":0},...],
  "cues":[{"effectId":"mort-01","positionIndex":0,"startTime":5.0},...],
  "projectName":"Show Reveillon 2026"
}}[/JOI_CMD]
```

### Segurança
- Todos os comandos são validados antes da execução (types, ranges)
- Confirmação visual no chat antes de ações destrutivas (remove)
- Limite de 50 comandos por mensagem para evitar flood
- Toast notification para cada ação executada

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Criar `joiCommandExecutor.ts` com parser + executor |
| 2 | Criar `JoiCommandFeedback.tsx` |
| 3 | Atualizar system prompt com comandos operacionais |
| 4 | Integrar executor no `FXKAssistant.tsx` |
| 5 | Adicionar presets operacionais |
| 6 | Build verification |

