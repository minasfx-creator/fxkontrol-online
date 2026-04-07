
# Ciclo de Realismo #7 — Trail Physics, Wind-Shearing, Sound-Sync Delay

## Problemas Identificados

| # | Problema | Localização |
|---|---|---|
| 1 | **Trails são segmentos retos** — cada segmento de trail usa `dragPos()` com o mesmo `dragCoeff` e `w[]` constante. O trail não segue a curvatura real da trajetória (gravidade + vento acumulado). Resultado: willow/kamuro trails parecem retas em vez de arcos parabólicos | `FireworkRenderer.tsx:399-408` |
| 2 | **Wind é uniforme** — `getWindForce()` chama `windField.sample(0, 50, 0)` (posição fixa) via `getGlobalWind()`. Não há variação por altitude. Na realidade, vento é mais forte em altitude e muda de direção — wind shearing | `sharedState.tsx:126-138`, `windField.ts:142-143` |
| 3 | **Sem delay de som por distância** — em shows reais, explosões distantes têm delay audível (~3s/km). A câmera pode estar a 200-3000m dos fogos. Sem esse delay, o som parece artificial | Não implementado |

## Soluções

### 1. Trail physics com curvatura real
**Arquivo**: `FireworkRenderer.tsx`

O trail já usa `dragPos()` para posição — mas o vento aplicado é `w[0] * t² * 0.3` com `w` constante. Para curvatura real:
- Usar `windField.sample(px, py, pz)` por segmento de trail, passando a posição real da estrela naquele instante
- Isso faz trails de willow curvarem com o vento em vez de derivar linearmente
- Custo: ~STAR_COUNT * TRAIL_LENGTH lookups adicionais, mas `windField.sample()` é hash-based (barato)

### 2. Wind-shearing por altitude
**Arquivo**: `windField.ts`

Adicionar multiplicador de altitude ao `sample()`:
- Abaixo de 50m: wind × 0.3 (protegido por terreno/prédios)
- 50-150m: interpolação linear 0.3 → 1.0
- 150-400m: wind × 1.0 (full speed)
- Acima de 400m: wind × 1.2 + rotação de direção de 15° (jet stream shearing)
- Adicionar `altitudeShearing: boolean` ao config (default true)

### 3. Sound-sync delay por distância
**Arquivo**: Novo `src/lib/soundDelay.ts` + integração em `FireworkRenderer.tsx`

- Calcular distância câmera→burst: `d = sqrt((cam.x - burst.x)² + ...)`
- Speed of sound: 343 m/s
- Delay: `d / 343` segundos
- Aplicar delay ao `progress` do burst visual: **não** — o visual é correto, o que precisa de delay é o SOM
- Exportar `getSoundDelay(cameraPos, burstPos)` para uso futuro no sistema de áudio
- Por enquanto, expor como helper + aplicar no flash visual (flash é o que sincroniza percepção de "instante da explosão")

### 4. getWindForce com altitude
**Arquivo**: `sharedState.tsx`

Modificar `getWindForce()` para aceitar posição Y opcional e passar para `windField.sample()` com coordenada real em vez de `(0, 50, 0)`.

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| `src/core/engine/windField.ts` | Wind-shearing por altitude |
| `src/components/editor/skycanvas/sharedState.tsx` | getWindForce com altitude |
| `src/components/editor/skycanvas/FireworkRenderer.tsx` | Trail curvatura real, wind por posição |
| `src/lib/soundDelay.ts` | Novo — helper de delay sonoro por distância |

## Ordem de Execução

| Passo | Tarefa |
|---|---|
| 1 | windField.ts — altitude shearing |
| 2 | sharedState.tsx — getWindForce com Y |
| 3 | soundDelay.ts — helper |
| 4 | FireworkRenderer.tsx — trail curvatura + wind por posição |
| 5 | Build verification |
