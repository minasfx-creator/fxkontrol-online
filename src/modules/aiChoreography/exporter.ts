/**
 * Exporters for the expanded AI choreography:
 * - CSV (Skybrush / Drone Show Software friendly): drone_id,timestamp,x,y,z,r,g,b
 * - JSON (compact)
 */
import type { ExpandedShow } from './types';

export function expandedShowToCSV(show: ExpandedShow): string {
  const header = 'drone_id,timestamp,x,y,z,r,g,b';
  const lines: string[] = [header];
  for (const d of show.drones) {
    for (const f of d.frames) {
      lines.push(
        `${d.drone_id},${f.t.toFixed(3)},${f.x.toFixed(3)},${f.y.toFixed(3)},${f.z.toFixed(3)},${f.r},${f.g},${f.b}`,
      );
    }
  }
  return lines.join('\n');
}

function triggerDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadExpandedShowCSV(show: ExpandedShow, filename = 'fxk_ai_choreo.csv') {
  triggerDownload(expandedShowToCSV(show), filename, 'text/csv');
}
export function downloadExpandedShowJSON(show: ExpandedShow, filename = 'fxk_ai_choreo.json') {
  triggerDownload(JSON.stringify(show, null, 2), filename, 'application/json');
}
