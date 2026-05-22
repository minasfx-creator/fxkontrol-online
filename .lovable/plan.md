# Plano Revisado — 100% Conformidade Visual + Edge/Firmware/Twin/UX (multi-specialist review)

Revisão multi-perfil (Interactive Experience · IoT Firmware · Tech Docs · Edge Core TS · OTA · QA HIL/Chaos · Device Twin · Trigger Core · UX Emergency PWA). Zip `Standard_Effects-3.zip` é o mesmo pack já integrado (605 .fwe + 159 .fwc) → eixo principal continua **paridade visual**, mas as outras especialidades adicionam **guard-rails operacionais** que tocam no mesmo PR.

Safety/CommandBus/FieldBus/SafetyStateMachine/uiCommandGateway/workMode → **zero alteração** (apenas leitura).

---

## Eixo 1 — Visual Conformity (Interactive Experience)

### 1A. Tail Component Catalog (159 .fwc)
- `scripts/parse-fwc-components.py` recursivo → `src/data/effectsLibraries/generated/tailComponents.json` (`{id,name,collection,kind:brocade|silver|gold|glitter|crackling|spider|polyp|microstarStrobe|mortarSparks|explosionSparks|snowballs|poppingFlowers|crissCross|cracklingPearls|dragonEggs|none, color[], density, length:short|medium|long|thin|thick|wide, strobe:bool, sparkleHz?}`).
- `src/lib/fwcTailParser.ts` regex puro (espelho TS, browser-safe).
- `src/data/tailComponentCatalog.ts` lookup nome + alias (`[Brocade Tail Medium]`, `[Silver Tail Short]`, `[Gold Charcoal Tail Medium, Dense]`, `[none]`).

### 1B. fweUniversalExtractor v2
- Extrai `<Type>` real (Crossette/Farfalle/Tourbillon/Fountain/Vulcano/PhotoFlash/FlameJet/Lycopodium/Sparkler/Nautical/Rocket/FrontPiece/Whistle).
- `tailRef` via match `[...]` filename + lookup 1A.
- `colorPhases[]` populado parseando "X to Y", "X & Y", "to Crackle/Strobe" → `{at:0..1, hex, modifier?:strobe|crackle|glitter|charcoal}`.
- `caliberIn` inferido por token `(big)=4 / (medium)=2.5 / (small)=1.5 / (XSmall)=0.8` quando XML não tem `<Diameter>`.
- 3 paletas vazias → resolver via `<Components>` recursivo.

### 1C. Renderer — 23 silhuetas novas + color phases + tails
- `src/render/silhouettes/`: crown, crownRain, fallingLeaves, saturnRing, heart, bowTie, ring, waterfall, strobePot, fountain, vulcano, photoFlash, flameJet, lycopodium, sparkler, frontPiece, nautical, rocket, ghostShell, halfHalf, fourFour, jellyfish, smiley.
- `effectRouter.ts` mapeia novos `RendererKinds` → `KNOWN_UNROUTED = 0`.
- `src/render/tails/applyTailComponent.ts` consome `tailRef` (Points additive). `none` = no tail.
- `src/render/colorPhase/applyColorPhases.ts` HSV lerp + modifiers (strobe 8Hz square, crackle random pops, glitter sub-emitter, charcoal black-trail).
- Flags: `r_tail_components_real`, `r_color_phases`, `r_silhouette_all`, `r_caliber_inference` (todas ON, override via localStorage).

### 1D. Adapter + UI
- `standardEffectsCatalog.ts` propaga `tailRef`/`colorPhases`/`caliberIn` enriquecido (campos opcionais, retrocompat).
- `resolveEffect.ts` prefere `colorPhases[0]` sobre `palette[0]`.
- `EffectLibrary.tsx` badge → `+{527+605} effects · 159 tails`.

---

## Eixo 2 — Trigger Core & Transport Adapter (read-only audit)
- **Não muda nada operacional.** Apenas adiciona `docs/reference/standardEffects-trigger-contract.md` documentando como `caliberIn`/`prefire` (mm/s extraídos no 1B) alimentam `pyroTransportPolicy` e a tabela de prioridade `serial > usb > artnet` (BLE banido em `real_operation`).
- Spec `standardEffectsTriggerContract.spec.ts` confere que todo effect com `category:pyro` exporta `caliberIn>0` e `prefire>=0` antes de chegar ao Trigger Core (gate fail-closed em build, não em runtime).

---

## Eixo 3 — Device Twin & Telemetry Schema
- Adiciona `src/twin/schemas/effectRender.v1.ts`: shape JSON-Schema do que o **Render Twin** publica por cue (`{cueId, effectId, caliberIn, palette, colorPhases, tailRef, durationMs, kind}`).
- Versionado (`$schemaVersion:"effectRender.v1"`), backward-compat handler em `src/twin/migrators/effectRenderV0toV1.ts`.
- Telemetria de render (frame budget já existe) ganha campo opcional `lastEffectKind` no envelope existente — não cria novo canal.

