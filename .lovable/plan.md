# Cards diretos para Tuya e DMX no Auto-Controller Launcher

Hoje, quando um Tuya, ENTTEC, FTDI/CH340/CP210x ou Art-Net node fica online, o overlay mostra apenas um botão genérico "Abrir controle". Vamos substituir por **ações inline** que executam de fato — respeitando a política honest-hardware (nada de botão fake; se não houver caminho real, o botão fica desabilitado com tooltip explicando).

## Comportamento por tipo

### Tuya / CubeMesh (smart outlets)
- **ON** e **OFF** por dispositivo (sem ARM — não é safety-critical, latência 200–800 ms já documentada).
- Hold-to-Confirm **400 ms** (mais leve que pyro) para evitar toque acidental.
- **ALL OFF** vermelho (envia OFF para todos os outlets Tuya/CubeMesh online).
- Badge amarelo "LOW-PRECISION" para reforçar que não serve para pyro.
- Como hoje não há `tuya-control` edge function nem bridge real, os botões chamam um adapter `tuyaOutletControl.ts` novo que:
  - Se houver `link.transport === 'webble'` ativo → escreve no characteristic Tuya BLE-mesh já mapeado em `WebBleDiscoverer`.
  - Caso contrário → mostra toast `NO_REAL_SENDER — pareie via /pairing/ble` e mantém o botão visualmente "armed-but-blocked" (cinza, não verde fake).

### ENTTEC / DMX-generic / Art-Net node
- **BLACKOUT** (vermelho, ação primária): chama `dmxUniverseManager.blackout(universe)` para o universo associado ao device, ou `blackoutAll()` se desconhecido.
- **HOLD ON 100%**: snapshot temporário 255 em todos os canais por 1 s (útil para teste de conexão), via `setChannels` + `flush({ critical: true })`.
- **PING / ArtPoll** para Art-Net node (`artnetModuleService.ping(ip)`), com badge mostrando RTT da última sondagem.
- Sem ARM (DMX não tem estado armado por protocolo).
- Multi-universo: se o device declarar `links[t].universes`, mostra um seletor compacto.

### Pyro (FXK16 / FireOne / Showven) — **inalterado**
Continua exatamente como está hoje (ARM hold-800ms, TEST CH1, E-STOP, Console).

## Estrutura de código

```text
src/components/hardware/
  AutoControllerLauncher.tsx        (refator: roteia por kind)
  cards/
    PyroControllerCard.tsx          (extraído do arquivo atual)
    TuyaControllerCard.tsx          (novo)
    DmxControllerCard.tsx           (novo — ENTTEC + dmx-generic + artnet-node)
    GenericControllerCard.tsx       (mantido p/ kind 'unknown' fallback)
  shared/
    HoldToConfirmButton.tsx         (novo — utilitário reaproveitável,
                                     extrai a lógica hold já duplicada)

src/core/hardware/
  tuyaOutletControl.ts              (novo adapter honest-hardware)
  dmxQuickActions.ts                (novo wrapper sobre DMXUniverseManager
                                     + ArtNetBridge para blackout/hold)
```

`controllerRegistry.ts` ganha:
- `capabilities.quickActions: Array<'on'|'off'|'blackout'|'hold-on'|'ping'|'all-off'>` para o card saber o que renderizar sem switch interno gigante.

## Arquivos editados

- `src/components/hardware/AutoControllerLauncher.tsx` — remove `GenericControllerCard` inline; passa a importar e rotear via `kind`.
- `src/core/discovery/controllerRegistry.ts` — adiciona `quickActions` em cada profile.
- `src/hooks/useActiveControllers.ts` — sem mudança funcional (apenas re-exporta `kind` se necessário).

## Detalhes técnicos relevantes

- **Política honest-hardware preservada**: nenhum card "simula" sucesso. Se o transport real não está disponível (`NO_REAL_SENDER`), o botão renderiza desabilitado + tooltip `Pareie pelo wizard primeiro`.
- **Memory hygiene**: timers do hold em `useRef`, limpos em `onMouseUp` / `onTouchEnd` / `onMouseLeave` / unmount.
- **Critical send**: blackout DMX usa `flush({ critical: true })` para bypass do rate-cap 33 PPS (já suportado em `ArtNetBridge`).
- **A11y**: cada card mantém `role="region"` + `aria-label`; ações destrutivas marcam `aria-pressed` durante hold.
- **Telemetria**: cada execução loga em `blackbox.record('cmd', …)` para o black-box 100 ms já existente.
- **Restrição UI**: nenhum botão é colocado dentro de `CollapsibleTrigger` (regra Radix).

## Não-objetivos

- Não cria UI nova fora do overlay.
- Não modifica `useFXK16Commands`, `DeviceAggregator` nem o pairing wizard.
- Não adiciona nova edge function Tuya — se faltar, o card é honesto sobre isso.
- Não mexe na ordem de empilhamento nem no posicionamento (continua bottom-right, vertical).
