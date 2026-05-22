/**
 * SwarmGPT Advanced — PLY parser (ASCII + binary little-endian).
 *
 * Supports the common photogrammetry/LiDAR PLY layout:
 *   - element vertex N
 *   - properties: float/double x y z (required)
 *   - properties: uchar red green blue (optional, mapped to 0..1)
 *   - any other vertex properties are read & skipped (correct stride).
 *
 * Faces (element face) are parsed when present (list uchar int vertex_indices /
 * vertex_index). Unknown property layouts fall back gracefully or throw a
 * descriptive error — never silent corruption.
 *
 * Zero external dependencies.
 */
import type { Vec3 } from '../../../types';

export interface PlyResult {
  vertices: Vec3[];
  /** Optional per-vertex RGB in [0..1], same length as vertices when present. */
  colors?: Array<readonly [number, number, number]>;
  /** Triangle indices (flat). May be empty for point-cloud-only PLYs. */
  indices: number[];
  /** "ascii" | "binary_little_endian" — exposed for debugging. */
  format: PlyFormat;
}

export type PlyFormat = 'ascii' | 'binary_little_endian';

interface PlyProperty {
  name: string;
  type: PlyScalarType;
  /** For list properties: the type of the count + the type of each element. */
  list?: { countType: PlyScalarType; itemType: PlyScalarType };
}

interface PlyElement {
  name: string;
  count: number;
  properties: PlyProperty[];
}

type PlyScalarType =
  | 'char' | 'uchar' | 'short' | 'ushort'
  | 'int' | 'uint' | 'float' | 'double'
  // PLY 1.0 aliases:
  | 'int8' | 'uint8' | 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32' | 'float64';

const SCALAR_BYTES: Record<PlyScalarType, number> = {
  char: 1, uchar: 1, short: 2, ushort: 2,
  int: 4, uint: 4, float: 4, double: 8,
  int8: 1, uint8: 1, int16: 2, uint16: 2, int32: 4, uint32: 4, float32: 4, float64: 8,
};

function isScalarType(s: string): s is PlyScalarType {
  return s in SCALAR_BYTES;
}

// ---------- Header ----------
function parseHeader(text: string): { format: PlyFormat; elements: PlyElement[]; headerEnd: number } {
  const headerEndMarker = '\nend_header\n';
  const idx = text.indexOf(headerEndMarker);
  if (idx < 0) throw new Error('PLY: missing end_header');
  const headerText = text.slice(0, idx);
  const headerEnd = idx + headerEndMarker.length;

  const lines = headerText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines[0] !== 'ply') throw new Error('PLY: missing magic "ply"');

  let format: PlyFormat | null = null;
  const elements: PlyElement[] = [];
  let currentEl: PlyElement | null = null;

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/);
    const head = parts[0];
    if (head === 'comment' || head === 'obj_info') continue;
    if (head === 'format') {
      const fmt = parts[1];
      if (fmt === 'ascii') format = 'ascii';
      else if (fmt === 'binary_little_endian') format = 'binary_little_endian';
      else throw new Error(`PLY: unsupported format "${fmt}"`);
      continue;
    }
    if (head === 'element') {
      currentEl = { name: parts[1], count: parseInt(parts[2], 10), properties: [] };
      elements.push(currentEl);
      continue;
    }
    if (head === 'property') {
      if (!currentEl) throw new Error('PLY: property without element');
      if (parts[1] === 'list') {
        const countType = parts[2];
        const itemType = parts[3];
        const name = parts[4];
        if (!isScalarType(countType) || !isScalarType(itemType)) {
          throw new Error(`PLY: unknown list types "${countType}/${itemType}"`);
        }
        currentEl.properties.push({ name, type: itemType, list: { countType, itemType } });
      } else {
        const type = parts[1];
        const name = parts[2];
        if (!isScalarType(type)) throw new Error(`PLY: unknown property type "${type}"`);
        currentEl.properties.push({ name, type });
      }
    }
  }

  if (!format) throw new Error('PLY: missing format line');
  return { format, elements, headerEnd };
}

// ---------- ASCII body ----------
function parseAscii(body: string, elements: PlyElement[]): PlyResult {
  const tokens = body.split(/\s+/).filter(Boolean);
  let cursor = 0;
  const next = () => {
    if (cursor >= tokens.length) throw new Error('PLY ascii: unexpected EOF');
    return tokens[cursor++];
  };

  const vertices: Vec3[] = [];
  const colors: Array<readonly [number, number, number]> = [];
  const indices: number[] = [];
  let hasColor = false;

  for (const el of elements) {
    if (el.name === 'vertex') {
      const xi = el.properties.findIndex((p) => p.name === 'x');
      const yi = el.properties.findIndex((p) => p.name === 'y');
      const zi = el.properties.findIndex((p) => p.name === 'z');
      const ri = el.properties.findIndex((p) => p.name === 'red' || p.name === 'r');
      const gi = el.properties.findIndex((p) => p.name === 'green' || p.name === 'g');
      const bi = el.properties.findIndex((p) => p.name === 'blue' || p.name === 'b');
      if (xi < 0 || yi < 0 || zi < 0) throw new Error('PLY: vertex element lacks x/y/z');
      hasColor = ri >= 0 && gi >= 0 && bi >= 0;

      for (let i = 0; i < el.count; i++) {
        const row: number[] = [];
        for (let j = 0; j < el.properties.length; j++) {
          if (el.properties[j].list) throw new Error('PLY: list property on vertex unsupported');
          row.push(parseFloat(next()));
        }
        vertices.push({ x: row[xi], y: row[yi], z: row[zi] });
        if (hasColor) {
          colors.push([row[ri] / 255, row[gi] / 255, row[bi] / 255] as const);
        }
      }
    } else if (el.name === 'face') {
      const listProp = el.properties.find((p) => p.list);
      if (!listProp) {
        for (let i = 0; i < el.count; i++) {
          for (let j = 0; j < el.properties.length; j++) next();
        }
        continue;
      }
      for (let i = 0; i < el.count; i++) {
        const count = parseInt(next(), 10);
        const idxs: number[] = [];
        for (let j = 0; j < count; j++) idxs.push(parseInt(next(), 10));
        for (let j = 1; j < idxs.length - 1; j++) {
          indices.push(idxs[0], idxs[j], idxs[j + 1]);
        }
      }
    } else {
      for (let i = 0; i < el.count; i++) {
        for (const prop of el.properties) {
          if (prop.list) {
            const c = parseInt(next(), 10);
            for (let j = 0; j < c; j++) next();
          } else {
            next();
          }
        }
      }
    }
  }

  return {
    vertices,
    indices,
    format: 'ascii',
    ...(hasColor ? { colors } : {}),
  };
}

