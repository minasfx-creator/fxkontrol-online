/**
 * venuePlanPdf — One-page A4 georeferenced show plan PDF for a venue preset.
 *
 * Layout:
 *   • Header (venue + reference)
 *   • Mini map (canvas Mercator-projection of audience/water/no-fly + launch
 *     points + NFPA rings), embedded as PNG
 *   • Launch point table (role, lat/lng, height AGL, caliber, NFPA min)
 *   • Narrative beats Gantt
 *   • Disclaimer footer
 *
 * No safety state. Claim: marketing_hypothesis.
 */
import jsPDF from 'jspdf';
import type { VenueShowPreset } from '@/lib/showVenuePresets';
import { nfpaMinDistanceM } from '@/utils/joiGeoHelpers';

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14;

interface BBoxLL {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
}

function collectBBox(preset: VenueShowPreset): BBoxLL {
  const pts: { lat: number; lng: number }[] = [];
  pts.push(preset.venue.gps);
  preset.venue.launchPoints.forEach((lp) => pts.push({ lat: lp.lat, lng: lp.lng }));
  preset.venue.waterFeature?.polygon.forEach((p) => pts.push(p));
  preset.venue.noFlyZones?.forEach((poly) => poly.forEach((p) => pts.push(p)));
  if (preset.venue.audienceArea) {
    const r = preset.venue.audienceArea.radiusM / 111_000;
    pts.push({ lat: preset.venue.audienceArea.lat + r, lng: preset.venue.audienceArea.lng });
    pts.push({ lat: preset.venue.audienceArea.lat - r, lng: preset.venue.audienceArea.lng });
    pts.push({ lat: preset.venue.audienceArea.lat, lng: preset.venue.audienceArea.lng + r });
    pts.push({ lat: preset.venue.audienceArea.lat, lng: preset.venue.audienceArea.lng - r });
  }
  // Also include NFPA-ring extents.
  preset.venue.launchPoints.forEach((lp) => {
    const r = nfpaMinDistanceM(lp.calibreMaxMm ?? 75) / 111_000;
    pts.push({ lat: lp.lat + r, lng: lp.lng });
    pts.push({ lat: lp.lat - r, lng: lp.lng });
    pts.push({ lat: lp.lat, lng: lp.lng + r });
    pts.push({ lat: lp.lat, lng: lp.lng - r });
  });
  const minLat = Math.min(...pts.map((p) => p.lat));
  const maxLat = Math.max(...pts.map((p) => p.lat));
  const minLng = Math.min(...pts.map((p) => p.lng));
  const maxLng = Math.max(...pts.map((p) => p.lng));
  return { minLat, maxLat, minLng, maxLng };
}

