## Problema

Fluxo relatado: Landing → Auth/Cadastro → cai em **Office Dashboard** em vez do **Studio (viewport 3D)**.

## Diagnóstico

1. **Roteamento já aponta para `/studio`** como destino padrão pós-login (`AuthRoute` em `App.tsx`: fallback = `/studio`; `/` → `/studio`). Os CTAs do Landing (`Link to="/studio"`) também estão corretos.

2. **Causa real (vista no console runtime do `/studio`):**
   ```
   TypeError: Failed to fetch dynamically imported module:
     /src/components/editor/Timeline.tsx
   ```
   - Em `src/pages/Index.tsx` linha 39, `Timeline` é carregado com o helper `lz()` simples — **sem `lazyRetry`** — diferente do `SkyCanvas` (linha 149). Quando o chunk fica obsoleto (deploy/HMR), o erro propaga para o `LazyChunkBoundary`, que substitui a tela por "Falha ao carregar a interface · Recarregar aplicativo".
   - Mesmo após "Recarregar", se o usuário tiver `/office` como última rota visitada (sidebar) ou se algum link lateral for clicado, ele sai do Studio. O sintoma "cai no Office" é a tela Office sendo a única que renderiza com sucesso enquanto o Studio quebra silenciosamente.

3. **Sinais corroborantes:** LCP de 25 s no `/studio`, vários warnings no AppErrorBoundary, e o card de "Recarregar" não preserva a rota.

## Plano de Correção

### 1. Blindar imports lazy do Studio (`src/pages/Index.tsx`)
- Trocar o helper `lz(...)` para envolver TODOS os `import()` com `lazyRetry()` (mesmo padrão já usado em `SkyCanvas`). Isso reexecuta o `import()` automaticamente em caso de chunk stale antes de jogar para o ErrorBoundary.
- Aplicar especificamente em `Timeline`, `EffectsLibrary`, painéis laterais e qualquer `lz(...)` restante no arquivo.

### 2. Fallback do `LazyChunkBoundary` que NÃO perde a rota (`src/components/errors/LazyChunkBoundary.tsx`)
- Manter `window.location.reload()` como ação principal, mas:
  - Renderizar um segundo botão **"Voltar ao Studio"** (`window.location.href = '/studio'`) para reforçar a rota correta.
  - Exibir a rota atual e o nome do módulo que falhou (do `error.message`) para diagnóstico.
- Adicionar tentativa automática única de `reload()` com guarda em `sessionStorage` (evita loop) — só se ainda não recarregou nesta sessão para esse path.

### 3. Reforçar destino pós-login (`src/App.tsx`)
- Em `AuthRoute`, ignorar `next` quando ele apontar para `/auth`, `/landing` ou `/` (já tratado parcialmente). Adicionar também ignore se `next === '/office'` **somente** quando vier diretamente do Landing (param `from=landing`), garantindo que cadastro novo sempre caia em `/studio`.
- Em `ProtectedRoute`, NÃO preservar `next` para a rota `/landing` (não faz sentido voltar para landing após login).

### 4. Smoke test manual
- Fazer logout, abrir `/landing`, clicar CTA → `/auth?next=/studio` → login → deve cair em `/studio` com Timeline carregada.
- Forçar erro de chunk (limpar cache) → ver fallback com botão "Voltar ao Studio" funcional.

## Arquivos afetados

- `src/pages/Index.tsx` — envolver todos `lazy(import(...))` com `lazyRetry`.
- `src/components/errors/LazyChunkBoundary.tsx` — fallback melhorado + auto-reload guarded.
- `src/App.tsx` — endurecer `AuthRoute`/`ProtectedRoute` para nunca cair em `/office` no primeiro login.

## Fora do escopo

- Otimização do LCP de 25 s do Studio (já tratada em iterações anteriores via DelayedMount/boot-safe profile).
- Recovery de WebGL context loss (já implementado).
