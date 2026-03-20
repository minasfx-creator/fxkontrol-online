/**
 * FX KONTROL · Twinmotion / Datasmith Parser
 * Parses .udatasmith XML files exported from Twinmotion.
 * Extracts actors (meshes, lights, cameras) with transforms, materials, and camera paths.
 */

// ─── Transform ──────────────────────────────────────────────

export interface DatasmithTransform {
  position: [number, number, number];
  rotation: [number, number, number, number]; // quaternion xyzw
  scale: [number, number, number];
}

// ─── Mesh definitions ───────────────────────────────────────

export interface DatasmithMeshDef {
  name: string;
  label: string;
  file: string;
}

// ─── Materials ──────────────────────────────────────────────

export interface DatasmithMaterial {
  name: string;
  label: string;
  parent: string;
  diffuseColor: string;
  roughness: number;
  metallic: number;
  opacity: number;
  textureMaps: {
    diffuse?: string;
    normal?: string;
    roughness?: string;
    metallic?: string;
    emissive?: string;
  };
}

// ─── Camera paths ───────────────────────────────────────────

export interface DatasmithCameraKeyframe {
  time: number;
  position: [number, number, number];
  rotation: [number, number, number, number];
  focalLength?: number;
}

export interface DatasmithCameraPath {
  name: string;
  label: string;
  duration: number;
  keyframes: DatasmithCameraKeyframe[];
}

// ─── Actors ─────────────────────────────────────────────────

export interface DatasmithActor {
  id: string;
  name: string;
  label: string;
  type: 'mesh' | 'light' | 'camera' | 'group' | 'landscape' | 'unknown';
  className: string;
  layer: string;
  transform: DatasmithTransform;
  meshRef?: string;
  materialRef?: string;
  lightType?: 'point' | 'spot' | 'directional' | 'area';
  lightColor?: string;
  lightIntensity?: number;
  focalLength?: number;
  children: DatasmithActor[];
  metadata: Record<string, string>;
}

// ─── Parse result ───────────────────────────────────────────

export interface DatasmithParseResult {
  version: string;
  host: string;
  totalActors: number;
  meshDefs: DatasmithMeshDef[];
  materials: DatasmithMaterial[];
  cameraPaths: DatasmithCameraPath[];
  actors: DatasmithActor[];
  meshActors: DatasmithActor[];
  lightActors: DatasmithActor[];
  cameraActors: DatasmithActor[];
  landscapeActors: DatasmithActor[];
  groupActors: DatasmithActor[];
  unknownActors: DatasmithActor[];
}

// ─── Helpers ────────────────────────────────────────────────

