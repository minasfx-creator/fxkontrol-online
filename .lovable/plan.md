

# IFMx-i32Q — Setup Simplificado: Celular + Bateria 12V + Placa 32 Relés

## Arquitetura Atual

```text
CELULAR (FX Kontrol) → USB-C OTG → CH340 → Arduino Nano → 4x 74HC595 → Placa 32 Relés → Bateria 12V → E-matches
```

## Hardware Mode: `direct_relay`
- Sem CDS (capacitive discharge) — relé fecha circuito direto da bateria 12V ao ignitor
- Canais ficam "carregados" instantaneamente (sem simulação de carga)
- Protocolo serial: `FIRE:pin:ms\n` → `OK:FIRE:pin\n`

## Componentes (~$15-20)
- Placa 32ch Relé ($10)
- USB-C OTG ($1)
- CH340 USB-Serial ($2)
- Arduino Nano ($3)
- Bateria 12V 7Ah ($5-8)

## Bugs Corrigidos
- ✅ Pin 31 bitshift overflow (`>>> 0`)
- ✅ E-STOP lockout 3s
- ✅ fireGroup sequencial (2ms stagger)
- ✅ Bridge reconnection após powerOn
- ✅ bridgeStatus polling 1s

## Modos de Disparo Implementados
- ✅ Manual, Semi-Auto, Auto (Timecode), UltraFire, Preset

## Conexões Disponíveis
- BLE, USB (ESP32), Wi-Fi (WebSocket), **Direct Relay (USB OTG)**


