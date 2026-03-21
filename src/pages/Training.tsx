import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Gamepad2, Package, CheckCircle2, ArrowRight, Star, Lock,
  Trophy, Zap, Users, Target, BookOpen, FlaskConical, Shield,
  Palette, AlertTriangle, Ruler, Flame, Sparkles, History
} from 'lucide-react';
import TrainingSimulator from '@/components/training/TrainingSimulator';
import { Equipment, Mission } from '@/components/training/types';

// ── Reference Manual Library ──────────────────────────────────────────

interface ManualReference {
  id: string;
  title: string;
  author: string;
  icon: string;
  color: string;
  topics: string[];
  description: string;
}

const MANUALS: ManualReference[] = [
  {
    id: 'manual-pirotecnia-1931',
    title: 'Manual de Pirotecnia',
    author: 'Maio & Jona, 1931',
    icon: '📕',
    color: 'text-red-400',
    topics: ['Bengala', 'Cohete', 'Traca', 'Saxon', 'Paracaídas', 'Pólvora Negra', 'Composições Coloridas'],
    description: 'Tratado clássico de pirotecnia com fórmulas de composição, classificação de efeitos e química de cores (Sr, Ba, Cu, Na). Base histórica da arte pirotécnica.',
  },
  {
    id: 'phmsa-2010',
    title: 'PHMSA Fireworks Safety',
    author: 'PHMSA / DOT, 2010',
    icon: '📘',
    color: 'text-blue-400',
    topics: ['Classificação 1.1G–1.4G', 'Distâncias de Segurança', 'Transporte', 'Armazenamento', 'APA 87-1'],
    description: 'Regulamentação federal dos EUA para transporte e armazenamento de artigos pirotécnicos. Tabelas NFPA de distâncias de segurança por calibre.',
  },
  {
    id: 'prometheus-publication',
    title: 'Prometheus Pyrotechnics Manual',
    author: 'Prometheus Publication',
    icon: '📗',
    color: 'text-emerald-400',
    topics: ['Composições Avançadas', 'Estrelas', 'Efeitos Especiais', 'Formulas Militares', 'Sinalizadores'],
    description: 'Manual avançado com formulações detalhadas para estrelas, sinalizadores, efeitos de cor e composições de flash. Referência profissional.',
  },
  {
    id: 'skylighter-chemistry',
    title: 'Skylighter Chemical Encyclopedia',
    author: 'Skylighter.com',
    icon: '📙',
    color: 'text-amber-400',
    topics: ['40+ Compostos', 'Veline Color System', 'Combinações Perigosas', 'Grades de Pólvora', 'Emissão Espectral'],
    description: 'Enciclopédia de compostos químicos pirotécnicos com propriedades, segurança, manuseio e espectro de emissão. Sistema Veline de mistura de cores.',
  },
  {
    id: 'nfpa-1123',
    title: 'NFPA 1123 / 1124 Reference',
    author: 'NFPA',
    icon: '📒',
    color: 'text-yellow-400',
    topics: ['Alturas de Abertura', 'Raios de Segurança', 'Classificação por Calibre', 'Inspeção', 'Licenciamento'],
    description: 'Normas NFPA para exibições pirotécnicas ao ar livre. Tabelas de altura de abertura, raios de segurança e requisitos de licenciamento.',
  },
];

// ── Equipment & Missions ──────────────────────────────────────────────

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

