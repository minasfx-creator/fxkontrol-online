

# Sound Design AR + Animações Refinadas — VenueShowOverlay

## Mudanças

### 1. `src/components/editor/VenueShowOverlay.tsx` — Som + Animações

**Sons AR (usando `ambientSound` existente):**
- Import `ambientSound` from `@/lib/ambientSound`
- `phase === 'reveal'`: tocar `ambientSound.play('nav')` a cada section reveal (dentro do interval de 150ms)
- GPS typewriter: tocar `ambientSound.play('click')` a cada caractere (via callback no `useTypewriter`)
- `phase === 'deploying'`: tocar `ambientSound.play('boot')` uma vez
- `phase === 'dissolve'`: nenhum som (silêncio cinematográfico)

**Animações refinadas:**
- **circOut easing** no dissolve: substituir `1 - progress` linear por `1 - (1 - (1 - progress)^3)` = curva circOut para fade mais suave (rápido no início, lento no final)
- **Dissolve mais longo**: 1500ms → 2500ms para transição mais cinematográfica
- **Glow pulsante no deploy**: adicionar `@keyframes` inline com `boxShadow` alternando entre `0 0 30px` e `0 0 60px` primary durante fase `deploying`
- **Intel sections**: adicionar easing `cubic-bezier(0.0, 0.0, 0.2, 1)` (circOut) na transition das sections
- **Stats bar**: adicionar animação de fade-in com delay quando todas sections estiverem visíveis

**Typewriter com som:**
- Modificar `useTypewriter` para aceitar callback `onTick` opcional
- Chamar `ambientSound.play('click')` a cada 3º caractere (evitar spam de áudio)

### 2. Nenhum arquivo novo necessário

O `ambientSound` já tem todos os sons necessários (`nav`, `click`, `boot`). Apenas importar e usar.

## Detalhes Técnicos

```text
circOut(t) = 1 - (1 - t)^3

Dissolve curve:
  t=0.0 → opacity=1.0
  t=0.3 → opacity=0.34  (rápido no início)
  t=0.7 → opacity=0.03  (quase invisível)
  t=1.0 → opacity=0.0
```

## Ordem de Execução

| Passo | Tarefa |
|---|---|
| 1 | Modificar `VenueShowOverlay.tsx` — adicionar sons + refinar animações |
| 2 | Build verification |

