/**
 * ─── Geo Tools KML/KMZ Exporter ────────────────────────────────────
 * Exports markers, ruler measurements, and paths/polygons from the
 * viewport Geo Tools into KML/KMZ format compatible with Google Earth.
 */

import JSZip from 'jszip';
import type { GeoMarker, GeoRulerPoint, GeoPath } from '@/components/editor/ViewportGeoTools';

export interface GeoToolsKMLOptions {
  markers: GeoMarker[];
  rulers: GeoRulerPoint[];
  paths: GeoPath[];
  gpsOrigin: { lat: number; lng: number; heading: number; altitude: number };
  projectName?: string;
  author?: string;
}

// ── Coordinate conversion (local 3D → GPS) ─────────────────────────

const METERS_PER_DEG_LAT = 111320;

function metersPerDegLng(lat: number): number {
  return 111320 * Math.cos((lat * Math.PI) / 180);
}

function localToGPS(
  x: number, y: number, z: number,
  origin: { lat: number; lng: number; heading: number; altitude: number },
): { lat: number; lng: number; alt: number } {
  const rad = (-origin.heading * Math.PI) / 180;
  const rx = x * Math.cos(rad) - z * Math.sin(rad);
  const rz = x * Math.sin(rad) + z * Math.cos(rad);
  return {
    lng: origin.lng + rx / metersPerDegLng(origin.lat),
    lat: origin.lat - rz / METERS_PER_DEG_LAT,
    alt: origin.altitude + y,
  };
}

function hexToKMLColor(hex: string, alpha: number = 255): string {
  const c = hex.replace('#', '');
  const r = c.substring(0, 2).toLowerCase();
  const g = c.substring(2, 4).toLowerCase();
  const b = c.substring(4, 6).toLowerCase();
  const a = alpha.toString(16).padStart(2, '0');
  return `${a}${b}${g}${r}`;
}

// ── KML Generation ──────────────────────────────────────────────────

