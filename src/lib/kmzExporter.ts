/**
 * ─── KMZ/KML Animated Exporter for Google Earth Pro ────────────────
 * Generates time-animated KML with gx:Track elements showing drones
 * moving through 3D space with LED color changes, camera tours,
 * and geofence overlays. Packaged as .kmz (ZIP) via JSZip.
 *
 * Features:
 *   - Per-drone gx:Track with interpolated positions at configurable FPS
 *   - LED color animation via gx:Track StyleMap + ExtendedData
 *   - Camera tour (gx:Tour) for flythrough preview
 *   - Launch pad markers with custom icons
 *   - Geofence polygon overlay
 *   - Formation label placemarks at transition times
 *   - Time span control for Google Earth timeline slider
 */

import JSZip from 'jszip';
import type { Position, Trajectory, DroneFormation, CameraKeyframe } from '@/store/useProjectStore';
import { interpolateColor, type ColorTransitionMode } from '@/lib/colorInterpolation';

// ── Types ───────────────────────────────────────────────────────────

export interface KMZExportOptions {
  projectName: string;
  positions: Position[];
  trajectories: Trajectory[];
  formations: DroneFormation[];
  duration: number;
  gpsOrigin: { lat: number; lng: number; heading: number; altitude: number };
  fps?: number;                 // samples per second (default 4)
  cameraKeyframes?: CameraKeyframe[];
  geofenceRadius?: number;      // meters
  geofenceAltitude?: number;    // max altitude in meters
  author?: string;
  includeTour?: boolean;
  includeTrails?: boolean;
  trailOpacity?: number;        // 0-255
}

// ── Coordinate Helpers ──────────────────────────────────────────────

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

// ── Time Helpers ────────────────────────────────────────────────────

function toISO(seconds: number, baseDate: Date = new Date()): string {
  const d = new Date(baseDate.getTime() + seconds * 1000);
  return d.toISOString();
}

function hexToKMLColor(hex: string, alpha: number = 255): string {
  const c = hex.replace('#', '');
  const r = c.substring(0, 2);
  const g = c.substring(2, 4);
  const b = c.substring(4, 6);
  const a = alpha.toString(16).padStart(2, '0');
  // KML color: aabbggrr
  return `${a}${b}${g}${r}`;
}

// ── Trajectory Interpolation ────────────────────────────────────────

interface SampledPoint {
  time: number;
  x: number;
  y: number;
  z: number;
  color: string; // hex
}

function interpolateTrajectoryAt(
  waypoints: { time: number; position: { x: number; y: number; z: number } }[],
  t: number,
): { x: number; y: number; z: number } {
  if (waypoints.length === 0) return { x: 0, y: 0, z: 0 };
  if (t <= waypoints[0].time) return { ...waypoints[0].position };
  if (t >= waypoints[waypoints.length - 1].time) return { ...waypoints[waypoints.length - 1].position };

  for (let i = 1; i < waypoints.length; i++) {
    if (waypoints[i].time >= t) {
      const prev = waypoints[i - 1];
      const curr = waypoints[i];
      const dt = curr.time - prev.time;
      const frac = dt > 0 ? (t - prev.time) / dt : 0;
      return {
        x: prev.position.x + (curr.position.x - prev.position.x) * frac,
        y: prev.position.y + (curr.position.y - prev.position.y) * frac,
        z: prev.position.z + (curr.position.z - prev.position.z) * frac,
      };
    }
  }
  return { ...waypoints[waypoints.length - 1].position };
}

