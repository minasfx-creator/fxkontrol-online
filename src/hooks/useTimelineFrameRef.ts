/**
 * useTimelineFrameRef — Zero-render ref to the canonical timeline time.
 *
 * Por quê
 * ────────
 * O `useProjectStore.currentTime` é a fonte oficial de tempo da UI, mas é
 * propagado via React state. Entre o áudio escrever em `timelineClock`
 * e o React re-renderizar, há até ~16 ms de janela em que o tempo da UI
 * está atrás do áudio real. Para FX cinematográficos (burst sync com
 * batida do kick, flash sync com snare) qualquer drift > ~5 ms é visível.
 *
 * Este hook entrega uma `RefObject<number>` que é atualizada DIRETAMENTE
 * por `timelineClock.onChange`, **sem trigger de render**. FX dentro de
 * `useFrame()` podem ler `ref.current` para o tempo do clock canonical
 * (que reflete `audio.currentTime` quando audio está como master) com
 * latência efetivamente zero.
 *
 * Quem deve usar
 * ──────────────
 *  - Shaders/uniforms cuja única dependência é `t`.
 *  - Geradores de partícula que avaliam `elapsed = t - fireTime` por frame.
 *  - Qualquer overlay que pisque/pulse no beat.
 *
 * Quem NÃO deve usar
 * ──────────────────
 *  - Componentes cujo *layout* depende de `currentTime` (renderiza/oculta
 *    item baseado em janela). Esses precisam re-render → use o store.
 *
 * O hook não muda contrato algum do TimelineClock — só expõe uma view.
 *
 * `getTimelineFrameTime()` (export adicional) é um snapshot one-shot
 * para handlers (ex.: onClick) que precisam do tempo "agora" sem hook.
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import { timelineClock } from '@/core/timeline/TimelineClock';

/**
 * Ref atualizada a cada notificação do clock. Seguro para ler em
 * `useFrame` ou em qualquer callback síncrono — não dispara re-render.
 */
export function useTimelineFrameRef(): MutableRefObject<number> {
  const ref = useRef<number>(timelineClock.getTime());
  useEffect(() => {
    // Initial snapshot on mount in case clock advanced before this effect.
    ref.current = timelineClock.getTime();
    const unsubscribe = timelineClock.onChange((state) => {
      ref.current = state.time;
    });
    return unsubscribe;
  }, []);
  return ref;
}

/**
 * Snapshot one-shot do tempo canonical da timeline. Use em handlers
 * imperativos (onClick, drop, etc). Para loop de render use o hook ref.
 */
export function getTimelineFrameTime(): number {
  return timelineClock.getTime();
}
