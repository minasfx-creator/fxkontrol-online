import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Search, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL_SECTIONS, type PanelId } from './PanelTabBar';
import { ScrollArea } from '@/components/ui/scroll-area';

const RECENTS_KEY = 'fxk-recent-panels';
const MAX_RECENTS = 5;

const PANEL_DESCRIPTIONS: Partial<Record<PanelId, string>> = {
  properties: 'Editar propriedades das posições selecionadas',
  waypoints: 'Definir waypoints para trajetórias de drones',
  groups: 'Organizar posições em grupos lógicos',
  chains: 'Encadear disparos em sequência',
  labels: 'Gerar etiquetas e rótulos para posições',
  sitelayout: 'Configurar layout do local do evento',
  sitemodels: 'Importar modelos 3D do site',
  script: 'Editor de script de disparos com timeline',
  effects: 'Biblioteca e editor de efeitos pirotécnicos',
  scripting: 'Ferramentas avançadas de scripting',
  calibration: 'Calibração de materiais VDL',
  swarmgpt: 'Gerar coreografias de drones com IA',
  videochoreo: 'Criar formações a partir de vídeo',
  synesthesia: 'Sincronizar efeitos com áudio/música',
  templates: 'Templates de shows prontos para usar',
  storyboard: 'Planejamento visual do show',
  trajectory: 'Otimizar trajetórias de voo',
  transitions: 'Planejar transições entre formações',
  collisions: 'Detectar e evitar colisões',
  boids: 'Simulação de enxame com algoritmo Boids',
  easyconnect: 'Descoberta unificada de hardware — BLE, USB, Art-Net, PBUS',
  usb: 'Conectar dispositivos USB de disparo',
  dmx: 'Controle DMX512 para fixtures',
  smpte: 'Sincronização SMPTE/LTC timecode',
  mavlink: 'Comunicação MAVLink com drones',
  lasercontrol: 'Controlar projetores laser ILDA',
  livefiring: 'Console de disparo ao vivo',
  diagnostic: 'Diagnóstico e debug do sistema',
  fleet: 'Gerenciar frota de drones',
  showcontrol: 'Controle central do show',
  takeoffgrid: 'Configurar grid de decolagem',
  lightprogram: 'Programar LEDs dos drones',
  safetycheck: 'Checklist de segurança pré-voo',
  pid: 'Ajustar parâmetros PID dos controladores',
  battery: 'Monitorar baterias da frota',
  indoor: 'Simulação indoor com obstáculos',
  telemetry: 'Dashboard de telemetria em tempo real',
  flightlog: 'Logs de voo e análise pós-show',
  geofence: 'Definir limites de voo (geofence)',
  inspector: 'Inspecionar dados de drones individuais',
  racks: 'Gerenciar racks de disparo',
  addressing: 'Endereçamento de módulos e canais',
  inventory: 'Controle de inventário e custos',
  suppliers: 'Catálogo de fornecedores',
  showven: 'Equipamentos Showven™ SFX',
  logistics: 'Logística de transporte e montagem',
  reports: 'Gerar relatórios do show',
  firing: 'Exportar arquivo de disparo',
  video: 'Gravar vídeo do show',
  share: 'Compartilhar projeto',
  aroverlay: 'Visualizar AR no local do evento',
  approval: 'Enviar show para aprovação do cliente',
  models: 'Importar e gerenciar modelos 3D',
  scene: 'Editar ambiente da cena 3D',
  wind: 'Configurar vento e câmera',
  maps: 'Visualizar no Google Maps',
  weather: 'Previsão do tempo para o evento',
  soundlevel: 'Simulação de nível sonoro',
  particles: 'Editor de partículas personalizado',
  audience: 'Simular perspectiva da audiência',
  safety: 'Verificação de segurança NFPA',
  showsettings: 'Configurações gerais do show',
  versioning: 'Controle de versões do projeto',
  generative: 'Efeitos generativos Lightjams',
};

function getRecents(): PanelId[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
  } catch { return []; }
}

function saveRecent(id: PanelId) {
  const recents = getRecents().filter(r => r !== id);
  recents.unshift(id);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
}

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenPanel: (id: PanelId) => void;
}

