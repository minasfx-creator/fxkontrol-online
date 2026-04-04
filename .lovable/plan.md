

# Plano: Integrar JoiHologramFullBody no FXK Assistant

## O Que Muda

Quando o painel do assistente está **expandido** (`expanded === true`), o avatar idle (área vazia sem mensagens) e o header usam o `JoiHologramFullBody` em vez do `JoiHologramAvatar` pequeno.

## Modificações

### `src/components/FXKAssistant.tsx`

1. **Import** `JoiHologramFullBody` ao lado do import existente de `JoiHologramAvatar`.

2. **Header (linha ~326):** Quando `expanded === true`, renderizar `JoiHologramFullBody` com `state={loading ? 'active' : 'idle'}` em tamanho compacto (`w-10 h-16`) no lugar do `JoiHologramAvatar size="sm"`.

3. **Idle screen (linhas ~360-361):** Quando `expanded === true` e `messages.length === 0`, substituir o `JoiHologramAvatar size="lg"` pelo `JoiHologramFullBody` grande (`h-64`) com `state="materializing"` na primeira renderização, transicionando para `idle`. Manter o `JoiHologramAvatar size="lg"` quando não expandido.

4. **Sidebar avatar expandido (novo):** No modo expandido, adicionar uma coluna lateral esquerda (largura ~120px) com o `JoiHologramFullBody` permanente ao lado do chat, visível mesmo com mensagens. Quando `expanded === false`, esta coluna não aparece.

### Layout do painel expandido

```text
┌─────────────────────────────────────────┐
│ Header: [FullBody mini] JOI·NEXUS  [─]  │
├──────────┬──────────────────────────────┤
│          │                              │
│ FullBody │    Chat messages             │
│ Hologram │    ...                       │
│ (120px)  │    ...                       │
│          │                              │
├──────────┴──────────────────────────────┤
│ [textarea input]                   [▶]  │
└─────────────────────────────────────────┘
```

Quando não expandido, layout mantém-se como está (sem coluna lateral).

## Ficheiros

| Ação | Ficheiro |
|------|---------|
| Modificar | `src/components/FXKAssistant.tsx` |

Nenhum ficheiro novo. Nenhuma alteração em stores ou CSS.

