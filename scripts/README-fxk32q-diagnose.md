# FXK32Q Diagnostic CLI

Bench-only diagnostic. Sends `VERSION → STATUS → ARM → FIRE → BATCH → STATUS → DISARM`
to a FXK32Q module via any of its 6 transports and prints the raw replies.

> ⚠️ **Não use em show real.** O firmware tem ARM gate próprio (v1.1+), mas
> este script é para **bancada**. O caminho operacional canônico é o app via
> `uiCommandGateway`.

## Install peers (sob demanda)

```sh
# USB-CDC e RS-485
npm i -D serialport

# WebSocket
npm i -D ws

# BLE (Linux: requer libcap/setcap)
npm i -D @abandonware/noble
```

`dgram`/`net` são built-ins do Node — Art-Net e Wi-Fi TCP funcionam sem deps extras.

## Exemplos

```sh
# USB-CDC, canal 5, 80ms
node scripts/fxk32q-diagnose.mjs --transport=usb --port=/dev/ttyACM0 --channel=5 --duration=80

# RS-485 XLII+ slave addr=3
node scripts/fxk32q-diagnose.mjs --transport=rs485 --port=/dev/ttyUSB0 --addr=3

# Wi-Fi TCP raw
node scripts/fxk32q-diagnose.mjs --transport=wifi --host=192.168.4.1 --tcp=23

# WebSocket
node scripts/fxk32q-diagnose.mjs --transport=ws --url=ws://192.168.4.1:81

# Art-Net (univ 0, start ch 1, ch 7@255 por 100ms)
node scripts/fxk32q-diagnose.mjs --transport=artnet --host=192.168.4.1 --universe=0 --start=1 --channel=7

# BLE (scaneia "FXK32Q")
node scripts/fxk32q-diagnose.mjs --transport=ble

# Tudo de uma vez (pula o que faltar config)
node scripts/fxk32q-diagnose.mjs --transport=all --port=/dev/ttyACM0 --host=192.168.4.1

# Só handshake, sem disparar nada
node scripts/fxk32q-diagnose.mjs --transport=usb --port=/dev/ttyACM0 --no-fire
```

## Flags

| Flag           | Default | Descrição                              |
| -------------- | ------- | -------------------------------------- |
| `--transport`  | `usb`   | usb \| ble \| wifi \| ws \| artnet \| rs485 \| all |
| `--port`       | —       | path serial (USB/RS-485)                |
| `--baud`       | 115200  | só USB                                 |
| `--addr`       | 1       | endereço RS-485 XLII+ (1..40)          |
| `--host`       | —       | IP (Wi-Fi/Art-Net)                     |
| `--tcp`        | 23      | porta TCP (Wi-Fi)                      |
| `--url`        | —       | ws://… (WebSocket)                     |
| `--universe`   | 0       | Art-Net universe                       |
| `--start`      | 1       | DMX start channel                      |
| `--channel`    | 1       | canal alvo (1..32)                     |
| `--duration`   | 100     | pulso em ms                            |
| `--mask`       | 0x3     | máscara 32-bit p/ BATCH                |
| `--no-fire`    | off     | só handshake (VERSION/STATUS/ARM/DISARM)|
| `--name`       | FXK32Q  | nome BLE alvo                          |
