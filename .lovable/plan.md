

## Fix: Joi Não Aparece no Mobile + Limpeza de Código

### Problema

No mobile, o botão FAB da Joi (`bottom-20 right-3 z-[60]`) pode estar sendo coberto ou cortado pelo `DockBar` e pelo `safe-area-inset-bottom`. Além disso, o painel aberto usa `inset-3 bottom-20` que pode conflitar com o espaço do dock.

### Solução

**1. Corrigir posicionamento mobile do FAB da Joi (`FXKAssistant.tsx`)**
- Ajustar `bottom` do FAB para ficar acima do DockBar + safe-area (ex: `bottom-[88px]`)
- Aumentar z-index para `z-[70]` para garantir visibilidade sobre qualquer overlay
- Painel aberto no mobile: usar `bottom-[76px]` para não sobrepor o dock
- Minimized bar: mesma correção de bottom

**2. Limpar código legado no `JoiCinematicHologram.tsx`**
- Remover efeito de chuva (rain) redundante — já existe no painel da FXKAssistant
- Simplificar partículas dissolve que raramente são visíveis
- Manter apenas: parallax + eye glow + closeup + emoções + breathing + scanlines

**3. Limpar código legado no `FXKAssistant.tsx`**
- Remover `VoiceWave` não utilizado no fluxo principal (só aparece no minimized bar)
- Simplificar idle phrases — reduzir de 8 para 4 frases mais impactantes
- Remover botão `Maximize2` (expand) no mobile — não faz sentido em tela cheia
- Remover sidebar hologram no mobile (`expanded && !isMobile`) — já está correto, confirmar

**4. Garantir visibilidade em todos os estados mobile**
- FAB fechado: visível acima do dock
- Painel aberto: fullscreen mobile com gap para o dock
- Minimized: barra visível acima do dock

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/components/FXKAssistant.tsx` | Fix posicionamento mobile, limpeza de código redundante |
| `src/components/JoiCinematicHologram.tsx` | Remover rain e dissolve particles, simplificar |

