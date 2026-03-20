

# Plano: Reduzir ícone mortar para não bloquear fogos

## Problema
O `MortarTubeIcon` é grande (tubos até 0.65m, base 0.5m) e com escala `pinScale` de 0.6–0.75, ocupa espaço demais no viewport, bloqueando a visualização dos efeitos pyro à distância.

## Solução

### Escala baseada em distância da câmera
No componente `Pin`, calcular a distância até a câmera a cada frame e aplicar escala inversamente proporcional — quanto mais longe, menor o ícone. Isso garante que os mortars não dominem a cena quando vistos de longe.

### Reduzir geometria base do MortarTubeIcon
- Diminuir dimensões dos tubos (~40% menores): tubos de 0.5→0.3 de altura, raios proporcionais
- Base plate mais fina e compacta
- Manter visibilidade quando próximo via escala dinâmica

### Implementação em `PositionPins.tsx`

1. **`MortarTubeIcon`**: Reduzir todas as dimensões de geometria (~40%)
2. **`Pin`**: No `useFrame`, calcular distância câmera→pin e aplicar `scale = clamp(baseScale * (referenceDistance / distance), minScale, maxScale)` onde:
   - `referenceDistance = 15` (distância onde escala é "normal")
   - `minScale = 0.15` (para distâncias grandes, quase invisível)
   - `maxScale = 0.8` (para distâncias curtas)
3. Ajustar hitbox proporcionalmente

### Arquivo modificado
- `src/components/editor/PositionPins.tsx`

