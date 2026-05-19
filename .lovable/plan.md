## Problemas diagnosticados

**1. Áudio para quando a Timeline é recolhida**
`src/pages/Index.tsx:632` faz `{!timelineCollapsed && <Timeline />}` — ao recolher, o `<Timeline>` desmonta, o `<AudioWaveform>` junto, e o `useEffect` cleanup do `<audio>` em `AudioWaveform.tsx:137-141` chama `audio.pause()` e `audio.src = ''`. O viewport maximizado tem o mesmo problema indireto.

**2. Não consegue adicionar fogos / não renderizam**
Três causas combinadas:
- a) O drop do `PyroTimelineTrack` (faixa "Pyro Cues") é read-only e só aparece quando já existem itens (`if (totalCues===0) return null`). Quem aceita drop é o `TimelineTrackRow trackIndex=0` (faixa "PYRO SYS") abaixo — não óbvio para o usuário.
- b) `Timeline.tsx` e os renderers (`sharedState.tsx`, `LightingSystem.tsx`, `FireworkRenderer.tsx`) procuram efeitos apenas em `EFFECT_LIBRARY`. Efeitos vindos de `buildImportedEffects()` (Finale/FWsim/527 parts) retornam `undefined` no `.find()` → drop é silenciosamente ignorado E itens existentes não renderizam.
- c) Sem posição selecionada, o drop no track de pyro cria item com `y: 0` (chão) — burst renderiza rente ao solo e parece "não aparecer".

## Plano

### A. Áudio persistente
1. Criar `src/components/editor/AudioEngine.tsx` (headless, sem UI). É o único dono do `HTMLAudioElement`. Lê `audioUrl/isPlaying/currentTime/volume/muted/playbackSpeed` da store via `useProjectStore.subscribe` (transient, zero re-render). Cleanup só no unmount da página.
2. Montar `<AudioEngine />` em `src/pages/Index.tsx` fora do bloco condicional da Timeline (junto dos providers/overlays globais).
3. Em `src/components/editor/AudioWaveform.tsx`: remover toda a engine de áudio (ref do `<audio>`, `useEffect`s de play/pause/seek/volume/rate). Mantém só: canvas + waveform + BPM + grid de beats + cue markers + upload + altura + mute toggle (mute passa a setar `muted` na store, lido pelo `AudioEngine`).
4. Resultado: recolher Timeline, maximizar viewport ou trocar de aba do painel mobile não interrompe a reprodução.

### B. Drag-drop dos fogos
5. Criar helper `src/data/effectsLibraries/lookup.ts` com `getEffectById(id)` que busca em `EFFECT_LIBRARY` e cai no `buildImportedEffects()` (memoizado). Lookup unificado, idempotente.
6. Trocar todos os `EFFECT_LIBRARY.find(e => e.id === ...)` por `getEffectById(...)` em:
   - `src/components/editor/Timeline.tsx` (todos os handlers de drop + todos os mapeamentos de render: pyro/drone/light/laser/dronefx/waypoint)
   - `src/components/editor/EffectLibrary.tsx` (handleAdd)
   - `src/components/editor/skycanvas/sharedState.tsx`
   - `src/components/editor/skycanvas/LightingSystem.tsx`
   - `src/components/editor/skycanvas/FireworkRenderer.tsx`
   - `src/components/editor/AudioWaveform.tsx` (cálculo de duração)
7. No drop do track pyro (`TimelineTrackRow` trackIndex=0), quando NÃO há posição selecionada, usar `position: { x: random±8, y: effect.heightMeters ?? 60, z: random±4 }` para o burst aparecer no céu.

### C. UX do drop na faixa Pyro Cues
8. Em `src/components/editor/PyroTimelineTrack.tsx`:
   - Remover o `if (totalCues === 0) return null` — passa a renderizar sempre um placeholder "Arraste fogos aqui" quando vazio.
   - Adicionar `onDragOver`/`onDrop` na linha de conteúdo: ao soltar um efeito de tipo `firework`, cria `TimelineItem` em `trackIndex=0` com o timestamp do drop (snap ao beat se ativo) e mesma regra de posição da seção B.7.

## Arquivos tocados
- `src/components/editor/AudioEngine.tsx` (novo)
- `src/components/editor/AudioWaveform.tsx`
- `src/pages/Index.tsx`
- `src/components/editor/Timeline.tsx`
- `src/components/editor/EffectLibrary.tsx`
- `src/components/editor/PyroTimelineTrack.tsx`
- `src/components/editor/skycanvas/sharedState.tsx`
- `src/components/editor/skycanvas/LightingSystem.tsx`
- `src/components/editor/skycanvas/FireworkRenderer.tsx`
- `src/data/effectsLibraries/lookup.ts` (novo)

## Fora de escopo
- Redesign visual da Timeline ou do AudioWaveform.
- Tocar em `useProjectStore`, safety state, command bus ou pipeline de export.
- Sync com SMPTE / clock externo (já existe `useShow3DEngineSync`, não vai mudar).
- Adicionar testes (pode ser rodada seguinte se quiser).

## Critério de pronto
- Toca um áudio → recolho a Timeline → continua tocando. Maximizo viewport → continua tocando.
- Arrastar qualquer efeito (built-in OU importado Finale/FWsim) na faixa "PYRO SYS" ou "Pyro Cues" cria o item e ele renderiza no céu.
- Build + suite verdes.