// ---------- Binary LE body ----------
function readScalar(view: DataView, offset: number, type: PlyScalarType): { value: number; size: number } {
  switch (type) {
    case 'char': case 'int8': return { value: view.getInt8(offset), size: 1 };
    case 'uchar': case 'uint8': return { value: view.getUint8(offset), size: 1 };
    case 'short': case 'int16': return { value: view.getInt16(offset, true), size: 2 };
    case 'ushort': case 'uint16': return { value: view.getUint16(offset, true), size: 2 };
    case 'int': case 'int32': return { value: view.getInt32(offset, true), size: 4 };
    case 'uint': case 'uint32': return { value: view.getUint32(offset, true), size: 4 };
    case 'float': case 'float32': return { value: view.getFloat32(offset, true), size: 4 };
    case 'double': case 'float64': return { value: view.getFloat64(offset, true), size: 8 };
  }
}

function parseBinaryLE(buffer: ArrayBuffer, headerEnd: number, elements: PlyElement[]): PlyResult {
  const view = new DataView(buffer);
  let offset = headerEnd;

  const vertices: Vec3[] = [];
  const colors: Array<readonly [number, number, number]> = [];
  const indices: number[] = [];
  let hasColor = false;

  for (const el of elements) {
    if (el.name === 'vertex') {
      const xi = el.properties.findIndex((p) => p.name === 'x');
      const yi = el.properties.findIndex((p) => p.name === 'y');
      const zi = el.properties.findIndex((p) => p.name === 'z');
      const ri = el.properties.findIndex((p) => p.name === 'red' || p.name === 'r');
      const gi = el.properties.findIndex((p) => p.name === 'green' || p.name === 'g');
      const bi = el.properties.findIndex((p) => p.name === 'blue' || p.name === 'b');
      if (xi < 0 || yi < 0 || zi < 0) throw new Error('PLY: vertex element lacks x/y/z');
      hasColor = ri >= 0 && gi >= 0 && bi >= 0;

      for (let i = 0; i < el.count; i++) {
        const row = new Array<number>(el.properties.length);
        for (let j = 0; j < el.properties.length; j++) {
          const prop = el.properties[j];
          if (prop.list) throw new Error('PLY: list property on vertex unsupported');
          const r = readScalar(view, offset, prop.type);
          row[j] = r.value;
          offset += r.size;
        }
        vertices.push({ x: row[xi], y: row[yi], z: row[zi] });
        if (hasColor) {
          colors.push([row[ri] / 255, row[gi] / 255, row[bi] / 255] as const);
        }
      }
    } else if (el.name === 'face') {
      const listProp = el.properties.find((p) => p.list);
      if (!listProp || !listProp.list) {
        let stride = 0;
        for (const p of el.properties) {
          if (p.list) throw new Error('PLY: cannot skip element with mixed list+fixed properties');
          stride += SCALAR_BYTES[p.type];
        }
        offset += el.count * stride;
        continue;
      }
      const countType = listProp.list.countType;
      const itemType = listProp.list.itemType;
      const itemSize = SCALAR_BYTES[itemType];
      for (let i = 0; i < el.count; i++) {
        const c = readScalar(view, offset, countType);
        offset += c.size;
        const n = c.value;
        const idxs: number[] = new Array(n);
        for (let j = 0; j < n; j++) {
          const r = readScalar(view, offset, itemType);
          idxs[j] = r.value;
          offset += itemSize;
        }
        for (let j = 1; j < n - 1; j++) {
          indices.push(idxs[0], idxs[j], idxs[j + 1]);
        }
      }
    } else {
      let stride = 0;
      for (const p of el.properties) {
        if (p.list) throw new Error(`PLY: cannot skip unknown element "${el.name}" with list property`);
        stride += SCALAR_BYTES[p.type];
      }
      offset += el.count * stride;
    }
  }

  return {
    vertices,
    indices,
    format: 'binary_little_endian',
    ...(hasColor ? { colors } : {}),
  };
}

// ---------- Public API ----------
export function parsePly(input: ArrayBuffer): PlyResult {
  const bytes = new Uint8Array(input);
  const previewLen = Math.min(bytes.length, 64 * 1024);
  const headerText = new TextDecoder('ascii').decode(bytes.subarray(0, previewLen));
  const { format, elements, headerEnd } = parseHeader(headerText);

  if (format === 'ascii') {
    const fullText = new TextDecoder('ascii').decode(bytes);
    return parseAscii(fullText.slice(headerEnd), elements);
  }
  return parseBinaryLE(input, headerEnd, elements);
}
