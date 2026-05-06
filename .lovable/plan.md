
## Objetivo

Adicionar **dois testes guard automatizados** que protegem o consolidação `/skycanvas`:

1. **`routesIntegrity.guard.spec.ts`** — varre todo `src/`, extrai cada referência interna de navegação (`to="/x"`, `navigate('/x')`, `path: '/x'`, `<Navigate to="/x">`, `href="/x"`) e falha se algum path não casa com uma `<Route>` registrada em `src/App.tsx` (literal ou padrão dinâmico tipo `/pairing/:transport`). Inclui asserts dedicados garantindo zero referência viva a `/studio` ou `/editor` fora dos redirects.

2. **`isEditorState.spec.tsx`** — testa o predicado `isEditor` do `MainLayout`:
   - `TRUE` apenas para `/skycanvas`
   - `FALSE` para 14 rotas concretas (`/`, `/auth`, `/office`, `/command`, `/strategy`, `/field`, `/pairing/usb`, `/training/center`, `/dev/skycanvas-lab`, `/comercial`, `/landing`, `/pricing`, `/skycanvas/extra`, etc.)
   - Lê `MainLayout.tsx` e regex-asserta que a fonte canônica usa `=== '/skycanvas'` e **não** menciona `'/studio'` ou `'/editor'`.

## Mecânica

- Sem React mount nem Browser. Pure-Node fs scan + regex → rápido, determinístico.
- Skip dirs: `__tests__`, `_quarantine`, `test`, `node_modules`. Skip arquivos `*.test.*` / `*.spec.*`.
- Allowlist `src/App.tsx` para conter as declarações `<Route>` legacy (redirects).
- Allowlist regex `NEVER_ROUTES_RE`: `https?:`, `mailto:`, `#`, `/api/`, `/wasm/`, `/assets/`, `/static/`, `/auth?…`, raiz `/`.
- Patterns dinâmicos (`/pairing/:transport`) viram `^/pairing/[^/]+$`.

## Arquivos a criar

- `src/__tests__/routesIntegrity.guard.spec.ts` (≈140 linhas)
- `src/__tests__/isEditorState.spec.tsx` (≈55 linhas)

## Critério de aceite

- Ambos passam ao rodar `vitest run`.
- Se alguém adicionar um `to="/foo"` para rota inexistente, o test falha com mensagem clara `unresolved internal routes: src/components/Foo.tsx:42 → /foo`.
- Se alguém reintroduzir `to="/studio"` ou `navigate('/editor')`, falha imediatamente com a localização.
- Se `MainLayout.isEditor` voltar a referenciar `/studio` ou `/editor`, falha com regex.

## Não tocar

Nenhum arquivo de produção. Zero impacto em runtime.
