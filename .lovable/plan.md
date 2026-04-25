
## Plano: diagnosticar e corrigir "viewport bugado não renderiza"

### Fase 1 — Triagem (preciso de info sua OU do navegador)

Não há erros no log do Vite e o servidor está saudável. Sem console logs do navegador e sem screenshot, qualquer "fix" seria chute. Duas formas de avançar:

**Opção A (rápida) — você me diz:**
- Qual rota? (`/`, `/editor`, `/pricing`, outra)
- O que aparece? (tela preta, spinner infinito, layout sem o canvas 3D, erro vermelho)
- Quando começou? (depois do `/pricing`? depois do upgrade dialog? sempre?)

**Opção B — eu abro o preview com o browser tool**, tiro screenshot e leio os console logs ao vivo. Isso consome cota de browser, mas resolve em 1 ida.

### Fase 2 — Suspeitos prováveis (em ordem)

Com base no que mexi nas últimas iterações:

1. **`UpgradeDialog` montado em `App.tsx`** (linha 83) — se ele explodir no render, derruba toda a árvore. Vou conferir se ele tolera `user === null` e se não chama hook condicional.
2. **`useEntitlements`** — usado pelo `Pricing` e pelo `UpgradeDialog`. Se quebrar quando não há sessão Supabase, derruba o root.
3. **Viewport 3D do `/editor`** — `SiteModelRenderer`, `DroneChoreography`, `CameraController`. Se algum `useGLTF` recebeu URL inválida sem o `ModelErrorBoundary`, ou se `useViewportStore` está em estado `cameraAnimating` travado, o canvas fica preto.
4. **Stale chunk** — vários `page reload` no log indicam HMR pesado. Pode ser só cache do navegador (hard reload resolve).

### Fase 3 — Correção

Depois de identificar o culpado:
- Se for `UpgradeDialog`/`useEntitlements`: hardening contra `user null`, `subscription undefined`, e wrap em try/catch silencioso.
- Se for o canvas 3D do `/editor`: garantir ErrorBoundary no `<Canvas>`, resetar `interactionState` no mount, e fallback visual quando WebGL falhar.
- Se for cache: instruir hard reload + bumpar versão do chunk.

### O que eu preciso de você agora

Me responda **uma** das duas:
- **(A)** Qual rota + o que vê na tela (1 frase basta), ou
- **(B)** "pode usar o browser" — eu abro, screenshot, leio console e sigo daqui.