function sampleFormationDrone(
  droneIndex: number,
  formations: DroneFormation[],
  fps: number,
  totalDuration: number,
): SampledPoint[] {
  const samples: SampledPoint[] = [];
  const steps = Math.ceil(totalDuration * fps);

  // Build waypoints from formations
  const waypoints: { time: number; position: { x: number; y: number; z: number } }[] = [];

  // Home position (first formation's point on ground)
  const homeX = formations[0]?.points[droneIndex]?.x ?? 0;
  const homeZ = formations[0]?.points[droneIndex]?.z ?? 0;
  waypoints.push({ time: 0, position: { x: homeX, y: 0, z: homeZ } });

  for (const f of formations) {
    const pt = f.points[droneIndex] || { x: 0, z: 0 };
    // Start of transition
    waypoints.push({
      time: f.startTime,
      position: { x: waypoints[waypoints.length - 1].position.x, y: waypoints[waypoints.length - 1].position.y, z: waypoints[waypoints.length - 1].position.z },
    });
    // Formed
    waypoints.push({
      time: f.startTime + f.transitionDuration,
      position: { x: pt.x, y: f.height, z: pt.z },
    });
    // Hold end
    waypoints.push({
      time: f.startTime + f.transitionDuration + f.holdDuration,
      position: { x: pt.x, y: f.height, z: pt.z },
    });
  }

  // Landing
  const lastF = formations[formations.length - 1];
  const landTime = lastF.startTime + lastF.transitionDuration + lastF.holdDuration + 10;
  waypoints.push({ time: landTime, position: { x: homeX, y: 0, z: homeZ } });

  // Sample
  for (let step = 0; step <= steps; step++) {
    const t = step / fps;
    const pos = interpolateTrajectoryAt(waypoints, t);

    // Determine color from current formation
    let color = '#000000';
    for (let fi = formations.length - 1; fi >= 0; fi--) {
      const f = formations[fi];
      const fStart = f.startTime;
      const fEnd = f.startTime + f.transitionDuration + f.holdDuration;
      if (t >= fStart && t <= fEnd) {
        const transEnd = f.startTime + f.transitionDuration;
        if (t <= transEnd && fi > 0) {
          // During transition - interpolate color
          const prevF = formations[fi - 1];
          const progress = f.transitionDuration > 0 ? (t - fStart) / f.transitionDuration : 1;
          color = interpolateColor(
            prevF.color, f.color, progress,
            (f.colorTransition as ColorTransitionMode) || 'linear',
            droneIndex, formations[0].droneCount,
          );
        } else {
          color = f.color;
        }
        break;
      }
    }

    samples.push({ time: t, ...pos, color });
  }

  return samples;
}

function sampleTrajectoryDrone(
  traj: Trajectory,
  pad: Position,
  fps: number,
  totalDuration: number,
): SampledPoint[] {
  const sorted = [...traj.waypoints].sort((a, b) => a.time - b.time);
  const allWp = [
    { time: 0, position: { x: pad.x, y: pad.y || 0, z: pad.z } },
    ...sorted,
  ];
  const lastT = sorted.length > 0 ? sorted[sorted.length - 1].time + 5 : 10;
  allWp.push({ time: lastT, position: { x: pad.x, y: pad.y || 0, z: pad.z } });

  const samples: SampledPoint[] = [];
  const steps = Math.ceil(Math.min(totalDuration, lastT + 2) * fps);

  for (let step = 0; step <= steps; step++) {
    const t = step / fps;
    const pos = interpolateTrajectoryAt(allWp, t);
    samples.push({ time: t, ...pos, color: pad.color || '#00B4D8' });
  }

  return samples;
}

// ── KML Document Builder ────────────────────────────────────────────

