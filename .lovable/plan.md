

# Teste de Detonação: 50 Módulos × 3 Venues × 3 Transportes

## Objetivo
Criar uma página de **Show Test Simulator** que executa testes simulados de disparo com 50 módulos FXK-M1 em 3 venues (Copacabana, Vitória, Liuyang/China), medindo performance real de cada transporte (LAN, WAN, Relay) e sistema híbrido. Gera relatório visual com métricas de latência, throughput, jitter, E-STOP response time e packet loss.

## Venues de Teste
| Venue | GPS | Distância do Servidor | Cenário |
|---|---|---|---|
| Copacabana, RJ | -22.97, -43.18 | ~20ms (Brasil) | Réveillon — 50 módulos em 2km de praia |
| Vitória, ES | -20.32, -40.29 | ~25ms (Brasil) | Show portuário — 50 módulos em área compacta |
| Liuyang, China | 28.15, 113.63 | ~280ms (intercontinental) | Fábrica de fogos — teste extremo WAN |

## Simulação por Transporte
Para cada venue, simula 50 módulos com show de 420 cues em 12 minutos:
- **LAN (UDP Art-Net)**: Latência base ~3ms, jitter ~0.5ms
- **WAN (Direct IP)**: Latência proporcional à distância + overhead TLS
- **Relay (WebSocket)**: Latência WAN + overhead relay (~15ms)
- **Híbrido**: 30 módulos LAN + 15 WAN + 5 Relay — calcula média ponderada

## Métricas Coletadas
- Latência média/min/max/p95/p99
- Jitter (desvio padrão)
- Throughput (packets/sec)
- Packet loss rate
- E-STOP response time
- Sync accuracy (δt entre primeiro e último módulo)
- Compliance NFPA 1123 (E-STOP < 50ms)

## Implementação

### 1. Criar `src/pages/ShowTestSimulator.tsx`
- Página fullscreen com dashboard de resultados
- Botão "DETONAR SHOW" que inicia simulação
- Cards por venue com barra de progresso
- Tabela comparativa final dos transportes
- Gráficos de latência (sparklines) usando divs estilizados

### 2. Criar `src/services/showTestEngine.ts`
- Motor de simulação que gera 50 módulos por venue
- Dispara chamadas reais ao `artnet-bridge` edge function (action: 'send') para medir latência real do edge function
- Adiciona latência simulada de rede por cenário geográfico
- Calcula todas as métricas estatísticas
- Gera timeline de eventos (420 cues distribuídos em 12 min)

### 3. Estrutura do Resultado
```text
┌─────────────────────────────────────────────────────┐
│  SHOW TEST REPORT — 50 MODULES × 3 VENUES          │
├──────────┬─────────┬──────────┬──────────┬──────────┤
│ Venue    │ LAN     │ WAN      │ RELAY    │ HYBRID   │
├──────────┼─────────┼──────────┼──────────┼──────────┤
│ COPA     │ 3.2ms   │ 22.1ms   │ 38.4ms   │ 12.5ms   │
│ VITÓRIA  │ 3.1ms   │ 26.3ms   │ 41.7ms   │ 14.2ms   │
│ LIUYANG  │ 3.0ms   │ 283.5ms  │ 298.1ms  │ 95.3ms   │
├──────────┼─────────┼──────────┼──────────┼──────────┤
│ E-STOP   │ <5ms    │ <30ms    │ <45ms    │ <15ms    │
│ NFPA1123 │ ✅ PASS │ ✅ PASS  │ ✅ PASS  │ ✅ PASS  │
└──────────┴─────────┴──────────┴──────────┴──────────┘
```

### 4. Adicionar rota `/show-test` no App.tsx

## Arquivos
1. **Novo**: `src/services/showTestEngine.ts` — motor de simulação + métricas
2. **Novo**: `src/pages/ShowTestSimulator.tsx` — UI do dashboard de teste
3. **Editar**: `src/App.tsx` — adicionar rota `/show-test`

