

# Plano: Catálogo OPT Laser Completo + Filmbase Flying Display + Laser 3D Preview + Timeline Multi-Track

Após estudar os catálogos enviados e o estado atual da plataforma, identifiquei 4 frentes de aprimoramento de alto impacto.

---

## 1. Catálogo Completo OPT Laser (laserEngine.ts + SupplierCatalogPanel)

O sistema atual tem apenas 2 presets OPT Laser (WP35, CF25). O catálogo 2025-2026 tem **13 séries** com specs técnicos completos. Expandir para a linha inteira:

**Modelos a adicionar ao `LASER_HARDWARE_PRESETS`:**

| Série | Modelos | Potência | PPS | IP |
|-------|---------|----------|-----|-----|
| PR5 | PR4000, PR6000, PR8000 | 4-8W | 40k | IP54 |
| PT6 | PT6000, PT8000 | 6-8W | 40k | IP54 |
| PR10 | PR10000, PR14000 | 10-14W | 40k | IP54 |
| CF20 | CF20000, CF24000, CF25000 | 20-25W | 40k | IPX4 |
| CF30 | CF30000, CF33000 | 30-33W | 40k | IP65 |
| CF45 | CF45000, CF48000 | 45-48W | 25k | IP65 |
| WP35 | WP35000, WP37000 | 35-37W | 30k | IP65 |
| WP45 | WP45000, WP48000 | 45-48W | 25k | IP65 |
| WP50 | WP60000, WP70000, WP80000 | 60-80W | 20k | IP65 |
| WP100 | WP100000, WP140000 | 100-140W | 20k | IP65 |
| WP150 | WP150000 | 150W | 20k | IP65 |
| Skybeam | Skybeam | Architectural | - | IP65 |

Cada preset com: potência RGB real por canal (mW), divergência, peso, dimensões, scan angle.

**Adicionar OPT Laser como fornecedor no `SupplierCatalogPanel`** com categoria "Laser Systems", permitindo que o usuário explore os modelos e adicione ao inventário do show.

**Arquivos:**
- Modificar: `src/lib/laserEngine.ts` (expandir `LASER_HARDWARE_PRESETS` e `GALVO_PRESETS`)
- Modificar: `src/components/editor/SupplierCatalogPanel.tsx` (adicionar fornecedor OPT Laser + Filmbase)

---

## 2. Filmbase Flying Display — Novo Tipo de Equipamento

O catálogo Filmbase apresenta um produto inovador: **telas LED transparentes voadas por drones** (5m x 15m, 250g/m², 95% transparência, P30/P40). Isso é diretamente relevante para a plataforma.

**Adicionar ao sistema:**
- Novo tipo de fixture `flyingDisplay` nas categorias de equipamento
- Preset Filmbase FLY78/L8 com specs reais (pixel count, peso 48.4kg, hover time, resolução P30/P40)
- Exibir no `ShowvenEquipmentPanel` ou em uma nova seção "Flying Displays"

**Arquivos:**
- Modificar: `src/lib/showvenPresets.ts` (adicionar categoria `flyingDisplay` e presets Filmbase)
- Modificar: `src/components/editor/ShowvenEquipmentPanel.tsx` (nova seção)

---

## 3. Laser 3D Preview no Viewport (pendente do plano anterior)

O `LaserPreviewBeams` e `useLaserPreviewStore` ainda não existem. Implementar:

- `useLaserPreviewStore.ts`: estado de lasers ativos no viewport (posição, pan, tilt, pattern, color, hardware preset)
- `LaserPreviewBeams.tsx`: componente R3F que renderiza feixes usando a mesma abordagem do `LaserEffect.tsx` mas lendo do store
- Fog volumétrico localizado (cone mesh com opacity modulada por `hazeLevel`)
- Integrar no `SkyCanvas.tsx`
- Sincronizar com `LaserControlPanel`

**Arquivos:**
- Criar: `src/store/useLaserPreviewStore.ts`
- Criar: `src/components/editor/LaserPreviewBeams.tsx`
- Modificar: `src/components/editor/SkyCanvas.tsx`
- Modificar: `src/components/editor/LaserControlPanel.tsx`

---

## 4. Timeline Multi-Track DAW (pendente do plano anterior)

Expandir a timeline com tracks dedicados para Laser e Generative:

- **Laser Track**: barras coloridas com indicador de pattern, arrastar presets do catálogo
- **Generative Track**: blocos representando presets Lightjams com gradientes de crossfade
- `GenerativeKeyframe` e `LaserKeyframe` no `useProjectStore`
- Tracks colapsáveis com ícones distintos
- Ordem: Formações → Drone FX → Laser → Generative → Pyro → Waypoints → Audio

**Arquivos:**
- Modificar: `src/components/editor/Timeline.tsx`
- Modificar: `src/store/useProjectStore.ts`

---

## Resumo de Impacto

| Frente | Valor |
|--------|-------|
| Catálogo OPT Laser completo | Planejamento profissional com specs reais de 30+ modelos |
| Filmbase Flying Display | Novo tipo de equipamento inovador para shows aéreos |
| Laser 3D Preview | Visualização estilo Depence no viewport |
| Timeline Multi-Track | Fluxo de trabalho DAW completo para show design |

