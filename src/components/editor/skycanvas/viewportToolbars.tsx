/**
 * 2D HUD toolbars overlaid on the 3D viewport (extracted from SkyCanvas.tsx).
 *
 * - ViewportPlaybackControls: bottom-center play/rewind/stop + scrub bar.
 * - FullscreenEditMenu: floating menu visible only in fullscreen mode.
 * - SiteModelTransformToolbar: Move/Rotate/Scale gizmo switcher with snap input.
 * - CameraBookmarksBar: chip list of saved cameras (Finale 3D-style).
 * - CameraBookmarkSaver: listens for save/apply bookmark events inside R3F.
 *
 * All components are pure presentational + event listeners — no shared module state.
 */
import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Cog, Minimize, Bookmark, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { timelineTransport } from '@/core/transport/timelineTransport';

/** Viewport playback controls — always visible at bottom center of 3D viewport */
export function ViewportPlaybackControls() {
  const isPlaying = useProjectStore(s => s.isPlaying);
  const currentTime = useProjectStore(s => s.currentTime);
  const duration = useProjectStore(s => s.duration);
  const playbackSpeed = useProjectStore(s => s.playbackSpeed);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const f = Math.floor((t % 1) * 30);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
      <button
        onClick={() => timelineTransport.rewind()}
        className="bg-card/85 backdrop-blur-xl border border-border/25 text-muted-foreground hover:text-foreground hover:bg-card/95 w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-lg"
        title="Rewind (Home)"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M1 1h2v10H1V1zm3 5l6 5V1L4 6z"/></svg>
      </button>

      <button
        onClick={() => timelineTransport.toggle()}
        className={cn(
          "backdrop-blur-xl border w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg",
          isPlaying
            ? "bg-primary/20 text-primary border-primary/30 shadow-primary/15"
            : "bg-card/85 text-foreground border-border/25 hover:bg-card/95"
        )}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="0.5"/><rect x="8.5" y="1" width="3.5" height="12" rx="0.5"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9.5-5.5L3 1.5z"/></svg>
        )}
      </button>

      <button
        onClick={() => timelineTransport.stop()}
        className="bg-card/85 backdrop-blur-xl border border-border/25 text-muted-foreground hover:text-destructive hover:bg-card/95 w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-lg"
        title="Stop"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1.5" y="1.5" width="9" height="9" rx="1"/></svg>
      </button>

      <div className="bg-card/85 backdrop-blur-xl border border-border/25 px-3 h-8 rounded-lg flex items-center gap-2 shadow-lg">
        <span className="text-[10px] font-mono-code text-foreground tracking-wider">{formatTime(currentTime)}</span>
        <span className="text-[9px] text-muted-foreground/60">/</span>
        <span className="text-[10px] font-mono-code text-muted-foreground">{formatTime(duration)}</span>
        {playbackSpeed !== 1 && (
          <span className="text-[8px] font-mono-code text-primary ml-1">{playbackSpeed}×</span>
        )}
      </div>

      <div className="bg-card/85 backdrop-blur-xl border border-border/25 w-24 h-8 rounded-lg flex items-center px-2 shadow-lg cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left - 8) / (rect.width - 16)));
          timelineTransport.seekTo(pct * duration);
        }}
      >
        <div className="relative w-full h-1 bg-border/30 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Floating menu for fullscreen mode — gives access to key actions */
export function FullscreenEditMenu() {
  const isPlaying = useProjectStore(s => s.isPlaying);
  const currentTime = useProjectStore(s => s.currentTime);
  const duration = useProjectStore(s => s.duration);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="absolute top-3 right-3 z-50 flex flex-col items-end gap-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="bg-surface-1/90 backdrop-blur-md text-foreground border border-border/60 px-3 py-1.5 rounded text-[10px] font-mono-code flex items-center gap-1.5 hover:bg-surface-2/90 transition-all shadow-lg"
      >
        <Cog className="w-3.5 h-3.5" />
        Menu
      </button>
      {expanded && (
        <div className="bg-surface-1/95 backdrop-blur-md border border-border/60 rounded-lg shadow-xl p-2 min-w-[160px] space-y-0.5">
          <button
            onClick={() => timelineTransport.toggle()}
            className="w-full text-left px-3 py-1.5 text-[10px] font-mono-code text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded flex items-center gap-2"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={() => timelineTransport.rewind()}
            className="w-full text-left px-3 py-1.5 text-[10px] font-mono-code text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded flex items-center gap-2"
          >
            ⏮ Rewind
          </button>
          <div className="border-t border-border/30 my-1" />
          <div className="px-3 py-1 text-[9px] font-mono-code text-muted-foreground">
            Time: {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
          </div>
          <div className="border-t border-border/30 my-1" />
          <button
            onClick={() => document.exitFullscreen()}
            className="w-full text-left px-3 py-1.5 text-[10px] font-mono-code text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded flex items-center gap-2"
          >
            <Minimize className="w-3 h-3" /> Sair Fullscreen
          </button>
        </div>
      )}
    </div>
  );
}

