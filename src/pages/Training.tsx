import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Gamepad2, Package, CheckCircle2, ArrowRight, Star, Lock,
  Trophy, Flame, Zap, Clock, Users, Target
} from 'lucide-react';

interface Equipment {
  id: string;
  name: string;
  icon: string;
  category: 'truss' | 'sfx' | 'pyro' | 'lighting';
}

interface Mission {
  id: string;
  title: string;
  description: string;
  scenario: string;
  equipment: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  xp: number;
  completed: boolean;
  locked: boolean;
  chapter: string;
}

const EQUIPMENT: Equipment[] = [
  { id: 'truss-straight', name: 'Treliça Reta 3m', icon: '🔩', category: 'truss' },
  { id: 'truss-corner', name: 'Treliça Canto 90°', icon: '📐', category: 'truss' },
  { id: 'sparkular', name: 'Sparkular', icon: '✨', category: 'sfx' },
  { id: 'flamer', name: 'Flame Machine', icon: '🔥', category: 'sfx' },
  { id: 'cryo', name: 'Cryo Jet CO2', icon: '❄️', category: 'sfx' },
  { id: 'fog', name: 'Fog Machine', icon: '🌫️', category: 'sfx' },
  { id: 'moving-head', name: 'Moving Head', icon: '💡', category: 'lighting' },
  { id: 'par-can', name: 'PAR Can LED', icon: '🔦', category: 'lighting' },
  { id: 'mortar', name: 'Morteiro 3"', icon: '🎆', category: 'pyro' },
  { id: 'roman-candle', name: 'Candela Romana', icon: '🕯️', category: 'pyro' },
];

const MISSIONS: Mission[] = [
  {
    id: 'tutorial-truss',
    chapter: 'Cap. 1 — Montagem',
    title: 'Primeira Montagem',
    description: 'Monte uma estrutura de treliça retangular com 4 cantos. O produtor está esperando.',
    scenario: '🏗️ Galpão vazio, 6h da manhã. Café frio.',
    equipment: ['truss-straight', 'truss-corner'],
    difficulty: 'easy',
    xp: 100,
    completed: false,
    locked: false,
  },
  {
    id: 'sfx-setup',
    chapter: 'Cap. 1 — Montagem',
    title: 'Instalação SFX',
    description: 'Configure sparkulars e flamers na treliça. Cuidado com a fiação!',
    scenario: '⚡ O eletricista não veio. Você é o eletricista agora.',
    equipment: ['sparkular', 'flamer', 'cryo'],
    difficulty: 'easy',
    xp: 150,
    completed: false,
    locked: false,
  },
  {
    id: 'dmx-config',
    chapter: 'Cap. 2 — Configuração',
    title: 'Patch DMX na Correria',
    description: 'Endereçe 16 fixtures antes do soundcheck. O DJ já está montando.',
    scenario: '🎛️ Console ligado, 200 cabos, zero labels. Boa sorte.',
    equipment: ['moving-head', 'par-can', 'sparkular'],
    difficulty: 'medium',
    xp: 300,
    completed: false,
    locked: false,
  },
  {
    id: 'drunk-invasion',
    chapter: 'Cap. 3 — Caos ao Vivo',
    title: 'Bêbado no Palco!',
    description: 'Um convidado bêbado invadiu a área técnica. Proteja os equipamentos e mantenha o show rodando.',
    scenario: '🍺 22h, pista lotada, segurança sumiu. O cara quer "apertar um botão".',
    equipment: ['sparkular', 'flamer'],
    difficulty: 'medium',
    xp: 400,
    completed: false,
    locked: true,
  },
  {
    id: 'producer-late',
    chapter: 'Cap. 3 — Caos ao Vivo',
    title: 'Produtor Atrasou 3h',
    description: 'O produtor não apareceu e você não tem acesso ao local. Improvise com o que tem.',
    scenario: '⏰ Portão fechado. Sem chave. Carga no caminhão. Cliente ligando.',
    equipment: ['truss-straight', 'truss-corner', 'moving-head'],
    difficulty: 'hard',
    xp: 500,
    completed: false,
    locked: true,
  },
  {
    id: 'full-reveillon',
    chapter: 'Cap. 4 — Show Completo',
    title: 'Réveillon — 5.000 Pessoas',
    description: 'Monte e execute o show de réveillon completo: pirotecnia, SFX, iluminação e drones.',
    scenario: '🎆 31/Dez, 18h. Tudo tem que funcionar à meia-noite. Sem segunda chance.',
    equipment: ['truss-straight', 'moving-head', 'sparkular', 'flamer', 'mortar'],
    difficulty: 'legendary',
    xp: 1000,
    completed: false,
    locked: true,
  },
];

const DIFF_CONFIG: Record<string, { color: string; bg: string; stars: number }> = {
  easy: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', stars: 1 },
  medium: { color: 'text-[hsl(var(--fxk-gold))]', bg: 'bg-[hsl(var(--fxk-gold)/0.1)] border-[hsl(var(--fxk-gold)/0.2)]', stars: 2 },
  hard: { color: 'text-accent', bg: 'bg-accent/10 border-accent/20', stars: 3 },
  legendary: { color: 'text-[hsl(var(--fxk-violet))]', bg: 'bg-[hsl(var(--fxk-violet)/0.1)] border-[hsl(var(--fxk-violet)/0.2)]', stars: 4 },
};

