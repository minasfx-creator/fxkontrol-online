## Plano: Áudio na Timeline + Limpeza de Código Morto + Disparo Real Plug-and-Play

### Frente 1 — Import de áudio pela timeline não abre seletor de arquivos

**Diagnóstico:** O `AudioWaveform.tsx` usa `<input type="file" accept="audio/*">` em duas posições (linha 519 no header e 597 no overlay vazio). O atributo `accept="audio/*"` no iOS/alguns desktops **filtra demais** e em alguns navegadores móveis simplesmente abre câmera/galeria em vez do seletor de arquivos. Além disso, formatos como `.flac`, `.opus`, `.aac` que o `audioUpload.ts` já suporta são **excluídos** pelo MIME `audio/*` em alguns browsers (Safari iOS especialmente).

Também, no mobile, clicar no `<label>` aninhando `<input>` às vezes não dispara — e `disabled={uploading}` no `<input>` não impede o clique repetido no label.

**Correções:**
- Trocar `accept="audio/*"` por uma lista de extensões explícita: `accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.webm,.opus"` — com extensões, navegadores que filtravam mostram todos os formatos suportados.
- Substituir o padrão `<label><input/></label>` por um `<button>` que dispara um `inputRef.current?.click()` programaticamente (mais confiável em iOS e em hosts iframe da Lovable).
- Reaproveitar `uploadAudioForProject()` de `src/lib/audioUpload.ts` em vez do upload duplicado dentro do próprio componente (DRY com o drop handler do viewport).
- Adicionar `e.target.value = ''` após o upload pra permitir re-selecionar o mesmo arquivo (bug clássico do `<input file>`).

### Frente 2 — Código morto / limpeza

Vou fazer um sweep estreito (não global) focado nos arquivos tocados nas últimas iterações:

- **`src/_quarantine/safety/*.txt`** — confirmar que zero imports apontam para lá; o `_quarantine` é proposital, mas `.txt` não é importável → manter; só verificar.
- **`SetlistPanel.tsx`** — importa ícones `GripVertical`, `ArrowDownUp` que **nunca são renderizados** + `dragIdx` state declarado e nunca lido. Remover imports e state mortos.
- **`AudioWaveform.tsx`** — após a Frente 1, o bloco `handleUpload` interno fica obsoleto (delegado pra `uploadAudioForProject`). Remover.
- **`AutoControllerLauncher.tsx` / cards** — varrer `console.log` esquecidos do ciclo anterior.
- Procurar outros componentes em `src/components/editor/` com imports não-usados via `rg "^import.*from" + cross-check` apenas nos arquivos editados recentemente. Não vou refatorar componentes intactos.

**Não vou** fazer um "remove all dead code do projeto inteiro" — isso é arriscado e fora do escopo desta passada. Foco: arquivos que tocamos.

### Frente 3 — Disparo real plug-and-play quando módulo é conectado

**Diagnóstico:** Hoje, `useActiveControllers` + `AutoControllerLauncher` já mostra o card no canto inferior direito quando um device é reconhecido. Mas:
1. O card mostra **ARM/FIRE/E-STOP** mesmo se o dispositivo está em `LIVE READ-ONLY` mode ou se o transport é `NO_REAL_SENDER` (stub) — então o operador clica e nada dispara, sem feedback claro do **porquê**.
2. Não há um indicador visual de "✅ pronto pra disparo real" vs "⚠️ apenas leitura/stub" no card.
3. `PyroControllerCard` chama o caminho typed que passa pelo ARM gate; o E-STOP precisa ir pelo path direto `<50ms` — confirmar.
4. Se um módulo FXK16 entra online via BLE depois que a página já carregou, o launcher aparece — mas o `useFXK16Bridge` singleton pode não ter sido instanciado nessa rota → o card existe mas o "Test FIRE" não tem bridge ativa.

