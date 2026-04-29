/**
 * ─── AutoControllerLauncher — global hardware overlay ─────────────
 * Floats a small card at the bottom-right of every authenticated route
 * whenever a recognised module/equipment becomes online. The card type
 * is chosen by `controller.profile.kind`:
 *   • fxk16 / fireone / showven  → PyroControllerCard (ARM/FIRE/E-STOP)
 *   • tuya / cubemesh            → TuyaControllerCard (ON/OFF/ALL OFF)
 *   • enttec / dmx-generic /
 *     artnet-node                → DmxControllerCard  (BLACKOUT/HOLD)
 *   • anything else              → GenericControllerCard (deep-link only)
 *
 * Driven by `useActiveControllers`. Multiple devices stack vertically.
 * Honest-hardware: never auto-arms, never auto-fires, never fakes a
 * write success.
 */
import { useNavigate } from 'react-router-dom';
import { useActiveControllers, type ActiveController } from '@/hooks/useActiveControllers';
import type { ControllerKind } from '@/core/discovery/controllerRegistry';
import { PyroControllerCard } from './cards/PyroControllerCard';
import { TuyaControllerCard } from './cards/TuyaControllerCard';
import { DmxControllerCard } from './cards/DmxControllerCard';
import { GenericControllerCard } from './cards/GenericControllerCard';

const PYRO_KINDS: ReadonlySet<ControllerKind> = new Set(['fxk16', 'fireone', 'showven']);
const TUYA_KINDS: ReadonlySet<ControllerKind> = new Set(['tuya', 'cubemesh']);
const DMX_KINDS: ReadonlySet<ControllerKind> = new Set(['enttec', 'dmx-generic', 'artnet-node']);

function CardForKind({
  controller,
  onClose,
  onOpenConsole,
}: {
  controller: ActiveController;
  onClose: () => void;
  onOpenConsole: () => void;
}) {
  const kind = controller.profile.kind;
  if (PYRO_KINDS.has(kind)) {
    return <PyroControllerCard controller={controller} onClose={onClose} onOpenConsole={onOpenConsole} />;
  }
  if (TUYA_KINDS.has(kind)) {
    return <TuyaControllerCard controller={controller} onClose={onClose} onOpenConsole={onOpenConsole} />;
  }
  if (DMX_KINDS.has(kind)) {
    return <DmxControllerCard controller={controller} onClose={onClose} onOpenConsole={onOpenConsole} />;
  }
  return <GenericControllerCard controller={controller} onClose={onClose} onOpenConsole={onOpenConsole} />;
}

export function AutoControllerLauncher() {
  const { pending, acknowledge } = useActiveControllers();
  const navigate = useNavigate();

  if (pending.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2"
      aria-live="polite"
    >
      {pending.map((c) => {
        const open = () => {
          if (c.profile.consoleRoute) navigate(c.profile.consoleRoute);
          acknowledge(c.aggregateId);
        };
        return (
          <div key={c.aggregateId} className="pointer-events-auto">
            <CardForKind
              controller={c}
              onClose={() => acknowledge(c.aggregateId)}
              onOpenConsole={open}
            />
          </div>
        );
      })}
    </div>
  );
}

export default AutoControllerLauncher;
