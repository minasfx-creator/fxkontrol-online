/**
 * venueKmlExport — Build a KML document (and optional .kmz ZIP) describing
 * a georeferenced show plan:
 *   • Placemark per launch point (with caliber + role)
 *   • Audience perimeter (Circle approximated as 64-vertex polygon)
 *   • Water feature polygon
 *   • No-fly zone polygons
 *   • NFPA min-distance ring per launch point
 *
 * Output is NOTAM-friendly and openable in Google Earth / QGIS.
 * Read-only: no safety state, no hardware. All claims documentary.
 */
import JSZip from 'jszip';
import type { VenueShowPreset } from '@/lib/showVenuePresets';
import { nfpaMinDistanceM } from '@/utils/joiGeoHelpers';

const EARTH_R = 6_378_137; // meters
const DEG = Math.PI / 180;

/**
 * Project a metric (dx east, dy north) offset (m) back into lat/lng using a
 * planar approximation centred at `center`. Adequate to <10 km.
 */
function offsetLatLng(centerLat: number, centerLng: number, dxEast: number, dyNorth: number) {
  const dLat = dyNorth / EARTH_R;
  const dLng = dxEast / (EARTH_R * Math.cos(centerLat * DEG));
  return { lat: centerLat + dLat / DEG, lng: centerLng + dLng / DEG };
}

function circlePolygon(lat: number, lng: number, radiusM: number, segments = 64) {
  const out: { lat: number; lng: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    out.push(offsetLatLng(lat, lng, Math.cos(a) * radiusM, Math.sin(a) * radiusM));
  }
  return out;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function coordString(pts: { lat: number; lng: number }[], alt = 0): string {
  return pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)},${alt}`).join(' ');
}

function placemarkPoint(name: string, desc: string, lat: number, lng: number, alt = 0): string {
  return `
    <Placemark>
      <name>${escapeXml(name)}</name>
      <description>${escapeXml(desc)}</description>
      <styleUrl>#fxk-launch</styleUrl>
      <Point><coordinates>${lng.toFixed(6)},${lat.toFixed(6)},${alt}</coordinates></Point>
    </Placemark>`;
}

function placemarkPolygon(name: string, styleId: string, polygon: { lat: number; lng: number }[]): string {
  // KML expects polygon to be closed.
  const closed = polygon.length > 0 && (polygon[0]!.lat !== polygon[polygon.length - 1]!.lat || polygon[0]!.lng !== polygon[polygon.length - 1]!.lng)
    ? [...polygon, polygon[0]!]
    : polygon;
  return `
    <Placemark>
      <name>${escapeXml(name)}</name>
      <styleUrl>#${styleId}</styleUrl>
      <Polygon><outerBoundaryIs><LinearRing>
        <coordinates>${coordString(closed)}</coordinates>
      </LinearRing></outerBoundaryIs></Polygon>
    </Placemark>`;
}

function placemarkLineRing(name: string, styleId: string, polygon: { lat: number; lng: number }[]): string {
  return `
    <Placemark>
      <name>${escapeXml(name)}</name>
      <styleUrl>#${styleId}</styleUrl>
      <LineString><tessellate>1</tessellate>
        <coordinates>${coordString(polygon)}</coordinates>
      </LineString>
    </Placemark>`;
}

/** Build the KML document string for a VenueShowPreset. */
export function buildVenueKml(preset: VenueShowPreset): string {
  const v = preset.venue;
  const launchMarks = v.launchPoints
    .map((lp) =>
      placemarkPoint(
        lp.name,
        `Role: ${lp.role}\nCaliber max: ${lp.calibreMaxMm ?? '—'} mm\nHeight AGL hint: ${lp.heightHintAGL ?? '—'} m`,
        lp.lat,
        lp.lng,
        lp.heightHintAGL ?? 0,
      ),
    )
    .join('');

  const audience = v.audienceArea
    ? placemarkLineRing(
        'Audience perimeter',
        'fxk-audience',
        circlePolygon(v.audienceArea.lat, v.audienceArea.lng, v.audienceArea.radiusM),
      )
    : '';

  const water = v.waterFeature
    ? placemarkPolygon(`Water (${v.waterFeature.kind})`, 'fxk-water', v.waterFeature.polygon)
    : '';

  const noFly = (v.noFlyZones ?? [])
    .map((poly, i) => placemarkPolygon(`No-fly zone ${i + 1}`, 'fxk-nofly', poly))
    .join('');

  const nfpa = v.launchPoints
    .map((lp) =>
      placemarkLineRing(
        `NFPA min — ${lp.name} (${lp.calibreMaxMm ?? 75} mm → ${nfpaMinDistanceM(lp.calibreMaxMm ?? 75).toFixed(0)} m)`,
        'fxk-nfpa',
        circlePolygon(lp.lat, lp.lng, nfpaMinDistanceM(lp.calibreMaxMm ?? 75)),
      ),
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(preset.name)} — FXKONTROL Show Plan</name>
    <description>${escapeXml(preset.description)}\n\nReference: ${escapeXml(preset.reference.event)} (${preset.reference.scale}). Coordinates are indicative — refine before any operational use.</description>

    <Style id="fxk-launch">
      <IconStyle><color>ff00d4ff</color><scale>1.1</scale></IconStyle>
      <LabelStyle><color>ff00d4ff</color><scale>0.9</scale></LabelStyle>
    </Style>
    <Style id="fxk-audience">
      <LineStyle><color>ffeed822</color><width>3</width></LineStyle>
    </Style>
    <Style id="fxk-water">
      <LineStyle><color>ffff9933</color><width>2</width></LineStyle>
      <PolyStyle><color>33ff9933</color></PolyStyle>
    </Style>
    <Style id="fxk-nofly">
      <LineStyle><color>ff0000ff</color><width>2</width></LineStyle>
      <PolyStyle><color>3300004f</color></PolyStyle>
    </Style>
    <Style id="fxk-nfpa">
      <LineStyle><color>ff0bb5f5</color><width>2</width></LineStyle>
    </Style>

    <Folder><name>Launch points</name>${launchMarks}</Folder>
    <Folder><name>Audience</name>${audience}</Folder>
    <Folder><name>Water feature</name>${water}</Folder>
    <Folder><name>No-fly zones</name>${noFly}</Folder>
    <Folder><name>NFPA min-distance rings</name>${nfpa}</Folder>
  </Document>
</kml>`;
}

/** Build a KMZ (ZIP containing doc.kml) blob for a venue preset. */
export async function buildVenueKmz(preset: VenueShowPreset): Promise<Blob> {
  const kml = buildVenueKml(preset);
  const zip = new JSZip();
  zip.file('doc.kml', kml);
  zip.file(
    '_FXK_DISCLAIMER.txt',
    [
      'FXKONTROL — Georeferenced show plan',
      '',
      `Venue: ${preset.name}`,
      `Reference: ${preset.reference.event} (${preset.reference.location})`,
      '',
      'Claim: marketing_hypothesis. Coordinates and dimensions are indicative,',
      'extracted from public references. Always re-validate against current local',
      'NOTAM / AVCB / DECEA / NFPA 1123 and physical site survey before any',
      'operational use. FXKONTROL never arms or fires from documents.',
    ].join('\n'),
  );
  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.google-earth.kmz' });
}

/** Trigger a browser download of the KMZ file. */
export async function downloadVenueKmz(preset: VenueShowPreset): Promise<void> {
  const blob = await buildVenueKmz(preset);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${preset.id}.kmz`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
