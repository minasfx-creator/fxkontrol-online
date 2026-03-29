

## Plano: Corrigir Viewport 3D Cortado no Desktop

### Problema Raiz

No `MainLayout.tsx`, a sidebar (`AppSidebar`) só é escondida para a rota `/command` (`!commandImmersive`), mas **não** para `/editor`. No desktop, a sidebar ocupa ~256px de largura, cortando o viewport 3D que usa `absolute inset-0` e espera ocupar 100% do pai.

```text
Cadeia atual no desktop /editor:
  div.h-[100dvh].flex
    ├─ AppSidebar (~256px)  ← ROUBA ESPAÇO
    └─ div.flex-1.flex-col
         └─ main.flex-1.relative
              └─ Index: div.absolute.inset-0  ← cortado em 256px
```

### Correção

**Arquivo: `src/layouts/MainLayout.tsx`** — 1 alteração

Linha 118: Mudar a guarda da sidebar de `!commandImmersive` para `!commandImmersive && !isEditor`, escondendo a sidebar também na rota `/editor`. A mesma lógica já aplicada ao header (linha 143).

Também na linha 126 (ARMED banner) e linha 205 (PANIC FAB): manter visíveis no editor — o editor tem seus próprios controles de panic.

### Resultado

O viewport 3D no desktop ocupará 100% da largura da tela, sem corte lateral da sidebar.

### Arquivos modificados: 1
- `src/layouts/MainLayout.tsx` — esconder sidebar no `/editor`

