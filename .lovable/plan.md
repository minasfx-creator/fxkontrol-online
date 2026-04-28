# Firmware FXK16 (ESP32-S3 v1.3 + Relé 16ch) + Reconhecimento no Sistema

Vou entregar **dois pacotes** complementares: (1) o firmware real para o ESP32-S3 (Arduino IDE / PlatformIO) compatível com o bridge ASCII já usado pelo FXK (`FireOneHardwareBridge`), e (2) o registro do módulo "FXK16 — 16ch" no app, para que apareça automaticamente nas listas de seleção de hardware, addressing e ShowPlan.

## Mapeamento de pinos (conforme solicitado: C1→Relé1, C2→Relé2, …)

Mapeamento default ESP32-S3 v1.3 → módulo de 16 relés (ativo-baixo, padrão dos boards de 16 relés JQC-3FF/Songle). Pinos escolhidos para evitar strapping pins (0, 3, 45, 46) e o boot button (GPIO0):

```text
Canal  ESP32-S3 GPIO   Canal  ESP32-S3 GPIO
C1  ->  GPIO 4         C9   -> GPIO 17
C2  ->  GPIO 5         C10  -> GPIO 18
C3  ->  GPIO 6         C11  -> GPIO 8
C4  ->  GPIO 7         C12  -> GPIO 9
C5  ->  GPIO 15        C13  -> GPIO 10
C6  ->  GPIO 16        C14  -> GPIO 11
C7  ->  GPIO 35        C15  -> GPIO 12
C8  ->  GPIO 36        C16  -> GPIO 13
```

Constantes ficam no topo do `.ino` em um `const uint8_t RELAY_PINS[16] = {...}` para fácil ajuste sem tocar a lógica. LED on-board (GPIO 48) usado como heartbeat. ESTOP físico opcional em GPIO 14 (INPUT_PULLUP, ativa em LOW).

## Arquivos novos

```text
firmware/fxk16-esp32s3/
  README.md                    # pinout, flashing, flags de segurança
  platformio.ini               # board = esp32-s3-devkitc-1, framework arduino
  src/
    main.ino                   # entry, setup() / loop()
    fxk16_protocol.h/.cpp      # parser ASCII compatível com FireOneHardwareBridge
    fxk16_relay.h/.cpp         # driver dos 16 relés + safety (estop, watchdog)
    fxk16_continuity.h/.cpp    # leitura de continuidade (ADC stub, opcional)
    fxk16_config.h             # MODEL, CHANNELS, FW_VERSION, BLE_NAME_PREFIX
```

## Comportamento do firmware

- **Identificação**: anuncia BLE com nome `FXK16-<MAC6>` (prefixo `FXK` já é varrido pelo bridge em `src/lib/fireoneModuleHardwareBridge.ts:376`) e expõe o serviço UART `0000ffe0/ffe1/ffe2` (já esperado pelo bridge).
- **Transporte**: USB-CDC (Serial @ 115200) e BLE simultaneamente. Mesmo parser ASCII usado em ambos.
- **Protocolo ASCII** (compatível 1:1 com o contrato em `fireoneModuleHardwareBridge.ts` linhas 12–22):
  - `HEARTBEAT\n` → `PONG\n`
  - `VERSION\n` → `VER:FXK16-1.0.0\n` *(o bridge popula `firmwareVersion`)*
  - `STATUS\n` → `BAT:<v>;PINS:<mask16>;RSSI:<dbm>;MODEL:FXK16;CH:16\n` *(novos tokens `MODEL` e `CH` — bridge ignora os desconhecidos hoje, mas vamos passar a lê-los — ver §"Mudanças no app")*
  - `FIRE:<pin>:<ms>\n` → fecha relé `RELAY_PINS[pin-1]` por `ms`, responde `OK:FIRE:<pin>\n`. Bloqueia se ESTOP latched, se `pin` fora de `[1..16]` ou se `ms` > 5000 → `ERR:FIRE:<pin>:<reason>\n`.
  - `BATCH:<mask16>:<ms>\n` → dispara múltiplos canais por bitmask, responde `OK:BATCH:<mask16>\n`.
  - `GPIO:<pin>:HIGH|LOW\n` → controle direto (apenas se `dev_unsafe_gpio` jumper em LOW; senão `ERR:GPIO:LOCKED`).
  - `CONT:<pin>\n` → `CONT:<pin>:<ohms>\n` (stub: 9999 se sem hardware de leitura).
  - `CDS:<pin>\n` → `CDS:<pin>:<volts>\n` (stub).
  - `ESTOP\n` → corta todos os relés, latch lockout até reset de energia ou comando `RESET\n`. Responde `OK:ESTOP\n`.
