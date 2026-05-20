/**
 * libraryDragDrop — payload encode/decode for dragging library assets
 * into the 3D viewport or sibling panels.
 *
 * Pure helpers — zero React/three.js dependency, fully unit-testable.
 */

export const FXK_ASSET_MIME = 'application/x-fxk-asset' as const;

export type LibraryAssetCategory = 'prop' | 'texture' | 'particle' | 'model3d' | 'audio' | 'other';

export interface LibraryDragPayload {
  id: string;
  name: string;
  category: LibraryAssetCategory;
  file_path: string;
  file_format: string;
}

/** Categorize an asset from its file format/extension. */
export function categorizeByFormat(format: string): LibraryAssetCategory {
  const ext = String(format || '').toLowerCase().replace(/^\./, '');
  if (['glb', 'gltf', 'fbx', 'obj', 'usdz', 'usd'].includes(ext)) return 'model3d';
  if (['png', 'jpg', 'jpeg', 'webp', 'ktx2', 'basis', 'exr', 'hdr'].includes(ext)) return 'texture';
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'audio';
  if (['vat', 'niagara', 'fxa', 'fxe', 'fwe'].includes(ext)) return 'particle';
  if (['skp', 'dae', 'stl', '3mf', 'ply', 'gltf-bin'].includes(ext)) return 'prop';
  return 'other';
}

/** Serialize a payload onto a native DataTransfer. */
export function setDragPayload(dt: DataTransfer, payload: LibraryDragPayload): void {
  try {
    dt.effectAllowed = 'copy';
    dt.setData(FXK_ASSET_MIME, JSON.stringify(payload));
    // Fallback for browsers that strip custom MIMEs in some contexts.
    dt.setData('text/plain', `fxk-asset:${payload.id}`);
  } catch {/* ignore */}
}

/** Try to read a payload back. Returns null on missing or malformed data. */
export function readDragPayload(dt: DataTransfer | null | undefined): LibraryDragPayload | null {
  if (!dt) return null;
  try {
    const raw = dt.getData(FXK_ASSET_MIME);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Partial<LibraryDragPayload>;
    if (typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.file_path !== 'string') return null;
    return {
      id: p.id,
      name: p.name,
      category: (p.category ?? 'other') as LibraryAssetCategory,
      file_path: p.file_path,
      file_format: typeof p.file_format === 'string' ? p.file_format : '',
    };
  } catch {
    return null;
  }
}

/**
 * Where on the viewport should this payload land?
 * Used by the Show3DEngine host to decide between viewport raycast and
 * a sibling panel (audio → audio panel, texture → material panel, etc.).
 */
export type DropTarget = 'viewport' | 'audio_panel' | 'texture_panel' | 'particle_panel' | 'reject';

export function resolveDropTarget(payload: LibraryDragPayload): DropTarget {
  switch (payload.category) {
    case 'model3d':
    case 'prop':
      return 'viewport';
    case 'audio':
      return 'audio_panel';
    case 'texture':
      return 'texture_panel';
    case 'particle':
      return 'particle_panel';
    default:
      return 'reject';
  }
}
