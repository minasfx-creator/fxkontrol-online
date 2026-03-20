// ═══ UE5 Map / T3D Scene Parser ═══
// Parses T3D text exports (File → Export or Ctrl+C actors) from Unreal Engine 5
// Extracts actors with transforms, lights, meshes, Niagara systems, and volumes

export type UE5ObjectType = 'mesh' | 'light' | 'niagara' | 'volume' | 'camera' | 'unknown';

export interface UE5Transform {
  location: [number, number, number];   // UE5 cm units
  rotation: [number, number, number];   // pitch, yaw, roll (degrees)
  scale: [number, number, number];
}

export interface UE5SceneObject {
  id: string;
  name: string;
  className: string;
  type: UE5ObjectType;
  transform: UE5Transform;
  // Metadata
  meshReference?: string;        // e.g. /Game/Props/Truss_4m.Truss_4m
  lightColor?: string;           // hex
  lightIntensity?: number;
  lightRadius?: number;
  niagaraSystem?: string;        // Niagara system reference
  volumeExtent?: [number, number, number]; // box extent for volumes
  properties: Record<string, string>;
}

export interface UE5MapParseResult {
  objects: UE5SceneObject[];
  meshes: UE5SceneObject[];
  lights: UE5SceneObject[];
  niagara: UE5SceneObject[];
  volumes: UE5SceneObject[];
  cameras: UE5SceneObject[];
  unknown: UE5SceneObject[];
  totalActors: number;
}

const MESH_CLASSES = [
  'StaticMeshActor', 'SkeletalMeshActor', 'StaticMeshComponent',
  'InstancedStaticMeshComponent', 'BP_', 'Blueprint',
];

const LIGHT_CLASSES = [
  'PointLight', 'SpotLight', 'DirectionalLight', 'RectLight',
  'PointLightComponent', 'SpotLightComponent',
];

const NIAGARA_CLASSES = [
  'NiagaraActor', 'NiagaraComponent', 'NiagaraSystem',
  'ParticleSystemComponent', 'CascadeParticleSystemComponent',
];

const VOLUME_CLASSES = [
  'TriggerBox', 'TriggerVolume', 'BlockingVolume',
  'NavMeshBoundsVolume', 'PostProcessVolume', 'BoxComponent',
  'KillZVolume', 'PainCausingVolume',
];

const CAMERA_CLASSES = [
  'CameraActor', 'CineCameraActor', 'CameraComponent',
];

function classifyActor(className: string): UE5ObjectType {
  if (LIGHT_CLASSES.some(c => className.includes(c))) return 'light';
  if (NIAGARA_CLASSES.some(c => className.includes(c))) return 'niagara';
  if (VOLUME_CLASSES.some(c => className.includes(c))) return 'volume';
  if (CAMERA_CLASSES.some(c => className.includes(c))) return 'camera';
  if (MESH_CLASSES.some(c => className.includes(c))) return 'mesh';
  return 'unknown';
}

function parseVector(value: string): [number, number, number] {
  // (X=100.000,Y=200.000,Z=50.000) or X=100 Y=200 Z=50
  const match = value.match(/X=([-\d.]+).*?Y=([-\d.]+).*?Z=([-\d.]+)/i);
  if (match) return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
  return [0, 0, 0];
}

