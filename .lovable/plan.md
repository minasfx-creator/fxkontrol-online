
## Objetivo

Conectar toda a plataforma ao novo `/skycanvas` como **surface canônica do editor**, eliminando o item "Studio" duplicado da sidebar e fazendo todos os links/atalhos/transições reconhecerem `/skycanvas`.

Zero alteração em rotas operacionais (`/command`, `/pairing/*`), zero toque em CommandBus/FieldBus/safety/workMode.

---

## Mudanças

### 1. Sidebar — remover duplicata "Studio"
`src/components/AppSidebar.tsx` (linhas 31-37): remover `{ title: 'Studio', url: '/studio', … }`. Restam: Office · **SkyCanvas** · Command · Strategy. Redirect `/studio → /skycanvas` em `App.tsx` continua, então bookmarks legacy seguem funcionando.

### 2. MainLayout — reconhecer `/skycanvas` como editor
`src/layouts/MainLayout.tsx` linha 76:
```ts
const isEditor = location.pathname === '/skycanvas' || location.pathname === '/studio';
```
Garante que dissolves/transições/HUD usem o mesmo modo "editor immersive" que era exclusivo de `/studio`.

### 3. Links e atalhos — apontar canonicamente para `/skycanvas`
Sweep nos arquivos abaixo (todos `to="/studio"` / `navigate('/studio')` / `path: '/studio'` / `path: '/editor'` viram `/skycanvas`):
- `src/pages/NotFound.tsx`
- `src/pages/Landing.tsx` (4 ocorrências CTA)
- `src/pages/Comercial.tsx`
- `src/pages/AIBuilder.tsx`
- `src/pages/IOSReadiness.tsx`
- `src/components/pairing/SuccessStep.tsx`
- `src/components/QuickJumpMenu.tsx`
- `src/components/office/DashboardPanel.tsx` (8 ocorrências, incluindo `?panel=`)
- `src/components/DockBar.tsx` (label "Editor 3D" → "SkyCanvas", path `/editor` → `/skycanvas`)

### 4. QueryString legacy
SkyCanvas hoje **não consome** `?panel=remotecontrol` / `?panel=drones` / `?panel=aroverlay`. Manter apenas o path canônico `/skycanvas` — os parâmetros viram no-op e não quebram (DashboardPanel passa a navegar pra `/skycanvas?panel=…` mas SkyCanvas ignora). Sem erro nem warning.

### 5. Ajuste de teste
`src/lib/__tests__/lazyRetry.resilience.test.ts` e `installChunkErrorRecovery.e2e.test.ts` mockam `pathname: '/studio'` — manter (ainda funciona via redirect e os testes não validam pathname final).

---

## Não tocar

- `src/App.tsx` redirects (já consolidados)
- `src/integrations/supabase/*`
- `src/store/useProjectStore.ts`
- Qualquer rota operacional / safety / pairing
- `src/components/show3d/v2/*` (já refinado na rodada anterior)
- `src/index.css` (glassmorphism já aplicado)

## Critério de aceite

- Sidebar mostra **um único** entry de editor (SkyCanvas)
- Todos os CTAs ("Voltar ao Studio", "Abrir Editor", AIBuilder onClose etc.) abrem `/skycanvas`
- Bookmarks de `/studio` e `/editor` continuam funcionando (redirect 301)
- MainLayout dispara modo editor para `/skycanvas`
- Suite de testes verde
