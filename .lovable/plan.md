

## Plano: Correção Definitiva do Viewport 3D no Mobile e Desktop

### Problema Raiz

Analisando a cadeia de layout do `/editor` no mobile:

```text
SidebarProvider
  └─ div.min-h-[100dvh].flex.w-full        ← root
       └─ div.flex-1.flex.flex-col.min-w-0  ← content column (NO height constraint)
            └─ main.flex-1.min-h-0.overflow-hidden.relative
                 └─ div.absolute.inset-0     ← Index mobile layout
                      └─ div.absolute.inset-0 ← SkyCanvas wrapper
```

**Causa**: O container intermediário `div.flex-1.flex.flex-col.min-w-0` (linha 124 do MainLayout) **não possui `min-h-0`**. Em flexbox, sem `min-h-0`, o conteúdo pode forçar o flex item a crescer além do esperado, quebrando o cálculo de `absolute inset-0` dentro do `<main>`. No mobile Safari especialmente, isso faz o Canvas receber apenas uma fração da altura disponível.

Além disso, o container raiz usa `min-h-[100dvh]` ao invés de `h-[100dvh]`, permitindo que o conteúdo empurre a altura para além da viewport.

### Correções (2 arquivos)

#### 1. MainLayout.tsx — Fixar cadeia de altura

**Linha 114-115**: Mudar o container raiz de `min-h-[100dvh]` para `h-[100dvh]` e adicionar `overflow-hidden`:
```tsx
<div className="h-[100dvh] flex w-full bg-background br2049-vignette overflow-hidden" ...>
```

**Linha 124**: Adicionar `min-h-0` ao container de conteúdo para que o flex shrink funcione:
```tsx
<div className="flex-1 flex flex-col min-w-0 min-h-0">
```

#### 2. Index.tsx — Garantir altura explícita no container mobile

**Linhas 401, 410**: Adicionar `h-full` como reforço ao container do editor mobile:
```tsx
<div className="absolute inset-0 overflow-hidden bg-background h-full">
```

**Linha 411**: Garantir que o wrapper do SkyCanvas tenha dimensões explícitas:
```tsx
<div className="absolute inset-0 w-full h-full">
```

Mesma correção para o desktop (linha 452-453): garantir `w-full h-full` no container do Canvas.

### Resultado

O Canvas de R3F receberá 100% da área disponível do `<main>`, que agora terá dimensões corretas em toda a cadeia flex. O terreno 3D ocupará a tela inteira ao invés de apenas uma faixa no topo.

### Arquivos modificados: 2
- `src/layouts/MainLayout.tsx` (2 linhas)
- `src/pages/Index.tsx` (3-4 linhas)

