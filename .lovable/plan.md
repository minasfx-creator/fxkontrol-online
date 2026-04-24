
Objetivo: corrigir o caso em que o botão Play muda de estado, mas o tempo da timeline continua em 0 e não avança.

1. Fechar a causa real com um teste de integração do motor
- Adicionar um teste cobrindo o fluxo completo: `play()` → `deterministicClock` → `lockstep` → `timelineClock.tick()` → espelho em `useProjectStore`.
- Cobrir 3 cenários que hoje parecem gerar “play sem movimento”:
  - velocidade persistida em `0`
  - timeline no fim da duração
  - play via UI móvel/compacta, não só via chamadas diretas ao clock
- Isso evita corrigir só o sintoma.

2. Centralizar o transporte da timeline
- Criar um controlador único de transporte para substituir chamadas soltas como `timelineClock.play()` espalhadas em:
  - `Timeline.tsx`
  - `MobileHUD.tsx`
  - `LiveModeOverlay.tsx`
  - `SkyCanvas.tsx`
  - `Toolbar.tsx`
  - `ShowCommanderPanel.tsx`
- Esse controlador deve padronizar:
  - `play()`
  - `pause()`
  - `toggle()`
  - `stop()`
  - `rewind()`
  - `playFromStartIfEnded()`
  - `ensurePlayableSpeed()`

3. Corrigir os dois estados UX que parecem “bug”
- Se a velocidade estiver `0`, o Play deve:
  - restaurar para a última velocidade válida, ou
  - cair para `1x` por padrão
- Se `currentTime >= duration`, o Play deve:
  - fazer `seek(0)` antes de tocar
- Isso mantém o suporte técnico a speed `0` no motor, mas impede que a UI entre em estado “parece quebrado”.

4. Blindar persistência e restauração
- Revisar carregamento de projeto e restauração de sessão em:
  - `useProjectPersistence.ts`
  - `useBlackBox.ts`
- Garantir que velocidade salva inválida ou `0` não deixe a timeline “tocando parada” ao reabrir o editor.
- Preservar casos avançados de sync externo sem quebrar o modo normal local.

5. Melhorar feedback visual para o operador
- Exibir estado mínimo de diagnóstico perto dos controles de playback:
  - `0x`
  - `END`
  - `EXT`
- Em mobile, mostrar esse feedback no HUD, porque o painel grande da timeline nem sempre está visível.
- Se o Play precisar autocorrigir velocidade ou reiniciar do fim, mostrar feedback discreto.

6. Limpar duplicação/código morto no transporte
- Remover lógica repetida de play/pause/stop dispersa pelos componentes.
- Deixar apenas o controlador central como caminho operacional da UI.
- Isso reduz regressões futuras e simplifica manutenção.

7. Validar fim a fim
- Validar:
  - Play no editor desktop
  - Play no HUD mobile
  - Play no overlay live
  - Stop/rewind
  - seek + play
  - timeline no fim + play
  - velocidade `0` + play
  - source `external` vs `local`
- Confirmar que `currentTime` e barra de progresso avançam continuamente e que o ícone reflete estado real.

Detalhes técnicos
- O código já mostra que o botão muda `playing=true`, então o problema não parece ser clique/handler.
- O clock independente em `EngineProvider` já existe; portanto o próximo ajuste deve focar no caminho de transporte e em estados inválidos da timeline, não só no RAF.
- O ponto mais suspeito hoje é a combinação de:
  - velocidade persistida em `0`
  - chamadas diretas e duplicadas a `timelineClock.play()`
  - ausência de autocorreção quando o usuário aperta Play em estado não reproduzível

Resultado esperado
- Play sempre faz a timeline andar no modo local.
- Play no fim reinicia corretamente.
- Velocidade inválida não deixa a UI “rodando parada”.
- Um único caminho de transporte passa a governar desktop, mobile e overlays.
