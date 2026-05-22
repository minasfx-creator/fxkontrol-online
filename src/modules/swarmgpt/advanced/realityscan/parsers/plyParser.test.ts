import { describe, it, expect } from 'vitest';
import { parsePly } from './plyParser';

function asciiPly(): ArrayBuffer {
  const text = [
    'ply',
    'format ascii 1.0',
    'element vertex 3',
    'property float x',
    'property float y',
    'property float z',
    'property uchar red',
    'property uchar green',
    'property uchar blue',
    'element face 1',
    'property list uchar int vertex_indices',
    'end_header',
    '0 0 0 255 0 0',
    '1 0 0 0 255 0',
    '0 1 0 0 0 255',
    '3 0 1 2',
    '',
  ].join('\n');
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

function binaryLePly(): ArrayBuffer {
  const header = [
    'ply',
    'format binary_little_endian 1.0',
    'element vertex 2',
    'property float x',
    'property float y',
    'property float z',
    'end_header',
    '',
  ].join('\n');
  const headerBytes = new TextEncoder().encode(header);
  const buf = new ArrayBuffer(headerBytes.length + 2 * 3 * 4);
  const u8 = new Uint8Array(buf);
  u8.set(headerBytes, 0);
  const dv = new DataView(buf);
  let off = headerBytes.length;
  const verts = [1, 2, 3, 4, 5, 6];
  for (const v of verts) { dv.setFloat32(off, v, true); off += 4; }
  return buf;
}

describe('parsePly — ASCII', () => {
  it('reads vertices, colors and faces', () => {
    const r = parsePly(asciiPly());
    expect(r.format).toBe('ascii');
    expect(r.vertices.length).toBe(3);
    expect(r.vertices[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(r.colors?.length).toBe(3);
    expect(r.colors?.[0]).toEqual([1, 0, 0]);
    expect(r.indices).toEqual([0, 1, 2]);
  });
});

describe('parsePly — binary little endian', () => {
  it('reads vertices', () => {
    const r = parsePly(binaryLePly());
    expect(r.format).toBe('binary_little_endian');
    expect(r.vertices.length).toBe(2);
    expect(r.vertices[0]).toEqual({ x: 1, y: 2, z: 3 });
    expect(r.vertices[1]).toEqual({ x: 4, y: 5, z: 6 });
  });
});

describe('parsePly — error handling', () => {
  it('throws when magic is missing', () => {
    const buf = new TextEncoder().encode('not a ply\nend_header\n').buffer as ArrayBuffer;
    expect(() => parsePly(buf)).toThrow();
  });

  it('throws when end_header is missing', () => {
    const buf = new TextEncoder().encode('ply\nformat ascii 1.0\n').buffer as ArrayBuffer;
    expect(() => parsePly(buf)).toThrow();
  });
});
