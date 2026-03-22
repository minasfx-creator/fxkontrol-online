

# Simulação Real de Show — 50 Módulos × 12 min × 3 Transportes

## O que será feito

Script Python que simula um show pirotécnico completo com parâmetros realistas e gera relatório PDF + JSON com análise comparativa dos 3 transportes.

## Parâmetros da Simulação

- **1 Mobile** atuando como XL4 Virtual (controller)
- **50 módulos** de campo (1600 ignitores)
- **~420 cues** em 4 fases: Opening → Build → Climax → Finale (barrage)
- **12 minutos** de show
- **3 transportes simultâneos**: Art-Net (UDP), Wi-Fi Direct (WS + AES-128-GCM), Radio (CC1101 433MHz)

## Métricas Analisadas

| Métrica | Descrição |
|---------|-----------|
| Confiabilidade | % de disparos entregues com sucesso |
| Latência | min/avg/median/P95/P99/max por transporte |
| Jitter (σ) | Variação de latência |
| Throughput | kbps efetivo durante o show |
| Burst handling | Performance em barragens densas (finale) |
| E-STOP | Tempo de resposta de emergência |
| AES overhead | Custo da criptografia por disparo |
| Retry rate | Taxa de reenvio por perda de pacote |

## Perfil Realista dos Transportes

```text
                Art-Net      Wi-Fi Direct    Radio 433MHz
Latência base   2.5ms        8.0ms           15.0ms
Jitter          ±1.2ms       ±4.5ms          ±8.0ms
Packet loss     0.05%        0.30%           1.20%
Max FPS         44           30              10
Criptografia    Não          AES-128-GCM     Não
Alcance         100m (cabo)  50m (P2P)       800m (campo)
MTU             530 bytes    1400 bytes      61 bytes
```

## Artefatos Gerados

| Arquivo | Conteúdo |
|---------|----------|
| `FXK_Show_Simulation_Report.pdf` | Relatório completo com tabelas, recomendações e veredicto |
| `FXK_Show_Simulation_Report.json` | Dados brutos para análise posterior |

## Implementação

1. Script Python gera cue list realística com distribuição por fase
2. Simula cada transporte com modelo de latência/jitter/perda/burst
3. Analisa resultados estatísticos (P95, P99, σ, confiabilidade)
4. Gera PDF formatado com tabelas comparativas e recomendações operacionais
5. Veredicto final de aprovação/reprovação por norma NFPA 1123