export function renderVenueMapCanvas(preset: VenueShowPreset, width = 1100, height = 700): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  // Background — Vantablack with subtle grid.
  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, width, height);

  const bbox = collectBBox(preset);
  const pad = 0.05;
  const latPad = (bbox.maxLat - bbox.minLat) * pad || 0.001;
  const lngPad = (bbox.maxLng - bbox.minLng) * pad || 0.001;
  const lat0 = bbox.minLat - latPad;
  const lat1 = bbox.maxLat + latPad;
  const lng0 = bbox.minLng - lngPad;
  const lng1 = bbox.maxLng + lngPad;

  // Equirectangular cosine-corrected projection — fine at this scale.
  const cosLat = Math.cos(((lat0 + lat1) / 2) * Math.PI / 180);
  const dLng = (lng1 - lng0) * cosLat;
  const dLat = lat1 - lat0;
  const aspect = width / height;
  let projW: number, projH: number, offX: number, offY: number;
  if (dLng / dLat > aspect) {
    projW = width;
    projH = (dLat / dLng) * width * aspect;
    offX = 0;
    offY = (height - projH) / 2;
  } else {
    projH = height;
    projW = (dLng / dLat) * height / aspect;
    offX = (width - projW) / 2;
    offY = 0;
  }
  const project = (lat: number, lng: number) => ({
    x: offX + ((lng - lng0) * cosLat / dLng) * projW,
    y: offY + projH - ((lat - lat0) / dLat) * projH,
  });

  // Grid
  ctx.strokeStyle = 'rgba(34,211,238,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    const x = (width / 10) * i;
    const y = (height / 10) * i;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Water feature
  if (preset.venue.waterFeature) {
    ctx.fillStyle = 'rgba(59,130,246,0.18)';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    preset.venue.waterFeature.polygon.forEach((p, i) => {
      const { x, y } = project(p.lat, p.lng);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // No-fly zones
  ctx.fillStyle = 'rgba(239,68,68,0.12)';
  ctx.strokeStyle = '#ef4444';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  (preset.venue.noFlyZones ?? []).forEach((poly) => {
    ctx.beginPath();
    poly.forEach((p, i) => {
      const { x, y } = project(p.lat, p.lng);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Audience perimeter
  if (preset.venue.audienceArea) {
    const center = project(preset.venue.audienceArea.lat, preset.venue.audienceArea.lng);
    const east = project(
      preset.venue.audienceArea.lat,
      preset.venue.audienceArea.lng + preset.venue.audienceArea.radiusM / (111_000 * cosLat),
    );
    const r = Math.abs(east.x - center.x);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#22d3ee';
    ctx.font = '14px sans-serif';
    ctx.fillText('Audience', center.x + 6, center.y - 6);
  }

  // NFPA rings + launch points
  preset.venue.launchPoints.forEach((lp) => {
    const center = project(lp.lat, lp.lng);
    const east = project(
      lp.lat,
      lp.lng + nfpaMinDistanceM(lp.calibreMaxMm ?? 75) / (111_000 * cosLat),
    );
    const r = Math.abs(east.x - center.x);
    // NFPA ring
    ctx.strokeStyle = 'rgba(245,158,11,0.85)';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Marker
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(center.x, center.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(lp.name, center.x + 7, center.y + 3);
  });

  // Compass
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('N', width - 22, 22);
  ctx.strokeStyle = '#22d3ee';
  ctx.beginPath();
  ctx.moveTo(width - 18, 26);
  ctx.lineTo(width - 18, 52);
  ctx.stroke();

  // Scale bar (~ 200 m)
  const scaleMeters = 200;
  const scalePx = (scaleMeters / (dLng * 111_000)) * projW;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(18, height - 22);
  ctx.lineTo(18 + scalePx, height - 22);
  ctx.stroke();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '11px sans-serif';
  ctx.fillText(`${scaleMeters} m`, 18, height - 28);

  return canvas;
}

/** Build the PDF document (jsPDF instance) for a venue preset. */
export function buildVenuePlanPdf(preset: VenueShowPreset): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(5, 8, 16);
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('FXKONTROL — Georeferenced Show Plan', M, 10);
  doc.setFontSize(10);
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.text(preset.name, M, 16);
  doc.text(`${preset.reference.event} · ${preset.reference.location}`, M, 20);

  // Map
  const canvas = renderVenueMapCanvas(preset);
  const dataUrl = canvas.toDataURL('image/png');
  const mapW = PAGE_W - M * 2;
  const mapH = (canvas.height / canvas.width) * mapW;
  doc.addImage(dataUrl, 'PNG', M, 26, mapW, mapH);

  let y = 26 + mapH + 6;

  // Anchor metadata
  doc.setTextColor(40);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Anchor: ${preset.venue.gps.lat.toFixed(5)}, ${preset.venue.gps.lng.toFixed(5)}   ·   Heading from audience: ${preset.venue.headingFromAudience.toFixed(0)}°   ·   Duration: ${preset.durationSec}s`,
    M, y,
  );
  y += 6;

  // Launch points table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Launch points', M, y);
  y += 4;
  doc.setFontSize(8);
  const cols = ['ID', 'Name', 'Role', 'Lat', 'Lng', 'AGL m', 'Cal mm', 'NFPA m'];
  const colXs = [M, M + 16, M + 46, M + 64, M + 88, M + 112, M + 130, M + 150];
  doc.setFillColor(34, 211, 238);
  doc.setTextColor(5, 8, 16);
  doc.rect(M, y - 3, PAGE_W - M * 2, 5, 'F');
  cols.forEach((c, i) => doc.text(c, colXs[i]!, y));
  y += 4;
  doc.setTextColor(40);
  doc.setFont('helvetica', 'normal');

  preset.venue.launchPoints.forEach((lp, i) => {
    if (y > PAGE_H - 28) {
      doc.addPage();
      y = M;
    }
    if (i % 2 === 0) {
      doc.setFillColor(244, 247, 252);
      doc.rect(M, y - 3, PAGE_W - M * 2, 4.5, 'F');
    }
    const row = [
      lp.id,
      lp.name,
      lp.role,
      lp.lat.toFixed(5),
      lp.lng.toFixed(5),
      String(lp.heightHintAGL ?? '—'),
      String(lp.calibreMaxMm ?? '—'),
      nfpaMinDistanceM(lp.calibreMaxMm ?? 75).toFixed(0),
    ];
    row.forEach((c, idx) => doc.text(String(c), colXs[idx]!, y));
    y += 4.5;
  });

  y += 4;
  if (y > PAGE_H - 40) { doc.addPage(); y = M; }

  // Narrative beats Gantt
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Narrative beats', M, y);
  y += 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const ganttX = M;
  const ganttW = PAGE_W - M * 2;
  const ganttH = 8;
  doc.setDrawColor(180);
  doc.rect(ganttX, y, ganttW, ganttH);
  preset.narrativeBeats.forEach((b) => {
    const x = ganttX + (b.tStart / preset.durationSec) * ganttW;
    const w = ((b.tEnd - b.tStart) / preset.durationSec) * ganttW;
    const moodColor: Record<string, [number, number, number]> = {
      intro: [99, 102, 241],
      build: [34, 211, 238],
      climax: [245, 158, 11],
      breath: [148, 163, 184],
      outro: [99, 102, 241],
      finale: [239, 68, 68],
    };
    const [r, g, bl] = moodColor[b.mood] ?? [22, 211, 238];
    doc.setFillColor(r, g, bl);
    doc.rect(x, y, Math.max(0.5, w), ganttH, 'F');
    doc.setTextColor(255);
    doc.setFontSize(6);
    doc.text(b.mood, x + 0.6, y + 5);
  });
  doc.setTextColor(40);
  y += ganttH + 4;
  doc.setFontSize(8);
  doc.text(`0s`, ganttX, y);
  doc.text(`${preset.durationSec}s`, ganttX + ganttW - 8, y);
  y += 6;

  // Disclaimer footer
  if (y > PAGE_H - 28) { doc.addPage(); y = M; }
  doc.setFillColor(248, 248, 248);
  doc.rect(M, y, PAGE_W - M * 2, 18, 'F');
  doc.setTextColor(80);
  doc.setFontSize(7);
  const disc = [
    'CLAIM: marketing_hypothesis — Coordinates and dimensions are indicative and extracted from public references.',
    'Always re-validate against current local NOTAM / AVCB / CBM / DECEA / ANAC / NFPA 1123 and a physical site survey.',
    'FXKONTROL never arms or fires from documents. Real operation requires Phase 2 hardware-verified transition.',
  ];
  disc.forEach((line, i) => doc.text(line, M + 2, y + 5 + i * 4));

  return doc;
}

/** Trigger a browser download of the venue plan PDF. */
export function downloadVenuePlanPdf(preset: VenueShowPreset): void {
  const pdf = buildVenuePlanPdf(preset);
  pdf.save(`${preset.id}-plan.pdf`);
}
