/**
 * Mobile "More" menu — organized by domain sections
 */
import { 
  Wind, FileText, Grid3X3, Package, Navigation, Sliders, 
  Gauge, Radio, Timer, Map, Bot, Music2,
  Crosshair, Tag, Video, Box, ShoppingBag, Shield, Code2,
  Users, Link, Sparkles, History, Cloud,
  Activity, FileDown, Route, Factory, Film,
  ArrowRightLeft, Orbit, Cable, Cpu, ScanLine, Zap, Bug,
  Radar, CircuitBoard, Lightbulb, ShieldCheck, Battery, Warehouse,
  BookOpen, Layers, Eye, Camera, Share2, MessageSquare,
  Atom, Volume2, Cog, Settings2, Globe, MapPin, Plane
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PanelId } from '@/components/editor/PanelTabBar';

interface Section {
  title: string;
  items: { id: PanelId; label: string; icon: typeof Wind }[];
}

const SECTIONS: Section[] = [
  {
    title: '📍 Posições',
    items: [
      { id: 'properties', label: 'Propriedades', icon: Settings2 },
      { id: 'waypoints', label: 'Waypoints', icon: Navigation },
      { id: 'groups', label: 'Grupos', icon: Users },
      { id: 'chains', label: 'Chains', icon: Link },
      { id: 'labels', label: 'Etiquetas', icon: Tag },
      { id: 'sitelayout', label: 'Layout Site', icon: Map },
    ],
  },
  {
    title: '📝 Script',
    items: [
      { id: 'script', label: 'Script Editor', icon: Route },
      { id: 'effects', label: 'Efeitos', icon: Sliders },
      { id: 'scripting', label: 'Scripting', icon: Code2 },
      { id: 'calibration', label: 'Calibração', icon: Factory },
    ],
  },
  {
    title: '🎭 Coreografia',
    items: [
      { id: 'swarmgpt', label: 'SwarmGPT AI', icon: Bot },
      { id: 'videochoreo', label: 'Video Choreo', icon: Video },
      { id: 'synesthesia', label: 'Audio Sync', icon: Music2 },
      { id: 'templates', label: 'Templates', icon: FileText },
      { id: 'storyboard', label: 'Storyboard', icon: Film },
      { id: 'trajectory', label: 'Trajetórias', icon: MapPin },
      { id: 'transitions', label: 'Transições', icon: ArrowRightLeft },
      { id: 'collisions', label: 'Colisões', icon: Crosshair },
      { id: 'boids', label: 'Boids', icon: Orbit },
    ],
  },
  {
    title: '🔌 Conexões',
    items: [
      { id: 'usb', label: 'USB', icon: Cpu },
      { id: 'dmx', label: 'DMX512', icon: ScanLine },
      { id: 'smpte', label: 'SMPTE/LTC', icon: Timer },
      { id: 'mavlink', label: 'MAVLink', icon: Radio },
      { id: 'lasercontrol', label: 'Laser', icon: Zap },
      { id: 'livefiring', label: 'Live SFX', icon: Sparkles },
      { id: 'diagnostic', label: 'Diagnóstico', icon: Bug },
    ],
  },
  {
    title: '🚁 Drone',
    items: [
      { id: 'fleet', label: 'Frota', icon: Radar },
      { id: 'showcontrol', label: 'Show Control', icon: CircuitBoard },
      { id: 'takeoffgrid', label: 'Grid', icon: Grid3X3 },
      { id: 'lightprogram', label: 'LED', icon: Lightbulb },
      { id: 'safetycheck', label: 'Safety', icon: ShieldCheck },
      { id: 'pid', label: 'PID', icon: Gauge },
      { id: 'battery', label: 'Bateria', icon: Battery },
      { id: 'indoor', label: 'Indoor', icon: Warehouse },
      { id: 'telemetry', label: 'Telemetria', icon: Activity },
      { id: 'flightlog', label: 'Flight Log', icon: BookOpen },
      { id: 'geofence', label: 'Geofence', icon: Layers },
      { id: 'inspector', label: 'Inspetor', icon: Eye },
    ],
  },
  {
    title: '📦 Hardware',
    items: [
      { id: 'racks', label: 'Racks', icon: Package },
      { id: 'addressing', label: 'Endereçamento', icon: Cpu },
      { id: 'inventory', label: 'Inventário', icon: Package },
      { id: 'suppliers', label: 'Fornecedores', icon: ShoppingBag },
      { id: 'logistics', label: 'Logística', icon: Tag },
    ],
  },
  {
    title: '📊 Relatórios',
    items: [
      { id: 'reports', label: 'Relatórios', icon: FileText },
      { id: 'firing', label: 'Export', icon: FileDown },
      { id: 'video', label: 'Gravação', icon: Video },
      { id: 'share', label: 'Compartilhar', icon: Share2 },
      { id: 'aroverlay', label: 'AR Overlay', icon: Camera },
      { id: 'approval', label: 'Aprovação', icon: MessageSquare },
      { id: 'models', label: 'Modelos 3D', icon: Box },
    ],
  },
  {
    title: '🌍 Cena',
    items: [
      { id: 'scene', label: 'Cena', icon: Cog },
      { id: 'wind', label: 'Vento', icon: Wind },
      { id: 'maps', label: 'Google Maps', icon: Globe },
      { id: 'weather', label: 'Clima', icon: Cloud },
      { id: 'soundlevel', label: 'Som', icon: Volume2 },
      { id: 'particles', label: 'Partículas', icon: Atom },
      { id: 'audience', label: 'Audiência', icon: FileText },
      { id: 'safety', label: 'NFPA', icon: Shield },
      { id: 'showsettings', label: 'Config.', icon: Settings2 },
      { id: 'versioning', label: 'Versões', icon: History },
    ],
  },
];

interface MobileMoreMenuProps {
  onSelectPanel: (id: PanelId) => void;
}

export default function MobileMoreMenu({ onSelectPanel }: MobileMoreMenuProps) {
  return (
    <div className="p-3 space-y-4">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            {section.title}
          </h3>
          <div className="grid grid-cols-4 gap-1.5">
            {section.items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onSelectPanel(id)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                  "bg-muted/20 hover:bg-muted/50 active:scale-95",
                  "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4.5 h-4.5" />
                <span className="text-[7px] font-bold uppercase tracking-wider truncate w-full text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
