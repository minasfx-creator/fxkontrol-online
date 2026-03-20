

# Plan: Integrar Tecnologia Twinmotion — Suporte Multi-formato CAD/BIM

## Contexto

O Twinmotion aceita arquivos de **todas as principais soluções CAD, BIM e modelagem 3D** via plugins Datasmith. Atualmente o FX KONTROL só importa `.udatasmith` XML. Este plano expande o sistema para aceitar os formatos nativos que os usuários do Twinmotion trabalham, adicionar suporte a materiais/texturas do Datasmith, e criar um painel de integração unificado.

## O que será implementado

### 1. Suporte a Formatos 3D Nativos (FBX, OBJ, SKP, IFC, GLTF, 3DS)
**Editar: `src/components/editor/TwinmotionImporter.tsx`**

Expandir o importador para aceitar formatos 3D diretos que o Twinmotion suporta:
- `.fbx`, `.obj`, `.gltf`, `.glb` — carregados via Three.js loaders (FBXLoader, OBJLoader, GLTFLoader)
- `.skp` (SketchUp), `.ifc` (BIM), `.3ds`, `.c4d`, `.rvt` — aceitos como referência/placeholder (geometria não interpretável no browser, mas posição e metadados são registrados)
- Tab "Modelo 3D" no diálogo para upload direto de arquivos 3D
- Auto-detecção do formato pelo header/extensão

### 2. Parser de Materiais Datasmith
**Editar: `src/lib/twinmotionParser.ts`**

Extrair dados de materiais do XML Datasmith:
- `<MasterMaterial>` e `<Material>` nodes com texturas, cores difusas, roughness, metallic
- Mapear materiais Twinmotion para propriedades Three.js (MeshStandardMaterial)
- Interface `DatasmithMaterial` com cor, textura refs, propriedades PBR
- Adicionar tipo `'material'` ao actor type para referências de material

### 3. Importação de Caminhos de Câmera (Twinmotion Paths)
**Editar: `src/lib/twinmotionParser.ts`** e **`src/components/editor/TwinmotionImporter.tsx`**

- Parsear `<CameraAnimation>` e `<Path>` nodes do Datasmith XML
- Extrair keyframes de câmera com posição, rotação e tempo
- Importar como camera bookmarks no `useSceneStore`

### 4. Diálogo Unificado Multi-Tab
**Editar: `src/components/editor/TwinmotionImporter.tsx`**

Reorganizar em 3 tabs:
- **Datasmith XML** — importação atual de `.udatasmith` (já funcional)
- **Modelo 3D** — upload de FBX/OBJ/GLTF/GLB com preview 3D em miniatura
- **Compatibilidade** — tabela de softwares suportados (3ds Max, Revit, SketchUp, Rhino, Archicad, etc.) com instruções de exportação para cada um

### 5. Drag-and-drop Expandido
**Editar: `src/pages/Index.tsx`**

Adicionar extensões: `fbx`, `obj`, `gltf`, `glb`, `skp`, `ifc`, `3ds` ao `SUPPORTED_DROP_EXTENSIONS` e mapeá-las para o tipo `'twinmotion'`.

### 6. Compatibilidade na Toolbar
**Editar: `src/components/editor/Toolbar.tsx`**

Atualizar o accept do file input para incluir os novos formatos. Label do menu: "Twinmotion / 3D Models".

## Detalhes Técnicos

### Three.js Loaders
```text
FBX  → three/examples/jsm/loaders/FBXLoader
OBJ  → three/examples/jsm/loaders/OBJLoader  
GLTF → three/examples/jsm/loaders/GLTFLoader (já incluso no three)
GLB  → GLTFLoader (binário)
```

### DatasmithMaterial interface
```text
DatasmithMaterial {
  name, label, parent
  diffuseColor: string
  roughness, metallic, opacity: number
  textureMaps: { diffuse?, normal?, roughness?, metallic? }
}
```

### Softwares compatíveis (tabela de referência)
```text
Software          Formato Export    Direct Link
3ds Max           .udatasmith       Sim
Revit             .udatasmith       Sim (2024+)
SketchUp Pro      .udatasmith       Sim
Rhino/Grasshopper .udatasmith       Sim
Archicad          .udatasmith       Sim
Vectorworks       .udatasmith       Sim
SOLIDWORKS        .udatasmith       Sim
Blender           .fbx / .gltf     —
Cinema 4D         .fbx / .c4d      —
```

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/lib/twinmotionParser.ts` | Editar — materiais, câmera paths |
| `src/components/editor/TwinmotionImporter.tsx` | Editar — multi-tab, 3D loader, compat table |
| `src/pages/Index.tsx` | Editar — extensões drag-drop |
| `src/components/editor/Toolbar.tsx` | Editar — label e accept |

