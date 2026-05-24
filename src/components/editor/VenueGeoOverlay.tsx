/**
 * VenueGeoOverlay — In-scene 3D overlay that visualises the active venue
 * preset on top of Google 3D Tiles:
 *
 *   • Audience perimeter (cyan circle)
 *   • Water feature (blue polygon)
 *   • No-fly zones (red polygons)
 *   • Per-launch-point NFPA min-distance ring (amber)
 *
 * Read-only: never mutates positions, never touches safety/CommandBus.
 * Auto-hides when no preset is active.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { useActiveVenue } from '@/store/useActiveVenue';
import { useSceneStore } from '@/store/useSceneStore';
import { getVenuePreset } from '@/lib/showVenuePresets';
import { geoToLocalSync } from '@/core/geo/useGeo';
import { nfpaMinDistanceM } from '@/utils/joiGeoHelpers';

const OVERLAY_Y = 0.6; // small lift above terrain to avoid z-fight

function polyToLocal(
  polygon: { lat: number; lng: number }[],
  anchor: { lat: number; lng: number; alt: number },
  y: number,
): Float32Array {
  const out = new Float32Array(polygon.length * 3);
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!;
    const local = geoToLocalSync(p.lat, p.lng, 0, anchor.lat, anchor.lng, anchor.alt);
    out[i * 3 + 0] = local.x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = local.z;
  }
  return out;
}

function ringPoints(
  centerLat: number,
  centerLng: number,
  radiusM: number,
  anchor: { lat: number; lng: number; alt: number },
  segments = 64,
): Float32Array {
  // Build ring in local meters around the center, then offset by center's local pos.
  const center = geoToLocalSync(centerLat, centerLng, 0, anchor.lat, anchor.lng, anchor.alt);
  const out = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    out[i * 3 + 0] = center.x + Math.cos(a) * radiusM;
    out[i * 3 + 1] = OVERLAY_Y;
    out[i * 3 + 2] = center.z + Math.sin(a) * radiusM;
  }
  return out;
}

function LineLoopFromArray({
  positions,
  color,
  closed,
  dashed,
}: {
  positions: Float32Array;
  color: string;
  closed: boolean;
  dashed?: boolean;
}) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    if (closed && positions.length >= 9) {
      const looped = new Float32Array(positions.length + 3);
      looped.set(positions, 0);
      looped[positions.length + 0] = positions[0]!;
      looped[positions.length + 1] = positions[1]!;
      looped[positions.length + 2] = positions[2]!;
      g.setAttribute('position', new THREE.BufferAttribute(looped, 3));
    } else {
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }
    return g;
  }, [positions, closed]);

  const mat = useMemo(() => {
    const m = dashed
      ? new THREE.LineDashedMaterial({
          color,
          dashSize: 6,
          gapSize: 4,
          transparent: true,
          opacity: 0.85,
          depthTest: true,
        })
      : new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.85,
          depthTest: true,
        });
    return m;
  }, [color, dashed]);

  return (
    <line
      // @ts-expect-error r3f primitive
      args={[geom, mat]}
      onUpdate={(l: any) => dashed && l.computeLineDistances?.()}
    />
  );
}

export default function VenueGeoOverlay() {
  const activeId = useActiveVenue((s) => s.activeVenuePresetId);
  const anchorLat = useSceneStore((s) => s.settings.geoAnchorLat);
  const anchorLng = useSceneStore((s) => s.settings.geoAnchorLon);
  const anchorAlt = useSceneStore((s) => s.settings.geoAnchorAlt);
  const google3DTilesEnabled = useSceneStore((s) => s.settings.google3DTilesEnabled);

  const preset = activeId ? getVenuePreset(activeId) : undefined;

  const layers = useMemo(() => {
    if (!preset || !google3DTilesEnabled) return null;
    const anchor = { lat: anchorLat, lng: anchorLng, alt: anchorAlt };

    const audience =
      preset.venue.audienceArea
        ? ringPoints(
            preset.venue.audienceArea.lat,
            preset.venue.audienceArea.lng,
            preset.venue.audienceArea.radiusM,
            anchor,
          )
        : null;

    const water = preset.venue.waterFeature
      ? polyToLocal(preset.venue.waterFeature.polygon, anchor, OVERLAY_Y - 0.05)
      : null;

    const noFly = (preset.venue.noFlyZones ?? []).map((poly) =>
      polyToLocal(poly, anchor, OVERLAY_Y),
    );

    const nfpaRings = preset.venue.launchPoints.map((lp) => ({
      id: lp.id,
      caliber: lp.calibreMaxMm ?? 75,
      radius: nfpaMinDistanceM(lp.calibreMaxMm ?? 75),
      positions: ringPoints(lp.lat, lp.lng, nfpaMinDistanceM(lp.calibreMaxMm ?? 75), anchor),
    }));

    return { audience, water, noFly, nfpaRings };
  }, [preset, google3DTilesEnabled, anchorLat, anchorLng, anchorAlt]);

  if (!layers) return null;

  return (
    <group name="venue-geo-overlay" renderOrder={50}>
      {layers.audience && (
        <LineLoopFromArray positions={layers.audience} color="#22d3ee" closed />
      )}
      {layers.water && (
        <LineLoopFromArray positions={layers.water} color="#3b82f6" closed />
      )}
      {layers.noFly.map((poly, i) => (
        <LineLoopFromArray
          key={`nfz-${i}`}
          positions={poly}
          color="#ef4444"
          closed
          dashed
        />
      ))}
      {layers.nfpaRings.map((r) => (
        <LineLoopFromArray
          key={`nfpa-${r.id}`}
          positions={r.positions}
          color="#f59e0b"
          closed
          dashed
        />
      ))}
    </group>
  );
}
