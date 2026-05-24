/**
 * Viewport drag-and-drop handler — extracted from Index.tsx to reduce main chunk.
 */
import { useCallback, type DragEvent } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import { toast } from 'sonner';

export const SUPPORTED_DROP_EXTENSIONS = [
  'mvr', 'csv', 'json', 'vviz', 'uasset', 'umap', 'copy', 't3d',
  'png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp',
  'udatasmith', 'ds', 'fbx', 'obj', 'gltf', 'glb', 'skp', 'ifc', '3ds', 'dae', 'dwg',
];

export function getDropType(ext: string): string {
  if (ext === 'mvr') return 'mvr';
  if (ext === 'csv') return 'csv';
  if (ext === 'vviz') return 'vviz';
  if (ext === 'uasset' || ext === 'umap') return 'uasset';
  if (['png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp'].includes(ext)) return 'heightmap';
  if (ext === 't3d') return 'ue5map';
  if (['udatasmith', 'ds', 'fbx', 'obj', 'gltf', 'glb', 'skp', 'ifc', '3ds', 'dae', 'dwg', 'c4d', 'rvt'].includes(ext)) return 'twinmotion';
  return 'ue5json';
}

export function useViewportDrop(setIsDragOver: (v: boolean) => void) {
  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes('application/showven-equipment')) {
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; return;
    }
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setIsDragOver(true);
    }
  }, [setIsDragOver]);

  const onDragLeave = useCallback((e: DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, [setIsDragOver]);

  const onDrop = useCallback((e: DragEvent) => {
    setIsDragOver(false);
    if (e.dataTransfer.files?.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (SUPPORTED_DROP_EXTENSIONS.includes(ext)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('viewport-file-drop', { detail: { file, type: getDropType(ext) } }));
        toast.info(`📂 ${file.name} dropped — opening importer...`);
        return;
      }
    }
    const raw = e.dataTransfer.getData('application/showven-equipment');
    if (!raw) return;
    e.preventDefault();
    try {
      const data = JSON.parse(raw);
      if (!data.effectType) return;
      const store = useProjectStore.getState();
      useUndoStore.getState().checkpoint();
      const posId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const offset = store.positions.length * 2;
      store.addPosition({ id: posId, name: data.name, x: offset, y: 0, z: 0, type: 'pyro', color: '#ff8800', heading: 0, pitch: 0, roll: 0 });
      store.addTimelineItem({
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        effectId: data.effectType, startTime: store.currentTime, trackIndex: 0,
        position: { x: offset, y: 0, z: 0 }, notes: `Showven ${data.name}`,
      });
      toast.success(`${data.name} dropped na cena`);
    } catch { /* ignore */ }
  }, [setIsDragOver]);

  return { onDragOver, onDragLeave, onDrop };
}
