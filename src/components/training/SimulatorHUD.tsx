import { Timer, Trophy, LogOut, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MissionObjective } from './types';

interface SimulatorHUDProps {
  missionTitle: string;
  score: number;
  timeRemaining: number;
  objectives: MissionObjective[];
  completedObjectiveIds: Set<string>;
  progress: number;
  onQuit: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SimulatorHUD({
  missionTitle,
  score,
  timeRemaining,
  objectives,
  completedObjectiveIds,
  progress,
  onQuit,
}: SimulatorHUDProps) {
  const isUrgent = timeRemaining <= 15;

  return (
    <>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-[hsl(var(--surface-0))]/80 to-transparent pointer-events-none">
        {/* Score */}
        <div className="pointer-events-auto flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[hsl(var(--fxk-gold))]" />
          <span className="text-lg font-bold font-mono text-foreground">{score}</span>
          <span className="text-[9px] text-muted-foreground">PTS</span>
        </div>

        {/* Mission title */}
        <div className="text-center">
          <p className="text-[9px] font-mono text-primary uppercase tracking-wider">MISSÃO ATIVA</p>
          <p className="text-xs font-bold text-foreground">{missionTitle}</p>
        </div>

        {/* Timer */}
        <div className={`pointer-events-auto flex items-center gap-2 ${isUrgent ? 'animate-pulse' : ''}`}>
          <Timer className={`h-4 w-4 ${isUrgent ? 'text-destructive' : 'text-muted-foreground'}`} />
          <span className={`text-lg font-bold font-mono ${isUrgent ? 'text-destructive' : 'text-foreground'}`}>
            {formatTime(timeRemaining)}
          </span>
        </div>
      </div>

      {/* Objectives panel (right side) */}
      <div className="absolute right-3 top-14 z-20 bg-[hsl(var(--surface-0))]/85 backdrop-blur-sm border border-border/40 rounded-lg p-2 min-w-[170px]">
        <div className="flex items-center gap-1.5 px-1 pb-1.5 border-b border-border/30">
          <Target className="h-3 w-3 text-primary" />
          <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
            Objetivos
          </span>
        </div>
        <div className="mt-1.5 space-y-1">
          {objectives.map((obj) => {
            const done = completedObjectiveIds.has(obj.id);
            return (
              <div key={obj.id} className={`flex items-center gap-2 text-[10px] px-1 py-0.5 rounded ${done ? 'text-emerald-400' : 'text-foreground/70'}`}>
                <span>{done ? '✓' : '○'}</span>
                <span className={done ? 'line-through opacity-60' : ''}>{obj.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 py-3 bg-gradient-to-t from-[hsl(var(--surface-0))]/80 to-transparent pointer-events-none">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={onQuit}
            className="pointer-events-auto text-[10px] h-7 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3 w-3 mr-1" /> Sair
          </Button>
          <div className="flex-1">
            <Progress value={progress} className="h-1.5" />
          </div>
          <span className="text-[9px] font-mono text-muted-foreground">{Math.round(progress)}%</span>
        </div>
      </div>
    </>
  );
}
