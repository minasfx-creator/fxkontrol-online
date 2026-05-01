/**
 * FxkLogo — FXKONTROL pentagon XLR-inspired logo
 *
 * Brand identity per branding brief (sec 6.1):
 *  - Pentagon shape evoking XLR connector pin layout
 *  - 5-pin formation = convergence of multiple technologies (DMX/drones/pyro/laser/mesh)
 *  - Cyan stroke = sync/communication semantic (matches operational palette)
 *
 * Use this in headers, splash, login, about pages, and anywhere the brand mark is needed.
 * For favicon/social, use /favicon.png (separate raster export).
 */
import logoSrc from '@/assets/logo-fxkontrol-pentagon.png';

interface FxkLogoProps {
  /** Logo size in px. Square. */
  size?: number;
  /** Optional className wrapper */
  className?: string;
  /** Show "FXKONTROL" wordmark to the right */
  withWordmark?: boolean;
  /** Wordmark variant */
  variant?: 'full' | 'mark-only' | 'compact';
  /** Set to true for hero/LCP usage to avoid lazy-loading penalty */
  priority?: boolean;
}

export function FxkLogo({
  size = 32,
  className = '',
  withWordmark = false,
  variant = 'mark-only',
  priority = false,
}: FxkLogoProps) {
  const showWordmark = withWordmark || variant === 'full' || variant === 'compact';
  const compact = variant === 'compact';

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} role="img" aria-label="FXKONTROL">
      <img
        src={logoSrc}
        alt="FXKONTROL pentagon mark"
        width={size}
        height={size}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        className="select-none"
        style={{ width: size, height: size }}
      />
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
