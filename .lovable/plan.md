

# Ciclo #82 — Memory Leak Fixes: Event Listeners & Subscriptions

## Bugs Encontrados

| # | Arquivo | Problema | Severidade |
|---|---------|---------|------------|
| 1 | `ViewportTransitionOverlay.tsx` | `handleTransition` cria 3 `setTimeout` mas retorna cleanup de dentro do callback — o return é ignorado pois não está num useEffect. Timers nunca são limpos se o evento dispara múltiplas vezes. | Alta |
| 2 | `DroneCommandPanel.tsx` | `setTimeout(() => setLaunchState('airborne'), 2000)` dentro de `handleLaunch` (useCallback) — timer não é limpo se componente desmonta durante os 2s. | Média |
| 3 | `GPUFireworkStressTest.tsx` | `setTimeout(() => setLaunching(false), 600)` no click handler — state update em componente potencialmente desmontado. | Baixa |
| 4 | `DMXMonitorPanel.tsx` | `setTimeout(() => changedChannels.current.clear(), 500)` no callback — acumula timers sem limpeza. | Média |
| 5 | `SplashScreen.tsx` | `setTimeout(() => onStart(), 700)` no `handleStart` — não cancelado se desmonta. | Baixa |
| 6 | `PyroFireOnePanel.tsx` | `supabase.channel('fxc-mobile-link').send(...)` e `supabase.channel('fxc-pyro-sync').send(...)` — cria canais efêmeros em cada chamada sem `removeChannel`. Acumula channels no SDK. | Alta |
| 7 | `fireoneModuleHardwareBridge.ts` | BLE `addEventListener` para `characteristicvaluechanged` e `gattserverdisconnected` nunca chama `removeEventListener` no disconnect. | Média |
| 8 | `FieldTestDesktop.tsx` | `setTimeout(() => setLastFired(null), 300)` em callback sem cleanup ref. | Baixa |

## Plano de Implementação

### 1. Fix ViewportTransitionOverlay — Timer leak (Alta)
Mover timers para refs e limpar na próxima invocação + no cleanup do useEffect.

### 2. Fix PyroFireOnePanel — Ephemeral Supabase channels (Alta)
Criar um canal persistente via `useRef` no mount, reutilizar para `.send()`, e `removeChannel` no cleanup.

### 3. Fix DroneCommandPanel — setTimeout leak
Usar ref para armazenar timer, limpar no cleanup do useEffect e no unmount.

### 4. Fix DMXMonitorPanel — setTimeout acumulados
Armazenar timer em ref, limpar antes de criar novo.

### 5. Fix fireoneModuleHardwareBridge — BLE listeners
Armazenar referências dos handlers e chamar `removeEventListener` no `disconnect()`.

### 6. Fix componentes menores (GPUFireworkStressTest, SplashScreen, FieldTestDesktop)
Padrão: `useRef` para timers + cleanup.

## Arquivos

| Acao | Arquivo |
|------|---------|
| Edit | `src/components/editor/ViewportTransitionOverlay.tsx` |
| Edit | `src/components/editor/live-firing/PyroFireOnePanel.tsx` |
| Edit | `src/components/editor/DroneCommandPanel.tsx` |
| Edit | `src/components/editor/dmx/DMXMonitorPanel.tsx` |
| Edit | `src/lib/fireoneModuleHardwareBridge.ts` |
| Edit | `src/components/editor/effects/GPUFireworkStressTest.tsx` |
| Edit | `src/components/editor/SplashScreen.tsx` |
| Edit | `src/components/editor/FieldTestDesktop.tsx` |

## Ordem
1. Fix ViewportTransitionOverlay + PyroFireOnePanel (alta severidade)
2. Fix DroneCommandPanel + DMXMonitorPanel + fireoneModuleHardwareBridge
3. Fix componentes menores
4. Build verification

