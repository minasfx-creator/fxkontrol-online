

# Otimização de LCP, SEO Técnico e Acessibilidade — FX KONTROL

## Contexto Importante

O relatório é extenso, mas muitas recomendações (SSG, hydration, WASM, consolidação de 17 stores) estão **fora do escopo prático** da plataforma Lovable (SPA pura com Vite/React, sem SSR/Next.js). Vou focar nas **ações concretas e implementáveis** que terão impacto real.

A pontuação LCP zero da auditoria veio da **página placeholder** (app não publicado). Após publicação, o Lighthouse analisará a app real. Mesmo assim, há otimizações válidas para quando estiver publicada.

---

## Fase 1 — SEO Técnico (index.html)

**Ficheiro: `index.html`**

1. **Corrigir viewport** — remover `maximum-scale=1.0, user-scalable=no` (viola acessibilidade WCAG e penaliza Lighthouse)
2. **Atualizar OG/Twitter** — usar imagens próprias da Minas FX em vez das do Lovable, corrigir `twitter:site`
3. **Adicionar JSON-LD** — structured data `Organization` + `SoftwareApplication` para E-E-A-T
4. **Adicionar `lang="pt-BR"`** — atualmente está `en`
5. **Adicionar canonical** — `<link rel="canonical">`

## Fase 2 — Ficheiros SEO Estáticos

1. **Criar `public/sitemap.xml`** — listar rotas públicas (`/`, `/auth`) com `lastmod` e `priority`
2. **Melhorar `public/robots.txt`** — adicionar GPTBot, PerplexityBot, referência ao sitemap, bloquear rotas privadas

## Fase 3 — Otimização LCP Real

**Ficheiro: `index.html`**

1. **Splash como elemento LCP visível** — o splash já está no HTML estático, mas o `<p>` de texto nele pode ser o LCP. Adicionar um `<h1>` visível e semântico dentro do splash para que o LCP seja imediato
2. **Preload do logo/ícone crítico** — adicionar `<link rel="preload">` para o favicon/logo usado no splash
3. **Reduzir font-loading bloqueante** — a segunda folha de fontes (5 famílias, 20+ pesos) é excessiva; reduzir para pesos usados

**Ficheiro: `src/main.tsx`**

4. **Defer splash dismissal** — usar `requestIdleCallback` em vez de `requestAnimationFrame` para dar mais tempo ao browser pintar

## Fase 4 — Acessibilidade (ARIA Landmarks)

**Ficheiro: `src/layouts/MainLayout.tsx`**

1. Adicionar `role="banner"` ao header
2. Adicionar `role="main"` à área de conteúdo (`<Outlet>`)
3. Adicionar `role="navigation"` ao sidebar/dock

**Ficheiro: `index.html`**

4. Adicionar `aria-label` ao splash para acessibilidade durante carregamento

## Resumo de Ficheiros

| Ficheiro | Ação |
|---|---|
| `index.html` | viewport, lang, canonical, JSON-LD, h1 no splash, preload, ARIA |
| `public/robots.txt` | Expandir com bots IA + sitemap ref |
| `public/sitemap.xml` | Criar novo |
| `src/main.tsx` | requestIdleCallback para splash |
| `src/layouts/MainLayout.tsx` | ARIA landmarks |

## O que NÃO será feito (e porquê)

- **SSG/Hydration** — impossível sem Next.js; Lovable usa Vite SPA puro
- **Consolidação de 17 stores Zustand** — refatoração massiva, já otimizados com seletores granulares
- **Migração WASM** — fora do escopo atual
- **ECS para VFX** — redesign arquitetural completo, não é limpeza

