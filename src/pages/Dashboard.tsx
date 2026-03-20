import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Clapperboard, CalendarDays, GraduationCap, Plus, FolderOpen,
  Zap, Rocket, Flame, Target, Clock, ArrowRight, Sparkles,
  Radio, Cpu, Cable, Activity
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

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

const TYPE_ICONS: Record<string, string> = {
  pyro: '🎆', drone: '🤖', sfx: '🔥', mixed: '🎯',
};

const QUICK_LAUNCH = [
  { label: 'Show Pirotécnico', emoji: '🎆', type: 'pyro', color: 'hsl(var(--accent))' },
  { label: 'Drone Show', emoji: '🛸', type: 'drone', color: 'hsl(var(--primary))' },
  { label: 'Show Misto', emoji: '🎯', type: 'mixed', color: 'hsl(var(--fxk-violet))' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-[hsl(var(--surface-1))] via-[hsl(var(--surface-2))] to-[hsl(var(--surface-1))] p-6 md:p-8 animate-fxk-fade-up">
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

      {/* System Status */}
      <div className="animate-fxk-fade-up" style={{ animationDelay: '0.08s' }}>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-display">Status do Sistema</span>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: 'OSC Bridge', icon: Cable, port: 9002 },
                { label: 'sACN Bridge', icon: Activity, port: 9003 },
                { label: 'MVR-xchange', icon: Cpu, port: 9004 },
                { label: 'FireOne', icon: Zap, port: null },
                { label: 'PBUS', icon: Radio, port: null },
                { label: 'Radio RF', icon: Radio, port: null },
              ].map((sys) => (
                <div key={sys.label} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[hsl(var(--surface-0)/0.5)] border border-border/10">
                  <div className="status-dot-offline" />
                  <div>
                    <p className="text-[9px] font-semibold text-muted-foreground/70">{sys.label}</p>
                    {sys.port && <p className="text-[8px] font-mono-code text-muted-foreground/30">:{sys.port}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Launch */}
      <div className="grid grid-cols-3 gap-3 animate-fxk-fade-up" style={{ animationDelay: '0.12s' }}>
        {QUICK_LAUNCH.map((q, i) => (
          <button
            key={q.type}
            onClick={() => navigate('/editor')}
            className="group relative overflow-hidden rounded-lg border border-border/50 bg-card p-4 text-center transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_20px_hsl(var(--primary)/0.08)]"
          >
            <span className="text-2xl block mb-2">{q.emoji}</span>
            <p className="text-xs font-semibold text-foreground">{q.label}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Criar novo</p>
          </button>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fxk-fade-up" style={{ animationDelay: '0.15s' }}>
        {[
          { label: 'Novo Projeto', icon: Plus, route: '/editor' },
          { label: 'Editor 3D', icon: Clapperboard, route: '/editor' },
          { label: 'Agenda', icon: CalendarDays, route: '/agenda' },
          { label: 'Simulação', icon: GraduationCap, route: '/training' },
        ].map((action, i) => (
          <button
            key={action.label}
            onClick={() => navigate(action.route)}
            className="group relative overflow-hidden rounded-lg border border-border/50 bg-card p-4 text-left transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <action.icon className="h-5 w-5 text-primary mb-3 transition-transform duration-300 group-hover:scale-110" />
            <p className="text-xs font-semibold text-foreground">{action.label}</p>
            <ArrowRight className="absolute bottom-3 right-3 h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-1 group-hover:translate-x-0" />
          </button>
        ))}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fxk-fade-up" style={{ animationDelay: '0.2s' }}>
        {[
          { value: projects.length, label: 'Projetos', icon: FolderOpen, color: 'text-primary' },
          { value: events.length, label: 'Próximos Eventos', icon: Target, color: 'text-accent' },
          { value: totalMinutes, label: 'Min. de Show', icon: Clock, color: 'text-[hsl(var(--fxk-gold))]' },
          { value: daysUntilNext !== null ? `${daysUntilNext}d` : '—', label: 'Próximo Evento', icon: CalendarDays, color: daysUntilNext !== null && daysUntilNext <= 3 ? 'text-accent' : 'text-primary' },
        ].map((stat) => (
          <Card key={stat.label} className="bg-card border-border/50 overflow-hidden group hover:border-primary/20 transition-colors">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Projects */}
        <Card className="bg-card border-border/50 animate-fxk-fade-up" style={{ animationDelay: '0.3s' }}>
          <div className="p-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Projetos Recentes</span>
            </div>
            <Button variant="ghost" size="sm" className="text-[10px] h-6 text-muted-foreground" onClick={() => navigate('/editor')}>
              Ver todos
            </Button>
          </div>
          <CardContent className="pt-0 space-y-1">
            {projects.length === 0 && (
              <div className="py-8 text-center">
                <Rocket className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum projeto ainda.</p>
                <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate('/editor')}>
                  <Plus className="h-3 w-3 mr-1" /> Criar primeiro projeto
                </Button>
              </div>
            )}
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/30 cursor-pointer transition-all duration-200 group"
                onClick={() => { localStorage.setItem('fxk-last-project', p.id); navigate('/editor'); }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Clapperboard className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono-code">
                      {format(new Date(p.updated_at), 'dd/MM HH:mm')} · {p.duration}s
                    </p>
                  </div>
                </div>
                <Zap className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="bg-card border-border/50 animate-fxk-fade-up" style={{ animationDelay: '0.35s' }}>
          <div className="p-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">Próximos Eventos</span>
            </div>
            <Button variant="ghost" size="sm" className="text-[10px] h-6 text-muted-foreground" onClick={() => navigate('/agenda')}>
              Agenda
            </Button>
          </div>
          <CardContent className="pt-0 space-y-1">
            {events.length === 0 && (
              <div className="py-8 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum evento agendado.</p>
                <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate('/agenda')}>
                  <Plus className="h-3 w-3 mr-1" /> Criar evento
                </Button>
              </div>
            )}
            {events.map((e) => {
              const daysLeft = e.event_date ? differenceInDays(new Date(e.event_date), new Date()) : null;
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/30 cursor-pointer transition-all duration-200 group"
                  onClick={() => navigate('/agenda')}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-accent/10 flex items-center justify-center text-sm">
                      {TYPE_ICONS[e.event_type] ?? '🎯'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">{e.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono-code">
                        {e.event_date ? format(new Date(e.event_date), 'dd/MM/yyyy') : '—'} · {e.client_name || 'Sem cliente'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {daysLeft !== null && daysLeft >= 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono-code font-bold ${daysLeft <= 3 ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'}`}>
                        {daysLeft === 0 ? 'HOJE' : `${daysLeft}d`}
                      </span>
                    )}
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-mono-code bg-muted text-muted-foreground">
                      {e.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
