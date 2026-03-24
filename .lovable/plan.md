

## Blindagem da Branch — 4 Otimizações Críticas

### Diagnóstico Rápido

Após auditoria do código, o estado real é:

| Issue | Status Atual | Ação Necessária |
|-------|-------------|-----------------|
| 1. Cache API Google | **SEM cache** — cada chamada individual (`reverseGeocode`, `getElevation`) faz um fetch separado | Adicionar cache in-memory + deduplicação |
| 2. InstancedMesh Drones | **JÁ IMPLEMENTADO** — `InstancedDroneSwarm.tsx` usa InstancedMesh com LOD tri-tier | Nenhuma |
| 3. Audio Sync | **JÁ IMPLEMENTADO** — `DeterministicClock` com drift correction + `timecodeProvider` com fallback chain (LTC→SMPTE→Audio→perf) | Nenhuma |
| 4. Playhead Re-renders | **PROBLEMA REAL** — `Timeline.tsx` e `DMXBezierEditor.tsx` subscrevem `currentTime` via React state, causando re-renders a 60Hz | Migrar playhead para DOM direto via `useRef` |

Apenas os itens **1** e **4** precisam de implementação. Os itens 2 e 3 já estão resolvidos com engenharia de qualidade.

---

### Mudança 1: Cache + Deduplicação para Google Geo API

**Ficheiro:** `src/services/googleGeoIntelligence.ts`

- Adicionar um `Map<string, { data, timestamp }>` como cache in-memory com TTL de 5 minutos
- Chave do cache: `${lat.toFixed(4)},${lng.toFixed(4)}` (precisão ~11m, suficiente para evitar duplicatas)
- As funções individuais (`reverseGeocode`, `getTimeZoneOffset`, `getElevation`) passam a ler do cache antes de fazer fetch
- Adicionar deduplicação de requests em voo (se já há um fetch para as mesmas coordenadas, retorna a mesma Promise)
- Resultado: mesmas coordenadas nunca geram mais de 1 chamada à API num intervalo de 5 minutos

### Mudança 2: Playhead DOM-Direto (Zero Re-renders)

**Ficheiro:** `src/components/editor/Timeline.tsx`

- Extrair o playhead (linha vertical + indicator) para um sub-componente `PlayheadIndicator` que usa `useProjectStore.subscribe` (Zustand transient subscription)
- Em vez de causar re-render React, atualizar `ref.current.style.transform = translateX(...)` diretamente no DOM
- O componente Timeline principal deixa de subscrever `currentTime` para rendering — apenas para clicks/seeks
- Mesma abordagem para `PyroTimelineTrack.tsx` (playhead indicator dentro de cada track)

**Ficheiro:** `src/components/editor/DMXBezierEditor.tsx`

- O `playheadTime` já é derivado de `currentTime` — isolar a linha SVG do playhead num sub-componente com subscription transiente
- Os valores DMX calculados (`evaluateCurve`) continuam a precisar de re-render, mas podem ser throttled a 10Hz em vez de 60Hz

---

### Ficheiros Alterados

| Ficheiro | Ação |
|----------|------|
| `src/services/googleGeoIntelligence.ts` | Cache in-memory + request deduplication |
| `src/components/editor/Timeline.tsx` | Playhead via DOM direto (transient subscribe) |
| `src/components/editor/PyroTimelineTrack.tsx` | Playhead indicator via ref |
| `src/components/editor/DMXBezierEditor.tsx` | Throttle DMX evaluation + playhead isolation |

### Impacto
- **Custo Google**: De potencialmente centenas de chamadas para ~1 por localização a cada 5 min
- **Performance UI**: Timeline e painéis laterais param de re-renderizar a 60Hz durante playback — apenas o playhead se move via manipulação DOM directa

