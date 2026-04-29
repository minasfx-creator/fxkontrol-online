/**
 * ─── LiveStatusChip — operator-facing readiness badge ─────────────
 * Honest-hardware chip rendered at the top of every controller card so
 * the operator can tell *at a glance* whether tapping ARM/FIRE/ON/OFF
 * will actually reach the wire:
 *
 *   🟢 LIVE       — pelo menos um link com sender real registrado
 *                   E provenance verificada (handshake OK).
 *   🟡 READ-ONLY  — link online + handshake OK, mas sem sender real
 *                   (por exemplo Tuya BLE sem session-key, Art-Net node
 *                   apenas observado via mDNS).
 *   🔴 NO-OP      — nenhum sender real ativo: tap só loga no blackbox,
 *                   nada chega no equipamento.
 *
 * Pure presentational: o caller computa o estado a partir do
 * `PhysicalDevice` + adapters concretos (`tuyaOutletControl.hasRealSender`,
 * `dmxQuickActions.listUniverses`, `useFXK16Bridge.isConnected`, etc.).
 */
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type LiveStatus = 'live' | 'read-only' | 'no-op';

export interface LiveStatusChipProps {
  status: LiveStatus;
  /** Optional short reason shown as `title` (tooltip). */
  reason?: string;
  className?: string;
}

const STATUS_LABEL: Record<LiveStatus, string> = {
  'live':      'LIVE',
  'read-only': 'READ-ONLY',
  'no-op':     'NO-OP',
};

export function LiveStatusChip({ status, reason, className }: LiveStatusChipProps) {
  return (
    <Badge
      variant="outline"
      title={reason ?? STATUS_LABEL[status]}
      className={cn(
        'h-5 gap-1 px-1.5 text-[10px] font-mono uppercase',
        status === 'live'      && 'border-green-500/50 text-green-500',
        status === 'read-only' && 'border-yellow-500/50 text-yellow-500',
        status === 'no-op'     && 'border-red-500/50 text-red-500',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          status === 'live'      && 'bg-green-500 animate-pulse',
          status === 'read-only' && 'bg-yellow-500',
          status === 'no-op'     && 'bg-red-500',
        )}
      />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export default LiveStatusChip;
