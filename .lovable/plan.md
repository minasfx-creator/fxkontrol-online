

# Simulação Condições Adversas — Starlink + XL4 Real vs Virtual

## Objetivo

Script Python que simula o mesmo show (50 módulos, 420 cues, 12 min) sob **condições adversas severas** e compara os resultados com os **specs reais do XL4 XLII+** e módulos IFMx-i32Q.

## Condições Adversas Simuladas

| Condição | Efeito no Transporte |
|----------|---------------------|
| **Vento forte (40 km/h + rajadas 60 km/h)** | +30% jitter em RF, +15% packet loss rádio 433MHz |
| **Chuva forte (>25mm/h)** | Degradação Starlink: +80ms latência, +5% packet loss, handoff 4× mais frequente |
| **Interferência RF (50 módulos simultâneos)** | Colisões no canal 433MHz: +40% packet loss, +20ms latência base no rádio |
| **Temperatura ambiente 38°C** | Drift de clock: +2ms jitter nos módulos |

## Comparação XL4 Real vs Virtual

Baseado nos specs reais extraídos do código (`fireoneProtocol.ts`):

| Parâmetro | XL4 XLII+ Real | XL4 Virtual (App) |
|-----------|----------------|-------------------|
| Max módulos | 40 (2×20 outputs) | 50 (software) |
| Baud rate RS-485 | 9600 8N1 | 9600 8N1 (idêntico) |
| Fire duration | 20–1000ms | 20–1000ms (clamped) |
| E-STOP | Broadcast 0x58 hardwired | 0x45 multi-path |
| Protocolo | [STX][ADDR][CMD][PAYLOAD][CHK][ETX] | Idêntico |
| UltraFire | 8 fire file slots | Suportado |
| Priority groups | 16 | 16 |
| Transporte | Cabo RS-485 only | RS-485 + Radio + Wi-Fi + Starlink |

## Métricas do Relatório

- Confiabilidade por transporte (normal vs adverso)
- Latência P95/P99 comparada com limites NFPA 1123
- E-STOP worst-case sob interferência RF
- Taxa de retry e pacotes perdidos irrecuperáveis
- Veredicto: qual cenário passa/reprova para operação real
- Recomendação operacional para shows em condições adversas

## Artefatos

| Arquivo | Conteúdo |
|---------|----------|
| `FXK_Adverse_Simulation_Report.pdf` | Relatório comparativo completo com tabelas e veredicto |
| `FXK_Adverse_Simulation.json` | Dados brutos |

## Implementação

1. Script Python com perfis de transporte degradados (vento/chuva/RF)
2. Modelo de colisão RF para 50 módulos simultâneos no canal 433MHz
3. Modelo de degradação Starlink por chuva (baseado em dados públicos de atenuação Ka-band)
4. Tabela comparativa XL4 Real vs Virtual com specs do `fireoneProtocol.ts`
5. Veredicto NFPA 1123 por cenário (normal vs adverso)

