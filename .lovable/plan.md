

# World Famous Firework Show Presets — Planos de Fogo Reais

## Visao Geral

Criar um sistema de presets de shows pirotecnicos baseados nos maiores shows do mundo, com planos de fogo realistas (posicoes de balsas, calibres, timing, efeitos). O usuario seleciona um local e recebe o cenario GPS + timeline completa pronta para simulacao.

---

## Dados Pesquisados (Shows Reais)

| Local | Dados Tecnico-Operacionais |
|---|---|
| **Copacabana, Rio** | 19 balsas, 35.000 disparos, calibres 100-400mm, 23.500kg, 14 min, sincronizado com musica, balsas distribuidas em 4.2km de praia |
| **Sydney Harbour** | 9 toneladas de fogos, 7km de Harbour, waterfall na ponte (134m altura), 4 plataformas aereas, balsas + Opera House + Bridge, ~12 min |
| **Burj Khalifa, Dubai** | Fogos instalados nos andares do predio (828m), LED mapping + pirotecnia, efeitos cascata verticalissima, Dubai Fountain sincronizada |
| **London Eye, Thames** | Barges no Thames + London Eye (135m), 12.000 fogos, 12 min, Titanium Fireworks/CarnDu, sincronizado BBC |
| **Jingu Gaien, Tokyo** | 12.000 disparos, show de 1h, warimono (shells artesanais), estilo hanabi classico japones |
| **Malta Grand Harbour** | Estilo italiano artesanal, shells 3-12", waterfront 360 graus, competicao internacional |
| **Eiffel Tower, Paris** | Fogos na torre (330m) + barges no Sena, 14 Juillet, cascatas na torre |
| **Marina Bay, Singapura** | Barges em baia, 7 min, sincronizado com laser show e drones |
| **Las Vegas Strip** | 7 casinos simultaneos, rooftop launchers, 8 min, shells 3-8" |
| **Funchal, Madeira** | Guinness record (2006), 16.5 min, barges ao redor da baia, 66.326 fogos |

---

## Arquitetura

### 1. Arquivo de Dados: `src/data/worldShowPresets.ts`

Cada preset contem:
- **Metadata**: nome, local, descricao, pais, bandeira, coordenadas GPS, heading ideal da camera
- **Positions**: array de `Position` (balsas, pontos fixos na ponte/predio/torre) com coordenadas XYZ relativas
- **Timeline**: array de `TimelineItem` com efeitos da `EFFECT_LIBRARY` existente, timings realistas, calibres corretos
- **Scene overrides**: `Partial<SceneSettings>` (waterEnabled, timeOfDay, fogDensity)
- **Duration**: duracao total do show

Exemplo da estrutura por show:

```text
Copacabana (14 min, 35.000 disparos):
  19 balsas: 4.2km linearmente no mar, ~220m entre balsas
  Fase 1 (0-30s):  Abertura — mines + comets de todas as balsas
  Fase 2 (30-180s): Shells 3-5" alternados, padrao wave esquerda-direita
  Fase 3 (180-360s): Crisantemos 6" + kamuro 5" crescendo
  Fase 4 (360-600s): Multi-break 6"+ waterfalls nas balsas centrais
  Fase 5 (600-720s): Cascata total + shells 8-10"
  Fase 6 (720-840s): Grand Finale — todas balsas simultaneas, 12" shells

Sydney (12 min):
  Bridge waterfall (134m, 1149m span): 20 posicoes ao longo da ponte
  6 barges no Harbour
  Opera House: 4 posicoes laterais
  Fase 1: Waterfall na ponte + mines nas barges
  Fase 2: Shells 4-6" das barges em sequencia
  Fase 3: Chrysanthemum 8" + palm 6"
  Fase 4: Grand Finale ponte + barges + Opera House
```

### 2. UI Component: `src/components/editor/WorldShowPresetsPanel.tsx`

- Lista de shows agrupados por continente (Americas, Europa, Asia, Oceania, Oriente Medio)
- Card com: bandeira + nome + foto placeholder + stats (disparos, duracao, posicoes)
- Botao "Carregar Show" que:
  1. `setGpsOrigin({ lat, lng, heading, altitude })`
  2. `useSceneStore.getState().updateSettings({ google3DTilesEnabled: true, waterEnabled, timeOfDay, ... })`
  3. Adiciona `positions` ao store
  4. Adiciona `timelineItems` ao store
  5. `setDuration(totalDuration)`
  6. Toast de confirmacao

### 3. Integracao no Editor

- Botao "World Shows" no toolbar superior ou dentro do GoogleMapsPanel
- Lazy-loaded panel
- Ao carregar, limpa timeline/posicoes existentes (com confirmacao)

---

## Shows a Implementar (10 presets)

1. **Copacabana, Rio de Janeiro** — 19 balsas, 35K disparos, 14 min
2. **Sydney Harbour Bridge** — waterfall + barges + Opera House, 12 min
3. **Burj Khalifa, Dubai** — vertical cascade 828m, 10 min
4. **London Eye, Thames** — barges + Eye, 12 min
5. **Tour Eiffel, Paris** — torre + Sena, 12 min
6. **Jingu Gaien, Tokyo** — hanabi classico, 15 min
7. **Marina Bay, Singapore** — barges + laser, 8 min
8. **Las Vegas Strip** — 7 rooftops, 8 min
9. **Funchal, Madeira** — baia 360, 16 min
10. **Grand Harbour, Malta** — competicao italiana, 10 min

---

## Detalhes Tecnicos por Show

Cada show tera ~30-80 positions e ~100-300 timeline items (representando os momentos-chave, nao os 35.000 disparos individuais — isso seria inviavel na UI). Os timeline items usam efeitos existentes (`mort-01` a `shell-13`, `wf-01` a `wf-04`, `mine-01` a `mine-06`, `cake-01` a `cake-05`) com posicoes e timings que replicam o arco dramatico real:

- Abertura (mines + comets) 
- Desenvolvimento (shells crescentes em calibre)
- Climax (multi-breaks + waterfalls)
- Grand Finale (saturacao total)

---

## Ordem de Execucao

| Passo | Tarefa |
|---|---|
| 1 | Criar `src/data/worldShowPresets.ts` com 10 shows completos |
| 2 | Criar `WorldShowPresetsPanel.tsx` com UI de selecao |
| 3 | Integrar no toolbar do editor |
| 4 | Build verification |

## Impacto

- ~1 novo arquivo de dados (~800 LOC)
- ~1 novo componente UI (~250 LOC)  
- ~5 linhas de integracao no editor

