

# Ciclo de Polish #19 — MineEffect Bug Fixes

## Bugs Encontrados no Codigo Atual

| # | Bug | Linha | Fix |
|---|-----|-------|-----|
| 1 | **Bounce sparks: gravidade 50%** — `0.5 * GRAV * bt * bt * 0.5` aplica fator 0.25 em vez de 0.5. Sparks flutuam | L214 | Remover o `* 0.5` final |
| 2 | **Smoke shader ignora size buffer** — vertex shader substituido com `3.0 *` hardcoded, entao `smokeSizeArr` calculado no loop (L378) nunca e usado | L507 | Usar `size` attribute no smoke shader |
| 3 | **Smoke sem color tint** — fumaca sempre warm gray fixo (0.35, 0.3, 0.25), nao absorve cor da explosao | L373-375 | Misturar 25% de `baseColor` |
| 4 | **Smoke termina em progress=0.7** — fumaca desaparece cedo demais | L350 | Estender para `progress < 0.92` |
| 5 | **Rising smoke cloud falta depthWrite={false}** — L469 so tem `depthTest={false}` | L469 | Adicionar `depthWrite={false}` |
| 6 | **Drip sem ember transition** — drips que batem no chao (`rawY < 0`) nao transitam para cor ember | L270-276 | Quando bounced, interpolar para charcoal/amber |

## Arquivo Modificado

`src/components/editor/effects/MineEffect.tsx` — 6 correcoes pontuais

## Ordem

1. Fix gravidade bounce (L214)
2. Fix smoke shader size attribute (L507)
3. Smoke color tint + duracao estendida (L350, L373)
4. Rising smoke depthWrite (L469)
5. Drip ember transition no bounce (L270)
6. Build verification

