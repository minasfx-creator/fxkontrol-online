

## Fix: Joi Não Aparece no Dashboard Desktop

### Causa Raiz

O componente `FXKAssistant` usa `position: fixed` para o botão flutuante, mas está renderizado **dentro** de um `div` que tem `filter: brightness(...)` aplicado (MainLayout linha 114). 

Em CSS, quando um elemento pai tem `filter` (que não seja `none`), ele cria um **novo containing block** — fazendo com que `position: fixed` dos filhos se comporte como `position: absolute` relativo a esse pai. Como esse pai tem `overflow-hidden`, o botão da Joi pode ficar cortado ou mal posicionado.

### Solução

Mover o `<FXKAssistant />` para **fora** do `div` que tem o `filter: brightness()`. Renderizar o componente como irmão desse div, diretamente dentro do `SidebarProvider`, onde `position: fixed` funciona corretamente em relação ao viewport.

Também mover o botão PANIC FAB para fora, pelo mesmo motivo.

### Mudanças

**`src/layouts/MainLayout.tsx`**

- Mover `<Suspense><FXKAssistant /></Suspense>` para **depois** do `div` com `filter: brightness()`
- Mover o PANIC FAB para **depois** do `div` com `filter: brightness()`
- Mover o `DockBar` para fora também (mesma razão)
- Estrutura final:
  ```
  <SidebarProvider>
    <div style={{ filter: brightness(...) }} className="overflow-hidden">
      {/* sidebar, header, main content */}
    </div>
    {/* Estes ficam FORA do div com filter */}
    <FXKAssistant />
    {PANIC FAB}
    {DockBar}
  </SidebarProvider>
  ```

### Arquivo Modificado

| Arquivo | Alteração |
|---|---|
| `src/layouts/MainLayout.tsx` | Mover FXKAssistant, PANIC FAB e DockBar para fora do div com `filter` |

