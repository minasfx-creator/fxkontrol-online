

# Refinamento Final — World Shows Intel AR + Bug Fixes

## Bugs a Corrigir

| Bug | Fix |
|---|---|
| `_uid` counter global — IDs duplicam se `generate()` chamado 2x | Usar `crypto.randomUUID()` |
| `_uid = 0` reset dentro de cada `generate` — frágil | Eliminar counter, usar UUID |
| `window.confirm()` — quebra estética FUI | Substituir por overlay inline |
| Sem empty state no filtro | Adicionar mensagem quando 0 resultados |

## Arquivos e Mudanças

### 1. `src/data/worldShowPresets.ts` — Fix IDs + Adicionar Intel

- Substituir `uid()` por `crypto.randomUUID()` em todos os helpers
- Remover `_uid` counter global e resets `_uid = 0`
- Adicionar campo `intel` ao tipo `WorldShowPreset`:

```typescript
intel: {
  population: string;
  lastShows: string[];
  recentWinners: string[];
  safetyNotes: string[];
  terrain: string;
  tideInfo: string;
  culture: string;
  keyInsights: string[];
  regulatory: string;
}
```

- Preencher intel para cada um dos 10 presets com dados reais

### 2. `src/components/editor/VenueIntelOverlay.tsx` — Novo (HUD AR)

Painel cinematográfico exibido ao selecionar um show, antes de carregar:

- Fundo `bg-black/90` com borda `border-cyan-500/30`
- Header: bandeira + nome + GPS coords com typewriter animation
- 8 seções com fade-in sequencial (150ms delay entre cada):
  - População & Público (Users icon)
  - Últimos Shows (History icon)
  - Vencedores Licitação (Trophy icon)
  - Segurança & Terreno (Shield icon)
  - Marés & Clima (Waves icon)
  - Cultura Local (Heart icon)
  - Insights Estratégicos (Lightbulb icon)
  - Regulatório (FileText icon)
- Botão "DEPLOY SHOW" estilo neon ciano — substitui `window.confirm`
- Botão "VOLTAR" para retornar à lista

### 3. `src/components/editor/WorldShowPresetsPanel.tsx` — Integrar Overlay

- Adicionar estado `selectedPreset: WorldShowPreset | null`
- Click no ShowCard → `setSelectedPreset(preset)` em vez de carregar direto
- Renderizar `VenueIntelOverlay` quando `selectedPreset` existe
- O overlay dispara `handleLoad` via botão DEPLOY
- Adicionar empty state quando filtro retorna 0 resultados
- Remover `window.confirm`

## Dados Intel por Local (resumo)

| Local | Pop. Metro | Terreno | Maré | Regulatório |
|---|---|---|---|---|
| Copacabana | 6.7M | Praia oceânica 4.2km | 0.3-1.2m | NOTAM DECEA + Bombeiros RJ |
| Sydney | 5.3M | Harbour, ponte 134m | 0.5-2.0m | NSW EPA + Maritime Safety |
| Burj Khalifa | 3.5M | Lago artificial urbano | N/A | Dubai Civil Defence |
| London Eye | 9.0M | Rio Thames, 135m | 1.0-7.0m | GLA + Port of London |
| Tour Eiffel | 11M | Rio Sena, torre 330m | Fluvial | Préfecture de Police |
| Tokyo | 14M | Parque urbano | N/A | Fire Dept Tokyo + MLIT |
| Marina Bay | 5.9M | Baía artificial | 0.5-3.0m | MPA Singapore |
| Las Vegas | 2.2M | Deserto, rooftops | N/A | Clark County Fire |
| Funchal | 112K | Baía vulcânica | 0.5-2.5m | ANPC Portugal |
| Malta | 516K | Porto natural 360° | 0.2-0.5m | Malta Police + TM |

## Ordem de Execução

| Passo | Tarefa |
|---|---|
| 1 | Fix bugs + adicionar intel em `worldShowPresets.ts` |
| 2 | Criar `VenueIntelOverlay.tsx` |
| 3 | Atualizar `WorldShowPresetsPanel.tsx` com overlay + empty state |
| 4 | Build verification |

## Impacto

- ~1 arquivo modificado (worldShowPresets.ts — +200 LOC intel data)
- ~1 arquivo novo (VenueIntelOverlay.tsx — ~180 LOC)
- ~1 arquivo modificado (WorldShowPresetsPanel.tsx — ~20 LOC)

