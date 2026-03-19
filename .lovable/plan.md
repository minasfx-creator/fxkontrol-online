
# Plano: Catálogo OPT Laser + Filmbase + Laser 3D + Timeline Multi-Track

## ✅ Concluído

### 1. Catálogo OPT Laser Completo
- 30+ modelos adicionados ao `LASER_HARDWARE_PRESETS` (PR, PT, CF, WP, Skybeam)
- Galvo presets OPT reais (20k, 25k, 30k, 40k PPS)
- OPT Laser adicionado como fornecedor no `SupplierCatalogPanel`

### 2. Filmbase Flying Display
- Novo tipo `flyingDisplay` no sistema de categorias Showven
- 3 presets Filmbase (FLY78, L8, FLY78 Custom)
- Seção dedicada no `ShowvenEquipmentPanel`
- Filmbase adicionado como fornecedor no `SupplierCatalogPanel`

### 3. Laser 3D Preview no Viewport
- `useLaserPreviewStore` criado com estado de fontes laser
- `LaserPreviewBeams` R3F com feixes volumétricos, fog cone e halo
- Integrado no `SkyCanvas.tsx`
- Toggle 3D no `LaserControlPanel` sincroniza pan/tilt/pattern em tempo real

### 4. Timeline Multi-Track DAW
- `LaserTrackRow` colapsável com drag & drop de lasers
- `GenerativeTrackRow` colapsável mostrando layers Lightjams ativos
- Ordem: Formações → Drone FX → Laser → Generative → Pyro → Waypoints → Audio
