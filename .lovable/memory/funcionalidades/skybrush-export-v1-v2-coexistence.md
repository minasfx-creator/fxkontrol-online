---
name: Skybrush Export v1 + v2 (honest coexistence)
description: Dois exporters Skybrush coexistem ambos com claim marketing_hypothesis — v1 stub leve e v2 ZIP completo (trajectories+lights+cues)
type: feature
---

Dois exporters Skybrush coexistem em FXKONTROL, ambos honest:

**v1 — `src/lib/skybrushExport.ts`** (stub leve)
- Conversation-starter ZIP, validação NFPA-style básica.
- Claim policy: `marketing_hypothesis`, `_FXK_DISCLAIMER.txt` obrigatório.
- Memória: `mem://funcionalidades/round3-pass2-skybrush-smoke`.

**v2 — `src/lib/exporters/skycExporterV2.ts` + `skycExporterV2Zip.ts`**
- Payload completo no formato Skybrush real: `show.json` + `cues.json` + `validation.json` + `show.csv` + `_FXK_DISCLAIMER.txt` + `trajectories/<id>.json` + `lights/<id>.json` por drone.
- Coordinate systems NEU/NED/ENU, Bézier trajectories, light programs, yaw control, GPS origin.
- **Mesma claim policy `marketing_hypothesis`** — `validation.json.claim` carimbado, disclaimer obrigatório no ZIP.
- API: `buildSkycV2Zip(opts)` puro (Blob) ou `downloadSkycV2Zip(opts)` com efeito DOM.
- 4 tests em `src/__tests__/skycExporterV2.test.ts` validam estrutura ZIP, claim stamp e disclaimer.

**Quando usar qual**: v1 para demos/investor decks rápidos. v2 quando precisar do payload técnico completo (trajetórias + LEDs + cues) para validação visual no Skybrush real (ainda não certificado).

**Promoção para `validated`** exige bench: importar o ZIP no Skybrush Studio real, voar simulação completa, registrar versão do importer e firmware da fleet em audit. Até lá, ambos ficam `marketing_hypothesis` com `ClaimBadge` amber.
