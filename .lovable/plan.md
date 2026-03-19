

# Plano: Conectar Formulações Reais ao Render + Equipamentos Showven + Melhorias de Renderização

Três frentes: (1) conectar `REAL_FORMULATIONS` ao pipeline de renderização real, (2) adicionar equipamentos Showven como presets de SFX reais, (3) melhorias de render baseadas nos vídeos e specs.

---

## 1. Conectar REAL_FORMULATIONS ao Render Pipeline

**Problema**: `formulationToCompound` e `REAL_FORMULATIONS` existem em `particleChemistry.ts` mas nunca são importados em nenhum outro arquivo. Ao selecionar um produto PIROEX/SkyKing no catálogo, as cores e física são genéricas.

**Alterações**:

**`src/components/editor/SupplierCatalogPanel.tsx`**
- Adicionar mapeamento `productId → formulationId` em cada `SupplierProduct` (ex: `formulationId: 'purple_peony_2.5'`).
- Ao clicar em um produto, emitir evento/callback `onSelectProduct(product)` que carrega a formulação real no editor.
- Mostrar preview de cor real (swatch derivado da `resultColor` da formulação) ao lado de cada produto.

**`src/components/editor/EffectEditor.tsx`**
- Adicionar prop `realFormulationId?: string` e seção "Real Product" que aparece quando um produto foi selecionado do catálogo.
- Quando `realFormulationId` está definido, sobrescrever cores VDL pelas cores da formulação real (`formulationToCompound`).
- Mostrar badge "FFIC Calibrated" e dados da composição química (lista de compostos com percentuais).

**`src/components/editor/effects/ShellBurstRenderer.tsx`**
- Adicionar prop `formulationId?: string`.
- Quando presente, importar `getRealFormulation` + `formulationToCompound` e usar a cor/emissionIntensity/sparkSize/burnRate da formulação real para configurar os uniforms do shader (`uColor`, `uHDRMultiplier` ajustado pela `emissionIntensity`).
- Aplicar `trailDecay` da formulação ao drag das partículas.
- Se `crackle === true` na formulação, ativar automaticamente sub-bursts de micro-partículas brancas de alta intensidade com lifetime curto (0.1-0.2s).

**`src/lib/pyroPhysics.ts`**
- Nova função `getFormulationModifiers(formulationId)` que retorna `StepModifiers` + drag customizado baseado nos dados químicos (Ti = baixo drag/alta velocidade, Fe/C = alto drag/longa duração).

---

## 2. Presets de Equipamentos Showven (SFX Reais)

**Fonte**: Comparativo Showven PDF -- flamers, sparkular, cryo, confetti, fog.

**`src/lib/effectTypeSystem.ts`**
- Adicionar novos tipos SFX: `sparkular` (cold sparks), `fog_low` (névoa baixa), `streamer` (streamers metálicos).
- Cada um com specs do documento: sparkular até 5m, fog_low (Creeper AQ) 10.000 cuft/min, flamers com alturas variáveis (2-20m).

**Novo: `src/lib/showvenPresets.ts`**
- Tabela de equipamentos Showven com specs reais do PDF:
  - cFlamer: 10m, 5 cores, 5.3L, DMX
  - uFlamer Max: 20m, sem cor, 17L
  - cFlamer Volcano: 10m, 5 bicos, 5 cores
  - Sparkular Cyclone II: cold sparks
  - Sparkular Jet II: jato vertical
  - Sparkular Wheel: roda de faíscas frias
  - Sparkular WaverFall: cascata de faíscas
  - Sparkular Blaster: explosão de faíscas
  - Sparkular Mobile: portátil
  - Creeper AQ: névoa baixa, 460x300x324mm, 15kg
  - PRO FOG: fumaça 30.000 cuft/min
  - easyFetti Shot: confetti cannon
  - uFetti Blower: confetti blower
  - PyroSlave X4/C16: controladores de disparo
  - FXmote/PyroMote/FXbutton: controle remoto wireless
  - DMX Relay R12: relay DMX

**`src/components/editor/effects/FlameEffect.tsx`**
- Adicionar prop `preset?: ShowvenFlamerPreset` que configura altura máxima, número de bicos, suporte a cor.
- Quando preset = cFlamer, renderizar com 5 cores alternando; quando uFlamer Max, single flame até 20m sem cor.

**`src/components/editor/effects/SparkShower.tsx`** (renomear internamente para suportar Sparkular)
- Adicionar prop `sparkularModel?: string` que configura altura e padrão (vertical jet, circular, waterfall, wheel).
- Partículas de "cold spark" com temperatura baixa (cor dourada/prata, sem fumaça, sem afterglow).

---

## 3. Melhorias de Renderização

**`src/components/editor/effects/ShellBurstRenderer.tsx`**
- **Crackling automático**: Quando formulação tem `crackle: true`, gerar micro-explosões (3-5 partículas brancas brilhantes, lifetime 0.08s) em posições aleatórias das estrelas ativas a cada 0.05s. Simula o efeito crackling real do Ti/Bi2O3.
- **Spark size da formulação**: Usar `sparkSize` da formulação para escalar `uBaseSize` do shader.

**`src/render_ultra/fireworks/particleChemistry.ts`**
- Nova função `getEmissionSpectrum(formulation)` que retorna array de `{wavelength, intensity}` baseado nos compostos (Cu → 510nm verde-azul, Sr → 606nm vermelho, Ba → 524nm verde, Na → 589nm amarelo, Ti → broadband branco). Usado para tone-mapping mais preciso.
- Função `blendFormulationColors(compounds[])` que calcula cor final via mistura ponderada de espectro em vez de cor estática.

**`src/components/editor/effects/FogMachineEffect.tsx`**
- Adicionar preset Creeper AQ com comportamento de névoa baixa (partículas que ficam no chão, spread horizontal, sem subida).

---

## Resumo de Arquivos

| Acao | Arquivo | Melhoria |
|------|---------|----------|
| Editar | `ShellBurstRenderer.tsx` | Props formulationId, crackling automático, spark size |
| Editar | `EffectEditor.tsx` | Seção Real Product, badge FFIC, override de cores |
| Editar | `SupplierCatalogPanel.tsx` | FormulationId por produto, swatch de cor real, callback |
| Editar | `particleChemistry.ts` | Emission spectrum, blend ponderado de cores |
| Editar | `pyroPhysics.ts` | getFormulationModifiers |
| Editar | `effectTypeSystem.ts` | Tipos sparkular, fog_low, streamer |
| Editar | `FlameEffect.tsx` | Preset Showven com altura/bicos/cor |
| Editar | `SparkShower.tsx` | Modo Sparkular com modelos reais |
| Editar | `FogMachineEffect.tsx` | Preset Creeper AQ névoa baixa |
| Criar | `showvenPresets.ts` | Tabela completa de equipamentos Showven |

