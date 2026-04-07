

# Calibracao Industrial PIROEX/FFIC — Dados dos Laudos Laboratoriais

## Dados Extraidos dos Test Reports FFIC (Changsha Customs)

Os laudos laboratoriais da FFIC (Fireworks and Firecracker Inspection Center) para PIROEX LTDA / Changsha Skyking contêm dados reais de construcao e composicao quimica que devem calibrar o motor de simulacao:

### Tabela de Construcao Real (FFIC Actual Findings)

| Calibre | Tubo OD mm | Tubo H mm | Efeito g | Lift g | Break g | Total g | Fuse Time (medido) |
|---------|-----------|-----------|----------|--------|---------|---------|---------------------|
| 2.5" | 58 | 85 | 51.8 | 25.4 | 21.1 | 98.3 | 4.1-4.9s (avg 4.3) |
| 3" | 69 | 100 | 86.4 | 36.2 | 30.8 | 153.4 | 5.3-6.5s (avg 5.9) |
| 4" | 89 | 125 | 201.7 | 48.7 | 83.4 | 333.8 | 5.1-6.7s (avg 6.1) |
| 5" | 117 | 150 | 348.9 | 81.0 | 180.4 | 610.3 | 5.3-6.7s (avg 6.0) |
| 6" | 144 | 180 | 660.4 | 121.9 | 340.6 | 1122.9 | 5.4-6.7s (avg 6.2) |

### Alturas Minimas de Burst (NEB/T M-251 Item 24c)

| Diametro OD (mm) | Altura Minima Burst (m) |
|-------------------|------------------------|
| 45.0-55.0 | >=25 |
| 55.0-76.2 | >=55 |
| 76.2-101.6 | >=70 |
| 101.6-127.0 | >=85 |
| 127.0-203.2 | >=120 |
| >203.2 | >=200 |

### Composicao Quimica Real (PIROEX shells)

- **Lift charge**: KNO3 75%, Carbon 15%, Sulfur 10% (polv. negra classica)
- **Break charge (chaff)**: KClO4 70%, Al 30%, Carbon 30%
- **Flash powder**: KClO4 36%, Al 15%
- **Red (Strontium)**: SrCO3 10-23%, KClO4, PVC 7%, Shellac 5%, Phenolic resin 6-8%
- **Brocade crown**: Ti 25%, Rice Flour 2%, Adhesion agent 5%
- **Cake 20mm**: 6.65g effect/shot, 1.93g lift/shot, tubo 172x25x20mm

### Dados Art-Net DMX (Star Lighting Artnet8)

- 8 saidas DMX512 bidirecionais (XLR 5 pinos)
- 2 entradas DMX fixas (portas 9-10)
- Protocolos: Art-Net e sACN
- Isolamento optico ate 1500V em todas as portas DMX
- RDM compativel
- Conexao 10/100 Ethernet RJ45

## Problemas Identificados no Motor Atual

| # | Problema | Impacto |
|---|---------|---------|
| 1 | **Fuse times em pyroPhysics.ts nao correspondem aos laudos FFIC** — getLiftTime() calcula balisticamente, mas os tempos medidos (4.3s para 2.5", 5.9s para 3") sao muito maiores que o calculo balistico puro porque incluem delay fuse real | Timing incorreto |
| 2 | **Break heights nao alinhados com NEB/T M-251** — tabela BREAK_HEIGHT tem 50m para 2" mas norma exige >=55m para OD 55-76mm (3"); valores atuais nao refletem minimos regulatorios | Alturas fora da norma |
| 3 | **Composicao quimica do flicker nao usa dados reais** — pyroNoise.ts tem params genericos; laudos mostram composicoes exatas (SrCO3 para red, Ti para brocade) que afetam burn rate e flicker | Flicker impreciso |
| 4 | **Perfil PIROEX/Skyking nao existe em manufacturerCalibration.ts** — temos dados reais de um fabricante chines (Changsha Skyking) para PIROEX mas nao ha perfil calibrado | Dados desperdicados |
| 5 | **Cake 20mm nao tem dados de calibracao** — laudos mostram 6.65g/shot, tubo 172x25x20mm, fuse 6.2-7.3s, mas nao ha perfil de cake sub-1" calibrado | Cakes imprecisos |
| 6 | **Art-Net DMX engine nao suporta Star Lighting Artnet8** — wiredDmxEngine.ts suporta ENTTEC/Eurolite/DMXking mas nao a interface brasileira Artnet8 com 8 universos | Hardware nao suportado |

## Solucoes

### 1. Adicionar perfil PIROEX/Skyking em manufacturerCalibration.ts
Criar novo perfil `piroex-skyking` com dados REAIS dos laudos FFIC:
- Calibres 2.5", 3", 4", 5", 6" com heightM, spreadDeg, prefireSec, starCount, breakSpeed, safetyM baseados nos dados medidos
- Derivar starCount dos pesos de efeito (proporcional a effect charge)
- Usar fuse times medidos como prefireSec

### 2. Atualizar pyroPhysics.ts com dados NEB/T M-251
- Adicionar tabela `MIN_BURST_HEIGHT_NEBT` com alturas minimas regulatorias
- Funcao `getMinBurstHeight(outerDiameterMm)` para validacao de conformidade
- Ajustar BREAK_HEIGHT para alinhar com alturas reais medidas

### 3. Calibrar composicao quimica em pyroNoise.ts
Atualizar `getFlickerParams()` com dados reais PIROEX:
- Strontium red (SrCO3 10-23%): burn rate lento, flicker irregular
- Brocade/Ti (25% titanium): burn rate muito alto, sparks brilhantes
- Flash (KClO4 36% + Al 15%): burst intenso e curto

### 4. Adicionar Star Lighting Artnet8 ao wiredDmxEngine.ts
Novo adaptador com specs do manual:
- 8 saidas DMX (bidirecionais), baudRate via Art-Net/sACN (ethernet, nao serial)
- Nota: este dispositivo usa Ethernet, nao USB serial — adicionar nota de compatibilidade

### 5. Adicionar dados de cake 20mm ao pyroPhysics.ts
- CAKE_PARTICLES_PER_SHOT para sub-1" (20mm = ~0.8"): 10-15 particulas
- Fuse time: 6.2-7.3s para cake completo (300 shots)

## Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `src/lib/manufacturerCalibration.ts` | Adicionar perfil PIROEX/Skyking com dados FFIC |
| `src/lib/pyroPhysics.ts` | Tabela NEB/T M-251, ajustar break heights |
| `src/lib/pyroNoise.ts` | Calibrar flicker com composicao quimica real |
| `src/lib/wiredDmxEngine.ts` | Adicionar nota Artnet8 (ethernet-based) |

## Ordem de Execucao

| Passo | Tarefa |
|-------|--------|
| 1 | manufacturerCalibration.ts — perfil PIROEX/Skyking |
| 2 | pyroPhysics.ts — tabela NEB/T M-251 + break heights |
| 3 | pyroNoise.ts — flicker calibrado por composicao real |
| 4 | wiredDmxEngine.ts — nota Artnet8 |
| 5 | Build verification |

