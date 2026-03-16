/**
 * GeoToolsR3F — 3D scene objects for Google Earth-like tools
 * Renders markers, ruler lines with distance labels, and path lines inside the R3F Canvas.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { GeoMarker, GeoRulerPoint, GeoPath, GeoToolMode } from './ViewportGeoTools';

// ═══ Marker Pin ═══
function MarkerPin({ marker }: { marker: GeoMarker }) {
  const meshRef = useRef<THREE.Group>(null);
  const color = new THREE.Color(marker.color);

  if (!marker.visible) return null;

  return (
    <group ref={meshRef} position={marker.position}>
      {/* Pin body — cone + sphere */}
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.8, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.35, 1.5, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {/* Glow ring at base */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.8, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Label */}
      <Html position={[0, 2.8, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="bg-card/90 backdrop-blur-md text-foreground text-[9px] font-mono-code px-2 py-0.5 rounded-md border border-border/20 whitespace-nowrap shadow-lg">
          {marker.name}
        </div>
      </Html>
    </group>
  );
}

// ═══ Ruler Line ═══
function RulerLine({ ruler }: { ruler: GeoRulerPoint }) {
  if (!ruler.visible || ruler.points.length < 2) return null;

  const points = ruler.points.map(p => new THREE.Vector3(...p));
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [ruler.points]);

  // Segment distances
  const segments: { midpoint: THREE.Vector3; distance: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const mid = new THREE.Vector3().lerpVectors(points[i], points[i + 1], 0.5);
    segments.push({
      midpoint: mid,
      distance: points[i].distanceTo(points[i + 1]),
    });
  }

  return (
    <group>
      {/* Main line */}
      <line geometry={geometry}>
        <lineBasicMaterial color="#f59e0b" linewidth={2} />
      </line>

      {/* Dashed shadow */}
      <line geometry={geometry}>
        <lineDashedMaterial color="#000000" dashSize={0.5} gapSize={0.3} linewidth={1} transparent opacity={0.3} />
      </line>

      {/* Point spheres */}
      {ruler.points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      ))}

      {/* Segment distance labels */}
      {segments.map((seg, i) => (
        <Html key={i} position={[seg.midpoint.x, seg.midpoint.y + 0.5, seg.midpoint.z]} center style={{ pointerEvents: 'none' }}>
          <div className="bg-warning/90 text-warning-foreground text-[9px] font-mono-code font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">
            {seg.distance.toFixed(1)}m
          </div>
        </Html>
      ))}

      {/* Total label */}
      {ruler.points.length > 2 && (
        <Html
          position={[points[points.length - 1].x, points[points.length - 1].y + 1.5, points[points.length - 1].z]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div className="bg-card/90 backdrop-blur-md text-warning text-[10px] font-mono-code font-bold px-2 py-1 rounded-lg border border-warning/30 shadow-xl whitespace-nowrap">
            Total: {ruler.totalDistance.toFixed(1)}m
          </div>
        </Html>
      )}
    </group>
  );
}

// ═══ Path Line ═══
function PathLine({ path }: { path: GeoPath }) {
  if (!path.visible || path.points.length < 2) return null;

  const allPts = path.closed
    ? [...path.points, path.points[0]]
    : path.points;

  const points = allPts.map(p => new THREE.Vector3(...p));
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [path.points, path.closed]);
  const color = new THREE.Color(path.color);

  // Calculate total length
  let totalLen = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalLen += points[i].distanceTo(points[i + 1]);
  }

  return (
    <group>
      {/* Main path */}
      <line geometry={geometry}>
        <lineBasicMaterial color={color} linewidth={2} />
      </line>

      {/* Point markers */}
      {path.points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}

      {/* Start pin */}
      <mesh position={[path.points[0][0], path.points[0][1] + 0.5, path.points[0][2]]}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>

      {/* Name + length label */}
      <Html
        position={[path.points[0][0], path.points[0][1] + 1.5, path.points[0][2]]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div className="bg-card/90 backdrop-blur-md text-[9px] font-mono-code px-2 py-0.5 rounded-md border border-border/20 shadow-lg whitespace-nowrap">
          <span style={{ color: path.color }} className="font-bold">{path.name}</span>
          <span className="text-muted-foreground ml-1.5">{totalLen.toFixed(1)}m</span>
        </div>
      </Html>

      {/* Polygon area fill (for closed paths with 3+ pts) */}
      {path.closed && path.points.length >= 3 && (
        <mesh position={[0, 0.05, 0]}>
          <shapeGeometry args={[createShapeFromPoints(path.points)]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function createShapeFromPoints(pts: [number, number, number][]): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][2]); // use X,Z as 2D plane
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i][0], pts[i][2]);
  }
  shape.closePath();
  return shape;
}

// ═══ Click handler for placing geo items ═══
export function GeoToolClickHandler({
  activeTool,
  onPlaceMarker,
  onPlaceRulerPoint,
  onPlacePathPoint,
  onFinishRuler,
  onFinishPath,
}: {
  activeTool: GeoToolMode;
  onPlaceMarker: (pos: [number, number, number]) => void;
  onPlaceRulerPoint: (pos: [number, number, number]) => void;
  onPlacePathPoint: (pos: [number, number, number]) => void;
  onFinishRuler: () => void;
  onFinishPath: () => void;
}) {
  const { raycaster, camera, scene } = useThree();

  if (activeTool === 'none') return null;

  return (
    <mesh
      position={[0, 0, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={false}
      onPointerDown={(e) => {
        if (e.button !== 0) return; // left click only
        e.stopPropagation();
        const point: [number, number, number] = [e.point.x, e.point.y, e.point.z];

        if (activeTool === 'marker') {
          onPlaceMarker(point);
        } else if (activeTool === 'ruler') {
          onPlaceRulerPoint(point);
        } else if (activeTool === 'path' || activeTool === 'polygon') {
          onPlacePathPoint(point);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (activeTool === 'ruler') onFinishRuler();
        if (activeTool === 'path' || activeTool === 'polygon') onFinishPath();
      }}
    >
      <planeGeometry args={[2000, 2000]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

// ═══ Main group for all geo objects ═══
export function GeoToolsScene({
  markers,
  rulers,
  paths,
}: {
  markers: GeoMarker[];
  rulers: GeoRulerPoint[];
  paths: GeoPath[];
}) {
  return (
    <group>
      {markers.map(m => <MarkerPin key={m.id} marker={m} />)}
      {rulers.map(r => <RulerLine key={r.id} ruler={r} />)}
      {paths.map(p => <PathLine key={p.id} path={p} />)}
    </group>
  );
}
