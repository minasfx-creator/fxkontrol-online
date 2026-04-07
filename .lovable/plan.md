

# Adicionar Shows Pirotécnicos Nacionais Brasileiros

## Resumo

Adicionar 6 shows pirotécnicos nacionais brasileiros ao catálogo World Shows, além de Copacabana que já existe. Cada preset terá plano de fogo realista, GPS real e intel estratégico completo.

---

## Shows a Adicionar

| Show | Local | GPS | Posições | Duração | Terreno |
|---|---|---|---|---|---|
| **Réveillon Salvador** | Farol da Barra, BA | -13.0089, -38.5327 | 10 balsas na baía | 600s (10min) | Baía de Todos os Santos |
| **Réveillon Fortaleza** | Praia de Iracema, CE | -3.7219, -38.5217 | 8 balsas | 480s (8min) | Praia oceânica |
| **Réveillon Balneário Camboriú** | Barra Sul, SC | -27.0044, -48.6229 | 6 balsas + FG Emissário | 420s (7min) | Praia c/ skyline |
| **Réveillon Brasília** | Esplanada dos Ministérios | -15.7989, -47.8649 | 8 posições terrestres | 480s (8min) | Terrestre, lago Paranoá |
| **São João Caruaru** | Pátio de Eventos, PE | -8.2823, -35.9714 | 6 posições terrestres | 360s (6min) | Terrestre, sertão |
| **Réveillon Recife/Olinda** | Marco Zero, PE | -8.0631, -34.8711 | 10 balsas no rio/mar | 540s (9min) | Rio Capibaribe + mar |

---

## Arquivo Modificado

### `src/data/worldShowPresets.ts`

- Adicionar 6 funções `generate*()` seguindo o padrão existente (multi-fase: opening → shells → crescendo → finale)
- Adicionar 6 entries no array `WORLD_SHOW_PRESETS` com intel completo:
  - População metro, últimos shows, vencedores de licitação
  - Segurança (NOTAMs, terreno), marés, cultura local
  - Insights estratégicos e regulatório
- Todos com `continent: 'americas'` e `flag: '🇧🇷'`

### Dados Intel Reais (resumo)

| Local | Pop. Metro | Regulatório |
|---|---|---|
| Salvador | 3.9M | DECEA + Capitania BA + IBAMA |
| Fortaleza | 4.0M | DECEA + Capitania CE + SEMACE |
| Balneário Camboriú | 150K (1M+ turistas) | DECEA + Bombeiros SC |
| Brasília | 4.8M | DECEA + GDF + ICMBio |
| Caruaru | 370K | Bombeiros PE + Polícia Civil |
| Recife/Olinda | 4.0M | DECEA + Capitania PE + PCR |

---

## Ordem de Execução

| Passo | Tarefa |
|---|---|
| 1 | Criar 6 funções generate + presets com intel em `worldShowPresets.ts` |
| 2 | Build verification |