export default function Training() {
  const [missions] = useState<Mission[]>(MISSIONS);
  const completedCount = missions.filter((m) => m.completed).length;
  const totalXP = missions.filter((m) => m.completed).reduce((s, m) => s + m.xp, 0);
  const maxXP = missions.reduce((s, m) => s + m.xp, 0);

  const chapters = [...new Set(missions.map(m => m.chapter))];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-[hsl(var(--surface-1))] via-[hsl(var(--surface-2))] to-[hsl(var(--surface-1))] p-6 animate-fxk-fade-up">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--fxk-violet)/0.08),transparent_60%)]" />
        <div className="absolute top-4 right-6 opacity-[0.04]">
          <Gamepad2 className="h-32 w-32" />
        </div>
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-mono text-[hsl(var(--fxk-violet))] tracking-widest uppercase mb-1">
              MODO SIMULAÇÃO
            </p>
            <h1 className="text-2xl font-bold font-display text-foreground">
              Training Center
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Simulação de montagem e operação de eventos em terceira pessoa. Complete missões, ganhe XP e desbloqueie cenários.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 justify-end mb-1">
              <Trophy className="h-4 w-4 text-[hsl(var(--fxk-gold))]" />
              <span className="text-lg font-bold font-mono text-foreground">{totalXP}</span>
              <span className="text-[9px] text-muted-foreground">XP</span>
            </div>
            <p className="text-[9px] text-muted-foreground font-mono">
              {completedCount}/{missions.length} missões
            </p>
          </div>
        </div>
        <div className="relative z-10 mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground font-mono">PROGRESSO GERAL</span>
            <span className="text-[9px] font-mono text-primary">
              {Math.round((completedCount / missions.length) * 100)}%
            </span>
          </div>
          <Progress value={(completedCount / missions.length) * 100} className="h-1.5" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 animate-fxk-fade-up" style={{ animationDelay: '0.1s' }}>
        {[
          { icon: Target, label: 'Missões', value: missions.length, color: 'text-primary' },
          { icon: CheckCircle2, label: 'Completas', value: completedCount, color: 'text-emerald-400' },
          { icon: Zap, label: 'XP Total', value: `${totalXP}/${maxXP}`, color: 'text-[hsl(var(--fxk-gold))]' },
          { icon: Users, label: 'Rank', value: 'Novato', color: 'text-[hsl(var(--fxk-violet))]' },
        ].map(stat => (
          <Card key={stat.label} className="bg-card border-border/30">
            <CardContent className="p-3 flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.color} shrink-0`} />
              <div>
                <p className="text-sm font-bold font-mono text-foreground">{stat.value}</p>
                <p className="text-[8px] text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Equipment */}
      <Card className="bg-card border-border/30 animate-fxk-fade-up" style={{ animationDelay: '0.15s' }}>
        <div className="p-3 pb-2 flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Inventário de Equipamentos</span>
        </div>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {EQUIPMENT.map((eq) => (
              <div
                key={eq.id}
                className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/30 text-[10px] cursor-default hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
              >
                <span className="text-sm">{eq.icon}</span>
                <span className="text-foreground/70 truncate">{eq.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Missions by chapter */}
      {chapters.map((chapter, ci) => (
        <div key={chapter} className="space-y-2 animate-fxk-fade-up" style={{ animationDelay: `${0.2 + ci * 0.05}s` }}>
          <h2 className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.15em] px-1">
            {chapter}
          </h2>
          {missions.filter(m => m.chapter === chapter).map((mission) => {
            const diff = DIFF_CONFIG[mission.difficulty];
            return (
              <Card
                key={mission.id}
                className={`border transition-all duration-200 ${
                  mission.locked
                    ? 'bg-card/50 border-border/20 opacity-60'
                    : 'bg-card border-border/40 hover:border-primary/30 hover:shadow-[0_0_15px_hsl(var(--primary)/0.05)]'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className={`h-9 w-9 rounded-lg border ${diff.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      {mission.locked ? (
                        <Lock className="h-4 w-4 text-muted-foreground/40" />
                      ) : mission.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <ArrowRight className={`h-4 w-4 ${diff.color}`} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm text-foreground">{mission.title}</p>
                        <div className="flex gap-0.5">
                          {Array.from({ length: diff.stars }).map((_, i) => (
                            <Star key={i} className={`h-2.5 w-2.5 fill-current ${diff.color}`} />
                          ))}
                        </div>
                        <span className={`text-[8px] font-mono px-1.5 py-px rounded ${diff.bg} ${diff.color}`}>
                          +{mission.xp} XP
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{mission.description}</p>
                      <p className="text-[10px] text-foreground/40 mt-1 italic">{mission.scenario}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {mission.equipment.map((eqId) => {
                          const eq = EQUIPMENT.find((e) => e.id === eqId);
                          return eq ? (
                            <span key={eqId} className="text-[9px] bg-muted/30 px-1.5 py-0.5 rounded-sm border border-border/20">
                              {eq.icon} {eq.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={mission.locked ? 'ghost' : 'outline'}
                      className="shrink-0 text-xs"
                      disabled={mission.locked || mission.completed}
                    >
                      {mission.completed ? '✓' : mission.locked ? <Lock className="h-3 w-3" /> : 'Jogar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}

      {/* Coming soon */}
      <div className="text-center py-6 border border-dashed border-border/30 rounded-xl bg-muted/5 animate-fxk-fade-up" style={{ animationDelay: '0.4s' }}>
        <Gamepad2 className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">
          🚧 Simulador 3D em terceira pessoa em desenvolvimento
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          Em breve: câmera orbital, drag-and-drop, NPCs engraçados e scoring em tempo real
        </p>
      </div>
    </div>
  );
}
