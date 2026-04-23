
Objetivo: integrar o `PyroUsbTransport` já existente ao playback determinístico para que cues de pyro do `ShowPlan` sejam agendadas, disparadas no tempo correto e nunca retro-disparem em `play`, `pause`, `seek`, `rewind` ou `external sync`.

1. Ajustar a arquitetura base do clock antes da bridge de pyro
- Registrar explicitamente `timelineClock.tick(dt)` como subsystem do `lockstep` dentro de `src/orchestration/EngineProvider.tsx`, com prioridade anterior ao scheduler de pyro.
- Parar de depender implicitamente do caminho legado em `SkyCanvas.tsx`, onde hoje só `executionBridge.tick(timelineClock.getTime())` está registrado.
- Manter a ordem determinística:
```text
DeterministicClock
  -> Lockstep
     -> commandBus / safety
     -> timelineClock
     -> pyroSchedulerBridge
     -> snapshot / flush
```

2. Aproveitar o `PyroUsbTransport` existente e endurecer seu contrato para uso agendado
- Não recriar o transporte; adaptar `src/hardware/transports/pyroUsb.ts` para o caso real de scheduler.
- Adicionar um wrapper/adapter opcional para o backend FireOne existente (`FireOneController`) em vez de duplicar protocolo.
- Garantir conversão operacional:
  - `ShowPlan.module` 0-based -> `moduleAddress = module + 1`
  - `ShowPlan.channel` 0-based -> `cueIndex/igniter = channel + 1`
- Manter regras atuais:
  - sem auto-arm implícito
  - lockout/watchdog preservados
  - diagnostics congelado
- Se necessário, endurecer validações para refletir endereço físico 1-based no dispatch real.

3. Criar a bridge temporal dedicada de pyro
- Criar `src/hardware/integrations/pyroSchedulerBridge.ts`.
- Responsabilidades da bridge:
  - ler `ShowPlan.pyroCues`
  - converter cada cue em `ScheduledHardwareEvent<PyroUsbScheduledPayload>`
  - instanciar e operar um `HardwareScheduler` com `latencyByType.pyro = PYRO_USB_DEFAULT_LATENCY_MS`
  - despachar apenas `fire` no tempo de execução; `arm/disarm/estop` continuam explícitos fora do timeline
- Aplicar compensação temporal por cue:
  - `scheduledTime = max(0, cue.time - cue.fuseDelay / 1000)`
  - scheduler ainda compensa a latência do transporte no `dispatchAt`
- IDs de eventos devem ser estáveis por cue para replay previsível e rastreio em diagnostics.

4. Sincronizar corretamente a bridge com movimento do playhead
- A bridge deve manter `lastClockState` e classificar transições:
  - avanço contínuo
  - pause
  - seek forward
  - rewind
  - reset
  - external sync / locate
- Regras:
  - play contínuo: `scheduler.tick(deltaClock)`
  - pause: não avançar scheduler
  - seek forward: `scheduler.seek(newTime)` para podar passado
  - rewind/reset/external jump: limpar e reconstruir fila a partir do tempo atual
  - jitter pequeno: não reconstruir e não duplicar firing
- Nunca disparar cues que já ficaram no passado após rebuild.

5. Isolar pyro real do `executionBridge` legado
- Hoje `src/core/execution/executionBridge.ts` ainda converte `ShowPlan.pyroCues` para um payload legado incompatível com o transporte novo.
- Remover pyro real desse caminho legado, mantendo o `executionBridge` apenas para:
  - simulação
  - status legado
  - outros domínios ainda não migrados
- Evitar dupla execução: `executionBridge` não pode continuar disparando pyro de `ShowPlan` em paralelo à nova bridge.

6. Aplicar gates de segurança antes do dispatch real
- Antes de chamar `pyroTransport.dispatch(...)`, validar:
  - transporte conectado
  - sem lockout ativo
  - watchdog não expirado
  - módulo armado
  - `safetyStateMachine.state` em `ARMED` ou `FIRING`
  - cue ainda válida para o tempo atual
- Em falha de gate:
  - não disparar
  - registrar motivo no diagnostics/log
  - nunca tentar “compensar” com retry automático, para evitar disparo duplicado
- Preservar a regra do projeto: sem dados/hardware fake no caminho real.

7. Expor diagnósticos operacionais da integração
- A bridge deve expor snapshot congelado com:
  - `currentClockTime`
  - `pendingCount`
  - `nextPyroDispatchTime`
  - `lastScheduledCueId`
  - `lastFiredCueId`
  - `lastRebuildReason`
  - `transportConnected`
  - `safetyState`
- Motivos de rebuild sugeridos:
  - `boot`
  - `play`
  - `seek-forward`
  - `rewind`
  - `external-sync`
  - `showplan-change`
  - `reset`

8. Cobrir com testes de integração antes de ativar no playback real
- Criar `src/hardware/integrations/pyroSchedulerBridge.spec.ts`.
- Casos mínimos:
  - cue dispara com compensação de `fuseDelay + latency`
  - seek forward ignora cues perdidas
  - rewind reconstrói e permite replay determinístico
  - pause não dispara
  - external sync/jitter não duplica firing
  - cue passada após rebuild é ignorada
  - lockout/watchdog/desarmado bloqueiam dispatch
  - múltiplos cues no mesmo timestamp preservam ordem estável
  - mapeamento `module + 1` e `channel + 1` chega corretamente ao dispatch físico
- Manter os testes atuais de `scheduler`, `ltc` e `pyroUsb` como base de regressão.

Arquivos a criar/editar
- Criar: `src/hardware/integrations/pyroSchedulerBridge.ts`
- Criar: `src/hardware/integrations/pyroSchedulerBridge.spec.ts`
- Editar: `src/orchestration/EngineProvider.tsx`
- Editar: `src/components/editor/SkyCanvas.tsx`
- Editar: `src/core/execution/executionBridge.ts`
- Editar: `src/hardware/transports/pyroUsb.ts` (somente se necessário para adapter/diagnostics/mapeamento)
- Editar: `src/hardware/index.ts`

Detalhes técnicos
- O repositório já possui `PyroUsbTransport`; a fase correta agora é integração temporal, não recriação do transporte.
- `ShowPlan` é a fonte canônica e já define `pyroCues` com `module`, `channel`, `time` e `fuseDelay`.
- `EngineProvider` hoje habilita `timelineClock` mas não registra seu tick no `lockstep`; isso precisa ser explícito para o scheduler seguir o clock determinístico.
- `SkyCanvas` ainda registra `executionBridge` como subsystem de playback; esse acoplamento precisa ser revisto para evitar conflito com pyro real.
- A implementação deve priorizar segurança operacional sobre “catch-up”: sem retro-fire, sem auto-arm em seek/play/sync, sem retry automático de fire.
