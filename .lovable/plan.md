

# Teste do Fluxo IFMx-i32Q + Firmware Arduino Nano (.ino)

## Verificação do Fluxo (Análise de Código)

O fluxo completo está **corretamente implementado**:

1. **Power On** → `safe_sense` (3s) → `ready` ✅
2. **ARM** → verifica lockout, ativa `firePowerOn` → `armed` ✅
3. **FIRE** → verifica armed + CDS/direct_relay → dispara → `firing` → volta `armed` ✅
4. **E-STOP** → desliga tudo, zera CDS, lockout 3s → `estop_lockout` → `idle` ✅
5. **Direct Relay mode** → bypass CDS voltage check, disparo instantâneo ✅
6. **Bridge reconnection** → atualiza callbacks dinamicamente se conectar após powerOn ✅

**Para testar na UI**: Abra o VirtualControllerHub → selecione "IFMx-i32Q Module" → na aba Módulo: Power ON → aguarde 3s (safe sense) → ARM → toque em ignitores para disparar → pressione E-STOP → verifique lockout de 3s.

## Firmware Arduino Nano (.ino)

Gerar arquivo downloadável completo com:
- Protocolo serial completo (FIRE, ESTOP, HEARTBEAT, VERSION, BATCH, CONT, STATUS)
- Suporte a 32 canais via 4x 74HC595 shift registers
- Leitura de continuidade via 2x CD4051 analog MUX + ADC
- Leitura de tensão da bateria via divisor resistivo no A7
- Comando BATCH para disparo por bitmask
- Safety: constrain duration 20-1000ms, E-STOP zera tudo
- Comentários em português + pin mapping completo

| Ação | Detalhe |
|------|---------|
| Gerar `/mnt/documents/FXK_Relay32_Firmware.ino` | Firmware completo ~80 linhas |
| Verificar rendering do arquivo | QA do conteúdo |

