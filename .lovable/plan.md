

# XL4 2.0 Mobile Redesign + Auditoria Global de Falhas

## Problemas Identificados

### A. CommandCenter Mobile — Experiencia Minima
O `CommandCenter.tsx` no mobile (linhas 106-112) simplesmente renderiza `<LiveFiringPanel>` em fullscreen sem nenhum chrome proprio — sem Dynamic Island, sem status de conexao, sem navegacao rapida. O operador perde toda a interface glassmorphism do desktop.

### B. PyroFireOnePanel — Tipografia Critica (Mobile)
Ainda contem `text-[5px]`, `text-[6px]`, `text-[7px]` extensivamente:
- Linha 798: `text-[6px]` para latencia ArtNet
- Linha 803: `text-[5px]` para RSSI dB
- Linhas 829, 848, 859, 864, 869, 875, 879, 883: `text-[6px]` e `text-[5px]` em badges, voltagem, temperatura, ARM buttons
- Linhas 710, 721, 726, 731, 761, 781: `text-[7px]` em panel mode para botoes criticos de seguranca

### C. MobileLinkMode — 1250 linhas com tipografia tiny
Arquivo inteiro usa `text-[5px]` a `text-[7px]` em badges, labels e controles criticos de seguranca — num componente feito para MOBILE.

### D. CommandCenter Mobile — Sem Dynamic Island Status
Desktop tem sidebar com Dynamic Island + status de conexao + safety footer. Mobile nao tem nada disso.

### E. LiveFiringPanel CueKey — `text-[8px]` para KEY label
Linha 271: KEY labels em mobile fullscreen usam `text-[9px]` (com `isBig`), mas em panel mode usam `text-[8px]` — marginal.

### F. MobileTabBar — Sem badge de contagem de efeitos ativos
O tab "Live FX" tem indicador pulsante vermelho quando ativo, mas nao mostra quantos efeitos estao ativos.

## Plano de Correcao

### 1. CommandCenter Mobile — Apple HUD Completo
Redesenhar o bloco mobile do `CommandCenter.tsx` para incluir:
- **Dynamic Island** no topo: pill com status de conexao (connected count), modo ativo, badge ARMED
- **Bottom navigation**: segmented control glassmorphism com as 4 categorias (Fire / HW / Net / System)
- **Quick mode pills**: 4 botoes rapidos (DMX, Pyro, ArtNet, Map) abaixo do Island
- **Safety indicator**: banner vermelho pulsante quando ARMED
- Manter `LiveFiringPanel` como conteudo principal mas com chrome proprio

### 2. PyroFireOnePanel — Tipografia Minima Global
Substituir em todo o arquivo (1325 linhas):
- `text-[5px]` → `text-[8px]` (13 ocorrencias)
- `text-[6px]` → `text-[8px]` (25 ocorrencias) 
- `text-[7px]` → `text-[8px]` em panel mode (30 ocorrencias)

### 3. MobileLinkMode — Tipografia Minima
Substituir em todo o arquivo (1250 linhas):
- `text-[5px]` → `text-[9px]`
- `text-[6px]` → `text-[9px]`
- `text-[7px]` → `text-[9px]` (este e um componente mobile-first, minimo 9px)

### 4. MobileTabBar — Badge de efeitos ativos
Adicionar `useLiveSfxStore` para ler `activeEffects.length` e exibir badge numerico no icone Live FX quando > 0.

### 5. MobileHUD — Melhorar com ARM Status
Adicionar indicador de ARMED state ao HUD (borda vermelha pulsante no pill quando armed).

## Arquivos Afetados
1. **Editar**: `src/pages/CommandCenter.tsx` — redesign mobile com Dynamic Island + bottom nav
2. **Editar**: `src/components/editor/live-firing/PyroFireOnePanel.tsx` — tipografia minima
3. **Editar**: `src/components/editor/live-firing/MobileLinkMode.tsx` — tipografia minima
4. **Editar**: `src/components/editor/MobileTabBar.tsx` — badge efeitos ativos
5. **Editar**: `src/components/editor/MobileHUD.tsx` — ARM status indicator

