import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Shield, Users, Activity, Database, RefreshCw, Crown, UserX, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

interface UserProfile {
  id: string;
  display_name: string;
  company: string;
  role_title: string;
  created_at: string;
  email?: string;
  roles: string[];
}

export default function Admin() {
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalUsers: 0, totalProjects: 0, totalEvents: 0 });

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/settings');
    }
  }, [isAdmin, roleLoading, navigate]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch all profiles (admin RLS allows this)
    const { data: profiles } = await supabase.from('profiles').select('*');
    
    // Fetch all roles
    const { data: roles } = await supabase.from('user_roles').select('*');

    // Map roles to users
    const userList: UserProfile[] = (profiles ?? []).map((p: any) => ({
      id: p.id,
      display_name: p.display_name || 'Sem nome',
      company: p.company || '—',
      role_title: p.role_title || 'Operador',
      created_at: p.created_at,
      roles: (roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
    }));
    setUsers(userList);

    // Stats
    const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
    const { count: evtCount } = await supabase.from('events').select('*', { count: 'exact', head: true });
    setStats({
      totalUsers: userList.length,
      totalProjects: projCount ?? 0,
      totalEvents: evtCount ?? 0,
    });

    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    if (userId === user?.id) {
      toast({ title: 'Não é possível alterar seu próprio papel', variant: 'destructive' });
      return;
    }

    if (currentlyAdmin) {
      await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
    } else {
      await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' } as any);
    }
    toast({ title: currentlyAdmin ? 'Admin removido' : 'Admin concedido' });
    fetchData();
  };

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: 'hsl(32 100% 50% / 0.15)' }}>
            <Shield className="h-5 w-5" style={{ color: 'hsl(32 100% 50%)' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-wide" style={{ textShadow: '0 0 8px hsl(32 100% 50% / 0.2)' }}>
              PAINEL ADMINISTRATIVO
            </h1>
            <p className="text-xs text-muted-foreground font-mono">Gestão de usuários · Estatísticas · Controle</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={fetchData}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: 'OPERADORES', value: stats.totalUsers, color: 'hsl(32 100% 50%)' },
          { icon: Database, label: 'PROJETOS', value: stats.totalProjects, color: 'hsl(200 80% 50%)' },
          { icon: Activity, label: 'EVENTOS', value: stats.totalEvents, color: 'hsl(150 70% 45%)' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border p-4 text-center" style={{ background: 'hsl(var(--surface-0))', borderColor: `${s.color}20` }}>
            <s.icon className="h-5 w-5 mx-auto mb-1" style={{ color: s.color }} />
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-[8px] font-mono tracking-widest text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <Separator className="opacity-20" />

      {/* Users Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'hsl(var(--surface-0))', borderColor: 'hsl(32 100% 50% / 0.1)' }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid hsl(32 100% 50% / 0.08)' }}>
          <Users className="h-4 w-4" style={{ color: 'hsl(32 100% 50%)' }} />
          <span className="text-xs font-mono font-bold tracking-wide">REGISTRO DE OPERADORES</span>
          <span className="ml-auto text-[9px] font-mono text-muted-foreground">{users.length} registros</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[9px] font-mono uppercase tracking-widest">Operador</TableHead>
              <TableHead className="text-[9px] font-mono uppercase tracking-widest">Empresa</TableHead>
              <TableHead className="text-[9px] font-mono uppercase tracking-widest">Função</TableHead>
              <TableHead className="text-[9px] font-mono uppercase tracking-widest">Papel</TableHead>
              <TableHead className="text-[9px] font-mono uppercase tracking-widest">Cadastro</TableHead>
              <TableHead className="text-[9px] font-mono uppercase tracking-widest text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => {
              const uIsAdmin = u.roles.includes('admin');
              const isSelf = u.id === user?.id;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'hsl(32 100% 50% / 0.12)' }}>
                        <span className="text-[9px] font-bold" style={{ color: 'hsl(32 100% 50%)' }}>
                          {u.display_name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs font-medium">{u.display_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.company}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.role_title}</TableCell>
                  <TableCell>
                    {uIsAdmin ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase"
                        style={{ background: 'hsl(32 100% 50% / 0.15)', color: 'hsl(32 100% 50%)' }}>
                        <Crown className="h-2.5 w-2.5" /> ADMIN
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-muted-foreground">OPERADOR</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[10px] font-mono text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right">
                    {!isSelf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-[10px]"
                        onClick={() => toggleAdmin(u.id, uIsAdmin)}
                      >
                        {uIsAdmin ? <UserX className="h-3 w-3 text-destructive" /> : <UserCheck className="h-3 w-3 text-primary" />}
                        {uIsAdmin ? 'Revogar' : 'Promover'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
