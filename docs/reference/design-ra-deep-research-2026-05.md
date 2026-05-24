# Design de Shows Pirotécnicos com RA — extract (deep-research, 2026-05)

Source: `Design_de_Shows_Pirotécnicos_com_RA-3.pdf` (deep-research note
delivered by the user). Captured 2026-05-13.

The doc is a high-level architectural rationale for next-generation
pyro/swarm choreography platforms. It **validates** rather than proposes
new tech for FX KONTROL — every concrete recommendation is already in the
codebase (memory cross-references in parens):

| Recommendation in PDF | Status here |
|---|---|
| `THREE.InstancedMesh` for ≥1k drones | ✅ implemented (Skybrush honest export, see `mem://funcionalidades/round3-pass2-skybrush-smoke`) |
| Vertex Shader-driven particle physics | ✅ GPGPU full state RT3+RT4 (`mem://funcionalidades/area-2-gpgpu-full-state-rt3-rt4`) |
| `BufferGeometry` shared base + size attenuation | ✅ standard in current renderer |
| `depthWrite: false` for smoke/haze billboards | ✅ smoke physics (`mem://funcionalidades/round3-pass2-skybrush-smoke`) |
| Perlin noise + uTime in fragment shader for smoke | ✅ smoke + niagara fluids |
| Volumetric god-rays with logarithmic mapping | ✅ god rays present in renderer |
| VVIZ defaultColorRate 20 Hz Euclidean → VDL palette | ✅ VVIZ ENU transform (`mem://funcionalidades/vviz-coordinate-transform-enu`) |
| Shader respects `Tip` suffix to abort trail | ✅ VDL parser ignores trail when suffix=Tip |
| HUD AR / Google-Glass paradigm | 🟡 NOT YET — kept as backlog (Strategic Hub /strategy is GTM, not HUD) |

## Action items

1. The `Tip` shader behaviour and Euclidean VDL map are **canonical**;
   any future renderer rewrite must preserve these.
2. AR HUD (Google-Glass-style): out of scope for this round. If/when we
   tackle it, this doc is the design rationale entry point.
3. No code change is required by accepting this PDF — the file exists
   purely for traceability when reviewers ask "where did the
   `instancedMesh + GPGPU + depthWrite=false` decisions come from?".