/** Site Model Transform Toolbar — Move/Rotate/Scale gizmo mode switcher */
export function SiteModelTransformToolbar() {
  const selectedId = useSceneStore((s) => s.selectedSiteModelId);
  const mode = useSceneStore((s) => s.siteModelTransformMode);
  const setMode = useSceneStore((s) => s.setSiteModelTransformMode);
  const selectModel = useSceneStore((s) => s.selectSiteModel);
  const snap = useSceneStore((s) => s.transformSnap);
  const setSnap = useSceneStore((s) => s.setTransformSnap);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedId) {
        selectModel(null);
      }
      if (selectedId) {
        if (e.key === 'g' || e.key === 'G') setMode('translate');
        if (e.key === 'r' || e.key === 'R') setMode('rotate');
        if (e.key === 's' || e.key === 'S') setMode('scale');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedId, selectModel, setMode]);

  if (!selectedId) return null;

  const modes = [
    { key: 'translate' as const, label: 'Move', icon: '⊞', shortcut: 'G' },
    { key: 'rotate' as const, label: 'Rotate', icon: '↻', shortcut: 'R' },
    { key: 'scale' as const, label: 'Scale', icon: '⤢', shortcut: 'S' },
  ];

  const snapLabel = mode === 'translate' ? `${snap.translateSnap}m` : mode === 'rotate' ? `${snap.rotateSnap}°` : `${snap.scaleSnap}x`;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-card/90 backdrop-blur-xl border border-border/30 rounded-xl px-2 py-1.5 shadow-lg">
      <span className="text-[9px] text-muted-foreground font-mono mr-1">MODEL</span>
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => setMode(m.key)}
          className={cn(
            'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all',
            mode === m.key
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
          title={`${m.label} (${m.shortcut})`}
        >
          {m.icon} {m.label}
        </button>
      ))}
      <div className="w-px h-4 bg-border/40 mx-1" />
      <button
        onClick={() => setSnap({ enabled: !snap.enabled })}
        className={cn(
          'px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1',
          snap.enabled
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        title={`Snap: ${snap.enabled ? 'ON' : 'OFF'} (${snapLabel})`}
      >
        ⊡ Snap {snap.enabled && <span className="text-[9px] opacity-70">{snapLabel}</span>}
      </button>
      {snap.enabled && (
        <input
          type="number"
          className="w-12 bg-muted/60 border border-border/30 rounded px-1 py-0.5 text-[10px] text-foreground text-center"
          value={mode === 'translate' ? snap.translateSnap : mode === 'rotate' ? snap.rotateSnap : snap.scaleSnap}
          min={mode === 'scale' ? 0.01 : 1}
          step={mode === 'translate' ? 0.5 : mode === 'rotate' ? 5 : 0.05}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (isNaN(v) || v <= 0) return;
            if (mode === 'translate') setSnap({ translateSnap: v });
            else if (mode === 'rotate') setSnap({ rotateSnap: v });
            else setSnap({ scaleSnap: v });
          }}
          title={mode === 'translate' ? 'Snap distance (m)' : mode === 'rotate' ? 'Snap angle (°)' : 'Snap scale step'}
        />
      )}
      <div className="w-px h-4 bg-border/40 mx-1" />
      <button
        onClick={() => selectModel(null)}
        className="px-2 py-1 rounded-lg text-[10px] text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all"
        title="Deselect (Esc)"
      >
        ✕
      </button>
    </div>
  );
}

/** Camera Bookmarks bar — Finale 3D custom camera shortcuts */
export function CameraBookmarksBar({ setActivePreset, setFreeLook }: {
  setActivePreset: (id: string) => void;
  setFreeLook: (v: boolean) => void;
}) {
  const bookmarks = useSceneStore(st => st.environment.cameraBookmarks);
  const removeCameraBookmark = useSceneStore(st => st.removeCameraBookmark);

  if (bookmarks.length === 0) return null;

  return (
    <div className="absolute top-14 left-3 flex items-center gap-1 flex-wrap max-w-[calc(100%-24px)]">
      {bookmarks.map(bm => (
        <div key={bm.id} className="group relative">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('apply-camera-bookmark', { detail: bm }));
              setFreeLook(true);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold transition-all border backdrop-blur-md bg-card/80 text-muted-foreground border-border/20 hover:text-foreground hover:bg-card/90"
          >
            <Bookmark className="w-3 h-3 text-primary/60" />
            {bm.name}
          </button>
          <button
            onClick={() => removeCameraBookmark(bm.id)}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Bookmark save handler — listens for save events and grabs camera state */
export function CameraBookmarkSaver() {
  const { camera } = useThree();
  const addCameraBookmark = useSceneStore(st => st.addCameraBookmark);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      addCameraBookmark({
        id: detail.id,
        name: detail.name,
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [0, 0, 0],
        fov: (camera as THREE.PerspectiveCamera).fov,
      });
    };
    window.addEventListener('save-camera-bookmark', handler);
    return () => window.removeEventListener('save-camera-bookmark', handler);
  }, [camera, addCameraBookmark]);

  useEffect(() => {
    const handler = (e: Event) => {
      const bm = (e as CustomEvent).detail;
      camera.position.set(bm.position[0], bm.position[1], bm.position[2]);
      if ((camera as THREE.PerspectiveCamera).fov !== bm.fov) {
        (camera as THREE.PerspectiveCamera).fov = bm.fov;
        (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
      }
    };
    window.addEventListener('apply-camera-bookmark', handler);
    return () => window.removeEventListener('apply-camera-bookmark', handler);
  }, [camera]);

  return null;
}
