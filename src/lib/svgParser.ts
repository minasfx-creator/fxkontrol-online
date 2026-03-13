/**
 * SVG → Drone Formation Parser
 * Parses SVG path data and converts to drone formation points.
 * Supports: M, L, C, Q, Z commands (absolute and relative).
 */

export interface SVGFormationResult {
  points: { x: number; z: number }[];
  width: number;
  height: number;
  pathCount: number;
}

interface Point2D { x: number; y: number }

/**
 * Tokenize an SVG path `d` attribute into commands.
 */
function tokenizePath(d: string): { cmd: string; args: number[] }[] {
  const tokens: { cmd: string; args: number[] }[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(d)) !== null) {
    const cmd = match[1];
    const argsStr = match[2].trim();
    const args = argsStr.length > 0
      ? argsStr.split(/[\s,]+/).map(Number).filter(n => !isNaN(n))
      : [];
    tokens.push({ cmd, args });
  }

  return tokens;
}

/**
 * Sample points along an SVG path at uniform intervals.
 */
function samplePath(d: string, numPoints: number): Point2D[] {
  const tokens = tokenizePath(d);
  if (tokens.length === 0) return [];

  // First pass: trace all segments to compute path points
  const pathPoints: Point2D[] = [];
  let cx = 0, cy = 0; // current position
  let sx = 0, sy = 0; // subpath start

  for (const { cmd, args } of tokens) {
    const isRel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();

    switch (C) {
      case 'M': {
        for (let i = 0; i < args.length; i += 2) {
          cx = isRel ? cx + args[i] : args[i];
          cy = isRel ? cy + args[i + 1] : args[i + 1];
          if (i === 0) { sx = cx; sy = cy; }
          pathPoints.push({ x: cx, y: cy });
        }
        break;
      }
      case 'L': {
        for (let i = 0; i < args.length; i += 2) {
          cx = isRel ? cx + args[i] : args[i];
          cy = isRel ? cy + args[i + 1] : args[i + 1];
          pathPoints.push({ x: cx, y: cy });
        }
        break;
      }
      case 'H': {
        for (const a of args) {
          cx = isRel ? cx + a : a;
          pathPoints.push({ x: cx, y: cy });
        }
        break;
      }
      case 'V': {
        for (const a of args) {
          cy = isRel ? cy + a : a;
          pathPoints.push({ x: cx, y: cy });
        }
        break;
      }
      case 'C': {
        // Cubic bezier — sample intermediate points
        for (let i = 0; i < args.length; i += 6) {
          const x1 = isRel ? cx + args[i] : args[i];
          const y1 = isRel ? cy + args[i + 1] : args[i + 1];
          const x2 = isRel ? cx + args[i + 2] : args[i + 2];
          const y2 = isRel ? cy + args[i + 3] : args[i + 3];
          const ex = isRel ? cx + args[i + 4] : args[i + 4];
          const ey = isRel ? cy + args[i + 5] : args[i + 5];

          const steps = 10;
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const mt = 1 - t;
            pathPoints.push({
              x: mt * mt * mt * cx + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * ex,
              y: mt * mt * mt * cy + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * ey,
            });
          }
          cx = ex; cy = ey;
        }
        break;
      }
      case 'Q': {
        // Quadratic bezier
        for (let i = 0; i < args.length; i += 4) {
          const x1 = isRel ? cx + args[i] : args[i];
          const y1 = isRel ? cy + args[i + 1] : args[i + 1];
          const ex = isRel ? cx + args[i + 2] : args[i + 2];
          const ey = isRel ? cy + args[i + 3] : args[i + 3];

          const steps = 8;
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const mt = 1 - t;
            pathPoints.push({
              x: mt * mt * cx + 2 * mt * t * x1 + t * t * ex,
              y: mt * mt * cy + 2 * mt * t * y1 + t * t * ey,
            });
          }
          cx = ex; cy = ey;
        }
        break;
      }
      case 'A': {
        // Arc — approximate with line to endpoint
        for (let i = 0; i < args.length; i += 7) {
          cx = isRel ? cx + args[i + 5] : args[i + 5];
          cy = isRel ? cy + args[i + 6] : args[i + 6];
          pathPoints.push({ x: cx, y: cy });
        }
        break;
      }
      case 'Z': {
        cx = sx; cy = sy;
        pathPoints.push({ x: cx, y: cy });
        break;
      }
    }
  }

  if (pathPoints.length === 0) return [];

  // Compute cumulative arc lengths
  const arcLengths: number[] = [0];
  for (let i = 1; i < pathPoints.length; i++) {
    const dx = pathPoints[i].x - pathPoints[i - 1].x;
    const dy = pathPoints[i].y - pathPoints[i - 1].y;
    arcLengths.push(arcLengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }

  const totalLength = arcLengths[arcLengths.length - 1];
  if (totalLength === 0) return pathPoints.slice(0, numPoints);

  // Sample uniformly along arc length
  const sampled: Point2D[] = [];
  for (let i = 0; i < numPoints; i++) {
    const targetLen = (i / numPoints) * totalLength;
    // Find segment
    let segIdx = 0;
    for (let j = 1; j < arcLengths.length; j++) {
      if (arcLengths[j] >= targetLen) { segIdx = j - 1; break; }
      segIdx = j - 1;
    }
    const segLen = arcLengths[segIdx + 1] - arcLengths[segIdx];
    const t = segLen > 0 ? (targetLen - arcLengths[segIdx]) / segLen : 0;
    const p0 = pathPoints[segIdx];
    const p1 = pathPoints[Math.min(segIdx + 1, pathPoints.length - 1)];
    sampled.push({
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
    });
  }

  return sampled;
}