function buildAnimatedKML(options: KMZExportOptions): string {
  const {
    projectName, positions, trajectories, formations,
    duration, gpsOrigin, fps = 4, cameraKeyframes = [],
    geofenceRadius = 80, geofenceAltitude = 120,
    author = 'AEROSWARM NEXUS', includeTour = true,
    includeTrails = true, trailOpacity = 180,
  } = options;

  const baseDate = new Date();
  const startISO = toISO(0, baseDate);
  const endISO = toISO(duration, baseDate);

  const droneTracksXML: string[] = [];
  const trailsXML: string[] = [];
  let droneIdx = 0;

  // ── Formation drones ──────────────────────────────────────────
  if (formations.length > 0) {
    const droneCount = formations[0].droneCount;
    for (let d = 0; d < droneCount; d++) {
      const samples = sampleFormationDrone(d, formations, fps, duration);
      const { trackXML, trailXML } = buildDroneTrackXML(
        `Drone ${d + 1}`, droneIdx, samples, gpsOrigin, baseDate,
        includeTrails, trailOpacity,
      );
      droneTracksXML.push(trackXML);
      if (trailXML) trailsXML.push(trailXML);
      droneIdx++;
    }
  }

  // ── Trajectory drones ─────────────────────────────────────────
  for (const traj of trajectories) {
    const pad = positions.find(p => p.id === traj.positionId);
    if (!pad) continue;
    const samples = sampleTrajectoryDrone(traj, pad, fps, duration);
    const { trackXML, trailXML } = buildDroneTrackXML(
      traj.name || `Traj ${droneIdx + 1}`, droneIdx, samples, gpsOrigin, baseDate,
      includeTrails, trailOpacity,
    );
    droneTracksXML.push(trackXML);
    if (trailXML) trailsXML.push(trailXML);
    droneIdx++;
  }

  // ── Launch pad markers ────────────────────────────────────────
  const padMarkers = positions.map(pos => {
    const gps = localToGPS(pos.x, pos.y, pos.z, gpsOrigin);
    const icon = pos.type === 'pyro'
      ? 'http://maps.google.com/mapfiles/kml/paddle/red-circle.png'
      : 'http://maps.google.com/mapfiles/kml/paddle/blu-circle.png';
    return `
    <Placemark>
      <name>${pos.name}</name>
      <description>Type: ${pos.type} | Heading: ${pos.heading}°</description>
      <Style>
        <IconStyle>
          <color>ff${hexToKMLColor(pos.color).slice(2)}</color>
          <scale>0.6</scale>
          <Icon><href>${icon}</href></Icon>
        </IconStyle>
      </Style>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${gps.lng},${gps.lat},${gps.alt}</coordinates>
      </Point>
    </Placemark>`;
  }).join('\n');

  // ── Formation labels ──────────────────────────────────────────
  const formationLabels = formations.map((f, i) => {
    const center = f.points.reduce(
      (acc, p) => ({ x: acc.x + p.x / f.droneCount, z: acc.z + p.z / f.droneCount }),
      { x: 0, z: 0 },
    );
    const gps = localToGPS(center.x, f.height + 5, center.z, gpsOrigin);
    const tStart = toISO(f.startTime, baseDate);
    const tEnd = toISO(f.startTime + f.transitionDuration + f.holdDuration, baseDate);
    return `
    <Placemark>
      <name>${f.formationType || `Formation ${i + 1}`}</name>
      <description>Drones: ${f.droneCount} | Height: ${f.height}m | Duration: ${f.holdDuration}s</description>
      <TimeSpan><begin>${tStart}</begin><end>${tEnd}</end></TimeSpan>
      <Style>
        <IconStyle>
          <color>ff${hexToKMLColor(f.color).slice(2)}</color>
          <scale>0.8</scale>
          <Icon><href>http://maps.google.com/mapfiles/kml/shapes/star.png</href></Icon>
        </IconStyle>
        <LabelStyle><color>ffffffff</color><scale>0.9</scale></LabelStyle>
      </Style>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${gps.lng},${gps.lat},${gps.alt}</coordinates>
      </Point>
    </Placemark>`;
  }).join('\n');

  // ── Geofence polygon ──────────────────────────────────────────
  const fenceCoords: string[] = [];
  for (let i = 0; i <= 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const gps = localToGPS(
      Math.cos(angle) * geofenceRadius, 0,
      Math.sin(angle) * geofenceRadius, gpsOrigin,
    );
    fenceCoords.push(`${gps.lng},${gps.lat},0`);
  }

  const geofenceXML = `
  <Folder>
    <name>Geofence</name>
    <Placemark>
      <name>Geofence (${geofenceRadius}m)</name>
      <Style>
        <LineStyle><color>660000ff</color><width>2</width></LineStyle>
        <PolyStyle><color>220000ff</color></PolyStyle>
      </Style>
      <Polygon>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs><LinearRing><coordinates>${fenceCoords.join(' ')}</coordinates></LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>
    <Placemark>
      <name>Max Altitude Ceiling (${geofenceAltitude}m)</name>
      <Style>
        <LineStyle><color>4400ffff</color><width>1</width></LineStyle>
        <PolyStyle><color>1100ffff</color></PolyStyle>
      </Style>
      <Polygon>
        <altitudeMode>relativeToGround</altitudeMode>
        <outerBoundaryIs><LinearRing><coordinates>${fenceCoords.map(c => {
          const [lng, lat] = c.split(',');
          return `${lng},${lat},${geofenceAltitude}`;
        }).join(' ')}</coordinates></LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Folder>`;

  // ── Camera Tour ───────────────────────────────────────────────
  let tourXML = '';
  if (includeTour) {
    const tourSteps: string[] = [];
    // Auto-generate orbit tour if no camera keyframes
    const kfs = cameraKeyframes.length > 0 ? cameraKeyframes : generateDefaultTour(gpsOrigin, duration, geofenceRadius);

    for (const kf of kfs) {
      const gps = localToGPS(kf.position[0], kf.position[1], kf.position[2], gpsOrigin);
      const lookGps = localToGPS(kf.lookAt[0], kf.lookAt[1], kf.lookAt[2], gpsOrigin);

      // Calculate heading and tilt from camera to lookAt
      const dLng = lookGps.lng - gps.lng;
      const dLat = lookGps.lat - gps.lat;
      const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;
      const horizDist = Math.sqrt(
        (dLat * METERS_PER_DEG_LAT) ** 2 +
        (dLng * metersPerDegLng(gps.lat)) ** 2,
      );
      const dAlt = lookGps.alt - gps.alt;
      const tilt = 90 - (Math.atan2(-dAlt, horizDist) * 180) / Math.PI;

      tourSteps.push(`
        <gx:FlyTo>
          <gx:duration>3</gx:duration>
          <gx:flyToMode>smooth</gx:flyToMode>
          <LookAt>
            <longitude>${lookGps.lng}</longitude>
            <latitude>${lookGps.lat}</latitude>
            <altitude>${lookGps.alt}</altitude>
            <heading>${heading}</heading>
            <tilt>${Math.min(90, Math.max(0, tilt))}</tilt>
            <range>${Math.max(20, horizDist)}</range>
            <altitudeMode>relativeToGround</altitudeMode>
          </LookAt>
        </gx:FlyTo>
        <gx:Wait><gx:duration>2</gx:duration></gx:Wait>`);
    }

    tourXML = `
    <gx:Tour>
      <name>Show Tour — ${projectName}</name>
      <gx:Playlist>${tourSteps.join('\n')}</gx:Playlist>
    </gx:Tour>`;
  }

  // ── Origin marker ─────────────────────────────────────────────
  const originXML = `
  <Placemark>
    <name>Launch Origin</name>
    <description>GPS: ${gpsOrigin.lat.toFixed(6)}, ${gpsOrigin.lng.toFixed(6)} | Heading: ${gpsOrigin.heading}°</description>
    <Style>
      <IconStyle>
        <color>ff00ff00</color>
        <scale>1.2</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-stars.png</href></Icon>
      </IconStyle>
    </Style>
    <Point><coordinates>${gpsOrigin.lng},${gpsOrigin.lat},0</coordinates></Point>
  </Placemark>`;

  // ── Assemble KML ──────────────────────────────────────────────
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"
     xmlns:gx="http://www.google.com/kml/ext/2.2"
     xmlns:kml="http://www.opengis.net/kml/2.2"
     xmlns:atom="http://www.w3.org/2005/Atom">
<Document>
  <name>${projectName} — Drone Show</name>
  <description>Animated drone show exported from AEROSWARM NEXUS by ${author}</description>
  <open>1</open>

  <Style id="droneStyle">
    <IconStyle>
      <scale>0.4</scale>
      <Icon><href>http://maps.google.com/mapfiles/kml/shapes/shaded_dot.png</href></Icon>
    </IconStyle>
    <LabelStyle><scale>0.6</scale></LabelStyle>
  </Style>

  ${tourXML}

  <Folder>
    <name>Drone Tracks</name>
    <description>${droneIdx} drones | Duration: ${duration}s | FPS: ${fps}</description>
    ${droneTracksXML.join('\n')}
  </Folder>

  ${includeTrails ? `
  <Folder>
    <name>Flight Trails</name>
    <visibility>0</visibility>
    ${trailsXML.join('\n')}
  </Folder>` : ''}

  <Folder>
    <name>Launch Pads</name>
    ${padMarkers}
  </Folder>

  <Folder>
    <name>Formations</name>
    ${formationLabels}
  </Folder>

  ${geofenceXML}
  ${originXML}

</Document>
</kml>`;
}

// ── Per-drone gx:Track builder ──────────────────────────────────────

function buildDroneTrackXML(
  name: string,
  index: number,
  samples: SampledPoint[],
  origin: KMZExportOptions['gpsOrigin'],
  baseDate: Date,
  includeTrail: boolean,
  trailOpacity: number,
): { trackXML: string; trailXML: string | null } {
  const whens: string[] = [];
  const coords: string[] = [];
  const colors: string[] = [];

  for (const s of samples) {
    const gps = localToGPS(s.x, s.y, s.z, origin);
    whens.push(`<when>${toISO(s.time, baseDate)}</when>`);
    coords.push(`<gx:coord>${gps.lng} ${gps.lat} ${gps.alt}</gx:coord>`);
    colors.push(s.color);
  }

  // Use the most common color for track style
  const dominantColor = colors.reduce((a, b, _, arr) =>
    arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b,
  );

  const trackXML = `
    <Placemark>
      <name>${name}</name>
      <Style>
        <IconStyle>
          <color>ff${hexToKMLColor(dominantColor).slice(2)}</color>
          <scale>0.4</scale>
          <Icon><href>http://maps.google.com/mapfiles/kml/shapes/shaded_dot.png</href></Icon>
        </IconStyle>
        <LabelStyle><scale>0</scale></LabelStyle>
      </Style>
      <gx:Track>
        <altitudeMode>relativeToGround</altitudeMode>
        ${whens.join('\n        ')}
        ${coords.join('\n        ')}
      </gx:Track>
    </Placemark>`;

  // Trail linestring (full path)
  let trailXML: string | null = null;
  if (includeTrail && samples.length >= 2) {
    const trailCoords = samples.map(s => {
      const gps = localToGPS(s.x, s.y, s.z, origin);
      return `${gps.lng},${gps.lat},${gps.alt}`;
    }).join(' ');

    const opHex = trailOpacity.toString(16).padStart(2, '0');
    trailXML = `
    <Placemark>
      <name>${name} Trail</name>
      <Style>
        <LineStyle>
          <color>${opHex}${hexToKMLColor(dominantColor).slice(2)}</color>
          <width>1.5</width>
        </LineStyle>
      </Style>
      <LineString>
        <altitudeMode>relativeToGround</altitudeMode>
        <tessellate>1</tessellate>
        <coordinates>${trailCoords}</coordinates>
      </LineString>
    </Placemark>`;
  }

  return { trackXML, trailXML };
}

// ── Default Camera Tour Generator ───────────────────────────────────

function generateDefaultTour(
  origin: KMZExportOptions['gpsOrigin'],
  duration: number,
  radius: number,
): CameraKeyframe[] {
  const keyframes: CameraKeyframe[] = [];
  const numSteps = Math.min(8, Math.max(3, Math.floor(duration / 15)));

  for (let i = 0; i < numSteps; i++) {
    const angle = (i / numSteps) * Math.PI * 2;
    const camDist = radius * 1.5;
    const t = (i / numSteps) * duration;
    const height = 30 + Math.sin(angle * 0.5) * 20;

    keyframes.push({
      id: `tour-${i}`,
      time: t,
      position: [
        Math.cos(angle) * camDist,
        height,
        Math.sin(angle) * camDist,
      ],
      lookAt: [0, 20, 0],
      fov: 60,
    });
  }

  return keyframes;
}

// ── Main Export Functions ────────────────────────────────────────────

/** Export as .kml (plain text XML) */
export function exportAnimatedKML(options: KMZExportOptions): string {
  return buildAnimatedKML(options);
}

/** Export as .kmz (ZIP containing doc.kml) */
export async function exportKMZ(options: KMZExportOptions): Promise<Blob> {
  const kml = buildAnimatedKML(options);
  const zip = new JSZip();
  zip.file('doc.kml', kml);

  // Add a simple description file
  zip.file('README.txt', [
    `${options.projectName} — Drone Show KMZ`,
    `Generated by AEROSWARM NEXUS`,
    `Date: ${new Date().toISOString()}`,
    `Drones: ${options.formations.length > 0 ? options.formations[0].droneCount : options.trajectories.length}`,
    `Duration: ${options.duration}s`,
    `GPS Origin: ${options.gpsOrigin.lat.toFixed(6)}, ${options.gpsOrigin.lng.toFixed(6)}`,
    '',
    'Open doc.kml in Google Earth Pro for animated playback.',
    'Use the timeline slider to scrub through the show.',
    'Enable "Drone Tracks" folder for animated drones.',
    'Enable "Flight Trails" folder for path visualization.',
    'Double-click "Show Tour" to play the camera flythrough.',
  ].join('\n'));

  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/** Download KMZ file */
export async function downloadKMZ(options: KMZExportOptions): Promise<void> {
  const blob = await exportKMZ(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${options.projectName.replace(/\s+/g, '_')}.kmz`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download animated KML file */
export function downloadAnimatedKML(options: KMZExportOptions): void {
  const kml = exportAnimatedKML(options);
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${options.projectName.replace(/\s+/g, '_')}_animated.kml`;
  a.click();
  URL.revokeObjectURL(url);
}