/** Convert Datasmith coordinates (UE5 cm, Z-up) to Three.js (m, Y-up) */
function parseTransform(el: Element): DatasmithTransform {
  const transformEl = el.querySelector('Transform') || el.querySelector('transform');
  if (!transformEl) {
    return { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
  }

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

  const scale = 0.01; // cm → m
  return {
    position: [ty * scale, tz * scale, -tx * scale],
    rotation: [qy, qz, -qx, qw],
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

function colorAttrToHex(el: Element, attr: string): string {
  const val = el.getAttribute(attr) || '';
  if (val.startsWith('#')) return val;
  if (val.startsWith('(')) {
    const nums = val.replace(/[()]/g, '').split(',').map(Number);
    if (nums.length >= 3) {
      const [r, g, b] = nums.map(n => Math.round(n * 255));
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
  }
  return '#cccccc';
}

function detectActorType(el: Element): DatasmithActor['type'] {
  const tag = el.tagName.toLowerCase();
  if (['light', 'pointlight', 'spotlight', 'directionallight', 'arealight'].includes(tag)) return 'light';
  if (tag === 'camera') return 'camera';
  if (tag === 'landscape') return 'landscape';

  const meshChild = el.querySelector('mesh[name]') || el.querySelector('Mesh[name]');
  if (meshChild && !meshChild.getAttribute('file')) return 'mesh';

  const children = el.querySelector('children') || el.querySelector('Children');
  if (children && children.children.length > 0) return 'group';

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
    id, name, label, type, className, layer,
    transform: parseTransform(el),
    children: [],
    metadata: {},
  };

  const meshChild = el.querySelector('mesh[name]') || el.querySelector('Mesh[name]');
  if (meshChild && !meshChild.getAttribute('file')) {
    actor.meshRef = meshChild.getAttribute('name') || undefined;
  }

  // Material reference
  const matChild = el.querySelector('material[name]') || el.querySelector('Material[name]');
  if (matChild) {
    actor.materialRef = matChild.getAttribute('name') || undefined;
  }

  if (type === 'light') {
    actor.lightType = detectLightType(el);
    actor.lightColor = parseColor(el);
    const intensityEl = el.querySelector('Intensity') || el.querySelector('intensity');
    actor.lightIntensity = intensityEl ? parseFloat(intensityEl.getAttribute('value') || '1') : 1;
  }

  if (type === 'camera') {
    const focalEl = el.querySelector('FocalLength') || el.querySelector('focallength');
    actor.focalLength = focalEl ? parseFloat(focalEl.getAttribute('value') || '35') : 35;
  }

  const metaEls = el.querySelectorAll('KeyValueProperty, Metadata > *');
  metaEls.forEach(m => {
    const key = m.getAttribute('name') || m.getAttribute('key') || m.tagName;
    const val = m.getAttribute('val') || m.getAttribute('value') || m.textContent || '';
    if (key) actor.metadata[key] = val;
  });

  const childrenContainer = el.querySelector(':scope > children') || el.querySelector(':scope > Children');
  if (childrenContainer) {
    Array.from(childrenContainer.children).forEach(child => {
      actor.children.push(parseActor(child));
    });
  }

  return actor;
}

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

// ─── Material parser ────────────────────────────────────────

function parseMaterials(root: Element): DatasmithMaterial[] {
  const materials: DatasmithMaterial[] = [];
  const matEls = root.querySelectorAll(':scope > MasterMaterial, :scope > Material, :scope > UEPbrMaterial');

  matEls.forEach(el => {
    const name = el.getAttribute('name') || '';
    const label = el.getAttribute('label') || name;
    const parent = el.getAttribute('parent') || el.getAttribute('ParentLabel') || '';

    let diffuseColor = '#cccccc';
    let roughness = 0.5;
    let metallic = 0.0;
    let opacity = 1.0;
    const textureMaps: DatasmithMaterial['textureMaps'] = {};

    // Parse properties
    el.querySelectorAll('KeyValueProperty, Color, Scalar, Texture').forEach(prop => {
      const pName = (prop.getAttribute('name') || prop.tagName).toLowerCase();
      const pVal = prop.getAttribute('val') || prop.getAttribute('value') || '';

      if (pName.includes('diffuse') || pName.includes('basecolor') || pName.includes('base_color')) {
        if (prop.tagName === 'Color' || pVal.startsWith('(') || pVal.startsWith('#')) {
          diffuseColor = pVal.startsWith('#') ? pVal : colorAttrToHex(prop, 'val');
        }
        if (prop.tagName === 'Texture' || prop.getAttribute('tex')) {
          textureMaps.diffuse = prop.getAttribute('tex') || pVal;
        }
      }
      if (pName.includes('roughness')) {
        if (prop.tagName === 'Texture' || prop.getAttribute('tex')) textureMaps.roughness = prop.getAttribute('tex') || pVal;
        else roughness = parseFloat(pVal) || 0.5;
      }
      if (pName.includes('metallic') || pName.includes('metalness')) {
        if (prop.tagName === 'Texture' || prop.getAttribute('tex')) textureMaps.metallic = prop.getAttribute('tex') || pVal;
        else metallic = parseFloat(pVal) || 0;
      }
      if (pName.includes('opacity') || pName.includes('alpha')) {
        opacity = parseFloat(pVal) || 1;
      }
      if (pName.includes('normal')) {
        textureMaps.normal = prop.getAttribute('tex') || pVal;
      }
      if (pName.includes('emissive')) {
        textureMaps.emissive = prop.getAttribute('tex') || pVal;
      }
    });

    materials.push({ name, label, parent, diffuseColor, roughness, metallic, opacity, textureMaps });
  });

  return materials;
}

// ─── Camera path parser ─────────────────────────────────────

function parseCameraPaths(root: Element): DatasmithCameraPath[] {
  const paths: DatasmithCameraPath[] = [];
  const pathEls = root.querySelectorAll(':scope > CameraAnimation, :scope > LevelSequence, :scope > Path');

  pathEls.forEach(el => {
    const name = el.getAttribute('name') || el.getAttribute('Name') || 'Camera Path';
    const label = el.getAttribute('label') || name;
    const keyframes: DatasmithCameraKeyframe[] = [];

    // Look for keyframe nodes
    const kfEls = el.querySelectorAll('Key, Keyframe, Frame, CameraKey');
    const scale = 0.01;

    kfEls.forEach(kf => {
      const time = parseFloat(kf.getAttribute('time') || kf.getAttribute('t') || '0');
      const tx = parseFloat(kf.getAttribute('tx') || kf.getAttribute('x') || '0');
      const ty = parseFloat(kf.getAttribute('ty') || kf.getAttribute('y') || '0');
      const tz = parseFloat(kf.getAttribute('tz') || kf.getAttribute('z') || '0');
      const qx = parseFloat(kf.getAttribute('qx') || '0');
      const qy = parseFloat(kf.getAttribute('qy') || '0');
      const qz = parseFloat(kf.getAttribute('qz') || '0');
      const qw = parseFloat(kf.getAttribute('qw') || '1');
      const fl = kf.getAttribute('focalLength') || kf.getAttribute('focal');

      keyframes.push({
        time,
        position: [ty * scale, tz * scale, -tx * scale],
        rotation: [qy, qz, -qx, qw],
        focalLength: fl ? parseFloat(fl) : undefined,
      });
    });

    // Fallback: parse transform sequence from child Camera actors
    if (keyframes.length === 0) {
      const camEls = el.querySelectorAll('Camera, CameraActor');
      let t = 0;
      camEls.forEach(cam => {
        const tr = parseTransform(cam);
        const focalEl = cam.querySelector('FocalLength');
        keyframes.push({
          time: t,
          position: tr.position,
          rotation: tr.rotation,
          focalLength: focalEl ? parseFloat(focalEl.getAttribute('value') || '35') : undefined,
        });
        t += 1;
      });
    }

    if (keyframes.length > 0) {
      const duration = keyframes.length > 0 ? Math.max(...keyframes.map(k => k.time), keyframes.length) : 0;
      paths.push({ name, label, duration, keyframes });
    }
  });

  return paths;
}

// ─── Main parser ────────────────────────────────────────────

export function parseDatasmith(xmlText: string): DatasmithParseResult {
  idCounter = 0;
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const root = doc.querySelector('DatasmithUnrealScene') || doc.documentElement;

  const version = root.getAttribute('version') || root.getAttribute('Version') || '0.0';
  const host = root.getAttribute('host') || root.getAttribute('Host') || 'Twinmotion';

  // Mesh definitions
  const meshDefs: DatasmithMeshDef[] = [];
  root.querySelectorAll(':scope > Mesh[file], :scope > StaticMesh[file]').forEach(el => {
    meshDefs.push({
      name: el.getAttribute('name') || '',
      label: el.getAttribute('label') || el.getAttribute('name') || '',
      file: el.getAttribute('file') || '',
    });
  });

  // Materials
  const materials = parseMaterials(root);

  // Camera paths
  const cameraPaths = parseCameraPaths(root);

  // Actors
  const actorTags = ['Actor', 'Light', 'PointLight', 'SpotLight', 'DirectionalLight', 'AreaLight', 'Camera', 'CineCamera', 'Landscape'];
  const actors: DatasmithActor[] = [];
  actorTags.forEach(tag => {
    root.querySelectorAll(`:scope > ${tag}`).forEach(el => {
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
    materials,
    cameraPaths,
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
  return meshRef.replace(/^SM_/, '').replace(/_/g, ' ');
}
