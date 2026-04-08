

# Ciclo #51 — Refinar Posições dos World Show Presets

## Problemas Identificados

| # | Problema | Shows Afetados | Impacto |
|---|---------|----------------|---------|
| 1 | **Balsas todas no mesmo Z** — Layout linear 1D em vez de arco offshore realista | Copacabana, Fortaleza, Brasília | **Alto** — fogos aparecem em linha reta plana |
| 2 | **Z-axis inconsistente** — Alguns shows usam Z negativo para "offshore", outros usam Z positivo. Mistura de convenções | Sydney, Tokyo, Malta, Recife | **Alto** — posições aparecem invertidas |
| 3 | **Orbit radius fixo (300)** não escala com tamanho do show — Copacabana tem 4km de spread, Caruaru 160m | Todos | Médio — câmera não enquadra o show |
| 4 | **Torre Burj Khalifa sem spread X/Z** — 15 posições empilhadas verticalmente no exato mesmo ponto | Burj Khalifa | Médio — visualmente confuso |
| 5 | **Sydney Bridge z:0 = mesma profundidade das barges** — Ponte deveria estar atrás (backdrop) | Sydney | Médio |
| 6 | **Heading dos positions sem sentido** — Balsas/ground com heading=0 mas deveriam apontar para público | Vários | Baixo — não afeta visual mas afeta ângulo de lançamento |

## Implementação

### Arquivo: `src/data/worldShowPresets.ts`

**Convenção de coordenadas padronizada:**
- X = lateral (esquerda/direita da vista do público)
- Y = altura (metros acima do solo/mar)
- Z = profundidade (negativo = longe do público/offshore, positivo = em direção ao público)
- Heading = ângulo de disparo em graus (0 = para cima, 180 = para trás)

**Copacabana (L86-91):** Arco offshore em vez de linha reta
- 19 balsas em arco suave: `z` varia de -60 a -120 (centro mais longe, extremidades mais perto)
- Spread X mantido em 220m entre balsas

**Sydney (L164-181):** Separar profundidades Bridge vs Barges vs Opera
- Bridge: `z: -300` (backdrop distante)
- Barges: `z: -80 a -150` (meia distância)  
- Opera House: `z: -50` (lateral próximo)

**Burj Khalifa (L237-247):** Adicionar leve spread X por andar
- Torre: `x` varia ±5m baseado no andar (simulando faces do prédio)
- Fonte: arco na frente do prédio (`z: +150 a +200`)

**London Eye (L292-302):** Posicionar Eye no backdrop, barges no rio
- Eye: `z: -200` (backdrop)
- Barges: `z: -60 a -100` (no rio entre público e Eye)

**Tokyo Hanabi (L400-406):** Semicírculo virado para frente
- Inverter Z do semicírculo: `z: Math.sin(angle) * 100` (positivo = frente)

**Malta (L586-597):** Harbour 360° correto, mas forts devem estar elevados e afastados
- Forts: Z mais negativo (-600 a -500) para criar profundidade

**Recife (L845-854):** Rio e mar em profundidades distintas
- Rio: `z: -40` (mais perto)
- Mar: `z: -250` (mais longe)

**Caruaru (L806-811):** Escala muito pequena (raio 80m) — adequado para o evento mas ajustar Z center

**Brasília (L763-768):** Linear correto para Esplanada, mas adicionar leve curvatura

### Arquivo: `src/components/editor/VenueShowOverlay.tsx` (L156)

**Orbit radius dinâmico baseado no spread do show:**
```ts
// Calcular bounding radius das posições
const maxSpread = Math.max(
  ...positions.map(p => Math.sqrt(p.x * p.x + p.z * p.z))
);
const orbitRadius = Math.max(maxSpread * 1.5, 200);
const orbitHeight = Math.max(maxSpread * 0.8, 150);
triggerOrbit([0, 0, 0], orbitRadius, 0.08, orbitHeight);
```

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Refinar coordenadas de todos os 16 shows |
| 2 | Orbit radius dinâmico no VenueShowOverlay |
| 3 | Build verification |

