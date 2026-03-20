/**
 * FX KONTROL · Twinmotion / Datasmith Parser
 * Parses .udatasmith XML files exported from Twinmotion.
 * Extracts actors (meshes, lights, cameras) with transforms and metadata.
 *
 * Datasmith XML structure:
 *   <DatasmithUnrealScene>
 *     <Mesh name="..." label="..." file="mesh.udsmesh" />
 *     <Actor name="..." label="..." layer="...">
 *       <Transform tx="" ty="" tz="" qx="" qy="" qz="" qw="" sx="" sy="" sz="" />
 *       <mesh name="..." />
 *       <children> ... </children>
 *     </Actor>
 *     <Light name="..." label="..." type="PointLight|SpotLight|DirectionalLight">
 *       <Transform ... />
 *       <Color R="" G="" B="" />
 *       <Intensity value="" />
 *     </Light>
 *     <Camera name="..." label="...">
 *       <Transform ... />
 *       <FocalLength value="" />
 *     </Camera>
 *   </DatasmithUnrealScene>
 */

export interface DatasmithTransform {
  position: [number, number, number]; // meters, Y-up (Three.js)
  rotation: [number, number, number, number]; // quaternion xyzw
  scale: [number, number, number];
}

export interface DatasmithMeshDef {
  name: string;
  label: string;
  file: string;
}

export interface DatasmithActor {
  id: string;
  name: string;
  label: string;
  type: 'mesh' | 'light' | 'camera' | 'group' | 'landscape' | 'unknown';
  className: string;
  layer: string;
  transform: DatasmithTransform;
  meshRef?: string;
  lightType?: 'point' | 'spot' | 'directional' | 'area';
  lightColor?: string;
  lightIntensity?: number;
  focalLength?: number;
  children: DatasmithActor[];
  metadata: Record<string, string>;
}

export interface DatasmithParseResult {
  version: string;
  host: string;
  totalActors: number;
  meshDefs: DatasmithMeshDef[];
  actors: DatasmithActor[];
  // Flattened by type for easy UI grouping
  meshActors: DatasmithActor[];
  lightActors: DatasmithActor[];
  cameraActors: DatasmithActor[];
  landscapeActors: DatasmithActor[];
  groupActors: DatasmithActor[];
  unknownActors: DatasmithActor[];
}

