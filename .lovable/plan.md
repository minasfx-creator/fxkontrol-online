
Objetivo: eliminar o crash do viewport e corrigir o “sugado para o chão / sem conseguir mexer” no fluxo Globe embutido.

Diagnóstico (confirmado no código atual):
- Do I know what the issue is? Sim.
- O crash não é mais por Canvas aninhado; agora é por duas cenas WebGL pesadas ativas ao mesmo tempo:
  - `SkyCanvas` fica montado no editor
  - `GlobeSelector` (com outro `<Canvas>`) fica por cima até confirmar local
- O “sugado para o chão” vem da lógica de clamp no `SkyCanvas`:
  - limiter de queda (`yDelta < -50`) pode forçar descida contínua em transições
  - `_lastValidY` inicial fixo (300) + presets baixos cria comportamento agressivo
  - alguns presets iniciam abaixo do piso mínimo (ex.: `1.7m`), ativando clamp logo ao entrar
- “Sem conseguir mexer” pode ocorrer por `OrbitControls.enabled` ficar em estado bloqueado após transição/evento.

Plano de implementação:
1) Garantir 1 único WebGL ativo no onboarding (fix principal de crash)
- Arquivo: `src/pages/Index.tsx`
- Quando `showViewportGlobe === true`, NÃO montar `SkyCanvas` ainda (nem overlays dependentes dele).
- Renderizar apenas uma superfície leve (placeholder/loader) no centro e manter o `GlobeSelector` overlay.
- Após `onLocationSelected`/`onSkip`, montar `SkyCanvas` e overlays normalmente.
- Resultado: elimina disputa de contexto GPU durante seleção de cidade.

2) Endurecer transição de controles ao sair do Globe
- Arquivo: `src/pages/Index.tsx`
- Em `handleLocationSelected`, além de ocultar o globe:
  - forçar evento de liberação de controle (`box-select-active = false`) para evitar estado “travado”.
- Resultado: evita entrar no editor com câmera desabilitada.

3) Corrigir clamp vertical para não “puxar” câmera
- Arquivo: `src/components/editor/SkyCanvas.tsx`
- Ajustar `clampToWorldBounds`:
  - inicializar `_lastValidY` com a altura real da câmera no primeiro frame útil (em vez de fixo).
  - detectar “teleporte/transição grande” e resetar baseline do clamp.
  - aplicar limiter de queda apenas em navegação manual (não durante transições/cinemática).
  - manter log de clamp com rising-edge (sem spam por frame) também para `altitude drop clamped`.
- Resultado: para o efeito de descida forçada e melhora a controlabilidade.

4) Alinhar presets com piso de segurança
- Arquivo: `src/components/editor/skycanvas/sharedState.tsx`
- Subir presets que começam abaixo de `CAMERA_MIN_Y` (ex.: 1.7/2m) para valores seguros.
- Resultado: evita clamp imediato ao trocar preset/entrar no editor.

5) Validação funcional (fim-a-fim)
- Fluxo alvo:
  1. abrir `/editor`
  2. selecionar cidade no globe embutido
  3. confirmar local
  4. editor carregar sem “THREE.WebGLRenderer: Context Lost”
  5. câmera responder (pan/zoom/orbit/fly) sem ser arrastada para `Y=5`
- Verificar console sem spam de:
  - `[Camera] altitude drop clamped`
  - `[Camera] altitude clamped to safe floor`
  - `Context Lost` recorrente

Arquivos que serão alterados:
- `src/pages/Index.tsx`
- `src/components/editor/SkyCanvas.tsx`
- `src/components/editor/skycanvas/sharedState.tsx`

Detalhes técnicos (resumo de arquitetura):
```text
ANTES
Index (editor)
 ├─ SkyCanvas (Canvas A, pesado)
 └─ GlobeSelector overlay (Canvas B, pesado)
=> risco alto de context loss

DEPOIS
Index (editor com globe aberto)
 ├─ Placeholder leve (sem Canvas A)
 └─ GlobeSelector (Canvas único)
Confirmou local:
 ├─ SkyCanvas (Canvas único)
 └─ GlobeSelector desmontado
```
