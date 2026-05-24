# FXK32Q — Mapa Art-Net / sACN

O FXK32Q escuta dois protocolos DMX-over-IP **simultâneos** no universo configurado por `SET_ARTNET:<universe>:<startCh>`:

| Protocolo | Porta UDP | Header             | Universo (BE / LE)  |
|-----------|----------:|--------------------|---------------------|
| Art-Net   | 6454      | `Art-Net\0` + 0x5000 | LE (bytes 14..15)   |
| sACN E1.31| 5568      | E1.31 framing root | BE (bytes 113..114) |

## Mapeamento canal → relé

```
Relé Cn (n=1..32)  ←  DMX[startCh + n - 1]
                     onde startCh ∈ [1..481] (limite = 513 - 32)
```

Exemplo: `SET_ARTNET:1:65` no universo 1 → C1 = DMX 65, C32 = DMX 96.

## Threshold de disparo

```
DMX[idx] >= ARTNET_FIRE_THRESHOLD (128)  →  firePin(n, 100ms)
DMX[idx] <  ARTNET_FIRE_THRESHOLD        →  rearma borda (canal pronto p/ próximo pulso)
```

A duração do pulso DMX-driven é fixa em **100 ms** para parity com IFMx-i32Q. Para pulsos diferentes, use o caminho ASCII (`FIRE:<n>:<ms>`) ou RS-485 (cmd `0x46` com payload `[pin][ms_hi][ms_lo]`).

## Comportamento de borda

- O firmware lembra o estado anterior de cada canal (`s_armedDmx[ch]`).
- Um disparo só ocorre na **borda de subida** (DMX < 128 → ≥ 128).
- O canal volta a estar "pronto" quando o valor cai abaixo do threshold.
- Isso evita que um valor sustentado em 255 dispare 33 vezes/segundo.

## Compatibilidade Showven / FireOne

- IFMx-i32Q: comportamento idêntico (threshold 128, pulso 100ms).
- ArtNetBridge do app FX Kontrol: já envia `sendDmx(universe, bytes)` com 512 slots — o módulo aceita sem ajuste.
- sACN do GrandMA, MagicQ, etc.: aceitos no universo configurado.
