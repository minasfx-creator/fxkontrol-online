

## Limpeza de Technical Debt + Blindagem WebGL para Google Earth 3D

### Resumo
Remoção de código morto, correção de anti-patterns React, otimização de geometria e blindagem de profundidade para escala global.

---

### 1. Deletar GlobeSelector.tsx
- **Arquivo**: `src/components/editor/GlobeSelector.tsx` — deletar inteiramente (868 linhas de código morto, sem imports ativos)

### 2. Limpeza de lógica morta em Index.tsx
**Arquivo**: `src/pages/Index.tsx`

- **Linha 182**: Remover `'globe'` da union type → `'cinematic' | 'splash' | 'editor'`
- **Linha 183**: Remover estado `showLocation` (nunca lido)
- **Linhas 296-298**: Remover `handleSplashStart` callback
- **Linha 301**: Remover `setShowLocation(location)` de dentro de `handleLocationSelected`
- **Linha 331**: Alterar `SplashScreen onStart` para ir direto ao editor: `onStart={() => setAppPhase('editor')}`
- **Linhas 334-336**: Remover bloco `if (appPhase === 'globe') { setAppPhase('editor'); }` — anti-pattern de state update durante render

### 3. Correção do anti-pattern getState() no GroundSystem.tsx
**Arquivo**: `src/components/editor/skycanvas/GroundSystem.tsx`

- **Linhas 1146-1178**: O Grid usa uma IIFE com `useSceneStore.getState()` dentro do JSX — viola as regras de hooks do React
- **Correção**: Extrair o valor no topo do componente `StageGround`:
  ```typescript
  const gridSnapResolution = useSceneStore(s => s.environment.gridSnapResolution);
  ```
  E usar `gridSnapResolution` diretamente no JSX em vez da IIFE

### 4. Redução de geometrias de 100k → 10k
**Arquivo**: `src/components/editor/skycanvas/GroundSystem.tsx`

Substituir `args={[100000, 100000]}` por `args={[10000, 10000]}` nas seguintes linhas:
- Linha 262 (GrassGround)
- Linha 435 (FinaleDarkGround)
- Linha 623 (SyntheticGrassGround)
- Linha 641 (ConcreteGround)
- Linha 1042 (SFX floor)
- Linha 1122 (flat-black)
- Linha 396: `createVolumetricFogPlane(100000)` → `createVolumetricFogPlane(10000)`

### 5. Blindagem de Profundidade para Escala Global
**Arquivo**: `src/components/editor/SkyCanvas.tsx`

- **Linha 1695**: Alterar `logarithmicDepthBuffer: false` → `logarithmicDepthBuffer: true`
  - Elimina z-fighting quando a câmera está a quilômetros do terreno Google Earth
- **Linha 1703**: Alterar camera `near={1.0} far={30000}` → `near={0.1} far={50000}`
  - Suporta visualização de drones próximos (0.1m) até horizonte distante (50km)

### 6. TilesRenderer Cleanup — JÁ IMPLEMENTADO ✓
O `useEffect` em `GoogleTilesEngine.tsx` (linha 122-127) já possui cleanup correto:
```typescript
return () => {
  tiles.dispose();
  scene.remove(group);
  tilesRef.current = null;
};
```
Nenhuma ação necessária aqui.

---

### Arquivos Alterados
| Arquivo | Ação |
|---------|------|
| `src/components/editor/GlobeSelector.tsx` | **DELETAR** |
| `src/pages/Index.tsx` | Remover código morto |
| `src/components/editor/skycanvas/GroundSystem.tsx` | Fix getState() + reduzir geometrias |
| `src/components/editor/SkyCanvas.tsx` | logarithmicDepthBuffer + camera far |

