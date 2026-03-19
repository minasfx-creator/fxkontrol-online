

# Plano de Refinamento — Analise Completa

Baseado nos documentos enviados (laudos FFIC de shells 2.5", cakes 20mm 300-shot, single shots 30mm para PIROEX/SkyKing), nas specs dos lasers OPT Laser (WP35 35W IP65, CF20 25W), e no estado atual do codebase, identifiquei 6 frentes de refinamento concretas.

---

## 1. Dados Reais de Composição Quimica no Particle Chemistry Engine

**Problema**: O `particleChemistry.ts` usa compostos genéricos (strontium, barium, copper) sem refletir formulações reais. Os laudos FFIC mostram composições exatas: purple peony usa Copper Oxide 22% + Potassium Perchlorate 16%, blue peony usa LAC 50% + PVC 8%, crackling willow usa Titanium 10% + AL+MG Alloy 5%.

**Refinamento**: Adicionar presets de composição derivados dos laudos reais (color peony, crackling willow, red mine) com proporções que influenciam temperatura de queima, cor resultante, taxa de decaimento e tamanho de faísca. Cada preset calcula cor final via mistura ponderada dos compostos.

**Arquivo**: `src/render_ultra/fireworks/particleChemistry.ts`

---

## 2. Calibragem da Física com Medições Reais dos Laudos

**Problema**: O `pyroPhysics.ts` usa tabelas de breakHeight/liftCharge genéricas. Os laudos revelam dados metrológicos reais:
- Shell 2.5": tubo 85mm alt x 58mm ext, carga efeito 51.8g, carga elevação 25.4g, carga abertura 21.1g, total 98.3g
- Single Shot 30mm: tubo 230mm alt x 38mm ext, 30mm int, efeito 28.4g, lift 6.92g, total 35.32g
- Fuse delay Shell: 4.1-4.9s (range). Single Shot: 5.0-6.9s

**Refinamento**: Criar tabela `REAL_PRODUCT_DATA` com dados dos laudos (peso de carga, fuse delay ranges, dimensões do tubo) para usar como presets validados. Ajustar `getLiftTime` para considerar carga de elevação real em vez de fórmula puramente balística. Adicionar variação de fuse delay baseada nos ranges medidos (4.1-4.9s em vez de valor fixo).

**Arquivo**: `src/lib/pyroPhysics.ts`

---

## 3. Presets de Laser Baseados em Hardware Real (OPT Laser)

**Problema**: O `laserEngine.ts` tem presets genéricos de galvo scanner (entry, 30k, 40k, 60k_pro) e wavelengths aproximados. As imagens mostram specs reais:
- WP35000-RGB: 35W total (R:10W, G:12W, B:13W), divergência <1.0mrad, 30kpps ILDA@8°, scan angle 60°, IP65, 24.5kg
- CF25000-RGB: 25W total (R:7W, G:8W, B:10W), divergência 1.0mrad, 40kpps ILDA@8°, scan angle 60°, Class 4

**Refinamento**: Adicionar presets `WP35_IP65` e `CF25_Carbon` ao `GALVO_PRESETS` e `LASER_WAVELENGTHS` com potência/divergência/PPS reais. Atualizar `LaserControlPanel.tsx` com dropdown de "Hardware Preset" que auto-configura scan rate, divergência e potência por canal RGB.

**Arquivos**: `src/lib/laserEngine.ts`, `src/components/editor/LaserControlPanel.tsx`

---

## 4. Importador de Laudos FFIC (Test Reports)

**Problema**: O sistema importa catálogos CSV/FDB/FSL mas nao tem capacidade de importar dados técnicos de laudos de teste (FFIC, BAM, etc.) que contém informações críticas: composição quimica, dimensões metrológicas, tempos de fuse delay medidos, classificação UN, carga pirotécnica total.

**Refinamento**: Criar componente `TestReportImporter` que faz upload de PDF de laudos FFIC e extrai via AI (Lovable AI / Gemini) as tabelas de:
- Composição quimica (Chemical Composition table)
- Dimensões do produto (Metrological Inspection)
- Tempos de fuse delay (Start duration results)
- Classificação (UN number, Class)

Os dados extraídos geram automaticamente um `ProductSpec` que calibra a simulação do efeito no editor.

**Arquivos**: Novo `src/components/editor/TestReportImporter.tsx`, nova edge function `supabase/functions/parse-test-report/index.ts`

---

## 5. Supplier Catalog com PIROEX / SkyKing como Preset Real

**Problema**: O `SupplierCatalogPanel.tsx` lista suppliers fictícios (Celtic, Jorge, etc.) com contagens genéricas. Os documentos mostram que o usuário trabalha com PIROEX LTDA (importador BR) e CHANGSHA SKYKING (fabricante CN).

**Refinamento**: Adicionar PIROEX e SkyKing ao catálogo com dados reais dos laudos:
- BOMBA AÉREA DE 2.5" (Shell Class D) — color peony
- CAKE 20mm 300 SHOT (Multiple Tube Class D)
- SINGLE SHOT 30mm — ti crackling willow tail with red mine
Cada produto com composição, peso, UN classification e fuse timing validados.

**Arquivo**: `src/components/editor/SupplierCatalogPanel.tsx`

---

## 6. Fuse Delay Variação Realista + Sound Sync

**Problema**: Atualmente o sistema usa timing fixo para fuse delay. Os laudos mostram que produtos reais têm variação mensurável: Shell 2.5" varia de 4.1s a 4.9s entre amostras; Single Shot 30mm varia de 5.0s a 6.9s; Cake 300-shot varia de 6.2s a 7.3s.

**Refinamento**: Implementar `fuseDelayWithJitter(nominalDelay, minDelay, maxDelay)` que aplica distribuição gaussiana dentro do range real. Isso faz a simulação parecer muito mais natural — num show real com 100 shells, nenhuma explode exatamente no mesmo instante.

**Arquivo**: `src/lib/pyroPhysics.ts`

---

## Resumo de Prioridades

| Prioridade | Melhoria | Impacto |
|-----------|----------|---------|
| Alta | Calibragem fisica com dados reais (laudos FFIC) | Simulação fiel ao produto real |
| Alta | Composição quimica real no render engine | Cores realistas por formulação |
| Alta | Fuse delay com jitter gaussiano | Timing natural do show |
| Media | Presets laser OPT Laser reais | Hardware fiel na simulação |
| Media | Supplier catalog PIROEX/SkyKing | Workflow real do usuario |
| Media | Importador de laudos via AI | Automação de calibração |

