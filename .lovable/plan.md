

# Calibração da Plataforma — Auditoria Completa e Refinamentos

## Problemas Encontrados

### A. Tipografia Ilegível (483 ocorrências em 23 arquivos)
- `text-[5px]` e `text-[6px]` espalhados em 23 componentes — impossível de ler em qualquer dispositivo
- `text-[7px]` em 71 arquivos (1814 ocorrências) — marginal, aceitável apenas em labels muito pequenos de desktop panel
- **LiveFiringPanel.tsx** ainda tem 117 ocorrências de `text-[7px]` após a última correção, incluindo em elementos importantes como CUE key labels, scene tabs, e status indicators
- Arquivos afetados mais críticos: `MobileLinkMode.tsx` (usa `text-[5px]` e `text-[6px]`), `SettingsPanel.tsx`, `DMXMonitorGrid.tsx`, `CollisionPanel.tsx`, `USBConnectionPanel.tsx`

### B. LiveFiringPanel — Problemas Residuais
1. **`text-[7px]` em mobile fullscreen**: Linhas como 838, 888, 893, 944, 984 usam `text-[7px]` no contexto `fs && mob` — ilegível em celular
2. **CueKey** (linha 271): `text-[7px]` para KEY label em panel mode — deveria ser `text-[9px]`
3. **DeviceRow** (linha 323): `text-[7px]` para index number — deveria ser `text-[8px]`
4. **Scene tabs** (linha 1012): `text-[7px]` em panel mode para S0/S1/S2/S3
5. **DEADMAN** (linha 944): `text-[7px]` em panel mode
6. **Inconsistência fs/non-fs**: Muitos ternários `fs ? "text-[10px]" : "text-[10px]"` onde ambos os lados são iguais — código morto

### C. MobileLinkMode.tsx — Tipografia Crítica
- Linha 538: `tsS = 'text-[6px]'` usado em labels de status
- Linha 816: `text-[6px]` em igniters grid
- Linha 900, 944, 1089, 1118, 1221: `text-[5px]` e `text-[6px]` em badges, indicators, event logs
- Tudo ilegível em mobile, que é o contexto principal deste componente

### D. SettingsPanel.tsx
- Linhas 84, 89, 137: `text-[6px]` em labels de configuração

### E. Engine / Lógica
1. **`globalThis.Map` workaround** (LiveFiringPanel linhas 396, 527): Funciona mas é frágil — deveria usar type alias
2. **`sceneCues` memo inútil** (linha 513): `cues.filter(() => true)` filtra nada — deveria filtrar por `activeScene`
3. **`pageCues` ignora scenes** (linha 516): `sceneCues.slice(0, 128)` não filtra por scene — os 4 scenes (S0-S3) provavelmente compartilham todos os CUEs, anulando o propósito do scene selector
4. **Fullscreen API forçada** (linhas 769-781): `requestFullscreen()` é chamado automaticamente ao entrar em fullscreen state, o que pode ser intrusivo e causar popups de permissão
5. **Ternários idênticos**: Dezenas de `fs ? "text-[10px]" : "text-[10px]"` — código redundante que dificulta manutenção

## Plano de Correção

### 1. Tipografia Global — Mínimos Legíveis
Substituir em **todos os arquivos afetados**:
- `text-[5px]` → `text-[8px]`
- `text-[6px]` → `text-[8px]`
- `text-[7px]` em contexto mobile (`fs && mob`, `mob`) → `text-[9px]`
- `text-[7px]` em contexto panel (non-fs) → `text-[8px]`

**Arquivos prioritários** (6 mais impactantes):
1. `LiveFiringPanel.tsx` — 117 ocorrências de `text-[7px]`
2. `MobileLinkMode.tsx` — `text-[5px]`, `text-[6px]`, `text-[7px]`
3. `SettingsPanel.tsx` — `text-[6px]`
4. `DMXMonitorGrid.tsx` — `text-[6px]`
5. `USBConnectionPanel.tsx` — `text-[7px]`
6. `CollisionPanel.tsx` — `text-[6px]`

### 2. Scene-CUE Filtering Fix
Corrigir `sceneCues` para filtrar CUEs pelo `activeScene`:
```
const sceneCues = useMemo(() => cues.filter(c => (c.sceneIndex ?? 0) === activeScene), [cues, activeScene]);
```

### 3. Limpar Ternários Redundantes
Substituir `fs ? "text-[10px]" : "text-[10px]"` por `"text-[10px]"` em todos os pontos.

### 4. Remover Fullscreen API Forçada
Remover o `useEffect` (linhas 768-781) que chama `requestFullscreen()` automaticamente — deixar apenas o estado CSS `fixed inset-0` que já funciona como fullscreen visual. O usuário pode usar o botão de maximize se quiser fullscreen real.

### 5. Map Type Alias
Adicionar `type TimerMap = Map<string, NodeJS.Timeout>` e usar em vez de `globalThis.Map`.

## Arquivos Afetados
1. `src/components/editor/LiveFiringPanel.tsx` — tipografia, scene filter, ternários, Map fix, fullscreen
2. `src/components/editor/live-firing/MobileLinkMode.tsx` — tipografia mínima
3. `src/components/editor/live-firing/SettingsPanel.tsx` — tipografia mínima
4. `src/components/editor/DMXMonitorGrid.tsx` — tipografia mínima
5. `src/components/editor/USBConnectionPanel.tsx` — tipografia mínima
6. `src/components/editor/CollisionPanel.tsx` — tipografia mínima

