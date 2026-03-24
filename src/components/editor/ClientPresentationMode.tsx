/**
 * ─── Client Presentation Mode ────────────────────────────────────────
 * Fullscreen cinematic overlay for client demos.
 * Hides all editor UI, auto-plays timeline with cinematic camera.
 * ESC to exit.
 */

import { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Pause } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { generateCinematicKeyframes } from '@/core/camera/cinematicSequencer';
import { triggerOrbit, stopOrbit } from '@/core/geo/GeoCameraController';
import { geoToLocalSync } from '@/core/geo/useGeo';

interface ClientPresentationModeProps {
  active: boolean;
  onExit: () => void;
}

export default function ClientPresentationMode({ active, onExit }: ClientPresentationModeProps) {
  const [showControls, setShowControls] = useState(true);

  const projectName = useProjectStore((s) => s.name);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const currentTime = useProjectStore((s) => s.currentTime);
  const duration = useProjectStore((s) => s.duration);

  // Auto-hide controls after 3s
  useEffect(() => {
    if (!active) return;
    setShowControls(true);
    const timer = setTimeout(() => setShowControls(false), 3000);
    return () => clearTimeout(timer);
  }, [active]);

  // Show controls on mouse move
  useEffect(() => {
    if (!active) return;
    let hideTimer: ReturnType<typeof setTimeout>;
    const onMove = () => {
      setShowControls(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setShowControls(false), 3000);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      clearTimeout(hideTimer);
    };
  }, [active]);

  // ESC to exit
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onExit();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [active, onExit]);

  // On enter: enable Google 3D tiles, cinematic camera, auto-play
  useEffect(() => {
    if (!active) return;

    const settings = useSceneStore.getState().settings;

    // Force Google Earth + Floating Origin
    useSceneStore.getState().updateSettings({
      google3DTilesEnabled: true,
      floatingOriginEnabled: true,
    });

    // Generate cinematic keyframes and enable camera animation
    const keyframes = generateCinematicKeyframes(
      {
        lat: settings.geoAnchorLat,
        lng: settings.geoAnchorLon,
        alt: settings.geoAnchorAlt,
        duration: duration || 120,
      },
      settings.geoAnchorLat,
      settings.geoAnchorLon,
      settings.geoAnchorAlt,
    );

    useProjectStore.getState().setCameraKeyframes(keyframes);
    useProjectStore.getState().setCameraAnimationEnabled(true);

    // Start playback
    if (!useProjectStore.getState().isPlaying) {
      useProjectStore.getState().play();
    }

    // Start orbit as fallback
    const center = geoToLocalSync(
      settings.geoAnchorLat, settings.geoAnchorLon, settings.geoAnchorAlt,
      settings.geoAnchorLat, settings.geoAnchorLon, settings.geoAnchorAlt,
    );
    triggerOrbit([center.x, 0, center.z], 400, 0.08, 250);

    return () => {
      // On exit: stop orbit, pause, restore camera
      stopOrbit();
      useProjectStore.getState().setCameraAnimationEnabled(false);
    };
  }, [active, duration]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      useProjectStore.getState().pause();
    } else {
      useProjectStore.getState().play();
    }
  }, [isPlaying]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!active) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Top bar — show name */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-auto transition-opacity duration-500"
        style={{ opacity: showControls ? 1 : 0 }}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/70 to-transparent">
          <div>
            <h1 className="text-white text-lg font-bold tracking-wide drop-shadow-lg">
              {projectName || 'FX KONTROL'}
            </h1>
            <p className="text-white/60 text-xs font-mono">
              Digital Twin · Apresentação Cliente
            </p>
          </div>
          <button
            onClick={onExit}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Sair (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom bar — timeline + controls */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-auto transition-opacity duration-500"
        style={{ opacity: showControls ? 1 : 0 }}
      >
        <div className="px-6 py-4 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlayback}
              className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            {/* Progress bar */}
            <div className="flex-1 relative h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>

            <span className="text-white/80 text-xs font-mono min-w-[80px] text-right">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>

      {/* Watermark */}
      <div className="absolute bottom-16 right-6 pointer-events-none">
        <p className="text-white/20 text-[10px] font-mono tracking-widest">
          FX KONTROL · MINAS FX
        </p>
      </div>
    </div>,
    document.body,
  );
}
