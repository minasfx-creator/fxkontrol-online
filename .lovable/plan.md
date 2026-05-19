# Templates de Show — Refinados com Planos Reais

5 planos analisados; vou converter em templates determinísticos e adicionar o Mineirão estádio.

## Dados extraídos

| Plano | Formato | Cues | Duração | Insights |
|---|---|---|---|---|
| **Réveillon BC** | Finale CSV completo | 85 | 410s | 6 posições (5 balsas + Emissário), Module/Slat/Pin, prefires reais (1.84–2.68s) por calibre |
| **Acaiaca Recife 2017** | Plano por quadros | 29 quadros | ~14min | 3 balsas, calibres 2–7", padrões em V/W/retos |
| **Itaguai 2022/23** | Plano por canais | 22 canais × 3 pontos | 36–45s/canal | Grades+tortas calibres 3–6" |
| **Show da Virada** | DOCX descritivo | 30+ blocos | — | 10 pontos lineares, leques W, calibres 2–3" |
| **Música 4** | Finale HTML print | — | — | Estrutura por shotTime/effectTime/pin/track |

## Entregas

### 1. Estender `ShowTemplate` (retrocompat)

`src/lib/showTemplates.ts` ganha campos opcionais:
```ts
pyroCues?: TemplatePyroCue[];   // mapeia 1:1 para PyroCue
positions?: TemplatePosition[]; // posições nomeadas com x/y/z/heading
venue?: { name: string; gps?: { lat; lng; alt } };
audioHint?: { bpm?: number; duration: number };
provenance: 'real_script' | 'reconstructed' | 'marketing_hypothesis';
sourceFile?: string;            // ex: "Réveillon_BC_firing_script.csv"
```
Tipos antigos continuam válidos (campos opcionais).

### 2. Catálogo de templates reais — `src/data/realShowTemplates.ts`

Cada template é função pura que retorna `Omit<ShowTemplate,'id'|'createdAt'>`:

- **`reveillonBC()`** — 85 cues 1:1 do CSV, 6 posições (Balsa 1–5 + FG Emissário), provenance `real_script`. Audio hint 410s.
- **`acaiacaRecife2017()`** — 29 quadros reconstruídos como cues sequenciais (3 posições × N calibres × tempo por quadro), provenance `reconstructed`.
- **`itaguai2022()`** — 22 canais × 3 pontos, grades/tortas alocadas por timing 36–45s, provenance `reconstructed`.
- **`showVirada10Pontos()`** — 10 posições lineares, blocos W de leques + tortas, provenance `reconstructed`.

### 3. **Mineirão Estádio — `mineiraoStadium()` ⭐**

Layout fiel ao Mineirão:
- **Venue**: Belo Horizonte, GPS `lat=-19.8658, lng=-43.9706, alt=852m`
- **Geometria** (eixo Y=norte, X=leste, Z=altura):
  - Eixo longo do gramado: ~108m (N–S), eixo curto ~68m (L–O)
  - Anel da cobertura: ~270m × 220m, altura 46m
- **22 posições canônicas**:
  - 4 cantos do gramado (`P1..P4`) — minas baixas + cake fan, h=0
  - 4 meio-laterais arquibancada inferior (`P5..P8`), h=12m
  - 8 pontos do anel da cobertura (`P9..P16`), h=46m, heading apontando p/ centro — bombas aéreas seguras
  - 2 posições centrais (`P17, P18`) atrás de cada baliza, h=2m — cortinas/cascatas
  - 4 cantos externos do estacionamento (`P19..P22`), h=0 — shells 5–6" maiores (longe da torcida)
- **120 cues** em 3 atos (90s):
  1. **Intro 0–20s**: anel da cobertura em wave (P9→P16) c/ Silver Mines
  2. **Build 20–55s**: gramado em pulses (P1–P8) sincronizado a 110 BPM, alternando Peony 4"/Brocade 5"
  3. **Climax 55–90s**: estacionamento externo (P19–P22) com Kamuro 12" + Horsetail 6", finale 20× Grand Peony em fan
- **NFPA 1123 respeitado**: shells ≥5" SÓ nas posições externas (raio ≥70m da torcida); minas+cakes pequenos nas posições internas. Geofence de audiência cobrindo bowl inteiro.
- **Audio hint**: 90s, sem BPM (hino).
- **Provenance**: `reconstructed` (layout do estádio real, sequência cinematic original).

### 4. UI — Quick Deploy no `ShowTemplatesPanel`

Nova aba **"⚡ Quick Deploy"** (primeira):
- Cards grandes com badge de provenance (real_script verde / reconstructed amber / marketing_hypothesis cyan)
- Mostra venue + duração + nº cues + thumbnail
- Botão único **"Deploy to Editor"** que:
  1. `useProjectStore.setMetadata(...)` (venue, gps, duração)
  2. `useProjectStore.setPositions(template.positions)`
  3. `useProjectStore.setPyroCues(template.pyroCues)` (idempotente: substitui)
  4. `useProjectStore.setCurrentTime(0)`
  5. Toast: "Réveillon BC deployed — 85 cues / 6 posições / 410s"
- Botão secundário "Merge" (não substitui, só anexa)

Tab "Browse" mantém comportamento atual (user-saved).

### 5. Testes — `src/lib/__tests__/realShowTemplates.spec.ts`

- Cada built-in retorna ≥1 cue, ≥1 posição
- Réveillon BC: exatos 85 cues, duração 410±1s, 6 posições
- Mineirão: 120 cues, todas em posição existente, shells ≥5" só em P19–P22, todas dentro do geofence
- Deploy é idempotente (rodar 2× = mesmo estado final)
- Provenance preserved no metadata

## Garantias

- **Zero impacto safety**: tudo é `useProjectStore` (Show plane). CommandBus/SSM/uiCommandGateway/GlobalEStopButton intocados.
- **Provenance honesta**: `real_script` só onde temos dados Finale exatos. `reconstructed` carimba os planos descritivos. Badge visível em cada card.
- **Retrocompat**: localStorage existente segue válido (novos campos são opcionais).
- **Mineirão NFPA-conforme**: shells grandes só nos cantos externos, geofence de audiência declarado.

## Arquivos

Novos:
- `src/data/realShowTemplates.ts` (5 templates: Réveillon BC, Acaiacá Recife, Itaguai, Show da Virada, **Mineirão Estádio**)
- `src/data/venues/mineiraoLayout.ts` (22 posições + geofence)
- `src/lib/__tests__/realShowTemplates.spec.ts`
- `public/reference/scripts/` (CSVs+HTML originais como auditoria, opcional)

Editados:
- `src/lib/showTemplates.ts` (+ campos opcionais no type, sem mexer no storage)
- `src/components/editor/ShowTemplatesPanel.tsx` (+ aba Quick Deploy + Deploy/Merge buttons)

Tempo: ~6 arquivos novos + 2 edições + 1 spec. Sem mudanças em renderer/safety/hardware.
