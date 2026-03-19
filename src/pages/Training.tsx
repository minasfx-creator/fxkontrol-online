import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GraduationCap, Package, CheckCircle2, ArrowRight } from 'lucide-react';

interface Equipment {
  id: string;
  name: string;
  icon: string;
  category: 'truss' | 'sfx' | 'pyro' | 'lighting';
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  equipment: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  completed: boolean;
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

const CHALLENGES: Challenge[] = [
  {
    id: 'basic-truss',
    title: 'Montagem Básica de Truss',
    description: 'Monte uma estrutura de treliça em formato retangular com 4 cantos e iluminação.',
    equipment: ['truss-straight', 'truss-corner', 'moving-head'],
    difficulty: 'easy',
    completed: false,
  },
  {
    id: 'sfx-stage',
    title: 'Palco SFX Completo',
    description: 'Configure um palco com flamers, sparkulars e cryo jets sincronizados.',
    equipment: ['sparkular', 'flamer', 'cryo', 'fog'],
    difficulty: 'medium',
    completed: false,
  },
  {
    id: 'full-show',
    title: 'Show Completo — Réveillon',
    description: 'Monte um show de réveillon com pirotecnia, SFX e iluminação para 5.000 pessoas.',
    equipment: ['truss-straight', 'moving-head', 'sparkular', 'flamer', 'mortar'],
    difficulty: 'hard',
    completed: false,
  },
];

const DIFF_COLORS: Record<string, string> = {
  easy: 'bg-emerald-500/20 text-emerald-400',
  medium: 'bg-accent/20 text-accent',
  hard: 'bg-destructive/20 text-destructive',
};

export default function Training() {
  const [challenges] = useState<Challenge[]>(CHALLENGES);
  const completedCount = challenges.filter((c) => c.completed).length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          Training Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simulação de montagem de palco em terceira pessoa — aprenda montando.
        </p>
      </div>

      {/* Progress */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Progresso Geral</span>
            <span className="text-xs font-mono text-primary">
              {completedCount}/{challenges.length}
            </span>
          </div>
          <Progress value={(completedCount / challenges.length) * 100} className="h-2" />
        </CardContent>
      </Card>

      {/* Equipment Inventory */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Equipamentos Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {EQUIPMENT.map((eq) => (
              <div
                key={eq.id}
                className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/50 text-xs cursor-default hover:border-primary/30 transition-colors"
              >
                <span className="text-base">{eq.icon}</span>
                <span className="text-foreground/80 truncate">{eq.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Challenges */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Desafios de Montagem
        </h2>
        {challenges.map((ch) => (
          <Card key={ch.id} className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    {ch.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <p className="font-semibold text-foreground">{ch.title}</p>
                    <Badge variant="outline" className={`text-[9px] ${DIFF_COLORS[ch.difficulty]}`}>
                      {ch.difficulty}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">{ch.description}</p>
                  <div className="flex gap-1 ml-6 flex-wrap">
                    {ch.equipment.map((eqId) => {
                      const eq = EQUIPMENT.find((e) => e.id === eqId);
                      return eq ? (
                        <span key={eqId} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm">
                          {eq.icon} {eq.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 ml-4" disabled={ch.completed}>
                  {ch.completed ? 'Completo' : 'Iniciar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coming soon notice */}
      <div className="text-center py-8 border border-dashed border-border rounded-lg">
        <p className="text-sm text-muted-foreground">
          🚧 O simulador 3D interativo está em desenvolvimento.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Em breve: câmera em terceira pessoa, drag-and-drop de equipamentos e scoring.
        </p>
      </div>
    </div>
  );
}
