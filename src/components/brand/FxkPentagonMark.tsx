/**
 * FxkPentagonMark — Vector pentagon XLR mark (canonical SVG).
 *
 * Geometry:
 *   • Outer pentagon (apex up) — XLR connector body silhouette.
 *   • 5 inner pin circles arranged in the canonical XLR-5 layout:
 *       pin 1 (top), pins 2–3 (upper-mid), pins 4–5 (lower-mid),
 *       grouped concentrically inside the body.
 *   • Center "FX" glyph dot — convergence marker (DMX/drones/pyro/laser/mesh).
 *
 * Color: stroke uses `currentColor` so callers control hue via Tailwind
 * (`text-status-sync`, `text-foreground`, etc). No hardcoded hex.
 *
 * Resolution-independent — same crispness at 16px favicon and 512px splash.
 */
import * as React from 'react';

export interface FxkPentagonMarkProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
  /** Stroke width in viewBox units (default 4 — calibrated for 100x100 box). */
  strokeWidth?: number;
  /** Render filled pin dots (default true). */
  filledPins?: boolean;
  title?: string;
}

export const FxkPentagonMark = React.forwardRef<SVGSVGElement, FxkPentagonMarkProps>(
  ({ size = 32, strokeWidth = 4, filledPins = true, title = 'FXKONTROL', className, ...rest }, ref) => {
    // Pentagon vertices on a 100x100 grid (apex up, centered at 50,52).
    // Computed: r=44, cx=50, cy=52, angle offsets [-90, -18, 54, 126, 198].
    const pts = '50,8 91.85,38.4 75.86,87.6 24.14,87.6 8.15,38.4';

    // XLR-5 pin layout (centered at 50,52, pin radius 6):
    //   pin1 top, pin2 upper-left, pin3 upper-right,
    //   pin4 lower-left, pin5 lower-right.
    const pins = [
      { cx: 50, cy: 32 },         // 1 — top
      { cx: 32, cy: 46 },         // 2 — upper-left
      { cx: 68, cy: 46 },         // 3 — upper-right
      { cx: 38, cy: 68 },         // 4 — lower-left
      { cx: 62, cy: 68 },         // 5 — lower-right
    ];

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={title}
        className={className}
        {...rest}
      >
        <title>{title}</title>
        {/* Outer pentagon body */}
        <polygon
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Inner pentagon (subtle inset, XLR housing depth cue) */}
        <polygon
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth * 0.35}
          strokeLinejoin="round"
          opacity={0.35}
          transform="translate(50 52) scale(0.78) translate(-50 -52)"
        />
        {/* 5-pin XLR */}
        {pins.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={5.5}
            fill={filledPins ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={filledPins ? 0 : strokeWidth * 0.6}
          />
        ))}
        {/* Convergence center dot — slightly muted */}
        <circle cx={50} cy={52} r={2.5} fill="currentColor" opacity={0.55} />
      </svg>
    );
  },
);
FxkPentagonMark.displayName = 'FxkPentagonMark';

export default FxkPentagonMark;
