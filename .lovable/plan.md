

# PDF Comparativo + Protótipo FXK-M1 Plug & Play

## O que será entregue

### 1. Design Philosophy (.md) ✅ Já criado
Arquivo `FXK_Ignition_Systems_Philosophy.md` — manifesto visual "Pyrotechnic Futurism" com estética de hardware de campo: paleta escura, tipografia machined, grid de circuito impresso.

### 2. PDF de 5 páginas: Mobile vs Hardware Convencional

**Página 1 — Capa**
- Título "MOBILE vs HARDWARE" com métricas-chave (6+ transportes, 50ms E-STOP, alcance global, 12+ sensores)
- Teaser do protótipo FXK-M1

**Página 2 — Tabela Comparativa**
- 16 categorias comparadas: Alcance, Transportes, E-STOP, Sensores, Confirmação de Tiro, Lógica, Redundância, Custo, Setup, Atualização, Mesh, Spectrum, Clima, Continuidade, IP Rating, Temperatura
- Indicadores visuais verde (vantagem clara) / âmbar (equivalente com dock)

**Página 3 — Tecnologias Exclusivas do Mobile**
- 10 cards: Confirmação Acústica, AR, Detecção de Inclinação, Wi-Fi Mesh, GPS Firing (ICET), Spectrum Analyzer, TDMA Anti-Colisão, UWB Positioning, Thermal Camera, NFC Tap-to-Pair
- Cada card com descrição técnica de 2 linhas

**Página 4 — Protótipo FXK-M1 (Esquemático)**
- Vista superior do módulo com:
  - Dock universal para smartphone (mola + trava)
  - USB-C passthrough (carga + dados)
  - PCB com ESP32-S3, 74HC595, MOSFETs, CC1101, LiPo
  - 32 terminais de parafuso para ignitores
  - 7 anotações técnicas numeradas
- Estética de schematic técnico com traces pontilhados

**Página 5 — Arquitetura + BOM**
- Diagrama de 3 camadas: Software → Dock → Campo
- Bill of Materials com 12 itens, custo total estimado: ~US$ 83

### Estética
- Background escuro (#0A0C10) com grid sutil
- Fontes: Tektur (títulos), IBM Plex Mono (dados), Work Sans (corpo)
- Retângulos chanfrados (chamfered) — estética de metal usinado
- Paleta: verde fosforescente, âmbar, ciano, vermelho (só E-STOP)

### Processo
1. Executar script Python com reportlab
2. Converter para imagens para QA visual
3. Verificar overlaps, margens, legibilidade
4. Corrigir issues encontradas
5. Entregar PDF + .md

