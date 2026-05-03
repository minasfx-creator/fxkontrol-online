# Plano — Unificar viewport do Video Editor com SkyCanvasMount

## Contexto

Hoje o `src/pages/VideoEditor.tsx` ainda monta o `SkyCanvas2` (v2 experimental), enquanto o resto do app (Index mobile-live, mobile, desktop e a rota `/dev/skycanvas-smoke`) já usa o **`SkyCanvasMount`** — wrapper oficial com `StudioErrorBoundary → WebGLErrorBoundary → Suspense(CanvasLoaderWithTimeout) → SkyCanvas`. Esse é o caminho que provou ser robusto em produção.

A pedido: aplicar o mesmo padrão do smoke como SkyCanvas oficial do editor.

## Mudança

**Arquivo:** `src/pages/VideoEditor.tsx`

1. Remover `import { SkyCanvas2 } from '@/components/show3d/v2'` (linha 41).
2. Adicionar `import SkyCanvasMount from '@/components/editor/SkyCanvasMount'`.
3. Substituir `<SkyCanvas2 />` (linha 664) por:
   ```tsx
   <SkyCanvasMount instanceKey="video-editor" area="Video Editor viewport" />
   ```

Nada mais muda. HUD, transport, timeline, drag-and-drop da Effect Library, sync com audio master clock — tudo já opera contra `useProjectStore.currentTime`, que é o mesmo clock canônico que o `SkyCanvas` oficial consome via `useShow3DEngineSync` / `Show3DEngine`.

## Por que é seguro

- **Zero impacto em safety/workMode/CommandBus** — `SkyCanvasMount` é puramente de apresentação.
- **Mesma fonte de verdade já em uso** em Index (3 montagens) e na rota smoke.
- **Boundaries melhores**: `WebGLErrorBoundary` cai em `SimplifiedSkyFallback` em vez de tela técnica, e `CanvasLoaderWithTimeout` (8s) evita spinner infinito após HMR/deploy stale.
- `SkyCanvas2` continua disponível em `/dev/skycanvas-2` para experimentação; não é deletado.

## Fora do escopo

- Não removo `src/components/show3d/v2/*` (rota demo `/dev/skycanvas-2` ainda usa).
- Não toco em layers v2 (Explosions/LightPoints/PyroPads) — o pipeline oficial tem seu próprio render path.
