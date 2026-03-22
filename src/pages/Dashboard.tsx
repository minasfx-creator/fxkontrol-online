import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Clapperboard, CalendarDays, GraduationCap, Plus, FolderOpen,
  Zap, Rocket, Flame, Target, Clock, ArrowRight, Sparkles,
  Radio, Cpu, Cable, Activity, Heart, MessageCircle, Share2,
  TrendingUp, TrendingDown, Minus, Circle, Bookmark,
  Shield, Smartphone, Play, Palette, Wand2, Layers,
  Timer, Crosshair, Volume2, Lightbulb, Pencil, LayoutTemplate,
  Wifi, Globe, Gauge, Hand, Usb
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import CinematicIntro from '@/components/editor/CinematicIntro';
import { useIsMobile } from '@/hooks/use-mobile';

/* ── Types ──────────────────────────────────────────── */
interface Project {
  id: string;
  name: string;
  updated_at: string;
  duration: number;
}

interface Event {
  id: string;
  name: string;
  event_date: string | null;
  status: string;
  event_type: string;
  client_name: string;
}

interface NewsItem {
  id: number;
  title: string;
  category: 'pyro' | 'drones' | 'sfx' | 'lighting' | 'festivals';
  sentiment: 'positive' | 'negative' | 'neutral';
  time: string;
  image: string;
  source: string;
  avatar: string;
}