const INITIAL_MISSIONS: Mission[] = [
  // ── Cap. 1 — Montagem ──
  {
    id: 'tutorial-truss', chapter: 'Cap. 1 — Montagem', title: 'Primeira Montagem',
    description: 'Monte uma estrutura de treliça retangular com 4 cantos. O produtor está esperando.',
    scenario: '🏗️ Galpão vazio, 6h da manhã. Café frio.',
    equipment: ['truss-straight', 'truss-corner'], difficulty: 'easy', xp: 100, completed: false, locked: false,
  },
  {
    id: 'sfx-setup', chapter: 'Cap. 1 — Montagem', title: 'Instalação SFX',
    description: 'Configure sparkulars e flamers na treliça. Cuidado com a fiação!',
    scenario: '⚡ O eletricista não veio. Você é o eletricista agora.',
    equipment: ['sparkular', 'flamer', 'cryo'], difficulty: 'easy', xp: 150, completed: false, locked: false,
  },
  // ── Cap. 2 — Configuração ──
  {
    id: 'dmx-config', chapter: 'Cap. 2 — Configuração', title: 'Patch DMX na Correria',
    description: 'Endereçe 16 fixtures antes do soundcheck. O DJ já está montando.',
    scenario: '🎛️ Console ligado, 200 cabos, zero labels. Boa sorte.',
    equipment: ['moving-head', 'par-can', 'sparkular'], difficulty: 'medium', xp: 300, completed: false, locked: false,
  },
  // ── Cap. 3 — Caos ao Vivo ──
  {
    id: 'drunk-invasion', chapter: 'Cap. 3 — Caos ao Vivo', title: 'Bêbado no Palco!',
    description: 'Um convidado bêbado invadiu a área técnica. Proteja os equipamentos e mantenha o show rodando.',
    scenario: '🍺 22h, pista lotada, segurança sumiu. O cara quer "apertar um botão".',
    equipment: ['sparkular', 'flamer'], difficulty: 'medium', xp: 400, completed: false, locked: true,
  },
  {
    id: 'producer-late', chapter: 'Cap. 3 — Caos ao Vivo', title: 'Produtor Atrasou 3h',
    description: 'O produtor não apareceu e você não tem acesso ao local. Improvise com o que tem.',
    scenario: '⏰ Portão fechado. Sem chave. Carga no caminhão. Cliente ligando.',
    equipment: ['truss-straight', 'truss-corner', 'moving-head'], difficulty: 'hard', xp: 500, completed: false, locked: true,
  },
  // ── Cap. 4 — Show Completo ──
  {
    id: 'full-reveillon', chapter: 'Cap. 4 — Show Completo', title: 'Réveillon — 5.000 Pessoas',
    description: 'Monte e execute o show de réveillon completo: pirotecnia, SFX, iluminação e drones.',
    scenario: '🎆 31/Dez, 18h. Tudo tem que funcionar à meia-noite. Sem segunda chance.',
    equipment: ['truss-straight', 'moving-head', 'sparkular', 'flamer', 'mortar'], difficulty: 'legendary', xp: 1000, completed: false, locked: true,
  },
  // ── Cap. 5 — Química Pirotécnica (Manual) ──
  {
    id: 'color-chemistry', chapter: 'Cap. 5 — Química Pirotécnica', title: 'Cores da Chama',
    description: 'Identifique os compostos químicos responsáveis por cada cor: Sr=Vermelho, Ba=Verde, Cu=Azul, Na=Amarelo. Aprenda o sistema Veline de mistura.',
    scenario: '🧪 Laboratório. 10 compostos na bancada. Qual produz a chama azul mais intensa?',
    equipment: ['mortar'], difficulty: 'easy', xp: 200, completed: false, locked: false,
  },
  {
    id: 'veline-mixing', chapter: 'Cap. 5 — Química Pirotécnica', title: 'Sistema Veline de Cores',
    description: 'Misture cores primárias para criar compostas: Magenta (50% Red + 50% Blue), Turquoise (55% Green + 45% Blue), Purple (5% Orange + 15% Red + 80% Blue).',
    scenario: '🎨 O cliente quer "roxo como o céu do pôr-do-sol". Calcule as proporções.',
    equipment: ['mortar', 'roman-candle'], difficulty: 'medium', xp: 350, completed: false, locked: false,
  },
  {
    id: 'dangerous-combos', chapter: 'Cap. 5 — Química Pirotécnica', title: 'Combinações Perigosas',
    description: 'Identifique combinações proibidas: KClO3+S (ignição espontânea), NH4NO3+KClO3 (clorato de amônio explosivo), Ba(ClO3)2+Sb2S3 (extremamente sensível).',
    scenario: '⚠️ Estagiário trouxe os compostos errados. Detecte antes que exploda.',
    equipment: ['mortar'], difficulty: 'hard', xp: 500, completed: false, locked: true,
  },
  // ── Cap. 6 — Segurança NFPA ──
  {
    id: 'nfpa-safety-radius', chapter: 'Cap. 6 — Segurança NFPA', title: 'Raio de Segurança por Calibre',
    description: 'Calcule distâncias mínimas de segurança NFPA 1123: 3"=70m, 6"=175m, 12"=300m. Posicione o público corretamente.',
    scenario: '📏 Evento em parque municipal. Arquibancada a 150m. Qual o calibre máximo?',
    equipment: ['mortar'], difficulty: 'medium', xp: 300, completed: false, locked: false,
  },
  {
    id: 'burst-height-calc', chapter: 'Cap. 6 — Segurança NFPA', title: 'Alturas de Abertura Reais',
    description: 'Use a tabela NFPA real: 3"=120m, 6"=210m, 10"=320m, 12"=350m. Verifique clearance aéreo e zonas de queda.',
    scenario: '✈️ Aeroporto a 3km. Torre de controle exige clearance de 200m. Escolha os calibres.',
    equipment: ['mortar', 'roman-candle'], difficulty: 'hard', xp: 450, completed: false, locked: true,
  },
  {
    id: 'risk-classification', chapter: 'Cap. 6 — Segurança NFPA', title: 'Classificação 1.1G a 1.4G',
    description: 'Classifique artigos pirotécnicos: >10" ou >7500g = 1.1G, >35g flash = 1.1G (APA 87-1). Consumer = 1.4G.',
    scenario: '📋 Fiscal da PHMSA na porta. 200 caixas. Classifique antes que ele chegue.',
    equipment: ['mortar'], difficulty: 'hard', xp: 500, completed: false, locked: true,
  },
  // ── Cap. 7 — Pólvora e Propelentes ──
  {
    id: 'bp-grades', chapter: 'Cap. 7 — Pólvora e Propelentes', title: 'Grades de Pólvora Negra',
    description: 'Aprenda os graus: Cannon (4.76mm, 1.0x), 4FA (1.68mm, 1.3x), Meal D (0.42mm, 2.0x), 5FG (0.149mm, 3.0x). Cada grau afeta a taxa de queima.',
    scenario: '💣 Carga de elevação fraca. O shell não atingiu a altura. Qual grau usar?',
    equipment: ['mortar'], difficulty: 'medium', xp: 300, completed: false, locked: false,
  },
  {
    id: 'caliber-scaling', chapter: 'Cap. 7 — Pólvora e Propelentes', title: 'Escala por Calibre',
    description: 'Domine as tabelas de calibre: velocidade do morteiro, altura de abertura, velocidade de abertura, contagem de estrelas, tempo de vida. Calibre de 1" a 16".',
    scenario: '📊 Designer quer "mais estrelas, mais alto, mais tempo". Calcule os limites reais.',
    equipment: ['mortar', 'roman-candle'], difficulty: 'medium', xp: 350, completed: false, locked: false,
  },
];

