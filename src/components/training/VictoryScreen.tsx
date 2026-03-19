import { Star, Trophy, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VictoryScreenProps {
  missionTitle: string;
  score: number;
  xp: number;
  timeRemaining: number;
  timeLimit: number;
  onContinue: () => void;
}

export default function VictoryScreen({ missionTitle, score, xp, timeRemaining, timeLimit, onContinue }: VictoryScreenProps) {
  const timeRatio = timeRemaining / timeLimit;
  const stars = timeRatio > 0.6 ? 3 : timeRatio > 0.3 ? 2 : 1;

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-[hsl(var(--surface-0))] flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08),transparent_60%)]" />

      <div className="relative z-10 text-center space-y-5 animate-fxk-fade-up">
        <p className="text-5xl">🎉</p>
        <h2 className="text-2xl font-bold font-display text-foreground">Missão Completa!</h2>
        <p className="text-sm text-muted-foreground">{missionTitle}</p>

        {/* Stars */}
        <div className="flex items-center justify-center gap-1">
          {[1, 2, 3].map((i) => (
            <Star
              key={i}
              className={`h-8 w-8 transition-all duration-500 ${
                i <= stars ? 'text-[hsl(var(--fxk-gold))] fill-[hsl(var(--fxk-gold))]' : 'text-muted-foreground/20'
              }`}
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-[hsl(var(--fxk-gold))]" />
            <span className="font-bold font-mono text-foreground">{score}</span>
            <span className="text-muted-foreground text-[10px]">PTS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-bold font-mono text-foreground">{Math.floor(timeRemaining)}s</span>
            <span className="text-muted-foreground text-[10px]">restantes</span>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5">
          <span className="text-sm font-bold text-primary">+{xp} XP</span>
        </div>

        <div>
          <Button onClick={onContinue} className="mt-2">
            Continuar <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
