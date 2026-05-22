# Wiring FWsim Graphics — Passo 1/5

## Contexto

Upload `presets-2.zip` é **redundante**: 44 `.fwe` + 44 PNG já estão em `public/finale-presets/` (bytes idênticos, rodada FWsim Asset Pack). Nada a importar.

O trabalho real em aberto é o **wiring** do `fwsimGraphicsConfig.json` já parseado (rodada anterior). Hoje:

- `fwsim_extended_palette` → **ON** (já em uso no quantizer)
- `r_fwsim_mine_calibration` → OFF
- `r_fwsim_smoke_texture` → OFF
- `r_fwsim_launch_flash_v2` → OFF
- `r_fwsim_bloom_weights` → OFF
- `r_fwsim_tonemapping` → OFF

Princípio: **uma flag por rodada**, com fallback exato quando OFF, A/B visual no `/dev/effects-e2e`.

## Esta rodada: 2 wirings de baixo risco

Escolho os dois que têm impacto visual imediato e menor superfície de regressão:

### 1. `r_fwsim_mine_calibration` (casa com refino recente de mines)

Em `MineEffect.tsx`, quando flag ON, consumir do `fwsimGraphicsConfig.flashes.mine`:
- `SizeDependingOnEnergy` curve → escalar raio do flash de ignição
- `DurationDependingOnEnergy` curve → vida do flash
- `IntensityDependingOnEnergy` curve → multiplicador aditivo no material
- `LaunchSparksConfig.mine` → contagem/dispersão de faíscas no tubo

OFF: comportamento exato de hoje (silhouette fan + drift 0.012).

### 2. `r_fwsim_smoke_texture`

Em `SmokeSystem.ts`, quando flag ON, trocar o sprite procedural por `src/assets/textures/fwsim/smoke_with_alpha.png` (já copiado). Física framerate-independent atual (drag exp(-1.21dt), buoyancy×lifeRatio) **preservada** — só muda o map do material.

OFF: textura procedural atual.

## Arquivos

**Editados:**
- `src/components/editor/effects/MineEffect.tsx` — ler config + `sampleCurve` por trás de `isFlagEnabled('r_fwsim_mine_calibration')`
- `src/render/SmokeSystem.ts` — `useLoader(TextureLoader, smokeUrl)` por trás de `isFlagEnabled('r_fwsim_smoke_texture')`, dispose no unmount
- `src/lib/featureFlags.ts` — flip dos defaults dos dois flags para `true`

**Criados:**
- `src/__tests__/fwsimWiringStep1.spec.ts` — flags ON aplicam config; flags OFF reproduzem baseline (snapshot de uniformes/curvas)

## Fora de escopo

- `r_fwsim_launch_flash_v2`, `r_fwsim_bloom_weights`, `r_fwsim_tonemapping` — próximas rodadas
- FMOD `.bank`, skin laranja FWsim — rejeitados (já documentado)
- Re-importar `presets-2.zip` — redundante

## Validação

- `bun run test src/__tests__/fwsimWiringStep1.spec.ts` verde
- `/dev/effects-e2e` rodar baseline com flags OFF, depois ON; comparar pixel-L2 nos ids `mine_*` e qualquer efeito que use smoke trail
- Visual no `/editor` viewport: mines com flash energy-driven, smoke com textura real

## Risco

Baixo. Zero impacto em safety / workMode / CommandBus / VDL parser / store. Render-only, atrás de flags com fallback exato.
