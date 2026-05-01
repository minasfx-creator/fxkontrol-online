/**
 * FxkLogo — FXKONTROL canonical brand mark.
 *
 * Now backed by the vector `<FxkPentagonMark />` (resolution-independent SVG)
 * so the logo is pixel-perfect at 16px favicon, 28px sidebar header, 64px
 * auth splash, and any size in between — without raster blur.
 *
 * Color follows `currentColor` → controlled by Tailwind text-* class.
 * Defaults to cyan/sync (operational palette).
 *
 *   <FxkLogo />                              // mark only, 32px, cyan
 *   <FxkLogo size={28} variant="full" />     // mark + wordmark
 *   <FxkLogo variant="compact" />            // mark + "FXK"
 *
 * Tone overrides:
 *   <FxkLogo className="text-foreground" />  // monochrome on hero
 */
import { cn } from '@/lib/utils';
import { FxkPentagonMark } from './FxkPentagonMark';

interface FxkLogoProps {
  /** Mark size in px (square). */
  size?: number;
  /** Optional className wrapper (controls color via text-* utility). */
  className?: string;
  /** Show "FXKONTROL" wordmark to the right of the mark. */
  withWordmark?: boolean;
  /** Wordmark variant. */
  variant?: 'full' | 'mark-only' | 'compact';
  /** Reserved for backward compatibility — SVG is inline so no lazy concern. */
  priority?: boolean;
  /** Override mark tone (defaults to cyan sync). */
  tone?: 'sync' | 'foreground' | 'inherit';
}

const TONE_CLASS: Record<NonNullable<FxkLogoProps['tone']>, string> = {
  sync: 'text-status-sync',
  foreground: 'text-foreground',
  inherit: '',
};

export function FxkLogo({
  size = 32,
  className = '',
  withWordmark = false,
  variant = 'mark-only',
  tone = 'sync',
}: FxkLogoProps) {
  const showWordmark = withWordmark || variant === 'full' || variant === 'compact';
  const compact = variant === 'compact';

  return (
    <div className={cn('inline-flex items-center gap-2', className)} role="img" aria-label="FXKONTROL">
      <FxkPentagonMark size={size} className={cn('select-none shrink-0', TONE_CLASS[tone])} />
      {showWordmark && (
        <span
          className="ds-mono font-semibold uppercase tracking-[0.18em] text-foreground"
          style={{ fontSize: compact ? size * 0.4 : size * 0.5, lineHeight: 1 }}
        >
          {compact ? 'FXK' : 'FXKONTROL'}
        </span>
      )}
    </div>
  );
}

export default FxkLogo;
