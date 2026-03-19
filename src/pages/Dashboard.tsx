import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clapperboard, CalendarDays, GraduationCap, Plus, FolderOpen, Zap } from 'lucide-react';
import { format } from 'date-fns';

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
      .limit(3)
      .then(({ data }) => setEvents(data ?? []));
  }, [user]);

  const statusColor: Record<string, string> = {
    planned: 'bg-muted text-muted-foreground',
    confirmed: 'bg-primary/20 text-primary',
    'em montagem': 'bg-accent/20 text-accent',
    executed: 'bg-emerald-500/20 text-emerald-400',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bem-vindo de volta, {user?.email?.split('@')[0]}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button
          variant="outline"
          className="h-20 flex-col gap-2 border-dashed hover:border-primary hover:text-primary"
          onClick={() => navigate('/editor')}
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs">Novo Projeto</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex-col gap-2 hover:border-primary hover:text-primary"
          onClick={() => navigate('/editor')}
        >
          <Clapperboard className="h-5 w-5" />
          <span className="text-xs">Abrir Editor 3D</span>
        </Button>
        <Button
          variant="outline"
          className="h-20 flex-col gap-2 hover:border-primary hover:text-primary"
          onClick={() => navigate('/training')}
        >
          <GraduationCap className="h-5 w-5" />
          <span className="text-xs">Iniciar Simulação</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{projects.length}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Projetos</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{events.length}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Próximos Eventos</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {Math.round(projects.reduce((s, p) => s + p.duration, 0) / 60)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Min. de Show</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            Projetos Recentes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {projects.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum projeto ainda.</p>
          )}
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 cursor-pointer transition-colors"
              onClick={() => navigate('/editor')}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(p.updated_at), 'dd/MM/yyyy HH:mm')} · {p.duration}s
                </p>
              </div>
              <Zap className="h-3 w-3 text-muted-foreground" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-accent" />
            Próximos Eventos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum evento agendado.</p>
          )}
          {events.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 cursor-pointer transition-colors"
              onClick={() => navigate('/agenda')}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{e.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {e.event_date ? format(new Date(e.event_date), 'dd/MM/yyyy') : '—'} · {e.client_name || 'Sem cliente'}
                </p>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono ${statusColor[e.status] ?? statusColor.planned}`}>
                {e.status}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
