

# Plan: Importação de Mapas e Arquivos UE5

## Contexto

O sistema já suporta importação de `.uasset`, `.umap`, `.t3d`, `.copy` e `.json` do UE5, mas focado em **efeitos Niagara** e **fixtures DMX**. Falta suporte para importar **dados de cenário/mapa** — posições de objetos, terreno, e modelos 3D referenciados em níveis UE5.

## O que será implementado

### 1. Parser de Mapa UE5 (T3D Scene Parser)
**Novo arquivo: `src/lib/ue5MapParser.ts`**

Parsear texto T3D exportado do UE5 (File → Export ou Ctrl+C de actors) para extrair:
- **Actors com posição/rotação/escala** — StaticMeshActor, PointLight, SpotLight, NiagaraActor
- **Referências de mesh** — `/Game/Props/Truss_4m.Truss_4m` → nome legível
- **Luzes** com cor, intensidade e posição → mapeadas para fixtures DMX no viewport
- **Volumes/áreas** — trigger boxes, safety zones → mapeadas para geofences

Resultado: lista de `UE5SceneObject` com tipo, nome, transform e metadados.

### 2. Diálogo de Importação de Mapa UE5
**Novo arquivo: `src/components/editor/UE5MapImporter.tsx`**

- Upload de arquivo `.t3d` ou paste de texto copiado do UE5
- Preview em lista dos objetos encontrados, agrupados por tipo (meshes, luzes, efeitos, volumes)
- Checkboxes para selecionar quais importar
- Opções: escala de conversão (UE5 usa cm, sistema usa m → divide por 100), offset de origem
- Botão "Importar" que:
  - **Luzes** → cria posições DMX + fixtures no sistema
  - **Meshes referenciadas** → cria SiteModels placeholder (cubo com nome) posicionados corretamente
  - **Niagara actors** → cria posições de efeitos pirotécnicos
  - **Volumes** → cria zonas de segurança/geofence

### 3. Importação de Heightmaps como Terreno
**Novo arquivo: `src/lib/heightmapToTerrain.ts`**

- Importar imagens PNG/JPG como heightmaps
- Converter pixel brightness → altura (0-maxHeight configurável)
- Gerar geometria `PlaneGeometry` com displacement no viewport 3D

**Novo componente: `src/components/editor/TerrainRenderer.tsx`**
- Componente R3F que renderiza o terreno no viewport
- Malha com displacement map aplicado via vertex shader
- Configurável: tamanho, altura máxima, cor/textura

### 4. Integração no Fluxo Existente

**`src/pages/Index.tsx`**:
- Adicionar extensões `png`, `jpg`, `tif` ao `SUPPORTED_DROP_EXTENSIONS` (para heightmaps)
- Novo tipo de drop `'ue5map'` para `.t3d` que contenha actors (não apenas DMX)

**`src/components/editor/Toolbar.tsx`**:
- Menu "Importar → Mapa UE5" e "Importar → Terreno (Heightmap)"
- Handler para `ue5map` no listener de viewport-file-drop

**`src/store/useSceneStore.ts`**:
- Adicionar estado `terrain` (heightmap data, dimensões, visibilidade)
- Actions: `setTerrain`, `clearTerrain`, `updateTerrainSettings`

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/lib/ue5MapParser.ts` | Criar — parser de actors T3D |
| `src/lib/heightmapToTerrain.ts` | Criar — PNG → heightfield |
| `src/components/editor/UE5MapImporter.tsx` | Criar — diálogo de importação |
| `src/components/editor/TerrainRenderer.tsx` | Criar — malha 3D de terreno |
| `src/store/useSceneStore.ts` | Editar — estado de terreno |
| `src/pages/Index.tsx` | Editar — extensões de drop |
| `src/components/editor/Toolbar.tsx` | Editar — menu + handler |