- **Safety guards** (gravados no firmware, não dependem do host):
  - Watchdog de hardware (TWDT) 2 s rearmado no loop.
  - Pulse limiter por canal: máximo 5000 ms; auto-open do relé garantido por timer FreeRTOS independente do parser (se host travar, relé abre).
  - Contador de FIRE/canal persistido em NVS para auditoria.
  - Boot state: todos os pinos `OUTPUT` + `digitalWrite(HIGH)` (relés ativos-baixo = abertos) **antes** de habilitar o transporte.

## Mudanças no app (reconhecimento)

Pequenas, cirúrgicas, sem refatorar:

1. **`src/store/useAddressingStore.ts`** — acrescentar entrada em `DEFAULT_MODULE_SPECS`:
   ```ts
   { id: 'fxk16', name: 'FXK16 — 16ch (ESP32-S3)', slatCount: 1, pinsPerSlat: 16, firingSystem: 'Default' },
   ```
2. **`src/core/showplan/ShowPlan.ts`** — ampliar a union `HardwareModuleConfig.type` para incluir `'fxk16-esp32s3'` e documentar `channelCount: 16`.
3. **`src/core/hardware/adapters/`** — criar `FXK16ModuleAdapter.ts` (espelha `RelayBankAdapter32.ts` mas com `maxChannels: 16`, `label: 'FXK16 — 16ch ESP32-S3'`, `protocols: ['serial-115200', 'ble-uart', 'usb-cdc']`). Registrar em `UnifiedHardwareRegistry.ts` ao lado do `relayBankAdapter`.
4. **`src/lib/fireoneModuleHardwareBridge.ts`** — no parser de tokens (linha 1031), aceitar e expor:
   - `MODEL:<str>` → guarda em `this.deviceModel` e dispara `onEvent('module_model', model)`.
   - `CH:<n>` → guarda em `this.channelCount`.
   Inclui ambos no objeto retornado por `getStatus()` ao lado de `firmwareVersion`. Permite ao registry promover o adapter genérico para `FXK16ModuleAdapter` quando o handshake retornar `MODEL:FXK16`.
5. **Sem mudanças** em timeline, UI principal, engine 3D, exporters ou safety state machine.

## Critérios de aceite

- Plugar o ESP32-S3 via USB e abrir `/dev/real-discovery`: aparece como `FXK16-<MAC6>` no transport `serial`, com `MODEL: FXK16` e `Channels: 16` no painel.
- Em Addressing Panel, o módulo "FXK16 — 16ch (ESP32-S3)" aparece no dropdown de specs.
- `FIRE:1:50` no console serial fecha o relé conectado a GPIO 4 por 50 ms e responde `OK:FIRE:1`.
- Comando `ESTOP` abre todos os 16 relés em < 50 ms (medido via osciloscópio ou GPIO logger) e mantém latch.
- Build do app sem erros TS; testes existentes do bridge continuam passando.

## Detalhes técnicos (resumo)

- Toolchain: Arduino-ESP32 core ≥ 3.0 (IDF 5.1) — necessário para BLE `NimBLE` ou `BLEDevice` UART nativo no S3.
- `platformio.ini` define `board = esp32-s3-devkitc-1`, `monitor_speed = 115200`, `lib_deps = h2zero/NimBLE-Arduino`.
- O parser é byte-stream (`\n` terminator) com buffer de 128 B; mesma forma que o bridge consome (`responseBuffer.split('\n')`, linha 1018).
- Identificação `MODEL:FXK16` é o único token novo no contrato — backward compatible: bridges antigos simplesmente ignoram.
- Nenhum segredo / NVS sensível é gravado pelo firmware nesta versão (AES PSK fica para um próximo passo se quiser endurecer).

Após sua aprovação, eu crio o diretório `firmware/fxk16-esp32s3/` com todos os arquivos acima e aplico as 4 mudanças no app.
