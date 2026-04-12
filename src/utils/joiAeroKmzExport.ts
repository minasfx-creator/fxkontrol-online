/**
 * ─── Joi Aero KMZ Exporter ─────────────────────────────────────────
 * Generates KMZ files with safety zones (NFPA 1123) and airspace
 * restriction areas (NOTAM) for submission to DECEA / aeronautical authorities.
 */

// JSZip loaded dynamically to reduce initial bundle

export interface AeroKmzParams {
  eventName: string;
  date: string;
  startTime: string;
  endTime: string;
  gpsCenter: { lat: number; lng: number };
  maxCaliber: number; // mm
  maxAltitude: number; // meters AGL
  notamRadius: number; // nautical miles
  responsibleName: string;
  responsibleDoc: string;
}

// NFPA 1123 minimum distances (meters) by caliber (mm)
const NFPA_DISTANCES: Record<number, { fireZone: number; safetyZone: number }> = {
  50: { fireZone: 21, safetyZone: 15 },
  75: { fireZone: 42, safetyZone: 21 },
  100: { fireZone: 60, safetyZone: 30 },
  125: { fireZone: 80, safetyZone: 40 },
  150: { fireZone: 105, safetyZone: 53 },
  200: { fireZone: 140, safetyZone: 70 },
  300: { fireZone: 210, safetyZone: 105 },
};

function getNfpaDistance(caliber: number): { fireZone: number; safetyZone: number } {
  const keys = Object.keys(NFPA_DISTANCES).map(Number).sort((a, b) => a - b);
  // Find closest caliber >= given
  for (const k of keys) {
    if (k >= caliber) return NFPA_DISTANCES[k];
  }
  return NFPA_DISTANCES[keys[keys.length - 1]];
}

function generateCircleCoords(lat: number, lng: number, radiusMeters: number, alt: number, points = 72): string {
  const coords: string[] = [];
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusMeters * Math.cos(angle)) / metersPerDegLat;
    const dLng = (radiusMeters * Math.sin(angle)) / metersPerDegLng;
    coords.push(`${(lng + dLng).toFixed(8)},${(lat + dLat).toFixed(8)},${alt.toFixed(1)}`);
  }
  return coords.join(' ');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hexToKmlColor(hex: string, alpha = 255): string {
  const c = hex.replace('#', '');
  const r = c.substring(0, 2).toLowerCase();
  const g = c.substring(2, 4).toLowerCase();
  const b = c.substring(4, 6).toLowerCase();
  const a = alpha.toString(16).padStart(2, '0');
  return `${a}${b}${g}${r}`;
}