function parseColor(value: string): string {
  // (R=1.0,G=0.5,B=0.2,A=1.0) linear
  const match = value.match(/R=([-\d.]+).*?G=([-\d.]+).*?B=([-\d.]+)/i);
  if (match) {
    const toSrgb = (v: number) => Math.round(Math.min(1, Math.max(0, v)) ** (1 / 2.2) * 255);
    const r = toSrgb(parseFloat(match[1]));
    const g = toSrgb(parseFloat(match[2]));
    const b = toSrgb(parseFloat(match[3]));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return '#ffffff';
}

function extractMeshRef(props: Record<string, string>): string | undefined {
  const mesh = props['StaticMesh'] || props['SkeletalMesh'] || props['Mesh'];
  if (!mesh) return undefined;
  // /Game/Props/Truss_4m.Truss_4m → Truss_4m
  const match = mesh.match(/([^/.]+)\.[^'")\s]+/);
  return match ? match[1] : mesh.replace(/['"]/g, '');
}

export function parseUE5Map(text: string): UE5MapParseResult {
  const objects: UE5SceneObject[] = [];
  
  // Strategy: parse Begin Actor / End Actor blocks
  const actorRegex = /Begin\s+Actor\s+Class=(\S+)\s+Name=(\S+)/gi;
  const lines = text.split('\n');
  
  let currentActor: { className: string; name: string; props: Record<string, string>; depth: number; startLine: number } | null = null;
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (/^Begin\s+Actor/i.test(line)) {
      const classMatch = line.match(/Class=(\S+)/i);
      const nameMatch = line.match(/Name="?([^"\s]+)"?/i);
      currentActor = {
        className: classMatch?.[1] || 'Unknown',
        name: nameMatch?.[1] || `Actor_${i}`,
        props: {},
        depth: depth,
        startLine: i,
      };
      depth++;
    } else if (/^End\s+Actor/i.test(line) && currentActor) {
      depth--;
      // Build scene object
      const type = classifyActor(currentActor.className);
      const loc = currentActor.props['RelativeLocation'] || currentActor.props['Location'] || '(X=0,Y=0,Z=0)';
      const rot = currentActor.props['RelativeRotation'] || currentActor.props['Rotation'] || '(Pitch=0,Yaw=0,Roll=0)';
      const scl = currentActor.props['RelativeScale3D'] || currentActor.props['Scale3D'] || '(X=1,Y=1,Z=1)';

      const rotMatch = rot.match(/Pitch=([-\d.]+).*?Yaw=([-\d.]+).*?Roll=([-\d.]+)/i);
      const rotation: [number, number, number] = rotMatch
        ? [parseFloat(rotMatch[1]), parseFloat(rotMatch[2]), parseFloat(rotMatch[3])]
        : [0, 0, 0];

      const obj: UE5SceneObject = {
        id: `ue5-${currentActor.name}-${i}`,
        name: currentActor.name,
        className: currentActor.className,
        type,
        transform: {
          location: parseVector(loc),
          rotation,
          scale: parseVector(scl),
        },
        properties: { ...currentActor.props },
      };

      // Extra metadata
      if (type === 'mesh') {
        obj.meshReference = extractMeshRef(currentActor.props);
      }
      if (type === 'light') {
        const color = currentActor.props['LightColor'] || currentActor.props['Color'];
        if (color) obj.lightColor = parseColor(color);
        const intensity = currentActor.props['Intensity'];
        if (intensity) obj.lightIntensity = parseFloat(intensity);
        const radius = currentActor.props['AttenuationRadius'] || currentActor.props['SourceRadius'];
        if (radius) obj.lightRadius = parseFloat(radius);
      }
      if (type === 'niagara') {
        obj.niagaraSystem = currentActor.props['Asset'] || currentActor.props['NiagaraSystemAsset'];
      }
      if (type === 'volume') {
        const extent = currentActor.props['BoxExtent'];
        if (extent) obj.volumeExtent = parseVector(extent);
      }

      objects.push(obj);
      currentActor = null;
    } else if (currentActor) {
      // Parse property lines: Key=Value
      const propMatch = line.match(/^(\w+)=(.+)$/);
      if (propMatch) {
        currentActor.props[propMatch[1]] = propMatch[2];
      }
      // Also handle Begin Object blocks inside actors (components)
      if (/^Begin\s+Object/i.test(line)) depth++;
      if (/^End\s+Object/i.test(line)) depth--;
    }
  }

  // Also try to parse simple "copy-paste" format without Begin/End blocks
  // e.g. lines like: StaticMeshActor  X=100 Y=200 Z=50
  if (objects.length === 0) {
    const simpleRegex = /^(\w+)\s+.*?(?:X|Location|Pos)/im;
    if (simpleRegex.test(text)) {
      // Try JSON format
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          for (const item of json) {
            if (item.Location || item.Transform) {
              const loc = item.Location || item.Transform?.Translation || { X: 0, Y: 0, Z: 0 };
              objects.push({
                id: `ue5-json-${objects.length}`,
                name: item.Name || item.Label || `Object_${objects.length}`,
                className: item.Class || item.Type || 'Unknown',
                type: classifyActor(item.Class || item.Type || ''),
                transform: {
                  location: [loc.X || 0, loc.Y || 0, loc.Z || 0],
                  rotation: [0, 0, 0],
                  scale: [1, 1, 1],
                },
                properties: item,
              });
            }
          }
        }
      } catch {
        // Not JSON — ignore
      }
    }
  }

  const result: UE5MapParseResult = {
    objects,
    meshes: objects.filter(o => o.type === 'mesh'),
    lights: objects.filter(o => o.type === 'light'),
    niagara: objects.filter(o => o.type === 'niagara'),
    volumes: objects.filter(o => o.type === 'volume'),
    cameras: objects.filter(o => o.type === 'camera'),
    unknown: objects.filter(o => o.type === 'unknown'),
    totalActors: objects.length,
  };

  return result;
}

/** Convert UE5 cm coordinates to system meters */
export function ue5ToMeters(cm: number, scale = 0.01): number {
  return cm * scale;
}

/** Convert UE5 coordinate system (Z-up, left-hand) to Three.js (Y-up, right-hand) */
export function ue5ToThreeJS(location: [number, number, number], scale = 0.01): [number, number, number] {
  // UE5: X=forward, Y=right, Z=up  →  Three.js: X=right, Y=up, Z=-forward
  return [
    location[1] * scale,   // UE5 Y → Three X
    location[2] * scale,   // UE5 Z → Three Y
    -location[0] * scale,  // UE5 X → Three -Z
  ];
}

/** Human-readable mesh name from path */
export function extractAssetName(path: string): string {
  if (!path) return 'Unknown';
  const parts = path.split(/[/.]/).filter(Boolean);
  return parts[parts.length - 1] || path;
}
