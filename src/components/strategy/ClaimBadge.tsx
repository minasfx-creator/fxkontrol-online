import { CLAIM_STATUS_META, type ClaimStatus } from '@/lib/claims';
import { ShieldCheck, FlaskConical, Sparkles } from 'lucide-react';

const ICONS: Record<ClaimStatus, React.ComponentType<{ className?: string }>> = {
  validated: ShieldCheck,
  pilot: FlaskConical,
  marketing_hypothesis: Sparkles,
};

const TONE_CLASS: Record<'ok' | 'warn' | 'info', string> = {
  ok: 'ds-status-ok',
  warn: 'ds-status-warn',
  info: 'ds-status-info',
};

interface Props {
  status: ClaimStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function ClaimBadge({ status, size = 'sm', className = '' }: Props) {
  const meta = CLAIM_STATUS_META[status];
  const Icon = ICONS[status];
  const px = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1.5 rounded-md font-mono uppercase tracking-wider ${TONE_CLASS[meta.tone]} ${px} ${className}`}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {meta.label}
    </span>
  );
}