function generateAeroKml(params: AeroKmzParams): string {
  const { eventName, date, startTime, endTime, gpsCenter, maxCaliber, maxAltitude, notamRadius, responsibleName, responsibleDoc } = params;

  const nfpa = getNfpaDistance(maxCaliber);
  const falloutRadius = nfpa.fireZone * 1.5;
  const notamRadiusMeters = notamRadius * 1852; // NM to meters
  const maxAltFeet = Math.round(maxAltitude * 3.28084);

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"
     xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document>
  <name>${escapeXml(eventName)} — Planta de Segurança e NOTAM</name>
  <description>
Evento: ${escapeXml(eventName)}
Data: ${escapeXml(date)}
Horário: ${escapeXml(startTime)} - ${escapeXml(endTime)}
Calibre máximo: ${maxCaliber}mm
Altitude máxima: ${maxAltitude}m (${maxAltFeet}ft AGL)
Raio NOTAM: ${notamRadius} NM (${notamRadiusMeters}m)
Responsável: ${escapeXml(responsibleName)} — ${escapeXml(responsibleDoc)}
Coordenadas: ${gpsCenter.lat.toFixed(6)}°S, ${gpsCenter.lng.toFixed(6)}°W
Gerado por JOI · Secretária Executiva AI · FX KONTROL
  </description>
  <open>1</open>

  <!-- ══ Styles ══ -->
  <Style id="fire-zone">
    <LineStyle><color>ff0000ff</color><width>3</width></LineStyle>
    <PolyStyle><color>400000ff</color></PolyStyle>
  </Style>
  <Style id="safety-zone">
    <LineStyle><color>ff00a5ff</color><width>2</width></LineStyle>
    <PolyStyle><color>3000a5ff</color></PolyStyle>
  </Style>
  <Style id="fallout-zone">
    <LineStyle><color>ff00ffff</color><width>2</width></LineStyle>
    <PolyStyle><color>2000ffff</color></PolyStyle>
  </Style>
  <Style id="notam-zone">
    <LineStyle><color>ffff8c00</color><width>3</width></LineStyle>
    <PolyStyle><color>20ff8c00</color></PolyStyle>
  </Style>
  <Style id="center-point">
    <IconStyle>
      <color>ff00bfff</color>
      <scale>1.5</scale>
      <Icon><href>http://maps.google.com/mapfiles/kml/shapes/target.png</href></Icon>
    </IconStyle>
    <LabelStyle><color>ffffffff</color><scale>1.0</scale></LabelStyle>
  </Style>

  <!-- ══ Zonas de Segurança (NFPA 1123) ══ -->
  <Folder>
    <name>Zonas de Segurança — NFPA 1123 (${maxCaliber}mm)</name>
    <open>1</open>

    <!-- Ponto Central -->
    <Placemark>
      <name>Centro do Evento</name>
      <description>Coordenadas: ${gpsCenter.lat.toFixed(6)}, ${gpsCenter.lng.toFixed(6)}
${escapeXml(eventName)} — ${escapeXml(date)}</description>
      <styleUrl>#center-point</styleUrl>
      <Point>
        <coordinates>${gpsCenter.lng.toFixed(8)},${gpsCenter.lat.toFixed(8)},0</coordinates>
      </Point>
    </Placemark>

    <!-- 🔴 Zona de Fogo -->
    <Placemark>
      <name>🔴 Zona de Fogo — ${nfpa.fireZone}m (${maxCaliber}mm)</name>
      <description>Distância mínima de público conforme NFPA 1123 para calibre ${maxCaliber}mm: ${nfpa.fireZone}m
Apenas blasters autorizados dentro desta zona.</description>
      <styleUrl>#fire-zone</styleUrl>
      <Polygon>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs><LinearRing>
          <coordinates>${generateCircleCoords(gpsCenter.lat, gpsCenter.lng, nfpa.fireZone, 0)}</coordinates>
        </LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>

    <!-- 🟠 Zona de Segurança Equipe -->
    <Placemark>
      <name>🟠 Zona de Segurança Equipe — ${nfpa.safetyZone}m</name>
      <description>Raio mínimo para equipe técnica conforme NFPA 1123.</description>
      <styleUrl>#safety-zone</styleUrl>
      <Polygon>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs><LinearRing>
          <coordinates>${generateCircleCoords(gpsCenter.lat, gpsCenter.lng, nfpa.safetyZone, 0)}</coordinates>
        </LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>

    <!-- 🟡 Zona de Fallout -->
    <Placemark>
      <name>🟡 Zona de Fallout — ${falloutRadius.toFixed(0)}m</name>
      <description>Raio de queda de detritos (1.5x zona de fogo). Área monitorada.</description>
      <styleUrl>#fallout-zone</styleUrl>
      <Polygon>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs><LinearRing>
          <coordinates>${generateCircleCoords(gpsCenter.lat, gpsCenter.lng, falloutRadius, 0)}</coordinates>
        </LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Folder>

  <!-- ══ Restrição de Espaço Aéreo (NOTAM) ══ -->
  <Folder>
    <name>Restrição Aérea — NOTAM (${notamRadius} NM)</name>
    <open>1</open>

    <!-- 🔵 Cilindro de Restrição Aérea (base) -->
    <Placemark>
      <name>🔵 Restrição Aérea — ${notamRadius} NM / ${maxAltFeet}ft AGL</name>
      <description>Raio: ${notamRadius} NM (${notamRadiusMeters}m)
Teto: ${maxAltitude}m (${maxAltFeet}ft AGL)
Período: ${escapeXml(startTime)} - ${escapeXml(endTime)} (${escapeXml(date)})
Tipo: Queima de fogos de artifício / Operação pirotécnica</description>
      <styleUrl>#notam-zone</styleUrl>
      <Polygon>
        <altitudeMode>relativeToGround</altitudeMode>
        <outerBoundaryIs><LinearRing>
          <coordinates>${generateCircleCoords(gpsCenter.lat, gpsCenter.lng, notamRadiusMeters, maxAltitude)}</coordinates>
        </LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>

    <!-- Base do cilindro -->
    <Placemark>
      <name>Base — Restrição Aérea</name>
      <styleUrl>#notam-zone</styleUrl>
      <Polygon>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs><LinearRing>
          <coordinates>${generateCircleCoords(gpsCenter.lat, gpsCenter.lng, notamRadiusMeters, 0)}</coordinates>
        </LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Folder>

  <!-- ══ Camera ══ -->
  <LookAt>
    <longitude>${gpsCenter.lng.toFixed(8)}</longitude>
    <latitude>${gpsCenter.lat.toFixed(8)}</latitude>
    <altitude>0</altitude>
    <heading>0</heading>
    <tilt>45</tilt>
    <range>${Math.max(notamRadiusMeters * 3, 500)}</range>
    <altitudeMode>relativeToGround</altitudeMode>
  </LookAt>
</Document>
</kml>`;

  return kml;
}

// ── Public API ──────────────────────────────────────────────────────

export function parseKmzReadyBlock(text: string): AeroKmzParams | null {
  const match = text.match(/\[KMZ_READY\]([\s\S]*?)\[\/KMZ_READY\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim()) as AeroKmzParams;
  } catch {
    return null;
  }
}

export function stripKmzReadyBlock(text: string): string {
  return text.replace(/\[KMZ_READY\][\s\S]*?\[\/KMZ_READY\]/g, '').trim();
}

export async function downloadAeroKmz(params: AeroKmzParams): Promise<void> {
  const kml = generateAeroKml(params);
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('doc.kml', kml);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  const safeName = params.eventName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const filename = `NOTAM_${safeName}_${params.date.replace(/\//g, '-')}.kmz`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
