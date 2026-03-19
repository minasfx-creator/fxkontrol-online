

# Plano: Permitir Câmera Mais Próxima do Chão

## Problema
O `minDistance` do `OrbitControls` está configurado em **5 unidades**, impedindo que a câmera se aproxime mais do chão. Na imagem enviada, a câmera está travada a uma altitude mínima que não permite visualização ao nível do solo.

## Solução
Reduzir `minDistance` de `5` para `0.5` no componente `OrbitControls` em `src/components/editor/SkyCanvas.tsx` (linha 3053). Isso permitirá zoom muito mais próximo do chão, útil para inspecionar posições de pyro e efeitos de perto.

**Arquivo:** `src/components/editor/SkyCanvas.tsx` — alterar `minDistance={5}` para `minDistance={0.5}`

