/**
 * MobileMoreMenu — Compact grid with search, recents, and operator-focused sections.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wind, FileText, Grid3X3, Package, Navigation, Sliders,
  Gauge, Radio, Timer, Map, Bot, Music2,
  Crosshair, Tag, Video, Box, ShoppingBag, Shield, Code2,
  Users, Link, Sparkles, History, Cloud,
  Activity, FileDown, Route, Factory, Film,
  ArrowRightLeft, Orbit, Cable, Cpu, ScanLine, Zap, Bug,
  Radar, CircuitBoard, Lightbulb, ShieldCheck, Battery, Warehouse,
  BookOpen, Layers, Eye, Camera, Share2, MessageSquare,
  Atom, Volume2, Cog, Settings2, Globe, MapPin, Plane,
  Search, ListMusic, FileSignature, Wallet, MonitorPlay
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PanelId } from '@/components/editor/PanelTabBar';

const RECENTS_KEY = 'fxk-recent-panels';
const MAX_RECENTS = 6;

interface PanelItem {
  id: PanelId;
  label: string;
  icon: typeof Wind;
  section: string;
}

const ALL_PANELS: PanelItem[] = [
  // Quick Access (operators)
  { id: 'showcontrol', label: 'Show Control', icon: CircuitBoard, section: '⚡ Acesso Rápido' },
  { id: 'safetycheck', label: 'Safety', icon: ShieldCheck, section: '⚡ Acesso Rápido' },
  { id: 'weather', label: 'Clima', icon: Cloud, section: '⚡ Acesso Rápido' },
  { id: 'telemetry', label: 'Telemetria', icon: Activity, section: '⚡ Acesso Rápido' },
  { id: 'diagnostic', label: 'Diagnóstico', icon: Bug, section: '⚡ Acesso Rápido' },
  // Crew Tools
  { id: 'share', label: 'Compartilhar', icon: Share2, section: '👥 Equipe' },
  { id: 'approval', label: 'Aprovação', icon: MessageSquare, section: '👥 Equipe' },
  { id: 'storyboard', label: 'Storyboard', icon: Film, section: '👥 Equipe' },
  { id: 'reports', label: 'Relatórios', icon: FileText, section: '👥 Equipe' },
  { id: 'video', label: 'Gravação', icon: Video, section: '👥 Equipe' },
  // Positions
  { id: 'properties', label: 'Propriedades', icon: Settings2, section: '📍 Posições' },
  { id: 'waypoints', label: 'Waypoints', icon: Navigation, section: '📍 Posições' },
  { id: 'groups', label: 'Grupos', icon: Users, section: '📍 Posições' },
  { id: 'chains', label: 'Chains', icon: Link, section: '📍 Posições' },
  { id: 'labels', label: 'Etiquetas', icon: Tag, section: '📍 Posições' },
  { id: 'sitelayout', label: 'Layout', icon: Map, section: '📍 Posições' },
  // Choreography
  { id: 'swarmgpt', label: 'SwarmGPT', icon: Bot, section: '🎭 Coreografia' },
  { id: 'videochoreo', label: 'Video AI', icon: Video, section: '🎭 Coreografia' },
  { id: 'synesthesia', label: 'Áudio', icon: Music2, section: '🎭 Coreografia' },
  { id: 'templates', label: 'Templates', icon: FileText, section: '🎭 Coreografia' },
  { id: 'trajectory', label: 'Trajetórias', icon: MapPin, section: '🎭 Coreografia' },
  { id: 'transitions', label: 'Transições', icon: ArrowRightLeft, section: '🎭 Coreografia' },
  { id: 'collisions', label: 'Colisões', icon: Crosshair, section: '🎭 Coreografia' },
  { id: 'boids', label: 'Boids', icon: Orbit, section: '🎭 Coreografia' },
  // Script
  { id: 'script', label: 'Script', icon: Route, section: '📝 Script' },
  { id: 'effects', label: 'Efeitos', icon: Sliders, section: '📝 Script' },
  { id: 'scripting', label: 'Scripting', icon: Code2, section: '📝 Script' },
  { id: 'calibration', label: 'Calibração', icon: Factory, section: '📝 Script' },
  // Connections
  { id: 'usb', label: 'USB', icon: Cpu, section: '🔌 Conexões' },
  { id: 'dmx', label: 'DMX512', icon: ScanLine, section: '🔌 Conexões' },
  { id: 'smpte', label: 'SMPTE', icon: Timer, section: '🔌 Conexões' },
  { id: 'mavlink', label: 'MAVLink', icon: Radio, section: '🔌 Conexões' },
  { id: 'lasercontrol', label: 'Laser', icon: Zap, section: '🔌 Conexões' },
  { id: 'livefiring', label: 'Live SFX', icon: Sparkles, section: '🔌 Conexões' },
  // Drone
  { id: 'fleet', label: 'Frota', icon: Radar, section: '🚁 Drone' },
  { id: 'takeoffgrid', label: 'Grid', icon: Grid3X3, section: '🚁 Drone' },
  { id: 'lightprogram', label: 'LED', icon: Lightbulb, section: '🚁 Drone' },
  { id: 'pid', label: 'PID', icon: Gauge, section: '🚁 Drone' },
  { id: 'battery', label: 'Bateria', icon: Battery, section: '🚁 Drone' },
  { id: 'indoor', label: 'Indoor', icon: Warehouse, section: '🚁 Drone' },
  { id: 'flightlog', label: 'Flight Log', icon: BookOpen, section: '🚁 Drone' },
  { id: 'geofence', label: 'Geofence', icon: Layers, section: '🚁 Drone' },
  { id: 'inspector', label: 'Inspetor', icon: Eye, section: '🚁 Drone' },
  // Hardware
  { id: 'racks', label: 'Racks', icon: Package, section: '📦 Hardware' },
  { id: 'addressing', label: 'Endereço', icon: Cpu, section: '📦 Hardware' },
  { id: 'inventory', label: 'Inventário', icon: Package, section: '📦 Hardware' },
  { id: 'suppliers', label: 'Fornecedor', icon: ShoppingBag, section: '📦 Hardware' },
  { id: 'logistics', label: 'Logística', icon: Tag, section: '📦 Hardware' },
  // Scene
  { id: 'scene', label: 'Cena', icon: Cog, section: '🌍 Cena' },
  { id: 'wind', label: 'Vento', icon: Wind, section: '🌍 Cena' },
  { id: 'maps', label: 'Google Maps', icon: Globe, section: '🌍 Cena' },
  { id: 'soundlevel', label: 'Som', icon: Volume2, section: '🌍 Cena' },
  { id: 'particles', label: 'Partículas', icon: Atom, section: '🌍 Cena' },
  { id: 'audience', label: 'Audiência', icon: FileText, section: '🌍 Cena' },
  { id: 'safety', label: 'NFPA', icon: Shield, section: '🌍 Cena' },
  { id: 'showsettings', label: 'Config.', icon: Settings2, section: '🌍 Cena' },
  { id: 'versioning', label: 'Versões', icon: History, section: '🌍 Cena' },
  { id: 'aroverlay', label: 'AR', icon: Camera, section: '🌍 Cena' },
  { id: 'models', label: '3D', icon: Box, section: '🌍 Cena' },
  { id: 'firing', label: 'Export', icon: FileDown, section: '🌍 Cena' },
];

interface MobileMoreMenuProps {
  onSelectPanel: (id: PanelId) => void;
}

export default function MobileMoreMenu({ onSelectPanel }: MobileMoreMenuProps) {
  const [search, setSearch] = useState('');
  const [recents, setRecents] = useState<PanelId[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
      setRecents(stored.slice(0, MAX_RECENTS));
    } catch { setRecents([]); }
  }, []);

  const handleSelect = useCallback((id: PanelId) => {
    onSelectPanel(id);
    // Update recents
    const updated = [id, ...recents.filter(r => r !== id)].slice(0, MAX_RECENTS);
    setRecents(updated);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
  }, [onSelectPanel, recents]);

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_PANELS;
    const q = search.toLowerCase();
    return ALL_PANELS.filter(p => p.label.toLowerCase().includes(q) || p.section.toLowerCase().includes(q));
  }, [search]);

  const sections = useMemo(() => {
    const map: Record<string, PanelItem[]> = {};
    filtered.forEach(p => {
      if (!map[p.section]) map[p.section] = [];
      map[p.section].push(p);
    });
    return Object.entries(map);
  }, [filtered]);

  const recentPanels = useMemo(() =>
    recents.map(id => ALL_PANELS.find(p => p.id === id)).filter(Boolean) as PanelItem[],
    [recents]
  );

  return (
    <div className="p-3 space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar painel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-8 pl-8 pr-3 text-xs rounded-xl glass-card text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/30 transition-all"
        />
      </div>

      {/* Recents */}
      {recentPanels.length > 0 && !search && (
        <div>
          <h4 className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5 px-1">Recentes</h4>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {recentPanels.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-card text-foreground/80 hover:text-foreground active:scale-95 transition-all"
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[9px] font-semibold whitespace-nowrap">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sections grid */}
      {sections.map(([title, items]) => (
        <div key={title}>
          <h4 className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5 px-1">
            {title}
          </h4>
          <div className="grid grid-cols-5 gap-1">
            {items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all active:scale-95",
                  "glass-card text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[6px] font-bold uppercase tracking-wider truncate w-full text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
