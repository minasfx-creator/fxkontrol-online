# FXKONTROL — Mapa de Portas Únicas

Cada plano expõe **uma única porta de entrada**. Tudo o mais é interno.
Imports diretos a APIs internas a partir de UI/IA são **proibidos** e
auditados por guard test.

## Tabela canônica

| Plano | Porta(s) pública(s) | API interna proibida fora do plano |
|---|---|---|
| Safety — comandos | `@/core/safety/uiCommandGateway` | `safetyStateMachine.transition`, `commandBus.dispatch`, `fieldBus.send`, `executor.fire` |
| Safety — modo real | `@/core/safety/requestRealOperation` | `workMode.set('real_operation')` direto |
| Safety — auditoria | `@/core/safety/safetyBlackBox` | manipular ring buffer direto |
| Safety — IA gate | `@/core/safety/aiGuardrail` | passar `caller='agent'` em ARM/FIRE/E_STOP |
| Show — projeto | `@/store/useProjectStore` (selectors) | mutar ShowPlan fora de actions |
| Show — render | `@/core/render/Show3DEngine` (host) | acessar three.js scene direto |
| Hardware — discovery | `@/hardware/unifiedDiscovery` | instanciar discoverers direto |
| Hardware — devices | `@/hardware/deviceAggregator` | `MultiTransportLink` direto fora de adapters |
| Experience | `pages/`, `features/<bucket>` | importar `@/components/editor/*` em código novo |

## Quem pode importar o quê

```text
UI (pages/, features/, components/)
  ✅ uiCommandGateway, requestRealOperation, useProjectStore, deviceAggregator (read), Show3DEngine
  ❌ safetyStateMachine, commandBus, fieldBus, executor, MultiTransportLink (direto)

AI (src/ai/, JOI, SwarmGPT)
  ✅ ShowGraph builders, compileShowGraph, validateShowPlan
  ❌ uiCommandGateway.fire(), requestRealOperation, qualquer ARM/FIRE/E_STOP
  ✅ uiCommandGateway.fire(..., { caller: 'agent' }) → será BLOQUEADO por aiGuardrail (esperado)

Hardware adapters (src/hardware/)
  ✅ MultiTransportLink, LinkHealth, TransportSenderRegistry
  ❌ ShowPlan mutation, UI imports

Strategic Hub (/strategy)
  ❌ @/core/safety/*, @/hardware/* (é GTM, nunca executa comandos)
```

## Guard tests recomendados

| Guard | Arquivo | Detecta |
|---|---|---|
| Entry points | `src/__tests__/entryPoints.guard.spec.ts` | UI importando `safetyStateMachine`/`fieldBus`/`commandBus` direto |
| Strategic isolation | `src/__tests__/strategicHubIsolation.guard.spec.ts` | `/strategy` importando `core/safety` ou `hardware` |
| Render core location | `src/__tests__/renderCoreLocation.guard.spec.ts` | Imports de `render_ultra` em código novo (fase de migração) |
| Commercial theme scope | `src/__tests__/commercialThemeScope.guard.spec.ts` | `data-theme="commercial"` fora do allow-list |
| Typography scale | `src/__tests__/typographyDsScale.guard.spec.ts` | Tamanhos de fonte fora de `text-ds-*` allow-list |

## Razão de existir

Numa frota de hardware crítica (E-STOP <50ms, pyro live), uma única função
chamada do lugar errado vira incidente. Portas únicas + guard tests em CI
fecham essa classe inteira de bugs.
