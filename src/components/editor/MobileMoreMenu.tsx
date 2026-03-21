/**
 * MobileMoreMenu — Apple Settings–style list with search and sections.
 * Clean rows, SF symbol sizing, haptic-ready.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { haptics } from '@/lib/haptics';
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
  Search, ListMusic, FileSignature, Wallet, MonitorPlay, Target,
  Bluetooth, Smartphone, Nfc
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PanelId } from '@/components/editor/PanelTabBar';

const RECENTS_KEY = 'fxk-recent-panels';
const MAX_RECENTS = 5;

interface PanelItem {
  id: PanelId;
  label: string;
  icon: typeof Wind;
  section: string;
}

const ALL_PANELS: PanelItem[] = [
  { id: 'showcommander', label: 'Show Commander', icon: Target, section: 'Comando' },
  { id: 'showcontrol', label: 'Show Control', icon: CircuitBoard, section: 'Comando' },
  { id: 'safetycheck', label: 'Safety Check', icon: ShieldCheck, section: 'Comando' },
  { id: 'weather', label: 'Clima', icon: Cloud, section: 'Comando' },
  { id: 'telemetry', label: 'Telemetria', icon: Activity, section: 'Comando' },
  { id: 'diagnostic', label: 'Diagnóstico', icon: Bug, section: 'Comando' },

  { id: 'setlist', label: 'Setlist', icon: ListMusic, section: 'Produção' },
  { id: 'rider', label: 'Rider', icon: FileSignature, section: 'Produção' },
  { id: 'budget', label: 'Budget', icon: Wallet, section: 'Produção' },
  { id: 'showpreview', label: 'Preview', icon: MonitorPlay, section: 'Produção' },
  { id: 'storyboard', label: 'Storyboard', icon: Film, section: 'Produção' },

  { id: 'share', label: 'Compartilhar', icon: Share2, section: 'Equipe' },
  { id: 'approval', label: 'Aprovação', icon: MessageSquare, section: 'Equipe' },
  { id: 'reports', label: 'Relatórios', icon: FileText, section: 'Equipe' },
  { id: 'video', label: 'Gravação', icon: Video, section: 'Equipe' },

  { id: 'properties', label: 'Propriedades', icon: Settings2, section: 'Posições' },
  { id: 'waypoints', label: 'Waypoints', icon: Navigation, section: 'Posições' },
  { id: 'groups', label: 'Grupos', icon: Users, section: 'Posições' },
  { id: 'chains', label: 'Chains', icon: Link, section: 'Posições' },
  { id: 'labels', label: 'Etiquetas', icon: Tag, section: 'Posições' },
  { id: 'sitelayout', label: 'Layout', icon: Map, section: 'Posições' },

  { id: 'swarmgpt', label: 'SwarmGPT', icon: Bot, section: 'Coreografia' },
  { id: 'videochoreo', label: 'Video AI', icon: Video, section: 'Coreografia' },
  { id: 'synesthesia', label: 'Áudio Reativo', icon: Music2, section: 'Coreografia' },
  { id: 'templates', label: 'Templates', icon: FileText, section: 'Coreografia' },
  { id: 'trajectory', label: 'Trajetórias', icon: MapPin, section: 'Coreografia' },
  { id: 'transitions', label: 'Transições', icon: ArrowRightLeft, section: 'Coreografia' },
  { id: 'collisions', label: 'Colisões', icon: Crosshair, section: 'Coreografia' },

  { id: 'usb', label: 'USB', icon: Cpu, section: 'Conexões' },
  { id: 'dmx', label: 'DMX512', icon: ScanLine, section: 'Conexões' },
  { id: 'smpte', label: 'SMPTE', icon: Timer, section: 'Conexões' },
  { id: 'mavlink', label: 'MAVLink', icon: Radio, section: 'Conexões' },
  { id: 'lasercontrol', label: 'Laser', icon: Zap, section: 'Conexões' },
  { id: 'livefiring', label: 'Live SFX', icon: Sparkles, section: 'Conexões' },
  { id: 'mobilelink', label: 'Mobile Link', icon: Cable, section: 'Conexões' },
  { id: 'bluetooth', label: 'Bluetooth BLE', icon: Bluetooth, section: 'Conexões' },
  { id: 'nfc', label: 'NFC Pair', icon: NfcIcon, section: 'Conexões' },
  { id: 'dmxoutput', label: 'DMX Output', icon: ScanLine, section: 'Conexões' },
  { id: 'remotecontrol', label: 'Remote Control', icon: Smartphone, section: 'Conexões' },
  { id: 'connections', label: 'Conexões HW', icon: Cable, section: 'Conexões' },
  { id: 'radio', label: 'Rádio USB', icon: Radio, section: 'Conexões' },

  { id: 'fleet', label: 'Frota', icon: Radar, section: 'Drones' },
  { id: 'takeoffgrid', label: 'Grid', icon: Grid3X3, section: 'Drones' },
  { id: 'lightprogram', label: 'LED', icon: Lightbulb, section: 'Drones' },
  { id: 'pid', label: 'PID', icon: Gauge, section: 'Drones' },
  { id: 'battery', label: 'Bateria', icon: Battery, section: 'Drones' },
  { id: 'geofence', label: 'Geofence', icon: Layers, section: 'Drones' },

  { id: 'racks', label: 'Racks', icon: Package, section: 'Hardware' },
  { id: 'addressing', label: 'Endereço', icon: Cpu, section: 'Hardware' },
  { id: 'inventory', label: 'Inventário', icon: Package, section: 'Hardware' },
  { id: 'suppliers', label: 'Fornecedor', icon: ShoppingBag, section: 'Hardware' },

  { id: 'scene', label: 'Cena', icon: Cog, section: 'Ambiente' },
  { id: 'wind', label: 'Vento', icon: Wind, section: 'Ambiente' },
  { id: 'maps', label: 'Google Maps', icon: Globe, section: 'Ambiente' },
  { id: 'particles', label: 'Partículas', icon: Atom, section: 'Ambiente' },
  { id: 'safety', label: 'NFPA', icon: Shield, section: 'Ambiente' },
  { id: 'showsettings', label: 'Configurações', icon: Settings2, section: 'Ambiente' },
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
    haptics.tap();
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
    <div className="p-4 space-y-4">
      {/* Search — Apple style */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 pl-10 pr-4 text-sm rounded-xl bg-[hsl(var(--surface-2)/0.8)] text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/20 transition-all border-0"
          autoFocus
        />
      </div>

      {/* Recents — horizontal chips */}
      {recentPanels.length > 0 && !search && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1">Recentes</h4>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {recentPanels.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl glass-button text-foreground/80"
              >
                <Icon className="w-4 h-4" />
                <span className="text-[11px] font-medium whitespace-nowrap">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sections — Apple Settings list style */}
      {sections.map(([title, items]) => (
        <div key={title}>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5 px-1">
            {title}
          </h4>
          <div className="rounded-2xl overflow-hidden bg-[hsl(var(--surface-1)/0.5)]">
            {items.map(({ id, label, icon: Icon }, idx) => (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  "hover:bg-[hsl(var(--surface-3)/0.5)] active:bg-[hsl(var(--surface-4)/0.5)]",
                  idx < items.length - 1 && "border-b border-[hsl(var(--border)/0.08)]"
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[13px] font-medium text-foreground">{label}</span>
                <svg className="w-4 h-4 text-muted-foreground/30 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
