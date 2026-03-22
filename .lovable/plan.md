

# FXK-PYRO — Eliminar Deadman (PC), Mobile Hold-to-Fire, Module Scanner, Fire Confirmation & Layout BR2049

## Resumo

Três blocos de mudanças no PyroFireOnePanel:
1. **Eliminar Deadman no PC** — firing direto com Master Key + ARM (sem hold)
2. **Mobile Hold-to-Fire** — cada igniter requer 300ms press-and-hold para segurança (substitui deadman)
3. **Module Scanner, Fire Confirmation Log, Layout futurístico** — conforme plano anterior aprovado

## Mudanças

### 1. `src/components/editor/live-firing/PyroFireOnePanel.tsx`

#### A. Eliminar Deadman (PC)
- Alterar `canFire`: no PC → `masterKeyOn && (pyroArm || dmxArm)` (sem deadmanHeld)
- No mobile → `masterKeyOn && (pyroArm || dmxArm)` também (segurança via hold-to-fire por igniter)
- Remover `renderDeadman()` inteiramente
- Remover referência a `deadmanHeld` da prop interface e do uso interno
- Remover `renderDeadman()` do fullscreen layout (linha 1430)
- Atualizar mensagem de "Hold DEADMAN to fire" para "ARM system to fire"

#### B. Mobile Hold-to-Fire (igniters)
- No `renderIgniterGrid()`: para mobile, substituir `onTouchStart` imediato por **hold-to-fire** com 300ms:
  - `onTouchStart` → inicia timer 300ms + progress ring visual (SVG circle com stroke-dashoffset animado)
  - `onTouchEnd` / `onTouchCancel` → cancela se < 300ms
  - Visual: anel de progresso âmbar ao redor do botão durante hold, flash verde ao completar
- No PC: manter click imediato (`onMouseDown`) sem mudança
- Adicionar state `holdingIgniter: { moduleAddr: number; pos: number } | null` e `holdProgress: number`

#### C. Module Scanner & Active Monitor
- Adicionar `renderModuleMonitor()` como sub-seção no renderModuleSelector ou como tab lateral no fullscreen:
  - Cada módulo: battery SVG arc gauge, signal bars (5), temperature, packet loss
  - **SCAN** button com animação sweep (CSS `pyro-scan-sweep`)
  - Summary bar: `ONLINE: 4/6 · ARMED: 2 · SIGNAL: OK`
  - Módulos color-coded: green=healthy, amber=degraded, red=armed, dark=offline
- Auto-refresh telemetria a cada 2s com pulse animation

#### D. Fire Confirmation & Timecode Log
- Adicionar `fireLog` state: `{ cueId: string; expectedMs: number; actualMs: number; delta: number; status: 'OK'|'LATE'|'EARLY' }[]`
- No timecode mode, ao disparar: registrar `actualMs = tcTimeMs`, `delta = actualMs - expectedMs`
- Renderizar log abaixo da cue list com color-coding: green (±50ms), amber (±200ms), red (>200ms)
- No manual mode: toast de confirmação com module/igniter/timestamp

#### E. Layout Futurístico BR2049
- **Header**: âmbar accent line (2px glow), LCD counters âmbar/vermelho (não mais verde), mission clock HH:MM:SS, subtitle "NEXUS FIELD CONTROLLER"
- **Igniter grid**: group headers (A:1-8, B:9-16, C:17-24, D:25-32), fired igniters com diagonal strikethrough pattern, armed igniters com red glow border
- **Mode tabs**: segmented control com sliding amber underline
- **PANIC**: warning stripes (diagonal yellow/black), pulsing red glow when armed
- **Connection bar**: consolidar em single-line com dot indicators: `● RS-485 ● DMX ● UDP ● ARTNET(4) | SIM | TX:1240 RX:890`
- **Corner brackets**: HUD overlay nos cantos do content area
- **Scanlines**: amber-tinted

### 2. `src/components/editor/LiveFiringPanel.tsx`

- Remover `deadmanHeld` da prop passada ao PyroFireOnePanel
- Manter deadman no LiveFiringPanel ARM bar para outros modos (super_dmx) mas **não** passar para PyroFireOnePanel
- Atualizar a linha que renderiza PyroFireOnePanel removendo `deadmanHeld={deadmanHeld}`

### 3. `src/index.css` — Animações

- `@keyframes pyro-scan-sweep`: varredura horizontal
- `@keyframes hold-ring`: stroke-dashoffset 100→0 em 300ms
- `.pyro-fire-confirmed`: flash verde
- `.pyro-fire-late`: pulse âmbar
- `.pyro-grid-group-header`: label de grupo com accent âmbar
- `.pyro-hud-corner`: corner brackets táticos

## Arquivos

1. `src/components/editor/live-firing/PyroFireOnePanel.tsx` — Overhaul completo
2. `src/components/editor/LiveFiringPanel.tsx` — Remover deadmanHeld da prop
3. `src/index.css` — Animações de suporte

## Notas Técnicas
- Sem mudanças no banco de dados
- Sem novas dependências
- Fire confirmation log em component state (não persistido)
- Hold-to-fire usa `setTimeout` + `requestAnimationFrame` para progress ring
- Deadman permanece no LiveFiringPanel para o modo super_dmx — só removido do PyroFireOnePanel