export default function FullscreenCommandMenu({ open, onClose, onOpenPanel }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [recents, setRecents] = useState<PanelId[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveCategory(null);
      setRecents(getRecents());
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSelect = useCallback((id: PanelId) => {
    saveRecent(id);
    onOpenPanel(id);
    onClose();
  }, [onOpenPanel, onClose]);

  const filteredSections = useMemo(() => {
    const q = search.toLowerCase().trim();
    return PANEL_SECTIONS
      .filter(s => !activeCategory || s.title === activeCategory)
      .map(s => ({
        ...s,
        items: q
          ? s.items.filter(i =>
              i.label.toLowerCase().includes(q) ||
              (PANEL_DESCRIPTIONS[i.id] || '').toLowerCase().includes(q) ||
              s.title.toLowerCase().includes(q)
            )
          : s.items,
      }))
      .filter(s => s.items.length > 0);
  }, [search, activeCategory]);

  const recentItems = useMemo(() => {
    return recents
      .map(id => {
        for (const s of PANEL_SECTIONS) {
          const item = s.items.find(i => i.id === id);
          if (item) return item;
        }
        return null;
      })
      .filter(Boolean) as typeof PANEL_SECTIONS[0]['items'];
  }, [recents]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-200"
      style={{ background: 'hsl(var(--surface-0) / 0.92)', backdropFilter: 'blur(24px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[960px] max-h-[85vh] mx-4 rounded-3xl border border-border/20 shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ background: 'hsl(var(--card) / 0.98)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-foreground tracking-[0.15em] uppercase font-display">Command Center</span>
            <span className="text-[9px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono-code tracking-wider">⌘K</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface-2 transition-colors text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-border/15" style={{ background: 'hsl(var(--surface-1))' }}>
            <Search className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar funcionalidade..."
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/40 font-medium"
            />
            <span className="text-[10px] text-muted-foreground/30 font-mono-code">ESC</span>
          </div>
        </div>

        {/* Body: sidebar + grid */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Category sidebar */}
          <div className="w-[180px] flex-shrink-0 border-r border-border/10 py-2 hidden md:block">
            <ScrollArea className="h-full">
              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "w-full text-left px-5 py-2.5 text-[11px] font-semibold tracking-wide transition-all",
                  !activeCategory
                    ? "text-primary bg-primary/8"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-surface-1/60"
                )}
              >
                Todas
              </button>
              {PANEL_SECTIONS.map(s => {
                const SIcon = s.icon;
                const isActive = activeCategory === s.title;
                return (
                  <button
                    key={s.title}
                    onClick={() => setActiveCategory(isActive ? null : s.title)}
                    className={cn(
                      "w-full text-left px-5 py-2.5 text-[11px] font-semibold tracking-wide flex items-center gap-2.5 transition-all",
                      isActive
                        ? "text-primary bg-primary/8"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-surface-1/60"
                    )}
                  >
                    <SIcon className="w-3.5 h-3.5" />
                    <span>{s.title}</span>
                  </button>
                );
              })}
            </ScrollArea>
          </div>

          {/* Mobile category tabs */}
          <div className="md:hidden w-full">
            <div className="flex items-center gap-1 px-4 pb-3 overflow-x-auto scrollbar-thin">
              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all",
                  !activeCategory ? "bg-primary/15 text-primary" : "text-muted-foreground/60"
                )}
              >
                Todas
              </button>
              {PANEL_SECTIONS.map(s => (
                <button
                  key={s.title}
                  onClick={() => setActiveCategory(activeCategory === s.title ? null : s.title)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all",
                    activeCategory === s.title ? "bg-primary/15 text-primary" : "text-muted-foreground/60"
                  )}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          {/* Grid content */}
          <ScrollArea className="flex-1">
            <div className="p-5 space-y-6">
              {/* Recents */}
              {!search && !activeCategory && recentItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />
                    <span className="text-[10px] font-bold text-muted-foreground/40 tracking-[0.15em] uppercase font-display">Recentes</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentItems.map(item => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={`recent-${item.id}`}
                          onClick={() => handleSelect(item.id)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/10 hover:border-primary/20 hover:bg-primary/5 transition-all text-muted-foreground/70 hover:text-foreground"
                          style={{ background: 'hsl(var(--surface-1) / 0.5)' }}
                        >
                          <Icon className="w-3.5 h-3.5 text-primary/50" />
                          <span className="text-[11px] font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sections */}
              {filteredSections.map(section => {
                const SIcon = section.icon;
                return (
                  <div key={section.title}>
                    <div className="flex items-center gap-2 mb-3">
                      <SIcon className="w-3.5 h-3.5 text-primary/40" />
                      <span className="text-[10px] font-bold text-muted-foreground/50 tracking-[0.15em] uppercase font-display">{section.title}</span>
                      <div className="flex-1 h-px bg-border/8" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {section.items.map(item => {
                        const Icon = item.icon;
                        const desc = PANEL_DESCRIPTIONS[item.id];
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item.id)}
                            className="group flex flex-col items-start gap-2 p-3.5 rounded-2xl border border-border/10 hover:border-primary/25 transition-all text-left hover:shadow-[0_0_20px_hsl(var(--primary)/0.08)]"
                            style={{ background: 'hsl(var(--surface-1) / 0.4)' }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/8 group-hover:bg-primary/15 transition-colors">
                                <Icon className="w-4.5 h-4.5 text-primary/70 group-hover:text-primary transition-colors" />
                              </div>
                              {item.shortcut && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface-2/60 text-muted-foreground/30 font-mono-code">{item.shortcut}</span>
                              )}
                            </div>
                            <div>
                              <div className="text-[12px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors leading-tight">{item.label}</div>
                              {desc && (
                                <div className="text-[10px] text-muted-foreground/40 mt-0.5 leading-snug line-clamp-2">{desc}</div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredSections.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/30">
                  <Search className="w-8 h-8 mb-3" />
                  <span className="text-sm font-medium">Nenhum resultado para "{search}"</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
