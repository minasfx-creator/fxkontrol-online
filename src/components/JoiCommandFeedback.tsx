/**
 * JoiCommandFeedback — Inline visual feedback for executed Joi commands
 */
import { CheckCircle, XCircle, Zap } from 'lucide-react';
import type { JoiCommandResult } from '@/utils/joiCommandExecutor';

interface Props {
  results: JoiCommandResult[];
}

export default function JoiCommandFeedback({ results }: Props) {
  if (!results.length) return null;

  return (
    <div
      className="mt-2 rounded-lg px-2.5 py-2 space-y-1"
      style={{
        background: 'hsl(190 100% 50% / 0.04)',
        border: '1px solid hsl(190 100% 50% / 0.1)',
      }}
    >
      <div className="flex items-center gap-1 mb-1">
        <Zap className="w-3 h-3" style={{ color: 'hsl(38 100% 55%)' }} />
        <span className="text-[8px] font-mono tracking-[0.2em] uppercase" style={{ color: 'hsl(38 100% 55% / 0.7)' }}>
          COMANDOS EXECUTADOS
        </span>
      </div>
      {results.map((r, i) => (
        <div key={i} className="flex items-start gap-1.5">
          {r.success ? (
            <CheckCircle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'hsl(140 70% 50%)' }} />
          ) : (
            <XCircle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'hsl(0 70% 55%)' }} />
          )}
          <div className="min-w-0">
            <span className="text-[9px] font-mono" style={{ color: r.success ? 'hsl(180 8% 82%)' : 'hsl(0 70% 70%)' }}>
              {r.label}
            </span>
            {r.detail && (
              <span className="text-[8px] font-mono ml-1" style={{ color: 'hsl(190 100% 50% / 0.4)' }}>
                {r.detail}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