const DIFF_CONFIG: Record<string, { color: string; bg: string; stars: number }> = {
  easy: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', stars: 1 },
  medium: { color: 'text-[hsl(var(--fxk-gold))]', bg: 'bg-[hsl(var(--fxk-gold)/0.1)] border-[hsl(var(--fxk-gold)/0.2)]', stars: 2 },
  hard: { color: 'text-accent', bg: 'bg-accent/10 border-accent/20', stars: 3 },
  legendary: { color: 'text-[hsl(var(--fxk-violet))]', bg: 'bg-[hsl(var(--fxk-violet)/0.1)] border-[hsl(var(--fxk-violet)/0.2)]', stars: 4 },
};

const CHAPTER_ICONS: Record<string, typeof BookOpen> = {
  'Cap. 5 — Química Pirotécnica': FlaskConical,
  'Cap. 6 — Segurança NFPA': Shield,
  'Cap. 7 — Pólvora e Propelentes': Flame,
};

export default function Training() {
  const [missions, setMissions] = useState<Mission[]>(INITIAL_MISSIONS);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const completedCount = missions.filter((m) => m.completed).length;
  const totalXP = missions.filter((m) => m.completed).reduce((s, m) => s + m.xp, 0);
  const maxXP = missions.reduce((s, m) => s + m.xp, 0);
  const chapters = [...new Set(missions.map(m => m.chapter))];

  const handleMissionComplete = (missionId: string) => {
    setMissions((prev) => {
      const updated = prev.map((m) => (m.id === missionId ? { ...m, completed: true } : m));
      const firstLocked = updated.findIndex((m) => m.locked);
      if (firstLocked !== -1) updated[firstLocked] = { ...updated[firstLocked], locked: false };
      return updated;
    });
    setActiveMission(null);
  };

  // --- SIMULATOR MODE ---
  if (activeMission) {
    return (
      <TrainingSimulator
        mission={activeMission}
        allEquipment={EQUIPMENT}
        onComplete={() => handleMissionComplete(activeMission.id)}
        onQuit={() => setActiveMission(null)}
      />
    );
  }

  // --- MISSION HUB ---
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-[hsl(var(--surface-1))] via-[hsl(var(--surface-2))] to-[hsl(var(--surface-1))] p-6 animate-fxk-fade-up">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--fxk-violet)/0.08),transparent_60%)]" />
        <div className="absolute top-4 right-6 opacity-[0.04]"><Gamepad2 className="h-32 w-32" /></div>
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-mono text-[hsl(var(--fxk-violet))] tracking-widest uppercase mb-1">MODO SIMULAÇÃO</p>
            <h1 className="text-2xl font-bold font-display text-foreground">Training Center</h1>
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
            <p className="text-[9px] text-muted-foreground font-mono">{completedCount}/{missions.length} missões</p>
          </div>
        </div>
        <div className="relative z-10 mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground font-mono">PROGRESSO GERAL</span>
            <span className="text-[9px] font-mono text-primary">{Math.round((completedCount / missions.length) * 100)}%</span>
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
          { icon: Users, label: 'Rank', value: totalXP >= 2000 ? 'Mestre' : totalXP >= 500 ? 'Técnico' : 'Novato', color: 'text-[hsl(var(--fxk-violet))]' },
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

      {/* Reference Library Toggle */}
      <div className="animate-fxk-fade-up" style={{ animationDelay: '0.12s' }}>
        <Button
          variant={showLibrary ? 'default' : 'outline'}
          size="sm"
          className="gap-2 text-xs"
          onClick={() => setShowLibrary(!showLibrary)}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Biblioteca de Referência — {MANUALS.length} Manuais
          <span className="text-[9px] opacity-60">{showLibrary ? '▲' : '▼'}</span>
        </Button>
      </div>

      {/* Reference Library */}
      {showLibrary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fxk-fade-up">
          {MANUALS.map((manual) => (
            <Card key={manual.id} className="bg-card border-border/40 hover:border-primary/30 transition-all duration-200 hover:shadow-[0_0_15px_hsl(var(--primary)/0.05)]">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{manual.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${manual.color}`}>{manual.title}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{manual.author}</p>
                    <p className="text-[10px] text-foreground/60 mt-2 leading-relaxed">{manual.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {manual.topics.slice(0, 4).map(topic => (
                        <span key={topic} className="text-[8px] px-1.5 py-0.5 rounded-sm bg-muted/30 border border-border/20 text-muted-foreground">
                          {topic}
                        </span>
                      ))}
                      {manual.topics.length > 4 && (
                        <span className="text-[8px] px-1.5 py-0.5 text-muted-foreground/50">
                          +{manual.topics.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Equipment */}
      <Card className="bg-card border-border/30 animate-fxk-fade-up" style={{ animationDelay: '0.15s' }}>
        <div className="p-3 pb-2 flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Inventário de Equipamentos</span>
        </div>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {EQUIPMENT.map((eq) => (
              <div key={eq.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/30 text-[10px] cursor-default hover:border-primary/30 hover:bg-primary/5 transition-all duration-200">
                <span className="text-sm">{eq.icon}</span>
                <span className="text-foreground/70 truncate">{eq.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Missions by chapter */}
      {chapters.map((chapter, ci) => {
        const ChapterIcon = CHAPTER_ICONS[chapter] || Sparkles;
        const isManualChapter = chapter.includes('Química') || chapter.includes('NFPA') || chapter.includes('Pólvora');
        return (
          <div key={chapter} className="space-y-2 animate-fxk-fade-up" style={{ animationDelay: `${0.2 + ci * 0.05}s` }}>
            <div className="flex items-center gap-2 px-1">
              {isManualChapter && <ChapterIcon className="h-3.5 w-3.5 text-primary/60" />}
              <h2 className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.15em]">{chapter}</h2>
              {isManualChapter && (
                <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono">MANUAL</span>
              )}
            </div>
            {missions.filter(m => m.chapter === chapter).map((mission) => {
              const diff = DIFF_CONFIG[mission.difficulty];
              return (
                <Card key={mission.id} className={`border transition-all duration-200 ${mission.locked ? 'bg-card/50 border-border/20 opacity-60' : 'bg-card border-border/40 hover:border-primary/30 hover:shadow-[0_0_15px_hsl(var(--primary)/0.05)]'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg border ${diff.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        {mission.locked ? <Lock className="h-4 w-4 text-muted-foreground/40" /> : mission.completed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <ArrowRight className={`h-4 w-4 ${diff.color}`} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm text-foreground">{mission.title}</p>
                          <div className="flex gap-0.5">
                            {Array.from({ length: diff.stars }).map((_, i) => (
                              <Star key={i} className={`h-2.5 w-2.5 fill-current ${diff.color}`} />
                            ))}
                          </div>
                          <span className={`text-[8px] font-mono px-1.5 py-px rounded ${diff.bg} ${diff.color}`}>+{mission.xp} XP</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{mission.description}</p>
                        <p className="text-[10px] text-foreground/40 mt-1 italic">{mission.scenario}</p>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {mission.equipment.map((eqId) => {
                            const eq = EQUIPMENT.find((e) => e.id === eqId);
                            return eq ? (
                              <span key={eqId} className="text-[9px] bg-muted/30 px-1.5 py-0.5 rounded-sm border border-border/20">{eq.icon} {eq.name}</span>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={mission.locked ? 'ghost' : mission.completed ? 'ghost' : 'default'}
                        className="shrink-0 text-xs"
                        disabled={mission.locked}
                        onClick={() => setActiveMission(mission)}
                      >
                        {mission.completed ? '↻ Replay' : mission.locked ? <Lock className="h-3 w-3" /> : '▶ Jogar'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
