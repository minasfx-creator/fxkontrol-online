# FXK32Q — Pinmap canônico (32 canais)

Tabela mantida em sincronia compile-time com `src/fxk32q_pinmap.h` via `static_assert`. Qualquer alteração nesta tabela exige atualização do header **no mesmo commit**.

## Banco A (placa de relé #1, IN1..IN16)

| Canal | GPIO | Terminal |
|------:|:-----|:---------|
|  C1   |  4   | A:IN1    |
|  C2   |  5   | A:IN2    |
|  C3   |  6   | A:IN3    |
|  C4   |  7   | A:IN4    |
|  C5   | 15   | A:IN5    |
|  C6   | 16   | A:IN6    |
|  C7   | 35   | A:IN7    |
|  C8   | 36   | A:IN8    |
|  C9   | 17   | A:IN9    |
|  C10  | 18   | A:IN10   |
|  C11  |  8   | A:IN11   |
|  C12  |  9   | A:IN12   |
|  C13  | 10   | A:IN13   |
|  C14  | 11   | A:IN14   |
|  C15  | 12   | A:IN15   |
|  C16  | 13   | A:IN16   |

## Banco B (placa de relé #2, IN1..IN16 → canais C17..C32)

| Canal | GPIO | Terminal |
|------:|:-----|:---------|
|  C17  | 38   | B:IN1    |
|  C18  | 39   | B:IN2    |
|  C19  | 40   | B:IN3    |
|  C20  | 41   | B:IN4    |
|  C21  | 42   | B:IN5    |
|  C22  | 47   | B:IN6    |
|  C23  |  1   | B:IN7    |
|  C24  |  2   | B:IN8    |
|  C25  | 37   | B:IN9    |
|  C26  | 33   | B:IN10   |
|  C27  | 34   | B:IN11   |
|  C28  | 45   | B:IN12   |
|  C29  | 46   | B:IN13   |
|  C30  | 48   | B:IN14   |
|  C31  | 21   | B:IN15   |
|  C32  | 14   | B:IN16   |

> No protótipo DevKitC-1, GPIOs 14/21/48 também acumulam funções de E-STOP, jumper UNSAFE e LED heartbeat. Na placa final, mover essas funções para GPIOs dedicados (free headers do S3) e liberar C30..C32 100% para os relés.

## Pinos auxiliares

| Função              | GPIO | Notas                              |
|---------------------|:----:|-------------------------------------|
| LED heartbeat       | 48   | RGB on-board                        |
| ESTOP físico        | 14   | INPUT_PULLUP, ativo LOW             |
| Jumper UNSAFE       | 21   | INPUT_PULLUP, LOW libera GPIO raw   |
| RS-485 TX           | 43   | UART1 TX                            |
| RS-485 RX           | 44   | UART1 RX                            |
| RS-485 DE/RE        |  3   | OUTPUT, HIGH=TX / LOW=RX            |
