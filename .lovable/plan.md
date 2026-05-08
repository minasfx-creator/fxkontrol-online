# Showven M1 — Integração com Dispatch (128 cues + handshake)

Espelho fiel do que já fizemos para o FireOne XL4+ e FXK32Q, agora para o **Showven M1** (master controller dual‑band, 128 cues × 4 cenas, V1.5). Tudo READ‑ONLY no boundary do registry; FIRE/ARM continuam passando por `uiCommandGateway → CommandBus → SafetyStateMachine`. Zero dado sintético, zero auto‑arm.

## Escopo

1. **Adapter** `ShowvenM1Adapter` (128 ch, protocolFamily `showven-pbus-dualband`).
2. **Singleton bridge** `useShowvenM1Bridge` (notifyHandshakeOk/Lost + watcher webSerial).
3. **Presence hook** `useShowvenM1Presence` (DeviceAggregator ∩ adapter ∩ provenance verified).
4. **Discovery → Registry bridge** subscreve o singleton e promove/demote o adapter.
5. **Registro** em `UnifiedHardwareRegistry` + `adapterTriage` (`showven-m1` → `/pairing/m1`).
6. **Wizard** `/pairing/m1` (4 passos: Welcome → PBus Link → Handshake/Version → Success), validando baud (19200), handshake PBus `STATUS` na address 1, e firmware ≥ V1.5.
7. **Mapping de 128 cues**: módulo puro `showvenM1CueMap.ts` que traduz `cueIndex 1..128` em `{ slaveAddress 1..16, channel 1..16 }` (mapa canônico FXcommander = 8 racks × 16 cues + cenas). Suporta override por show e exporta validador (zero colisão / faixas válidas).
8. **Dispatch**: estender `ShowvenCueRunner.load()` para aceitar `cueIndex` (1..128) opcional além de rack/tube. Quando presente, resolve via `showvenM1CueMap.resolve()`. PBus `FIRE_SEQ` continua coalescendo por device.
9. **AutoControllerLauncher**: card pyro p/ família `showven` consome `useShowvenM1Presence` (mesmo padrão do XL4/FXK32Q) — só "Pronto p/ ARM" quando present.
10. **Logs** no padrão da plataforma (`[discoveryBridge] Showven M1 promoted/demoted ...` e `[showvenM1Bridge] ...`), entrada no `safetyBlackBox` no momento da promoção (caller=`system`).

## Arquivos

Novos:
- `src/core/hardware/adapters/ShowvenM1Adapter.ts`
- `src/hooks/useShowvenM1Bridge.ts`
- `src/hooks/useShowvenM1Presence.ts`
- `src/lib/showvenM1Handshake.ts` (parse STATUS/VERSION PBus, fw guard)
- `src/lib/showvenM1CueMap.ts` (128 cues → slave/channel, override, validador)
- `src/pages/ShowvenM1PairingWizard.tsx`
- `src/components/pairing/m1/{M1WelcomeStep,M1LinkStep,M1HandshakeStep,M1SuccessStep}.tsx`
- Tests:
  - `src/__tests__/showvenM1Adapter.spec.ts`
  - `src/__tests__/showvenM1Handshake.spec.ts`
  - `src/__tests__/showvenM1CueMap.spec.ts`
  - `src/__tests__/useShowvenM1Presence.spec.ts`
  - `src/__tests__/showvenM1DiscoveryBridge.integration.test.ts`
  - `src/__tests__/showvenCueRunner.m1Mapping.spec.ts`

Editados:
- `src/core/hardware/UnifiedHardwareRegistry.ts` (registra `showvenM1Adapter`)
- `src/core/hardware/discoveryRegistryBridge.ts` (subscribe + promote/demote)
- `src/core/hardware/adapterTriage.ts` (entry `showven-m1` → `/pairing/m1`, status `AWAITING_HANDSHAKE`)
- `src/pages/PairingWizard.tsx` (`'m1'` no SUPPORTED + lazy)
- `src/App.tsx` (pre‑warm import se necessário)
- `src/features/viewport-tools/hardware/showvenCueRunner.ts` (aceita `cueIndex` via map)
- `src/components/AutoControllerLauncher` (gate por `useShowvenM1Presence` quando kind=`showven`)
- `public/sitemap.xml` (entry `/pairing/m1` consistente com XL4)

## Detalhes técnicos

```text
Handshake (PBus, 19200 8N1):
  TX: STATUS frame addr=1
  RX: STATUS reply (model token, fw, slaves on bus)
  Pass: model ∈ {FXCOMMANDER, M1}, fw ≥ "1.5.0"
  Fail → wizard mantém em AWAITING_HANDSHAKE, bridge nunca promove

Cue map (default FXcommander 8×16):
  cue   1..16  → slave 1, ch 1..16
  cue  17..32  → slave 2, ch 1..16
  ...
  cue 113..128 → slave 8, ch 1..16
  Override por show: Record<cueIndex, {slave, channel}>
  Validador: faixas (1..128, slave 1..16, ch 1..16), zero duplicado destino,
             zero cue não mapeado se show declarar cueIndex.
```

Contratos de honestidade preservados:
- `canWrite=false` no adapter (igual FXK32Q/XL4), gating real continua no CommandBus.
- `pollTelemetry` só muta com `isHardwareSimulatorEnabled()` ON.
- Promoção exige resposta PBus real; bridge auto‑demote em `lost`/`offline`.
- `simulationGuard` continua respeitado em design/simulation (sem bloqueios novos).

Sem mudanças em workMode, SafetyStateMachine, ou políticas de transporte (BLE permanece banido para FIRE em real_operation pelo `pyroTransportPolicy`).

## Critérios de aceite

- `/pairing/m1` completa wizard em ≤4 passos e promove `ShowvenM1Adapter` para `live_read_only` apenas com handshake real.
- AutoControllerLauncher mostra card "Showven M1 — pronto p/ ARM" só quando `useShowvenM1Presence` retorna `present`.
- `ShowvenCueRunner` consome `cueIndex` 1..128 via `showvenM1CueMap` e dispara via `FIRE_SEQ` coalescido (sem duplicar PBus frames).
- Suite verde: novos testes (≥30 casos) + suite atual sem regressão.
- Logs `[discoveryBridge] Showven M1 promoted/demoted ...` aparecem no mesmo formato dos demais.