/** Convert Datasmith coordinates (UE5 cm, Z-up) to Three.js (m, Y-up) */
function parseTransform(el: Element): DatasmithTransform {
  const transformEl = el.querySelector('Transform') || el.querySelector('transform');

  if (!transformEl) {
    return { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
  }

  // Datasmith stores transforms in cm, Z-up (UE coordinate system)
  const tx = parseFloat(transformEl.getAttribute('tx') || '0');
  const ty = parseFloat(transformEl.getAttribute('ty') || '0');
  const tz = parseFloat(transformEl.getAttribute('tz') || '0');

  const qx = parseFloat(transformEl.getAttribute('qx') || '0');
  const qy = parseFloat(transformEl.getAttribute('qy') || '0');
  const qz = parseFloat(transformEl.getAttribute('qz') || '0');
  const qw = parseFloat(transformEl.getAttribute('qw') || '1');

  const sx = parseFloat(transformEl.getAttribute('sx') || '1');
  const sy = parseFloat(transformEl.getAttribute('sy') || '1');
  const sz = parseFloat(transformEl.getAttribute('sz') || '1');

  // Convert UE5 (X-forward, Y-right, Z-up, cm) → Three.js (X-right, Y-up, Z-back, m)
  const scale = 0.01; // cm → m
  return {
    position: [ty * scale, tz * scale, -tx * scale],
    rotation: [qy, qz, -qx, qw], // swizzle quaternion
    scale: [sy, sz, sx],
  };
}

function parseColor(el: Element): string {
  const colorEl = el.querySelector('Color') || el.querySelector('color');
  if (!colorEl) return '#ffffff';
  const r = Math.round(parseFloat(colorEl.getAttribute('R') || colorEl.getAttribute('r') || '1') * 255);
  const g = Math.round(parseFloat(colorEl.getAttribute('G') || colorEl.getAttribute('g') || '1') * 255);
  const b = Math.round(parseFloat(colorEl.getAttribute('B') || colorEl.getAttribute('b') || '1') * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function detectActorType(el: Element): DatasmithActor['type'] {
  const tag = el.tagName.toLowerCase();
  if (tag === 'light' || tag === 'pointlight' || tag === 'spotlight' || tag === 'directionallight' || tag === 'arealight') return 'light';
  if (tag === 'camera') return 'camera';
  if (tag === 'landscape') return 'landscape';

  // Check for mesh reference inside Actor
  if (el.querySelector('mesh') || el.querySelector('Mesh')) {
    // Only if it references a mesh (has name attr), not a mesh definition
    const meshChild = el.querySelector('mesh[name]') || el.querySelector('Mesh[name]');
    if (meshChild && !meshChild.getAttribute('file')) return 'mesh';
  }

  // Check for children (group)
  const children = el.querySelector('children') || el.querySelector('Children');
  if (children && children.children.length > 0) return 'group';

  // By class name
  const className = el.getAttribute('class') || '';
  if (className.includes('StaticMesh') || className.includes('Mesh')) return 'mesh';
  if (className.includes('Light')) return 'light';
  if (className.includes('Camera') || className.includes('CineCamera')) return 'camera';
  if (className.includes('Landscape')) return 'landscape';

  return 'unknown';
}

function detectLightType(el: Element): DatasmithActor['lightType'] {
  const type = (el.getAttribute('type') || el.tagName || '').toLowerCase();
  if (type.includes('spot')) return 'spot';
  if (type.includes('directional') || type.includes('sun')) return 'directional';
  if (type.includes('area') || type.includes('rect')) return 'area';
  return 'point';
}

let idCounter = 0;

function parseActor(el: Element): DatasmithActor {
  const id = `ds-${idCounter++}`;
  const name = el.getAttribute('name') || el.getAttribute('Name') || `Actor_${id}`;
  const label = el.getAttribute('label') || el.getAttribute('Label') || name;
  const layer = el.getAttribute('layer') || el.getAttribute('Layer') || '';
  const className = el.getAttribute('class') || el.tagName || '';
  const type = detectActorType(el);

  const actor: DatasmithActor = {
    id,
    name,
    label,
    type,
    className,
    layer,
    transform: parseTransform(el),
    children: [],
    metadata: {},
  };

  // Mesh reference
  const meshChild = el.querySelector('mesh[name]') || el.querySelector('Mesh[name]');
  if (meshChild && !meshChild.getAttribute('file')) {
    actor.meshRef = meshChild.getAttribute('name') || undefined;
  }

  // Light properties
  if (type === 'light') {
    actor.lightType = detectLightType(el);
    actor.lightColor = parseColor(el);
    const intensityEl = el.querySelector('Intensity') || el.querySelector('intensity');
    actor.lightIntensity = intensityEl ? parseFloat(intensityEl.getAttribute('value') || '1') : 1;
  }

  // Camera properties
  if (type === 'camera') {
    const focalEl = el.querySelector('FocalLength') || el.querySelector('focallength');
    actor.focalLength = focalEl ? parseFloat(focalEl.getAttribute('value') || '35') : 35;
  }

  // Metadata key-value pairs
  const metaEls = el.querySelectorAll('KeyValueProperty, Metadata > *');
  metaEls.forEach(m => {
    const key = m.getAttribute('name') || m.getAttribute('key') || m.tagName;
    const val = m.getAttribute('val') || m.getAttribute('value') || m.textContent || '';
    if (key) actor.metadata[key] = val;
  });

  // Parse children
  const childrenContainer = el.querySelector(':scope > children') || el.querySelector(':scope > Children');
  if (childrenContainer) {
    Array.from(childrenContainer.children).forEach(child => {
      actor.children.push(parseActor(child));
    });
  }

  return actor;
}

/** Flatten actor tree into array */
function flattenActors(actors: DatasmithActor[]): DatasmithActor[] {
  const flat: DatasmithActor[] = [];
  function walk(list: DatasmithActor[]) {
    for (const a of list) {
      flat.push(a);
      if (a.children.length > 0) walk(a.children);
    }
  }
  walk(actors);
  return flat;
}

/**
 * Parse a Datasmith (.udatasmith) XML string.
 */
export function parseDatasmith(xmlText: string): DatasmithParseResult {
  idCounter = 0;
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  const root = doc.querySelector('DatasmithUnrealScene') || doc.documentElement;

  const version = root.getAttribute('version') || root.getAttribute('Version') || '0.0';
  const host = root.getAttribute('host') || root.getAttribute('Host') || 'Twinmotion';

  // Mesh definitions (geometry refs)
  const meshDefs: DatasmithMeshDef[] = [];
  const meshDefEls = root.querySelectorAll(':scope > Mesh[file], :scope > StaticMesh[file]');
  meshDefEls.forEach(el => {
    meshDefs.push({
      name: el.getAttribute('name') || '',
      label: el.getAttribute('label') || el.getAttribute('name') || '',
      file: el.getAttribute('file') || '',
    });
  });

  // Top-level actors
  const actorTags = ['Actor', 'Light', 'PointLight', 'SpotLight', 'DirectionalLight', 'AreaLight', 'Camera', 'CineCamera', 'Landscape'];
  const actors: DatasmithActor[] = [];

  actorTags.forEach(tag => {
    root.querySelectorAll(`:scope > ${tag}`).forEach(el => {
      // Skip mesh definition nodes (those with 'file' attr)
      if (el.getAttribute('file')) return;
      actors.push(parseActor(el));
    });
  });

  const allFlat = flattenActors(actors);

  return {
    version,
    host,
    totalActors: allFlat.length,
    meshDefs,
    actors,
    meshActors: allFlat.filter(a => a.type === 'mesh'),
    lightActors: allFlat.filter(a => a.type === 'light'),
    cameraActors: allFlat.filter(a => a.type === 'camera'),
    landscapeActors: allFlat.filter(a => a.type === 'landscape'),
    groupActors: allFlat.filter(a => a.type === 'group'),
    unknownActors: allFlat.filter(a => a.type === 'unknown'),
  };
}

/** Extract readable asset name from Datasmith mesh reference */
export function extractMeshLabel(meshRef: string, meshDefs: DatasmithMeshDef[]): string {
  const def = meshDefs.find(d => d.name === meshRef);
  if (def?.label) return def.label;
  // Fallback: clean the reference name
  return meshRef.replace(/^SM_/, '').replace(/_/g, ' ');
}
