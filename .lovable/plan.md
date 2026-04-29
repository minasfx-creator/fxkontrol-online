## Objetivo

Adicionar controles **In/Out** (recorte não-destrutivo) ao áudio na timeline. O recorte:

1. Mapeia o tempo da timeline `[0 .. (out − in)]` para o tempo do áudio `[in .. out]` durante reprodução, scrub e exportação.
2. Recalcula a **waveform** mostrando só a região recortada.
3. Recalcula a **duração** do projeto (`duration = out − in`).
4. Re-timestampa **automaticamente** os efeitos da timeline para preservar seu alinhamento musical relativo ao novo `t=0`.
5. É **não-destrutivo**: o arquivo de áudio original não é alterado; só `audioInPoint` e `audioOutPoint` são persistidos. Pode ser desfeito (Reset) recuperando os efeitos de antes do trim.

## Mudanças

### 1. Store — pontos In/Out + ação de trim com recálculo

**`src/store/useProjectStore.ts`**

Novos campos:
- `audioInPoint: number` (segundos no áudio original, default `0`)
- `audioOutPoint: number | null` (segundos no áudio original, `null` = fim do arquivo)
- `audioOriginalDuration: number | null` (preenchido após decodificação; necessário para clamp dos pontos)
- `audioTrimHistory: { in: number; out: number | null; timestamp: number; itemSnapshot: TimelineItem[] } | null` (1 nível de undo; opcional para ação "Reset trim")

Setters:
- `setAudioInPoint(t)`, `setAudioOutPoint(t)` — só atualizam o valor (uso em drag visual; não recalcula nada).
- `setAudioOriginalDuration(d)` — chamado pelo `loadAudio()` após `decodeAudioData`.
- **`applyAudioTrim(inT, outT)`** — ação atômica que:
  1. Faz clamp: `0 ≤ inT < outT ≤ audioOriginalDuration`. Rejeita janela menor que `0.05s`.
  2. Calcula `delta = inT - audioInPoint` e `newDuration = outT - inT`.
  3. Para cada `TimelineItem` / `CueMarker` / `CameraKeyframe` / `Trajectory.waypoints`: `t' = t - delta`. Items que ficarem com `t' < 0` ou `t' > newDuration` são **filtrados** (mas o `audioTrimHistory` guarda snapshot original para undo).
  4. Atualiza `audioInPoint`, `audioOutPoint`, `duration = newDuration`, `currentTime = clamp(currentTime - delta, 0, newDuration)`.
  5. Salva snapshot no `audioTrimHistory` (1 nível de undo).
- **`resetAudioTrim()`** — restaura `audioInPoint=0`, `audioOutPoint=null`, `duration = audioOriginalDuration`, e se houver `audioTrimHistory`, restaura `timelineItems` para o snapshot e reverte os deltas dos demais (cues/camera/waypoints) somando o delta original de volta.

### 2. Mapeamento timeline ↔ áudio

**`src/lib/audio/audioTrimMapping.ts`** (novo, puro):
```ts
export const timelineToAudio = (t: number, inP: number) => t + inP;
export const audioToTimeline = (a: number, inP: number) => a - inP;
export const clampToTrim   = (a: number, inP: number, outP: number | null, origDur: number) =>
  Math.min(outP ?? origDur, Math.max(inP, a));
```

Aplicado em:

- **`AudioWaveform.tsx`** — `useEffect` que cria o `<Audio>`: assim que o áudio carrega e `audioInPoint > 0`, faz `audio.currentTime = audioInPoint`. Adiciona listener `timeupdate`: se `audio.currentTime >= (audioOutPoint ?? duration)`, pausa e dispara `setPlaying(false)`. Sync de seek: agora compara `audio.currentTime` com `currentTime + audioInPoint` (com a mesma tolerância 0.15s).
- **`useAudioMasterClock.ts`** — quando lê `audio.currentTime`, escreve `timelineClock.syncExternalTime(audio.currentTime - audioInPoint)`. Lê `audioInPoint` via `useProjectStore.getState()` no callback (não como dep do hook, pra evitar reinit).

### 3. Recálculo de waveform restrito à região

**`AudioWaveform.tsx`** — `loadAudio()`:
- Após `decodeAudioData`, chama `setAudioOriginalDuration(audioBuffer.duration)`.
- A janela usada para downsample passa a ser `[audioInPoint .. audioOutPoint ?? audioBuffer.duration]`:
  - `startSample = floor(audioInPoint * sampleRate)`
  - `endSample = floor((audioOutPoint ?? audioBuffer.duration) * sampleRate)`
  - `samples = floor(newDuration * pixelsPerSecond * 2)`
  - `blockSize = floor((endSample - startSample) / samples)`
  - Loop sobre `rawData.subarray(startSample, endSample)`.
- Re-executa quando `audioInPoint` ou `audioOutPoint` mudam (adicionar às deps de `loadAudio` + `useEffect` que o invoca).
- Cache: guarda o `AudioBuffer` decodificado em `audioBufferRef` para evitar re-fetch a cada mudança de in/out — só o downsample é refeito.

### 4. UI — handles In/Out + toolbar de trim

