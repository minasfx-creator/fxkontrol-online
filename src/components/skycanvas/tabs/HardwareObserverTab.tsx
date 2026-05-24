/**
 * Hardware Observer Tab — passive list of recognized controllers.
 * INERT: never arms, fires, or disarms. CTA opens /command for real ops.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Radio, ShieldAlert } from 'lucide-react';
import { useActiveControllers } from '@/hooks/useActiveControllers';
import { useWorkMode } from '@/core/safety/workMode';

export default function HardwareObserverTab() {
  const { controllers } = useActiveControllers();
  const navigate = useNavigate();
  const mode = useWorkMode();

  return (
    <div className="space-y-3 p-2">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="ds-mono text-[11px] uppercase tracking-wider text-cyan-300/90">
            Dispositivos reconhecidos
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Modo {mode} — somente observação. Use /command para operação real.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/command')}
          className="glass-chip ds-focus inline-flex items-center gap-1 px-2.5 py-1 text-[10px] ds-mono uppercase tracking-wider text-cyan-200 hover:text-cyan-100"
        >
          <ShieldAlert className="h-3 w-3" /> /command <ArrowUpRight className="h-3 w-3" />
        </button>
      </header>

      <div className="glass-section-divider" />

      {controllers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.08] p-4 text-center">
          <Radio className="h-5 w-5 mx-auto text-zinc-600 mb-2" />
          <p className="ds-mono text-[10px] text-zinc-500 uppercase tracking-wider">
            Nenhum hardware reconhecido
          </p>
          <button
            type="button"
            onClick={() => navigate('/dev/real-discovery')}
            className="mt-2 text-[10px] text-cyan-300 hover:text-cyan-200 underline"
          >
            Abrir Real Discovery →
          </button>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {controllers.map((c) => {
            const dev = c.device;
            const transports = Object.keys(dev.links ?? {});
            return (
              <li
                key={c.aggregateId}
                className="glass-chip flex items-center gap-2 px-3 py-2 rounded-lg"
              >
                <span
                  className={`h-2 w-2 rounded-full ${dev.online ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                  aria-label={dev.online ? 'online' : 'offline'}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-zinc-200 truncate">
                    {c.profile.label ?? dev.label ?? c.aggregateId}
                  </div>
                  <div className="ds-mono text-[9px] text-zinc-500 uppercase tracking-wider truncate">
                    {c.profile.kind} · {transports.join(' · ') || '—'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/command')}
                  className="text-[10px] text-cyan-300 hover:text-cyan-200 ds-mono uppercase tracking-wider ds-focus rounded px-1.5 py-0.5"
                  title="Abrir em /command (operação real)"
                >
                  abrir →
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