---

## Eixo 4 — Edge Core (TypeScript) [aguardando dependência]
- **Stub-only nesta rodada**: `supabase/functions/effects-catalog-sync/` placeholder + `_PENDING.md` marcando que o sync remoto do catálogo (`getStandardEffects()` → edge cache) entra na próxima rodada quando o esquema do Twin (Eixo 3) for ratificado.
- Não deploya edge function nesta rodada.

---

## Eixo 5 — OTA Agent & Release Orchestration [aguardando dependência]
- **Doc-only**: `docs/ota/standard-effects-bundle-strategy.md` define que `standardEffects.json` (~221KB) + `tailComponents.json` (~80KB est.) viajam como **bundle estático versionado** (`fxk.effects.bundle.v1`), distribuído via OTA agent que ainda não existe. Sem código.

---

## Eixo 6 — QA / HIL & Chaos
- `/dev/effects-e2e` re-baseline obrigatório após 1A-D.
- Spec `effectsLibraryE2E.spec.ts`: `KNOWN_UNROUTED` = **0** (hard assert).
- Novos specs: `fwcTailParser.spec.ts` (15 fixtures), `tailComponentCatalog.spec.ts` (lookup + alias + fallback), `fweExtractorV2.spec.ts` (Type real + caliber inference + colorPhases + 3 paletas vazias resolvidas), `colorPhases.spec.ts` (lerp HSV + 4 modifiers), 6 specs de silhueta novas (smoke render → bbox + particle count > 0), `effectRenderTwinSchema.spec.ts` (Eixo 3).
- **Chaos seed**: `src/dev/__tests__/effectsChaosRender.spec.ts` — render 605 effects com seed determinístico, sem GC stalls > 50ms (usa `useFrameBudget` chip BUDGET já existente).

---

## Eixo 7 — UX Designer & Emergency PWA
- Adiciona `EffectLibrary.tsx` filtro pill bar "Tail: All · Brocade · Silver · Gold · Glitter · Crackling · None" (read-only, não muta showplan).
- Search bar ganha hint `Try: "red to silver", "(big)", "crown rain"` baseado nos novos campos extraídos.
- **PWA emergency offline**: pre-cache do bundle (`standardEffects.json` + `tailComponents.json`) via `scripts/vite-plugin-precache-guard.js` já standalone → adiciona entry `effects-bundle` ao manifest do precache (sem ativar service worker — só lista).

---

## Eixo 8 — Technical Documentation (Tech Docs Specialist)
- `docs/reference/standard-effects-catalog.md` — fonte canônica: 605 effects × 6 collections, schema, tail catalog, color phases, claim policy (pilot — não validado bench).
- `docs/reference/fwc-tail-components.md` — 159 .fwc, kinds, density, length convention.
- `docs/reference/effects-render-twin.md` — Eixo 3 schema + migrator.
- `mem://funcionalidades/standard-effects-pack-integration` atualizado com Eixos 1A-1D + 2 + 3 + 6 + 7.

---

## Fora de escopo (explícito)
- Safety / workMode / CommandBus / FieldBus / SafetyStateMachine / uiCommandGateway — zero toques.
- Sem deploy de edge function (Eixo 4 = stub).
- Sem OTA agent (Eixo 5 = doc).
- Sem firmware change (FXK16/FXK32Q intocados — IoT Firmware Specialist confirma: pack é puro asset visual, não afeta protocolo PBUS/AES).
- Sem PNG thumbnails novos, sem shaders WGSL novos.
- Sem migração breaking do `Effect` type (apenas campos opcionais).

---

## Métricas de aceitação (gate consolidado)
| Critério | Alvo |
|---|---|
| `KNOWN_UNROUTED` | 0 |
| Effects com silhueta dedicada | 605/605 |
| Paletas fallback `#FFD27A` | 0 |
| Effects sem `caliberIn` | 0 |
| `pixel-L2` (`/dev/effects-e2e`) | ≤ baseline + 5% |
| Frame budget p95 (chaos render) | ≤ 50ms |
| Trigger contract spec | verde |
| Twin schema spec | verde |
| Suite total | ~995/995 (50 novos + 945 atuais) |

## Estimativa
1 turno de build (Eixos 1+2+3+6+7+8 implementados; Eixos 4+5 só placeholders + doc).

## Ordem de execução
1A → 1B → 1C → 1D → 6 (re-baseline) → 7 (UI filter) → 2 (contract spec) → 3 (twin schema) → 8 (docs) → 4/5 (placeholders).