Estende **`AudioWaveform.tsx`** (lane existente, sem novo arquivo grande):

- Dois handles verticais sobrepostos ao canvas: traço vertical (`Scissors` icon no topo) na posição `(audioInPoint - audioInPoint) * pps = 0` e `(audioOutPoint - audioInPoint) * pps = duration * pps`. Inicialmente nas bordas; viram interativos só quando o usuário entra em "Trim Mode".
- Toggle "Trim" (ícone `Scissors`) na coluna de controles à esquerda (perto do botão Snap). Estado local `trimMode`.
- Quando `trimMode === true`:
  - Aparecem dois handles draggáveis (largura 6 px, altura total da lane, cor `hsl(var(--warning))`).
  - Drag atualiza um estado local `pendingIn / pendingOut` (preview ao vivo, sem mexer no áudio nem na timeline ainda — apenas redesenha overlay sombreado nas regiões fora do range).
  - Botões `Apply trim` (chama `applyAudioTrim(pendingIn, pendingOut)`) e `Cancel`. Ao aplicar, mostra toast com `delta` aplicado e nº de cues/items removidos.
  - Atalhos: `I` define `pendingIn = currentTime + audioInPoint`; `O` define `pendingOut = currentTime + audioInPoint`. Apenas quando `trimMode === true` e foco fora de inputs.
- Quando `audioInPoint > 0 || audioOutPoint != null` (já recortado), aparece chip `Trimmed · X.XXs–Y.YYs` com botão `Reset` (chama `resetAudioTrim()`).

### 5. Re-timestampagem automática dos efeitos

Implementada em `applyAudioTrim` (passo 1.3 acima). Regras:

| Entidade | Campo de tempo | Ação |
|---|---|---|
| `TimelineItem` | `startTime` | `t' = t - delta`; remove se `t' < -0.05` ou `t' > newDuration + 0.05` |
| `CueMarker` | `time` | mesmo |
| `CameraKeyframe` | `time` | mesmo |
| `Trajectory.waypoints[].time` | `time` | mesmo (waypoints removidos se ficarem fora) |
| `DroneFormation` | `startTime` | mesmo (formações inteiras removidas se startTime fora) |

Toast de sumário: `Trimmed audio · removed N items / M cues outside new window`.

### 6. Persistência e exportações

- `useProjectPersistence.ts`: incluir `audioInPoint`, `audioOutPoint`, `audioOriginalDuration` no snapshot serializado (com migration: se ausentes, defaults `0` / `null` / `null`).
- Exportações VVIZ/CSV/JSON (`exportEngine.ts`): **nenhuma mudança nos timestamps emitidos** — eles já refletem o `startTime` pós-trim do store, que é o tempo "show". Adicionar metadata-comment opcional `// audio in=X out=Y` no header dos exports é fora do escopo desta tarefa.

### 7. Edge cases protegidos

- Áudio ainda decodificando quando o usuário clica `Apply trim` → desabilita botão até `audioOriginalDuration != null`.
- Reset trim sem snapshot disponível (projeto recarregado) → restaura só `in=0, out=null, duration=audioOriginalDuration` sem mexer em items (com toast `History indisponível, items mantidos`).
- Áudio trocado (`setAudioUrl(novoUrl)`): zera `audioInPoint`, `audioOutPoint`, `audioOriginalDuration` e `audioTrimHistory` para evitar aplicar trim de outro arquivo.
- `currentTime` durante trim mode: continua usando o sistema de coordenadas da **timeline atual** (pré-aplicação); só após `Apply` o store muda.

### 8. Testes

`src/lib/audio/__tests__/audioTrimMapping.test.ts` (novo):
- `timelineToAudio(0, 5) === 5`; `audioToTimeline(5, 5) === 0`.
- `clampToTrim` respeita bordas com e sem `outPoint`.

`src/store/__tests__/applyAudioTrim.test.ts` (novo):
- Trim `[2, 8]` em projeto com items em `t=1, 3, 7, 9` → resultado: items em `1, 5` (os de `t=1` e `t=9` removidos), `duration=6`.
- Snapshot preservado em `audioTrimHistory`; `resetAudioTrim` restaura ambos.
- Trim com `inT >= outT` ou janela < 50ms → no-op + warning.

### Arquivos tocados

- `src/store/useProjectStore.ts` — campos, setters, `applyAudioTrim`, `resetAudioTrim`, hook em `setAudioUrl`.
- `src/lib/audio/audioTrimMapping.ts` — **novo** (helpers puros).
- `src/components/editor/AudioWaveform.tsx` — handles UI, modo trim, atalhos `I/O`, downsample restrito, sync com `audioInPoint`, fim-de-trim em `timeupdate`, cache de `AudioBuffer`.
- `src/hooks/useAudioMasterClock.ts` — subtrai `audioInPoint` ao escrever no `timelineClock`.
- `src/hooks/useProjectPersistence.ts` — serializa/deserializa novos campos com migration.
- `src/lib/audio/__tests__/audioTrimMapping.test.ts` — **novo**.
- `src/store/__tests__/applyAudioTrim.test.ts` — **novo**.
