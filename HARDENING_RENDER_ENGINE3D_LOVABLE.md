# Hardening pesado de Render e Engine 3D (Lovable)

Este documento define um baseline **agressivo** de segurança, estabilidade e resiliência para aplicações com renderização 3D (WebGL/WebGPU/Three.js/Babylon/PlayCanvas) no contexto Lovable.

## 1) Objetivos e princípios

- Priorizar **segurança por padrão**: negar por padrão e liberar por exceção.
- Evitar travamentos por GPU/driver com **degradação controlada**.
- Tornar o pipeline determinístico para reduzir falhas intermitentes.
- Bloquear entradas maliciosas em assets 3D (GLB/GLTF/FBX/texturas/shaders).
- Medir tudo (telemetria) e mitigar automaticamente em runtime.

## 2) Threat model mínimo para 3D

Ameaças críticas:

1. **DoS de GPU/CPU** via cenas gigantes, shaders caros, texturas enormes, loops de animação.
2. **Supply chain de assets** (modelos e texturas adulterados) contendo payloads ou metadados abusivos.
3. **Fuga de memória** (VRAM/RAM) por recursos sem descarte (`dispose`).
4. **Context loss** e crash de render por drivers instáveis.
5. **Exfiltração e injeção** em integrações com scripts externos e CDN.

## 3) Baseline obrigatório (produção)

### 3.1 Segurança de plataforma (web/app)

- Ativar CSP estrita (`default-src 'self'`, `script-src 'self'`, sem `unsafe-eval`).
- Ativar headers de hardening (`nosniff`, `referrer-policy`, `permissions-policy`).
- Fixar versões de engine/render libs com lockfile e revisão de segurança.

### 3.2 Gate de assets 3D

Todo asset importado deve passar por validações automatizadas antes do deploy:

- Tamanho máximo de arquivo (`MAX_ASSET_MB`).
- Máximo de triângulos (`MAX_TRIANGLES`).
- Resolução máxima de texturas (`MAX_TEXTURE_DIM`).
- Extensões GLTF permitidas e assinatura de integridade.

### 3.3 Runtime safety

- Budget por frame (frame time, draw calls, triângulos visíveis).
- Watchdog para degradação progressiva automática.
- Fallback de API: `webgpu` → `webgl2` → `static_preview`.
- Cooldown para crash-loop (prevenção de reinicialização infinita).

### 3.4 Gestão de memória

- Lifecycle explícito para descarte de recursos GPU.
- Cache com TTL/LRU.
- Hard limits de VRAM e nós de cena por sessão.

### 3.5 Observabilidade

Métricas mínimas:

- FPS p50/p95
- frame time p95/p99
- draw calls p95
- triângulos renderizados p95
- context loss rate
- crash-free sessions

## 4) Refinamento FXK Ultra (visual + UX) sem tocar no core determinístico

Para manter estabilidade sem quebrar módulos críticos, o refinamento foi isolado em camadas:

- **Engine de estabilidade** (`render_stability.js`): proteção contra crashes, fallback e gate de assets.
- **Engine de performance adaptativa** (`performance_system.js`): reduz efeitos/shaders sob pressão de FPS/GPU/VRAM.
- **Engine de tema premium** (`theme_engine.js`): dark, ultra dark e high contrast com estilo glass.
- **Engine de animação premium** (`animation_engine.js`): transições naturais (120/240/400ms, easing cúbico + spring).
- **Orquestrador FXK** (`fxk_ultra_refinement.js`): conecta performance + estabilidade + UI sem alterar Clock/Lockstep/ExecutionBridge.

## 5) Resultado esperado

- Visual cinematográfico com realismo controlado por budget.
- UX limpa e premium, com microinterações e transições suaves.
- Plataforma mais robusta a variações de dispositivo, browser e driver.
- Zero acoplamento da lógica determinística ao render/UI.

## 6) AI Copilot FPV + Assistente Visual (opcional e não intrusivo)

Camada adicionada em `modules/ai/` para assistência em tempo real, sem alterar core determinístico:

- `AICoPilot.cjs`: suavização de input com `lerp`/`clamp`, correção de micro-erros, modos MANUAL/ASSISTED/AI_CONTROL/CINEMATIC, e `suggestedCameraTarget`.
- `AIDecisionEngine.cjs`: cálculo de `safeTrajectory` com análise de risco (colisão, altitude, sinal, bateria).
- `FXKAssistant.cjs`: assistente visual com estados IDLE/GUIDING/ALERT/CINEMATIC, `orbColor`/`orbOpacity`, e voz opcional.
- `AssistantOrb.cjs`: identidade visual abstrata com glow/pulso por estado.
- `AIControls.cjs`: estado de UI para `[AI COPILOT ON/OFF]`, `[ASSIST LEVEL]`, `[VOICE ON/OFF]`.

Regras aplicadas:

- IA **não interfere** na execução automática do show.
- Assistente é opcional e pode ser desativado.
- Decisões focadas em segurança e UX, com baixa latência.
