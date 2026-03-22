import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { User, Phone, Building2, Briefcase, Save, Shield } from 'lucide-react';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { user } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    display_name: '',
    phone: '',
    company: '',
    role_title: '',
    bio: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        phone: profile.phone || '',
        company: profile.company || '',
        role_title: profile.role_title || '',
        bio: profile.bio || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    await updateProfile(form);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-wide" style={{ textShadow: '0 0 8px hsl(32 100% 50% / 0.2)' }}>
            CONFIGURAÇÕES DO OPERADOR
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Perfil · Preferências · Segurança</p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => navigate('/admin')}
          >
            <Shield className="h-3.5 w-3.5" />
            <span className="text-xs font-mono">ADMIN</span>
          </Button>
        )}
      </div>

      {/* Profile Card */}
      <div className="rounded-xl border p-5 space-y-5" style={{ background: 'hsl(var(--surface-0))', borderColor: 'hsl(32 100% 50% / 0.1)' }}>
        {/* Avatar + email */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full flex items-center justify-center shrink-0" style={{ background: 'hsl(32 100% 50% / 0.15)' }}>
            <span className="text-lg font-bold" style={{ color: 'hsl(32 100% 50%)' }}>
              {(form.display_name || user?.email || 'FX').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{form.display_name || 'Operador'}</p>
            <p className="text-xs text-muted-foreground font-mono">{user?.email}</p>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-widest"
                style={{ background: 'hsl(32 100% 50% / 0.15)', color: 'hsl(32 100% 50%)' }}>
                <Shield className="h-2.5 w-2.5" /> ADMIN
              </span>
            )}
          </div>
        </div>

        <Separator className="opacity-20" />

        {/* Form fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <User className="h-3 w-3" /> Nome de exibição
            </Label>
            <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              className="h-9 text-sm bg-background/50" placeholder="Seu nome" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> Telefone
            </Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="h-9 text-sm bg-background/50" placeholder="+55 31 99999-0000" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-3 w-3" /> Empresa
            </Label>
            <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              className="h-9 text-sm bg-background/50" placeholder="MinasFX Pirotecnia" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="h-3 w-3" /> Cargo / Função
            </Label>
            <Input value={form.role_title} onChange={e => setForm(f => ({ ...f, role_title: e.target.value }))}
              className="h-9 text-sm bg-background/50" placeholder="Técnico Pirotécnico" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Bio / Observações</Label>
          <textarea
            value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            className="w-full h-20 rounded-md border border-border bg-background/50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
            placeholder="Anotações sobre o operador..."
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2" size="sm"
            style={{ background: 'hsl(32 100% 50%)', color: 'hsl(220 30% 6%)' }}>
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando...' : 'Salvar Perfil'}
          </Button>
        </div>
      </div>

      {/* Session info */}
      <div className="rounded-xl border p-4 space-y-2" style={{ background: 'hsl(var(--surface-0))', borderColor: 'hsl(32 100% 50% / 0.08)' }}>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Sessão Ativa</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">UID:</span>{' '}
            <span className="font-mono text-[10px] text-foreground/70">{user?.id?.slice(0, 8)}…</span>
          </div>
          <div>
            <span className="text-muted-foreground">Último login:</span>{' '}
            <span className="font-mono text-[10px] text-foreground/70">{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('pt-BR') : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