/**
 * Parse SVG content and extract all path data.
 */
function extractPaths(svgContent: string): string[] {
  const paths: string[] = [];
  const pathRe = /<path[^>]*\sd="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(svgContent)) !== null) {
    paths.push(m[1]);
  }
  // Also try rect, circle, ellipse as simple shapes
  const rectRe = /<rect[^>]*x="([^"]*)"[^>]*y="([^"]*)"[^>]*width="([^"]*)"[^>]*height="([^"]*)"/gi;
  while ((m = rectRe.exec(svgContent)) !== null) {
    const x = parseFloat(m[1]) || 0;
    const y = parseFloat(m[2]) || 0;
    const w = parseFloat(m[3]) || 10;
    const h = parseFloat(m[4]) || 10;
    paths.push(`M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`);
  }
  const circRe = /<circle[^>]*cx="([^"]*)"[^>]*cy="([^"]*)"[^>]*r="([^"]*)"/gi;
  while ((m = circRe.exec(svgContent)) !== null) {
    const cx = parseFloat(m[1]) || 0;
    const cy = parseFloat(m[2]) || 0;
    const r = parseFloat(m[3]) || 10;
    // Approximate circle with 4 cubic beziers
    const k = 0.5522847498;
    paths.push(`M${cx},${cy - r} C${cx + r * k},${cy - r} ${cx + r},${cy - r * k} ${cx + r},${cy} C${cx + r},${cy + r * k} ${cx + r * k},${cy + r} ${cx},${cy + r} C${cx - r * k},${cy + r} ${cx - r},${cy + r * k} ${cx - r},${cy} C${cx - r},${cy - r * k} ${cx - r * k},${cy - r} ${cx},${cy - r} Z`);
  }
  return paths;
}

/**
 * Parse SVG and generate drone formation points.
 * Points are centered at origin and scaled to fit within the given radius.
 */
export function parseSVGToFormation(
  svgContent: string,
  droneCount: number,
  targetRadius: number = 20,
): SVGFormationResult {
  const paths = extractPaths(svgContent);
  if (paths.length === 0) {
    return { points: [], width: 0, height: 0, pathCount: 0 };
  }

  // Distribute drones proportionally across paths by estimated length
  const allPathPoints: Point2D[][] = paths.map(d => {
    const tokens = tokenizePath(d);
    // Rough length estimate
    const pts = samplePath(d, 50);
    return pts;
  });

  const lengths = allPathPoints.map(pts => {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.sqrt((pts[i].x - pts[i - 1].x) ** 2 + (pts[i].y - pts[i - 1].y) ** 2);
    }
    return len;
  });

  const totalLength = lengths.reduce((a, b) => a + b, 0);
  if (totalLength === 0) {
    return { points: [], width: 0, height: 0, pathCount: paths.length };
  }

  // Sample points proportionally
  let allPoints: Point2D[] = [];
  let remaining = droneCount;

  for (let i = 0; i < paths.length; i++) {
    const count = i === paths.length - 1
      ? remaining
      : Math.max(1, Math.round((lengths[i] / totalLength) * droneCount));
    remaining -= count;
    if (remaining < 0) remaining = 0;

    const sampled = samplePath(paths[i], count);
    allPoints = allPoints.concat(sampled);
  }

  // Trim or pad
  if (allPoints.length > droneCount) allPoints = allPoints.slice(0, droneCount);

  // Compute bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of allPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const scale = targetRadius * 2 / Math.max(w, h);

  // Center and scale, map SVG Y → 3D Z (invert Y for correct orientation)
  const formationPoints = allPoints.map(p => ({
    x: (p.x - centerX) * scale,
    z: -(p.y - centerY) * scale,
  }));

  return {
    points: formationPoints,
    width: w * scale,
    height: h * scale,
    pathCount: paths.length,
  };
}
