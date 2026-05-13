# Refinamento Visual — Marcadores, Mines e Realismo

## 1. Remover marcadores laranjas

### 1a. DirectionLine + anel da posição pyro
**Arquivo:** `src/components/editor/PositionPins.tsx`
- Remover o render `<DirectionLine .../>` na linha ~473 (linha + arrowhead saindo da posição pyro indicando heading/pitch)
- Manter o `MortarTubeIcon` (o tubo 3D em si — usuário não pediu pra remover) e a base disc
- Manter o `LinkedGlowRing` (pulsa só quando evento é selecionado no timeline — feedback útil, não é "marcador parado")
- Remover também o componente `DirectionLine` se não for usado em outro lugar (dead-code)

### 1b. Marcadores SFX laranjas no palco
**Arquivo:** `src/components/editor/skycanvas/GroundSystem.tsx`
- Remover a chamada `<InstancedSFXMarkers ...>` do `SFXStageEnvironment` (anéis `#ff6600` espalhados sobre o palco que não correspondem a posições reais)
- Remover a função `InstancedSFXMarkers` inteira (linhas 737-767)

## 2. Corrigir renderização das Mines

**Bug identificado em** `src/components/editor/effects/MineEffect.tsx` (linhas 399-404, 434):

```text
PROBLEMA: o <group> raiz aplica launchRotation (pitch+heading)
       → inclina TODOS os 600 particles + muzzle flash + ring de chão
       → mine de 85° pitch (quase vertical) sai torta
       → ground ring deixa de ser horizontal
```

**Correção:**
- Remover `rotation={launchRotation}` do `<group>` raiz (linha 434)
- Manter `position={position}` e `renderOrder={50}`
- Mine é **omnidirecional ground burst** (NFPA): coluna sobe vertical, spray em hemisfério, drips caem por gravidade — não deve seguir orientação do tubo
- O `launchHeading`/`launchPitch` continuam recebidos pra futura aplicação seletiva (ex.: tilt sutil ≤10° na coluna), mas não rotacionar o grupo inteiro
- Remover o `useMemo` `launchRotation` e os params da assinatura se ficarem unused após confirmação

## 3. Refinamento de realismo dos fogos

Ajustes pontuais, calibrados contra referência real (vídeos PyroJam / WPM):

### 3a. `src/components/editor/effects/MineEffect.tsx`
- **Coluna mais densa e curta**: aumentar `COLUMN_FRAC` 0.20→0.28, reduzir lifetime coluna `0.3+random*0.3` → `0.18+random*0.25` (jet real dura ~0.4s, não 0.6s)
- **Spray com decay mais rápido**: `attackReleaseEnvelope(progress, 0.02, 0.85, 2.5)` → `(progress, 0.015, 0.55, 3.2)` (mines reais têm release curto, não cauda longa)
- **Muzzle flash menor e mais branco**: raio `1.2 + caliber*0.5 + progress*20` → `0.6 + caliber*0.3 + progress*8` (estava virando bola gigante)
- **Ground ring opacity**: 0.12 → 0.08 e raio máximo `3+progress*30` → `2+progress*15` (era halo desproporcional)
- **Smoke plume**: já está bom, sem alteração

### 3b. `src/components/editor/skycanvas/FireworkRenderer.tsx` + efeitos shell
- **HDR clamp**: garantir que `clampNiagaraHDR` está sendo aplicado nos cores finais de Comet/MultiBurst (verificar `multiplier ≤ 8.0` em vez de valores soltos que estouram o tonemap)
- **Trail decay mais natural**: nos `CometEffect` e `ShellBurst`, o ember tail está fazendo transição abrupta — suavizar com `smoothstep(0.5, 0.85, lifeRatio)` em vez de cliff em 0.55
- **Gravity em stars de shell**: confirmar que stars individuais estão recebendo gravidade pós-burst (não só o shell). Se não estiverem, adicionar integração simples no loop de stars

### 3c. `src/render_ultra/fireworks/cinemaFireShader.ts`
- **HDR multiplier 10.0 → 7.5**: está saturando o pipeline (bloom threshold 1.2 fica branco-leitoso). Calibrar pra HDR ~7.5 mantém realce sem clip
- **Ember onset 0.55 → 0.62**: começa cedo demais hoje, dá impressão de "envelhecer rápido"

### 3d. (opcional, baixo risco) — escala de partículas
- Reduzir `basePointSize` global em `MineEffect` 0.22 → 0.18 (caliber 3 estava com pontos visivelmente "grandes" no SkyCanvas)

## Detalhes Técnicos

```text
Pipeline visual atual (mantido):
  Effects (MineEffect, CometEffect…) → Three.js Points (additive)
  → ExplosionGlowSystem (HDR pass)
  → ACES Hue-Preserve tonemap
  → Bloom + Halation + Grain → Final

Mudanças NÃO tocam:
  - safety (workMode, uiCommandGateway, FieldBus)
  - ShowPlan / cue scheduling
  - Pipeline WebGPU camadas 10/11 (gpgpu/)
  - particleChemistry / formulações
  - hardware adapters
```

## Validação

1. Build automático passa
2. Visual: abrir `/editor`, dropar uma mine no SkyCanvas, executar — verificar que (a) sem orange ring no palco, (b) sem linha laranja saindo das posições pyro, (c) mine sobe **vertical**, (d) burst aéreo parece mais "punchy" e menos "borracha".
3. Sem novos erros no console (browser--read_console_logs após render)

## Arquivos afetados
- `src/components/editor/PositionPins.tsx` (remover DirectionLine usage + componente)
- `src/components/editor/skycanvas/GroundSystem.tsx` (remover InstancedSFXMarkers)
- `src/components/editor/effects/MineEffect.tsx` (remover rotation, calibrar muzzle/ring/coluna)
- `src/components/editor/skycanvas/FireworkRenderer.tsx` (suavizar ember transition)
- `src/render_ultra/fireworks/cinemaFireShader.ts` (HDR 10→7.5, ember 0.55→0.62)

Zero mudança de backend, schema, rotas ou comandos.
