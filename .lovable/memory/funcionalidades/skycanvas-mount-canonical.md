---
name: SkyCanvas Mount Canonical
description: SkyCanvasMount é a única porta de montagem do viewport 3D — engine selectable + v2Props + React.memo
type: feature
---

`src/components/editor/SkyCanvasMount.tsx` é o **único ponto canônico** para montar o viewport SkyCanvas em qualquer página.

API:
- `engine: 'auto' | 'v2' | 'legacy'` (default `'auto'` — flag-driven com fallback automático)
- `v2Props?: SkyCanvas2Props` — forward memoizado para `SkyCanvas2`
- `instanceKey`, `area`, `loaderTimeoutMs`, `loaderLabel`, `children`

Garantias:
- 1 lazy chunk por engine compartilhado entre TODOS os consumers
- `React.memo(SkyCanvasMountImpl)` — a árvore 3D não re-renderiza em mudanças de UI sem efeito
- Boundary stack uniforme: `StudioErrorBoundary → WebGLErrorBoundary → Suspense`
- `engine='auto'`: se SkyCanvas2 lançar `onFatalError`, demove para legacy sem reload

**Callers MUST `useMemo` v2Props** — o memo do mount depende disso para evitar re-renders fantasmas.

Consumers em produção: `pages/SkyCanvas.tsx`, `pages/dev/UE5BridgePage.tsx`, `pages/VideoEditor.tsx`, `pages/dev/SkyCanvasLab.tsx` (variant smoke).

Mounts diretos de `SkyCanvas2`/`SkyCanvas3D` permitidos APENAS em `SkyCanvasLab.tsx` (harness dev de variantes) e testes smoke.
