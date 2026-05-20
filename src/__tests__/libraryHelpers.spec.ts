import { describe, it, expect } from 'vitest';
import {
  FXK_ASSET_MIME,
  categorizeByFormat,
  setDragPayload,
  readDragPayload,
  resolveDropTarget,
  type LibraryDragPayload,
} from '@/lib/libraryDragDrop';
import { filterAssets, collectTags, countByCategory, effectiveCategory } from '@/lib/libraryFilters';

// Minimal DataTransfer-like fake.
class FakeDT {
  private map = new Map<string, string>();
  effectAllowed: string = 'none';
  setData(t: string, v: string) { this.map.set(t, v); }
  getData(t: string) { return this.map.get(t) ?? ''; }
}

describe('libraryDragDrop', () => {
  it('categorizes by extension', () => {
    expect(categorizeByFormat('glb')).toBe('model3d');
    expect(categorizeByFormat('.GLTF')).toBe('model3d');
    expect(categorizeByFormat('png')).toBe('texture');
    expect(categorizeByFormat('mp3')).toBe('audio');
    expect(categorizeByFormat('niagara')).toBe('particle');
    expect(categorizeByFormat('skp')).toBe('prop');
    expect(categorizeByFormat('xyz')).toBe('other');
  });

  it('roundtrips a payload via DataTransfer', () => {
    const dt = new FakeDT() as unknown as DataTransfer;
    const payload: LibraryDragPayload = {
      id: 'a1', name: 'Pegasus', category: 'model3d',
      file_path: 'u/1/pegasus.glb', file_format: 'glb',
    };
    setDragPayload(dt, payload);
    const out = readDragPayload(dt);
    expect(out).toEqual(payload);
  });

  it('rejects malformed payload', () => {
    const dt = new FakeDT() as unknown as DataTransfer;
    (dt as unknown as FakeDT).setData(FXK_ASSET_MIME, '{not json');
    expect(readDragPayload(dt)).toBeNull();

    const dt2 = new FakeDT() as unknown as DataTransfer;
    (dt2 as unknown as FakeDT).setData(FXK_ASSET_MIME, JSON.stringify({ id: 1 }));
    expect(readDragPayload(dt2)).toBeNull();
  });

  it('routes drop target per category', () => {
    const make = (c: LibraryDragPayload['category']): LibraryDragPayload =>
      ({ id: 'x', name: 'n', file_path: 'p', file_format: 'f', category: c });
    expect(resolveDropTarget(make('model3d'))).toBe('viewport');
    expect(resolveDropTarget(make('prop'))).toBe('viewport');
    expect(resolveDropTarget(make('audio'))).toBe('audio_panel');
    expect(resolveDropTarget(make('texture'))).toBe('texture_panel');
    expect(resolveDropTarget(make('particle'))).toBe('particle_panel');
    expect(resolveDropTarget(make('other'))).toBe('reject');
  });
});

describe('libraryFilters', () => {
  const assets = [
    { id: '1', name: 'Pegasus Drone', file_format: 'glb', tags: ['drone', 'pro'], category: 'model3d' },
    { id: '2', name: 'Brick Texture', file_format: 'png', tags: ['stone', 'pbr'] },
    { id: '3', name: 'Boom Sample', file_format: 'mp3', tags: ['sfx'], description: 'low boom 808' },
    { id: '4', name: 'Stage Truss', file_format: 'skp', tags: ['stage', 'pro'] },
  ];

  it('effectiveCategory falls back to extension', () => {
    expect(effectiveCategory(assets[1])).toBe('texture');
    expect(effectiveCategory(assets[3])).toBe('prop');
  });

  it('filters by query in name, tags and description', () => {
    expect(filterAssets(assets, { query: 'pegasus' })).toHaveLength(1);
    expect(filterAssets(assets, { query: '808' })).toHaveLength(1);
    expect(filterAssets(assets, { query: 'pbr' })).toHaveLength(1);
  });

  it('filters by category', () => {
    expect(filterAssets(assets, { category: 'model3d' })).toHaveLength(1);
    expect(filterAssets(assets, { category: 'all' })).toHaveLength(4);
  });

  it('filters by tags (AND)', () => {
    expect(filterAssets(assets, { tags: ['pro'] })).toHaveLength(2);
    expect(filterAssets(assets, { tags: ['pro', 'stage'] })).toHaveLength(1);
  });

  it('collectTags sorts by frequency', () => {
    const tags = collectTags(assets);
    expect(tags[0].tag).toBe('pro');
    expect(tags[0].count).toBe(2);
  });

  it('countByCategory aggregates correctly', () => {
    const c = countByCategory(assets);
    expect(c.all).toBe(4);
    expect(c.model3d).toBe(1);
    expect(c.texture).toBe(1);
    expect(c.audio).toBe(1);
    expect(c.prop).toBe(1);
  });
});
