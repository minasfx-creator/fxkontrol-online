/**
 * ViewportConfigMenu — Unified VIEWPORT dropdown
 * Consolidates Camera Presets, Navigation Mode, Display Options
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Camera, ScanEye, Navigation, ChevronDown, Grid3X3, Ruler, Eye, Footprints, Cpu, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSceneStore } from '@/store/useSceneStore';
import { CAMERA_PRESETS } from './skycanvas/sharedState';

type NavMode = 'orbit' | 'freelook' | 'fly' | 'ground';

interface ViewportConfigMenuProps {
  activePreset: string;
  freeLook: boolean;
  flyMode: boolean;
  groundMode: boolean;
  onPresetChange: (id: string) => void;
  onFreeLookToggle: () => void;
  onFlyModeToggle: () => void;
  onGroundModeToggle: () => void;
}

export default function ViewportConfigMenu({
  activePreset,
  freeLook,
  flyMode,
  groundMode,
  onPresetChange,
  onFreeLookToggle,
  onFlyModeToggle,
  onGroundModeToggle,
}: ViewportConfigMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const env = useSceneStore(s => s.environment);
  const updateEnvironment = useSceneStore(s => s.updateEnvironment);

  const currentNavMode: NavMode = groundMode ? 'ground' : flyMode ? 'fly' : freeLook ? 'freelook' : 'orbit';
  const preset = CAMERA_PRESETS.find(p => p.id === activePreset) ?? CAMERA_PRESETS[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const NAV_MODES: { id: NavMode; icon: typeof Camera; label: string; desc: string }[] = [
    { id: 'orbit', icon: Camera, label: 'Orbit', desc: 'LMB Rotate · MMB Pan' },
    { id: 'freelook', icon: ScanEye, label: 'Free Look', desc: 'Unlocked camera' },
    { id: 'fly', icon: Navigation, label: 'Fly (WASD)', desc: 'FPS-style navigation' },
    { id: 'ground', icon: Footprints, label: 'Ground Op', desc: 'Walk at terrain level' },
  ];

  const handleNavMode = useCallback((mode: NavMode) => {
    switch (mode) {
      case 'orbit':
        if (freeLook) onFreeLookToggle();
        if (flyMode) onFlyModeToggle();
        if (groundMode) onGroundModeToggle();
        break;
      case 'freelook':
        if (!freeLook) onFreeLookToggle();
        if (flyMode) onFlyModeToggle();
        if (groundMode) onGroundModeToggle();
        break;
      case 'fly':
        if (freeLook) onFreeLookToggle();
        if (!flyMode) onFlyModeToggle();
        if (groundMode) onGroundModeToggle();
        break;
      case 'ground':
        if (freeLook) onFreeLookToggle();
        if (flyMode) onFlyModeToggle();
        if (!groundMode) onGroundModeToggle();
        break;
    }
  }, [freeLook, flyMode, groundMode, onFreeLookToggle, onFlyModeToggle, onGroundModeToggle]);

  return (
    <div ref={menuRef} className="absolute top-3 left-3 z-30">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all border backdrop-blur-xl",
          open
            ? "bg-primary/15 text-primary border-primary/25 shadow-lg shadow-primary/10"
            : "bg-card/80 text-muted-foreground border-border/20 hover:text-foreground hover:bg-card/90"
        )}
      >
        <Eye className="w-3.5 h-3.5" />
        <span>VIEWPORT</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-[220px] bg-card/95 backdrop-blur-xl border border-border/20 rounded-xl shadow-2xl py-1 animate-fade-in">
          {/* Navigation Mode */}
          <div className="px-3 pt-2 pb-1">
            <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-wider">Navigation</span>
          </div>
          {NAV_MODES.map(({ id, icon: Icon, label, desc }) => (
            <button
              key={id}
              onClick={() => handleNavMode(id)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-all hover:bg-muted/30",
                currentNavMode === id ? "text-primary font-semibold" : "text-muted-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <div className="flex flex-col">
                <span>{label}</span>
                <span className="text-[8px] text-muted-foreground/50">{desc}</span>
              </div>
              {currentNavMode === id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          ))}

          <div className="h-px bg-border/20 mx-2 my-1" />

          {/* Camera Presets */}
          <div className="px-3 pt-1 pb-1">
            <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-wider">Camera Preset</span>
          </div>
          <div className="max-h-[180px] overflow-y-auto">
            {CAMERA_PRESETS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { onPresetChange(id); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-[11px] font-medium flex items-center gap-2 transition-all hover:bg-muted/30",
                  activePreset === id && !freeLook
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="h-px bg-border/20 mx-2 my-1" />

          {/* Display Options */}
          <div className="px-3 pt-1 pb-1">
            <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-wider">Display</span>
          </div>
          <button
            onClick={() => updateEnvironment({ showRulers: !env.showRulers })}
            className={cn(
              "w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-all hover:bg-muted/30",
              env.showRulers ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Rulers</span>
            {env.showRulers && <span className="ml-auto text-[8px] text-primary">ON</span>}
          </button>
          <button
            onClick={() => updateEnvironment({ showAxesHelper: !env.showAxesHelper })}
            className={cn(
              "w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-all hover:bg-muted/30",
              env.showAxesHelper ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Axes Helper</span>
            {env.showAxesHelper && <span className="ml-auto text-[8px] text-primary">ON</span>}
          </button>

          <div className="h-px bg-border/20 mx-2 my-1" />

          {/* Drone Renderer */}
          <div className="px-3 pt-1 pb-1">
            <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-wider">Drone Renderer</span>
          </div>
          <button
            onClick={() => updateEnvironment({ droneRendererMode: 'instanced' })}
            className={cn(
              "w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-all hover:bg-muted/30",
              env.droneRendererMode === 'instanced' ? "text-primary font-semibold" : "text-muted-foreground"
            )}
          >
            <Cpu className="w-3.5 h-3.5" />
            <div className="flex flex-col">
              <span>Instanced (PBR)</span>
              <span className="text-[8px] text-muted-foreground/50">Tri-tier LOD · Production</span>
            </div>
            {env.droneRendererMode === 'instanced' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
          <button
            onClick={() => updateEnvironment({ droneRendererMode: 'swarm' })}
            className={cn(
              "w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-all hover:bg-muted/30",
              env.droneRendererMode === 'swarm' ? "text-primary font-semibold" : "text-muted-foreground"
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            <div className="flex flex-col">
              <span>Swarm (Tactical)</span>
              <span className="text-[8px] text-muted-foreground/50">Zero-GC · 2000+ drones</span>
            </div>
            {env.droneRendererMode === 'swarm' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
        </div>
      )}
    </div>
  );
}