function generateGeoToolsKML(opts: GeoToolsKMLOptions): string {
  const { markers, rulers, paths, gpsOrigin, projectName = 'FX Kontrol Geo Tools', author = 'Minas FX' } = opts;

  const visibleMarkers = markers.filter(m => m.visible);
  const visibleRulers = rulers.filter(r => r.visible);
  const visiblePaths = paths.filter(p => p.visible);

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"
     xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document>
  <name>${escapeXml(projectName)}</name>
  <description>Exported from FX Kontrol Geo Tools by ${escapeXml(author)}</description>
  <open>1</open>
`;

  // ── Styles ──
  // Marker styles
  visibleMarkers.forEach(m => {
    kml += `  <Style id="marker-${m.id}">
    <IconStyle>
      <color>${hexToKMLColor(m.color)}</color>
      <scale>1.2</scale>
      <Icon><href>http://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon>
    </IconStyle>
    <LabelStyle>
      <color>ffffffff</color>
      <scale>0.8</scale>
    </LabelStyle>
  </Style>
`;
  });

  // Ruler style
  kml += `  <Style id="ruler-line">
    <LineStyle>
      <color>ff00bfff</color>
      <width>3</width>
    </LineStyle>
    <IconStyle>
      <color>ff00bfff</color>
      <scale>0.6</scale>
      <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
    </IconStyle>
  </Style>
`;

  // ── Markers folder ──
  if (visibleMarkers.length > 0) {
    kml += `  <Folder>
    <name>Marcadores</name>
    <open>1</open>
`;
    visibleMarkers.forEach(m => {
      const gps = localToGPS(m.position[0], m.position[1], m.position[2], gpsOrigin);
      kml += `    <Placemark>
      <name>${escapeXml(m.name)}</name>
      <description>Coordenadas locais: X=${m.position[0].toFixed(2)}, Y=${m.position[1].toFixed(2)}, Z=${m.position[2].toFixed(2)}</description>
      <styleUrl>#marker-${m.id}</styleUrl>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${gps.lng.toFixed(8)},${gps.lat.toFixed(8)},${gps.alt.toFixed(2)}</coordinates>
      </Point>
    </Placemark>
`;
    });
    kml += `  </Folder>
`;
  }

  // ── Rulers folder ──
  if (visibleRulers.length > 0) {
    kml += `  <Folder>
    <name>Medições</name>
    <open>1</open>
`;
    visibleRulers.forEach(r => {
      const gpsPoints = r.points.map(p => localToGPS(p[0], p[1], p[2], gpsOrigin));
      const coords = gpsPoints.map(g => `${g.lng.toFixed(8)},${g.lat.toFixed(8)},${g.alt.toFixed(2)}`).join(' ');

      kml += `    <Placemark>
      <name>${escapeXml(r.label)} — ${r.totalDistance.toFixed(1)}m</name>
      <description>Distância total: ${r.totalDistance.toFixed(2)} metros (${r.points.length} pontos)</description>
      <styleUrl>#ruler-line</styleUrl>
      <LineString>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>
`;

      // Segment distance placemarks
      for (let i = 0; i < r.points.length - 1; i++) {
        const p1 = r.points[i];
        const p2 = r.points[i + 1];
        const dist = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2 + (p2[2] - p1[2]) ** 2);
        const mid: [number, number, number] = [
          (p1[0] + p2[0]) / 2,
          (p1[1] + p2[1]) / 2,
          (p1[2] + p2[2]) / 2,
        ];
        const gpsMid = localToGPS(mid[0], mid[1], mid[2], gpsOrigin);
        kml += `    <Placemark>
      <name>${dist.toFixed(1)}m</name>
      <styleUrl>#ruler-line</styleUrl>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${gpsMid.lng.toFixed(8)},${gpsMid.lat.toFixed(8)},${(gpsMid.alt + 0.5).toFixed(2)}</coordinates>
      </Point>
    </Placemark>
`;
      }

      // Endpoint markers
      r.points.forEach((p, i) => {
        const gps = localToGPS(p[0], p[1], p[2], gpsOrigin);
        kml += `    <Placemark>
      <name>P${i + 1}</name>
      <styleUrl>#ruler-line</styleUrl>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${gps.lng.toFixed(8)},${gps.lat.toFixed(8)},${gps.alt.toFixed(2)}</coordinates>
      </Point>
    </Placemark>
`;
      });
    });
    kml += `  </Folder>
`;
  }

  // ── Paths/Polygons folder ──
  if (visiblePaths.length > 0) {
    kml += `  <Folder>
    <name>Caminhos e Polígonos</name>
    <open>1</open>
`;
    visiblePaths.forEach(p => {
      const gpsPoints = p.points.map(pt => localToGPS(pt[0], pt[1], pt[2], gpsOrigin));
      const kmlColor = hexToKMLColor(p.color);

      // Style per path
      kml += `    <Style id="path-${p.id}">
      <LineStyle>
        <color>${kmlColor}</color>
        <width>3</width>
      </LineStyle>
      <PolyStyle>
        <color>${hexToKMLColor(p.color, 60)}</color>
      </PolyStyle>
      <IconStyle>
        <color>${kmlColor}</color>
        <scale>0.5</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
    </Style>
`;

      if (p.closed) {
        // Polygon
        const ringCoords = [...gpsPoints, gpsPoints[0]]
          .map(g => `${g.lng.toFixed(8)},${g.lat.toFixed(8)},${g.alt.toFixed(2)}`)
          .join(' ');

        // Calculate area (approximate, using shoelace on lat/lng)
        let area = 0;
        for (let i = 0; i < gpsPoints.length; i++) {
          const j = (i + 1) % gpsPoints.length;
          area += gpsPoints[i].lng * gpsPoints[j].lat;
          area -= gpsPoints[j].lng * gpsPoints[i].lat;
        }
        area = Math.abs(area / 2) * METERS_PER_DEG_LAT * metersPerDegLng(gpsOrigin.lat);

        kml += `    <Placemark>
      <name>${escapeXml(p.name)}</name>
      <description>Polígono fechado — ${p.points.length} vértices, ~${area.toFixed(0)} m²</description>
      <styleUrl>#path-${p.id}</styleUrl>
      <Polygon>
        <altitudeMode>relativeToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${ringCoords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
`;
      } else {
        // Path (LineString)
        const coords = gpsPoints.map(g => `${g.lng.toFixed(8)},${g.lat.toFixed(8)},${g.alt.toFixed(2)}`).join(' ');
        let totalLen = 0;
        for (let i = 0; i < p.points.length - 1; i++) {
          const [x1, y1, z1] = p.points[i];
          const [x2, y2, z2] = p.points[i + 1];
          totalLen += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
        }

        kml += `    <Placemark>
      <name>${escapeXml(p.name)}</name>
      <description>Caminho — ${p.points.length} pontos, ${totalLen.toFixed(1)}m total</description>
      <styleUrl>#path-${p.id}</styleUrl>
      <LineString>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>
`;
      }

      // Start marker
      const startGps = gpsPoints[0];
      kml += `    <Placemark>
      <name>${escapeXml(p.name)} — Início</name>
      <styleUrl>#path-${p.id}</styleUrl>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${startGps.lng.toFixed(8)},${startGps.lat.toFixed(8)},${startGps.alt.toFixed(2)}</coordinates>
      </Point>
    </Placemark>
`;
    });
    kml += `  </Folder>
`;
  }

  // ── LookAt (center camera on origin) ──
  kml += `  <LookAt>
    <longitude>${gpsOrigin.lng.toFixed(8)}</longitude>
    <latitude>${gpsOrigin.lat.toFixed(8)}</latitude>
    <altitude>${gpsOrigin.altitude}</altitude>
    <heading>${gpsOrigin.heading}</heading>
    <tilt>60</tilt>
    <range>200</range>
    <altitudeMode>relativeToGround</altitudeMode>
  </LookAt>
</Document>
</kml>`;

  return kml;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Public API ──────────────────────────────────────────────────────

export function exportGeoToolsKML(opts: GeoToolsKMLOptions): string {
  return generateGeoToolsKML(opts);
}

export async function exportGeoToolsKMZ(opts: GeoToolsKMLOptions): Promise<Blob> {
  const kml = generateGeoToolsKML(opts);
  const zip = new JSZip();
  zip.file('doc.kml', kml);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export function downloadGeoToolsKML(opts: GeoToolsKMLOptions, filename = 'geo-tools.kml'): void {
  const kml = exportGeoToolsKML(opts);
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  downloadBlob(blob, filename);
}

export async function downloadGeoToolsKMZ(opts: GeoToolsKMLOptions, filename = 'geo-tools.kmz'): Promise<void> {
  const blob = await exportGeoToolsKMZ(opts);
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