/* ── Constants ──────────────────────────────────────── */
const MOCK_NEWS: NewsItem[] = [
  { id: 1, title: 'Drone shows superam fogos em 35% dos eventos corporativos na Europa', category: 'drones', sentiment: 'positive', time: '2min', image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600&h=600&fit=crop', source: 'DroneWorld', avatar: '🤖' },
  { id: 2, title: 'NFPA atualiza norma 1123 para pirotecnia de proximidade', category: 'pyro', sentiment: 'neutral', time: '15min', image: 'https://images.unsplash.com/photo-1498931299472-f7a63a5a1cfa?w=600&h=600&fit=crop', source: 'PyroNews', avatar: '🎆' },
  { id: 3, title: 'Showven lança novo SparkularFall 2 com controle DMX integrado', category: 'sfx', sentiment: 'positive', time: '28min', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop', source: 'SFX Today', avatar: '🔥' },
  { id: 4, title: 'Rock in Rio 2026 confirma 40 shows com drones sincronizados', category: 'festivals', sentiment: 'positive', time: '45min', image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&h=600&fit=crop', source: 'Festival Mag', avatar: '🎪' },
  { id: 5, title: 'Escassez global de lítio pode afetar baterias de drones em 2027', category: 'drones', sentiment: 'negative', time: '1h', image: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=600&h=600&fit=crop', source: 'TechBrief', avatar: '🤖' },
  { id: 6, title: 'Moving heads Ayrton Perseo ganha prêmio LDI Innovation', category: 'lighting', sentiment: 'positive', time: '2h', image: 'https://images.unsplash.com/photo-1504509546545-e000b4a62425?w=600&h=600&fit=crop', source: 'LDI Weekly', avatar: '💡' },
  { id: 7, title: 'Novo protocolo Art-Net 5 promete latência sub-1ms', category: 'lighting', sentiment: 'positive', time: '3h', image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&h=600&fit=crop', source: 'ProLight', avatar: '💡' },
  { id: 8, title: 'FAA restringe voos de drones em 12 novos aeroportos dos EUA', category: 'drones', sentiment: 'negative', time: '4h', image: 'https://images.unsplash.com/photo-1506947411487-a56738b4ccd4?w=600&h=600&fit=crop', source: 'AviationPost', avatar: '🤖' },
  { id: 9, title: 'Galaxis lança módulo de disparo com 64 canais e GPS integrado', category: 'pyro', sentiment: 'positive', time: '5h', image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&h=600&fit=crop', source: 'FireTech', avatar: '🎆' },
  { id: 10, title: 'Coachella 2026 bate recorde com 1.200 drones em show de encerramento', category: 'festivals', sentiment: 'positive', time: '6h', image: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=600&h=600&fit=crop', source: 'Festival Mag', avatar: '🎪' },
];

const CATEGORY_FILTERS: Array<{ key: NewsItem['category'] | 'all'; label: string; emoji: string }> = [
  { key: 'all', label: 'Tudo', emoji: '🌐' },
  { key: 'pyro', label: 'Pyro', emoji: '🎆' },
  { key: 'drones', label: 'FXK-DRONES', emoji: '🤖' },
  { key: 'sfx', label: 'SFX', emoji: '🔥' },
  { key: 'lighting', label: 'Light', emoji: '💡' },
  { key: 'festivals', label: 'Festivals', emoji: '🎪' },
];

const TYPE_ICONS: Record<string, string> = {
  pyro: '🎆', drone: '🤖', sfx: '🔥', mixed: '🎯',
};

/* ── Hub Tool Definitions ───────────────────────────── */
interface HubTool {
  label: string;
  icon: React.ElementType;
  panel: string;
}

const SHOW_COMMANDER_TOOLS: HubTool[] = [
  { label: 'Super DMX', icon: Zap, panel: 'super_dmx' },
  { label: 'FXK-PYRO', icon: Flame, panel: 'pyro_fire' },
  { label: 'Auto Fire', icon: Timer, panel: 'auto_fire' },
  { label: 'Manual Fire', icon: Hand, panel: 'manual_fire' },
  { label: 'FXK-LINK', icon: Smartphone, panel: 'mobile_link' },
  { label: 'Safety', icon: Shield, panel: 'check_slave' },
];

const MASTER_EDITOR_TOOLS: HubTool[] = [
  { label: 'Script Editor', icon: Pencil, panel: 'script' },
  { label: 'Efeitos', icon: Wand2, panel: 'effects' },
  { label: 'SwarmGPT AI', icon: Sparkles, panel: 'swarmgpt' },
  { label: 'Storyboard', icon: Layers, panel: 'storyboard' },
  { label: 'Timeline', icon: Clapperboard, panel: '' },
  { label: 'Templates', icon: LayoutTemplate, panel: 'templates' },
];

/* ── Feed Card (Instagram-style) ─────────────────────── */
function FeedCard({ item }: { item: NewsItem }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="bg-card border border-border/40 rounded-2xl overflow-hidden group">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-sm">
          {item.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{item.source}</p>
          <p className="text-[9px] text-muted-foreground font-mono-code">{item.time}</p>
        </div>
        {item.sentiment === 'positive' && <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
        {item.sentiment === 'negative' && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
        {item.sentiment === 'neutral' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className="relative aspect-[4/3] overflow-hidden">
        <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" loading="lazy" />
      </div>
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setLiked(!liked)} className="active:scale-90 transition-transform">
            <Heart className={`h-5 w-5 ${liked ? 'fill-red-500 text-red-500' : 'text-foreground/70 hover:text-foreground'} transition-colors`} />
          </button>
          <MessageCircle className="h-5 w-5 text-foreground/70 hover:text-foreground cursor-pointer transition-colors" />
          <Share2 className="h-5 w-5 text-foreground/70 hover:text-foreground cursor-pointer transition-colors" />
        </div>
        <button onClick={() => setSaved(!saved)} className="active:scale-90 transition-transform">
          <Bookmark className={`h-5 w-5 ${saved ? 'fill-foreground text-foreground' : 'text-foreground/70 hover:text-foreground'} transition-colors`} />
        </button>
      </div>
      <div className="px-4 pb-4 pt-1">
        <p className="text-xs leading-relaxed text-foreground/90">
          <span className="font-semibold mr-1">{item.source}</span>
          {item.title}
        </p>
      </div>
    </div>
  );
}

/* ── Hub Card Component ──────────────────────────────── */
function HubCard({
  title, subtitle, badge, tools, accentClass, borderClass, badgeBg, navigate, delay = '0s', commandRoute = false
}: {
  title: string;
  subtitle: string;
  badge: string;
  tools: HubTool[];
  accentClass: string;
  borderClass: string;
  badgeBg: string;
  navigate: (path: string) => void;
  delay?: string;
  commandRoute?: boolean;
}) {
  const baseDelay = parseFloat(delay);
  const goToTool = (panel: string) => {
    if (commandRoute) {
      navigate(panel ? `/command?mode=${panel}` : '/command');
    } else if (panel) {
      navigate(`/editor?panel=${panel}`);
    } else {
      navigate('/editor');
    }
  };

  return (
    <Card className={`bg-card ${borderClass} overflow-hidden animate-fxk-stagger group/hub`} style={{ animationDelay: delay }}>
      <CardContent className="p-0">
        {/* Hub Header — shimmer on hover */}
        <div className={`px-4 py-3 border-b border-border/30 bg-gradient-to-r ${accentClass} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(var(--foreground)/0.03)] to-transparent opacity-0 group-hover/hub:opacity-100 transition-opacity duration-500" style={{ backgroundSize: '200% 100%', animation: 'fxk-shimmer 3s linear infinite' }} />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <h2 className="text-sm font-bold font-display text-foreground tracking-tight">{title}</h2>
              <p className="text-[9px] text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
            <span className={`text-[8px] font-bold font-mono-code uppercase tracking-widest px-2 py-0.5 rounded-full ${badgeBg}`}>
              {badge}
            </span>
          </div>
        </div>

        {/* Tool Grid — staggered buttons */}
        <div className="p-3 grid grid-cols-3 gap-1.5">
          {tools.map((tool, i) => (
            <button
              key={tool.label}
              onClick={() => goToTool(tool.panel)}
              className="group flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all duration-200 hover:bg-muted/40 active:scale-[0.95] border border-transparent hover:border-border/30 animate-fxk-stagger"
              style={{ animationDelay: `${baseDelay + 0.05 * i}s` }}
            >
              <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center group-hover:bg-muted/60 group-hover:scale-110 transition-all duration-200">
                <tool.icon className="h-3.5 w-3.5 text-foreground/70 group-hover:text-foreground transition-colors" />
              </div>
              <span className="text-[9px] font-semibold text-muted-foreground group-hover:text-foreground text-center leading-tight transition-colors">
                {tool.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Dashboard ───────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === 'undefined') return false;
    const seen = sessionStorage.getItem('fxk-intro-seen');
    return !seen;
  });
  const [feedFilter, setFeedFilter] = useState<NewsItem['category'] | 'all'>('all');

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false);
    sessionStorage.setItem('fxk-intro-seen', '1');
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('projects')
      .select('id, name, updated_at, duration')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setProjects(data ?? []));

    supabase
      .from('events')
      .select('id, name, event_date, status, event_type, client_name')
      .eq('user_id', user.id)
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .limit(4)
      .then(({ data }) => setEvents(data ?? []));
  }, [user]);

  const totalMinutes = Math.round(projects.reduce((s, p) => s + p.duration, 0) / 60);
  const userName = user?.email?.split('@')[0] ?? 'Operator';
  const lastProjectId = typeof window !== 'undefined' ? localStorage.getItem('fxk-last-project') : null;
  const nextEvent = events[0];
  const daysUntilNext = nextEvent?.event_date
    ? differenceInDays(new Date(nextEvent.event_date), new Date())
    : null;

  const filteredNews = feedFilter === 'all' ? MOCK_NEWS : MOCK_NEWS.filter(n => n.category === feedFilter);

  if (showIntro) {
    return <CinematicIntro onComplete={handleIntroComplete} />;
  }

  return (
    <div className="max-w-7xl mx-auto pb-10">
      {/* ── Hero Banner ──────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-[hsl(var(--surface-1))] via-[hsl(var(--surface-2))] to-[hsl(var(--surface-1))] p-6 md:p-8 mb-6 animate-fxk-fade-up">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="absolute top-4 right-4 opacity-[0.03]">
          <Sparkles className="h-40 w-40" />
        </div>
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="text-xs font-mono-code text-primary/80 tracking-widest uppercase mb-2">
              ● FX KONTROL ONLINE
            </p>
            <h1 className="text-3xl md:text-4xl font-bold font-display tracking-tight text-foreground">
              Bem-vindo, <span className="text-fxk-gradient">{userName}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-lg">
              Sua estação de controle para shows pirotécnicos, drones e efeitos especiais.
            </p>
          </div>
          {lastProjectId && (
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex gap-1.5 text-xs border-primary/20 text-primary hover:bg-primary/10"
              onClick={() => navigate('/editor')}
            >
              <ArrowRight className="h-3 w-3" />
              Retomar sessão
            </Button>
          )}
        </div>
      </div>

      {/* ── Main Grid: Left (ops) + Center (feed) + Right ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px_1fr] gap-6">

        {/* ─ Left Column ─ */}
        <div className="space-y-4 order-2 lg:order-1">
          {/* Show Commander Hub */}
          <HubCard
            title="FXK-PYRO Hub"
            subtitle="Execução e controle ao vivo"
            badge="LIVE"
            tools={SHOW_COMMANDER_TOOLS}
            accentClass="from-accent/5 to-transparent"
            borderClass="border-accent/20 hover:border-accent/40 transition-colors"
            badgeBg="bg-accent/15 text-accent"
            navigate={navigate}
            commandRoute
            delay="0.1s"
          />

          {/* Mobile Command Launcher */}
          <div className="space-y-2 animate-fxk-stagger" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={() => navigate('/editor?panel=remotecontrol')}
              className="w-full group relative overflow-hidden rounded-xl border border-accent/20 bg-gradient-to-r from-accent/5 via-card to-primary/5 p-4 text-left transition-all duration-300 hover:border-accent/40 hover:shadow-[0_0_20px_hsl(var(--accent)/0.1)] active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                  <Smartphone className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold font-display text-foreground">Mobile Command</p>
                    <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-glow" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Controle remoto Master/Slave para qualquer dispositivo
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors shrink-0" />
              </div>
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/editor?panel=remotecontrol&mode=wifi')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/20 bg-accent/5 text-[9px] font-semibold text-accent hover:bg-accent/10 transition-colors active:scale-95"
              >
                📶 WiFi
              </button>
              <button
                onClick={() => navigate('/editor?panel=remotecontrol&mode=cloud')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-[9px] font-semibold text-primary hover:bg-primary/10 transition-colors active:scale-95"
              >
                ☁️ Cloud
              </button>
            </div>
          </div>

          {/* Hardware Controllers */}
          <Card className="bg-card border-border/50 animate-fxk-stagger overflow-hidden" style={{ animationDelay: '0.3s' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-display">Hardware</span>
                </div>
                <button
                  onClick={() => navigate('/command?mode=controllers')}
                  className="text-[9px] text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  Ver todos →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'FXK-PYRO', icon: Zap, mode: 'pyro_fire', color: 'text-red-400', border: 'border-red-500/15' },
                  { label: 'ZK6200', icon: Gauge, mode: 'super_dmx', color: 'text-amber-400', border: 'border-amber-500/15' },
                  { label: 'Art-Net', icon: Globe, mode: 'artnet_modules', color: 'text-primary', border: 'border-primary/15' },
                  { label: 'FXK Module', icon: Cpu, mode: 'module', color: 'text-orange-400', border: 'border-orange-500/15' },
                  { label: 'P-BUS', icon: Cable, mode: 'pbus', color: 'text-amber-400', border: 'border-amber-500/15' },
                  { label: 'Radio', icon: Radio, mode: 'radio', color: 'text-cyan-400', border: 'border-cyan-500/15' },
                ].map((hw) => (
                  <button
                    key={hw.label}
                    onClick={() => navigate(`/command?mode=${hw.mode}`)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[hsl(var(--surface-0)/0.5)] border ${hw.border} hover:bg-muted/20 transition-all active:scale-[0.97] text-left`}
                  >
                    <hw.icon className={`h-3.5 w-3.5 ${hw.color} shrink-0`} />
                    <span className="text-[9px] font-semibold text-foreground/70 truncate">{hw.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Events */}
          <Card className="bg-card border-border/50 animate-fxk-stagger" style={{ animationDelay: '0.35s' }}>
            <div className="p-3 pb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-semibold text-foreground">Eventos</span>
              </div>
              <Button variant="ghost" size="sm" className="text-[10px] h-5 text-muted-foreground" onClick={() => navigate('/agenda')}>
                Agenda
              </Button>
            </div>
            <CardContent className="pt-0 pb-2 space-y-0.5">
              {events.length === 0 && (
                <div className="py-6 text-center">
                  <CalendarDays className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-[10px] text-muted-foreground">Nenhum evento.</p>
                  <Button variant="outline" size="sm" className="mt-2 text-[10px] h-7" onClick={() => navigate('/agenda')}>
                    <Plus className="h-3 w-3 mr-1" /> Criar
                  </Button>
                </div>
              )}
              {events.map((e) => {
                const daysLeft = e.event_date ? differenceInDays(new Date(e.event_date), new Date()) : null;
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors group"
                    onClick={() => navigate('/agenda')}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-md bg-accent/10 flex items-center justify-center text-sm shrink-0">
                        {TYPE_ICONS[e.event_type] ?? '🎯'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-accent transition-colors">{e.name}</p>
                        <p className="text-[9px] text-muted-foreground font-mono-code">
                          {e.event_date ? format(new Date(e.event_date), 'dd/MM') : '—'} · {e.client_name || '—'}
                        </p>
                      </div>
                    </div>
                    {daysLeft !== null && daysLeft >= 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono-code font-bold shrink-0 ${daysLeft <= 3 ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'}`}>
                        {daysLeft === 0 ? 'HOJE' : `${daysLeft}d`}
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* ─ Center Column: Instagram Feed ─ */}
        <div className="order-1 lg:order-2 animate-fxk-stagger" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORY_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFeedFilter(f.key)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200 shrink-0 active:scale-[0.95] ${
                  feedFilter === f.key
                    ? 'bg-primary/15 ring-1 ring-primary/30'
                    : 'bg-card border border-border/30 hover:border-primary/20'
                }`}
              >
                <span className="text-base">{f.emoji}</span>
                <span className={`text-[9px] font-semibold ${feedFilter === f.key ? 'text-primary' : 'text-muted-foreground'}`}>
                  {f.label}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono-code text-muted-foreground tracking-widest uppercase">
              Industry Feed · {filteredNews.length} posts
            </span>
          </div>
          <div className="space-y-4">
            {filteredNews.map((item, i) => (
              <div key={item.id} className="animate-fxk-stagger" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
                <FeedCard item={item} />
              </div>
            ))}
          </div>
        </div>

        {/* ─ Right Column ─ */}
        <div className="space-y-4 order-3">
          {/* Master Editor Hub */}
          <HubCard
            title="Master Editor"
            subtitle="Design, script e coreografia"
            badge="DESIGN"
            tools={MASTER_EDITOR_TOOLS}
            accentClass="from-primary/5 to-transparent"
            borderClass="border-primary/20 hover:border-primary/40 transition-colors"
            badgeBg="bg-primary/15 text-primary"
            navigate={navigate}
            delay="0.2s"
          />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: projects.length, label: 'Projetos', icon: FolderOpen, color: 'text-primary' },
              { value: events.length, label: 'Eventos', icon: Target, color: 'text-accent' },
              { value: totalMinutes, label: 'Min. Show', icon: Clock, color: 'text-[hsl(var(--fxk-gold))]' },
              { value: daysUntilNext !== null ? `${daysUntilNext}d` : '—', label: 'Próx. Evento', icon: CalendarDays, color: daysUntilNext !== null && daysUntilNext <= 3 ? 'text-accent' : 'text-primary' },
            ].map((stat, i) => (
              <Card key={stat.label} className="bg-card border-border/50 hover:border-primary/20 transition-colors animate-fxk-stagger" style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                <CardContent className="p-3 flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                    <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold font-display text-foreground leading-none">{stat.value}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Projects */}
          <Card className="bg-card border-border/50 animate-fxk-stagger" style={{ animationDelay: '0.5s' }}>
            <div className="p-3 pb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Projetos</span>
              </div>
              <Button variant="ghost" size="sm" className="text-[10px] h-5 text-muted-foreground" onClick={() => navigate('/editor')}>
                Todos
              </Button>
            </div>
            <CardContent className="pt-0 pb-2 space-y-0.5">
              {projects.length === 0 && (
                <div className="py-6 text-center">
                  <Rocket className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-[10px] text-muted-foreground">Nenhum projeto.</p>
                  <Button variant="outline" size="sm" className="mt-2 text-[10px] h-7" onClick={() => navigate('/editor')}>
                    <Plus className="h-3 w-3 mr-1" /> Criar
                  </Button>
                </div>
              )}
              {projects.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors group"
                  onClick={() => { localStorage.setItem('fxk-last-project', p.id); navigate('/editor'); }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Clapperboard className="h-3 w-3 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{p.name}</p>
                      <p className="text-[9px] text-muted-foreground font-mono-code">
                        {format(new Date(p.updated_at), 'dd/MM HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Enter Editor CTA */}
          <button
            onClick={() => navigate('/editor')}
            className="w-full group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 p-4 text-center transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_30px_hsl(var(--primary)/0.1)] active:scale-[0.98] animate-fxk-stagger"
            style={{ animationDelay: '0.6s' }}
          >
            <Zap className="h-5 w-5 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-sm font-bold font-display text-foreground">Abrir Editor</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Show Design Platform</p>
          </button>
        </div>
      </div>
    </div>
  );
}