**Aprimoramentos:**
1. **Status de prontidão real no card** — adicionar um chip no topo de cada card:
   - 🟢 `LIVE` — pelo menos um link tem `realSender !== NO_REAL_SENDER` E `provenance.evidence_level === 'verified'`
   - 🟡 `READ-ONLY` — handshake OK mas sem sender real registrado
   - 🔴 `NO-OP` — stub/sim mode (clique só loga, não dispara)
   
   Calcular via `controller.device.links` cruzando com `transportSenderRegistry`.

2. **Auto-init das bridges** — quando um controller pyro vira "active", instanciar a bridge correspondente (`useFXK16Bridge`, `usePBusHardware`, etc.) automaticamente em background pra que o "Test FIRE" do card funcione sem precisar abrir a console route. Fazer isso via um `controllerBridgeAutoInit.ts` que escuta `useActiveControllers` e mantém uma `Map<aggregateId, BridgeHandle>`.

3. **Toast on-connect** — quando um device pyro/dmx/tuya passa para `online`, soltar um `toast.success("FXK16 #001 pronto · LIVE")` com botão "Abrir controle". Hoje só aparece o card silencioso no canto, fácil de não notar em telas grandes.

4. **E-STOP path validado** — confirmar em `PyroControllerCard.tsx` que o handler do botão E-STOP chama `safetyStateMachine.emergencyStop()` direto (path <50ms), **NÃO** a typed API (`createFxk16CommandApi.estop()`) que passa pelo ARM gate e adiciona latência.

5. **Persistir "auto-arm-on-connect = false" como default explícito** — adicionar uma flag `autoArmOnConnect` no `controllerRegistry` (default `false` pra **todos** os pyro kinds, conforme regra honest-hardware "nunca auto-arma"). Documentar visualmente no card.

### Arquivos que vou tocar
- `src/components/editor/AudioWaveform.tsx` (frente 1+2)
- `src/components/editor/SetlistPanel.tsx` (frente 2 — cleanup)
- `src/components/hardware/cards/PyroControllerCard.tsx` (frente 3 — chip + E-STOP path + bridge init)
- `src/components/hardware/cards/TuyaControllerCard.tsx` (frente 3 — chip)
- `src/components/hardware/cards/DmxControllerCard.tsx` (frente 3 — chip)
- `src/components/hardware/cards/GenericControllerCard.tsx` (frente 3 — chip)
- `src/components/hardware/AutoControllerLauncher.tsx` (frente 3 — toast on-connect)
- `src/core/discovery/controllerRegistry.ts` (frente 3 — flag autoArmOnConnect)
- **NOVO:** `src/core/hardware/controllerBridgeAutoInit.ts` (frente 3 — auto-init bridges)
- **NOVO:** `src/components/hardware/shared/LiveStatusChip.tsx` (frente 3 — chip reutilizável)

### Não vou tocar
- `src/integrations/supabase/*`, `_quarantine/safety/*`, `supabase/config.toml`
- O safety state machine em si — só consumo a API `emergencyStop()` que já existe
- Pipeline WebGPU / SkyCanvas (tema separado)
- Storage bucket `audio` (já existe e funciona)

### Resultado esperado
- No celular/desktop, clicar no ícone 📤 da trilha de áudio **abre o seletor de arquivos** com todos os formatos suportados.
- Re-selecionar o mesmo arquivo funciona.
- Plug um FXK16 USB/BLE → toast "FXK16 pronto · LIVE", card aparece com chip 🟢 LIVE, botão "Test FIRE" hold-800ms já funciona sem precisar abrir outra rota.
- Sem hardware real, o chip mostra 🔴 NO-OP e os botões ficam visualmente "desabilitados" (não escondidos — honest-hardware).

### Pergunta opcional
Você quer que o **toast de "device pronto"** seja **sempre exibido** quando um módulo conecta, ou só quando é a **primeira conexão da sessão** daquele aggregateId (evita spam se o link cair e voltar a cada 30s)? Default que vou aplicar: **só primeira conexão da sessão**.
