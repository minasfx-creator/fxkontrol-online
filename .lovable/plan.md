## Objetivo
Eliminar do `MobileLinkMode.tsx` (XL4+ remote firing console) **todo** hardware simulado e qualquer uso de `Math.random()`. Após o round, o painel só reflete estado real do `FireOneController` (USB-CDC RS-485) — sem botão SIM, sem mock de baterias/RSSI/igniters, sem `createSimulatedModuleStatus`.

## Mudanças

### `src/components/editor/live-firing/MobileLinkMode.tsx`
1. **Imports**: remover `createSimulatedModuleStatus`. Adicionar gerador honesto de id de evento (`_evtSeq` monotônico) — substitui as 4 ocorrências de `Math.random().toString(36)` em `setEvents([...])`.
2. **`createDefaultModules()` → `EMPTY_MODULES`**: passa a retornar `[]`. Sem voltagem/RSSI/resistência/conexão sintéticas. O state `modules` arranca vazio (a menos que `localStorage[MODULES_KEY]` já tenha dado real persistido pelo operador).
3. **State `hwSimulated` REMOVIDO** (`useState` + setter + dependency arrays).
4. **Handlers**: remover branch `if (hwSimulated) { ... }` em `handleHwScan`, `handleHwFire`, `handleHwArmModule`, `handleHwEmergencyStop`, `handleHwContinuity`. Cada handler passa a executar **apenas** o caminho real (`fireoneRef.current.*`); se `!hwConnected`, mostra `toast.error('Hardware FireOne desconectado — conecte via USB.')` e retorna sem efeito colateral.
5. **UI Hardware Serial Mode (linhas ~960–995)**:
   - Remover botão "SIM" e badge `(Simulado)` / `Modo simulação ativo`.
   - Estado conectado/desconectado lê só `hwConnected`. Texto "○ Desconectado" / "● Conectado · 9600 8N1".
   - Empty-state passa a ser `'Conecte o hardware FireOne via USB para descobrir módulos'`.
6. **Continuity refresh (linha 917)**: troca `setModules(createDefaultModules())` por `setModules([])` (limpa cache local; só reaparece via dado real persistido).
7. **`handleHwFire` mock-fallback**: deletar `broadcastModuleFire(modAddr, igniterPos, 'HW-...')` no caminho simulado (já some com #4).

### Guard test
**Editar `src/__tests__/mocksErradicated.guard.spec.ts`** (já existe — adicionar bloco):
- `MobileLinkMode.tsx` **não** pode conter `Math.random`, `hwSimulated`, `createSimulatedModuleStatus`, `MOCK_`, ou as strings `'Modo simulação'` / `'Simulado'`.
- Falha o build se reaparecer.

### Smoke test novo
**`src/__tests__/mobileLinkModeHonest.spec.tsx`** (~50 linhas, RTL):
- Render em modo `xl4Mode='hardware'` com `hwConnected=false`: empty-state mostra "Conecte o hardware FireOne via USB" e **não** existe botão "SIM" no DOM.
- `modules` state arranca `[]` quando `localStorage[MODULES_KEY]` está limpo (sem 6 módulos sintéticos).
- `handleHwFire` chamado sem conexão dispara toast de erro e não muta `hwModules`.

## Arquivos
**Editados (3)**: `src/components/editor/live-firing/MobileLinkMode.tsx`, `src/__tests__/mocksErradicated.guard.spec.ts`.
**Criado (1)**: `src/__tests__/mobileLinkModeHonest.spec.tsx`.

## Critérios de aceite
- `rg "Math.random|hwSimulated|createSimulatedModuleStatus" src/components/editor/live-firing/MobileLinkMode.tsx` → **zero matches**.
- Tab "Hardware" do MobileLinkMode mostra apenas connect/disconnect reais; sem SIM, sem dados sintéticos.
- Suite verde + 2 specs novos passam.
- Zero impacto em `uiCommandGateway`, `SafetyStateMachine`, `workMode`, FireOneController, ou outros painéis.

## Fora de escopo
- Migrar handlers FireOne pra `uiCommandGateway` (auditoria honesty rodada futura).
- Hub `/dev/fxk32q` + DevIndex card.
- Limpeza dos demais painéis em `live-firing/` (XL43RemoteMode, FXKMobileMode, etc.) — ronda própria.
