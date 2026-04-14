/**
 * Sparkline — Minimal SVG trend line (FUI principle: no axes, no labels)
 */

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  color?: string;
}

export default function Sparkline({ data, width = 80, height = 20, className = '', color }: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  });

  const pathD = `M${points.join(' L')}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ filter: 'drop-shadow(0 0 3px currentColor)' }}
    >
      <path
        d={pathD}
        fill="none"
        stroke={color || 'hsl(var(--fxk-cyan))'}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
