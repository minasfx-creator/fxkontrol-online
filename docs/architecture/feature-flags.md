# FXKONTROL — Feature Flags (snapshot)

> Fonte canônica: `src/lib/featureFlags.ts`. Este documento é gerado a
> partir dela em revisões periódicas. Para o estado live, sempre consultar
> o código.

## Convenção

| Status | Significado |
|---|---|
| **stable** | Default ON, sem plano de remoção |
| **experimental** | Default ON/OFF, em validação |
| **deprecated** | Default OFF, remoção planejada |
| **dev-only** | Apenas em `import.meta.env.DEV` |

## Flags conhecidas

| Flag | Default | Status | Resumo |
|---|---|---|---|
| `vdl_color_cache` | ON | stable | LRU 256 RGB→VDL |
| `tus_resumable_upload` | ON | stable | TUS 1.0.0 upload assets |
| `gpgpu_webgl2_fallback` | ON | stable | WebGPU→WebGL2 (FBO ParticleGPGPU) |
| `hud_radial_menu` | ON | stable | Radial menu portal |
| `hud_elastic_feedback` | ON | stable | ElasticTarget shake/pulse |
| `timeline_ecs_dod` | ON | stable | Timeline SoA / zero-GC |
| `dev_hardware_simulator` | OFF | dev-only | Habilita `simulate*()` em adapters |
| `real_only_mode` | ON | stable | Gate ingest/log a hardware verificado |
| `training_v2_cinematic` | ON | stable | Missões staged / MetaHuman / HUD |

## Como adicionar uma flag

1. Definir em `src/lib/featureFlags.ts`
2. Adicionar linha na tabela acima (status + resumo de uma linha)
3. Se mudar invariante de safety: registrar memória em `mem://arquitetura/`
4. Após 1 release stable: considerar promoção para hard-coded
