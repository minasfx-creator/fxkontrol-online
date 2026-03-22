

# Simplificação Hardware: Celular + Bateria 12V + Placa 32 Relés + Adaptador USB-C OTG

## Conceito Simplificado

O sistema atual assume ESP32 + Shift Registers + ULN2803 + MOSFETs + Capacitores — componentes demais. O usuário quer o setup mais simples possível:

```text
┌──────────────┐    USB-C OTG     ┌────────────────────┐    12V    ┌──────────┐
│  CELULAR     │ ──────────────── │ Placa 32ch Relé    │ ◄─────── │ Bateria  │
│  (FX Kontrol)│   Adaptador     │ (ex: SainSmart)    │          │ 12V 7Ah  │
│              │   USB→Serial    │ IN1-IN32 → Relé    │──── E-matches
└──────────────┘                 │ COM → 12V+         │
                                 │ NO → Ignitor       │
                                 └────────────────────┘
```

**Diferença chave:** Sem ESP32. O celular conecta DIRETO via USB-C OTG + adaptador USB-Serial (CH340/CP2102) à placa de 32 relés. O adaptador USB-Serial custa ~$2 e o celular envia comandos seriais direto.

**Componentes ($15-20 total):**
- Placa 32 canais relé (~$10) — já tem optoisoladores
- Adaptador USB-C OTG ($1)  
- Conversor USB-Serial CH340 ($2)
- Bateria 12V 7Ah selada ($5-8) — ou LiPo 3S

## Mudanças

### 1. `fireoneModuleHardwareBridge.ts` — Adicionar modo "Direct Serial Relay"

Novo método `connectDirectRelay()` que usa WebSerial para falar direto com CH340/CP2102 sem precisar de ESP32 firmware. O celular controla os pinos do conversor serial diretamente:
- Protocolo simplificado: enviar bytes que representam estado dos 32 relés
- Usar DTR/RTS toggling do serial para controle básico, ou protocolo de 4 bytes (header + pin + state + checksum)
- Sem necessidade de firmware — o adaptador USB-Serial apenas roteia sinais

**Alternativa realista:** Como CH340 só tem 2 pinos de controle (DTR/RTS), precisamos de um Arduino Nano ($3) como intermediário simples entre USB e os 32 relés. O firmware é trivial (~20 linhas).

### 2. `fireoneModuleEmulator.ts` — Remover dependência de CDS

- Substituir lógica CDS (capacitive discharge) por "direct relay" mode
- Quando `hardwareMode === 'direct_relay'`: sem simulação de carga de capacitor, disparo é instantâneo via relé
- Bateria 12V alimenta diretamente os relés → ignitor (sem CDS intermediário)
- Simplificar `IgniterChannel` para não exigir `cdsVoltage` no modo direto

### 3. `VirtualIFMx32QPanel.tsx` — Atualizar aba Hardware

- Novo esquemático simplificado mostrando: Celular → USB-C OTG → CH340 → Arduino Nano → Placa 32 Relés → Bateria 12V
- Lista de componentes atualizada (~$15-20)
- Diagrama de fiação simples
- Instruções passo-a-passo de montagem
- Firmware Arduino Nano (20 linhas) embutido no painel

### 4. `useFireOneModuleMode.ts` — Adicionar `connectDirectRelay()`

Expor novo método de conexão direta ao relé board via USB OTG.

## Arquitetura Final

```text
CELULAR (FX Kontrol app)
  │ USB-C OTG
  ▼
Adaptador USB-Serial (CH340)
  │ TX/RX (115200 baud)
  ▼
Arduino Nano ($3) — firmware 20 linhas
  │ Digital pins D2-D9 + A0-A5 (via shift register 74HC595 x4)
  │ OU: 2x MCP23017 (I2C GPIO expander = 32 pins com 2 chips)
  ▼
Placa 32 Relés (5V logic, 12V switching)
  │ COM ← Bateria 12V+
  │ NO → E-match → GND bateria
  ▼
DISPARO REAL
```

| Arquivo | Mudança |
|---------|---------|
| `src/lib/fireoneModuleHardwareBridge.ts` | Add `connectDirectRelay()`, simplified serial protocol |
| `src/lib/fireoneModuleEmulator.ts` | Add `direct_relay` hardware mode, bypass CDS |
| `src/components/editor/live-firing/VirtualIFMx32QPanel.tsx` | Updated hardware tab with simplified schematic + Arduino Nano firmware |
| `src/hooks/useFireOneModuleMode.ts` | Expose `connectDirectRelay()` |

