/**
 * Training v2.1 — MissionFailedScreen (GTA-V "Wasted" homage).
 */

import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface Props {
  title?: string;
  flavor: string;
  lesson?: string;
  onRetry: () => void;
  onQuit: () => void;
}

export default function MissionFailedScreen({
  title = 'MISSÃO FALHADA',
  flavor,
  lesson,
  onRetry,
  onQuit,
}: Props) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[hsl(0_75%_25%/0.55)] backdrop-blur-[3px] animate-fade-in" />
      <div className="relative z-10 max-w-lg w-full px-6 text-center space-y-5 animate-fxk-fade-up">
        <p className="text-[10px] uppercase tracking-[0.4em] font-mono text-white/70">Game over</p>
        <h2 className="text-[44px] leading-none font-extrabold text-white tracking-wider drop-shadow-[0_0_18px_rgba(0,0,0,0.9)]">
          {title}
        </h2>
        <p className="text-base text-white/90 italic">"{flavor}"</p>
        {lesson && (
          <div className="mx-auto max-w-md rounded-md border border-white/15 bg-black/55 px-4 py-3 text-left">
            <p className="text-[10px] uppercase tracking-widest font-mono text-white/60 mb-1">Lição tática</p>
            <p className="text-sm text-white/95 leading-snug">{lesson}</p>
          </div>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <Button variant="outline" onClick={onRetry} className="bg-white/10 text-white border-white/40 hover:bg-white/20">
            <RotateCcw className="h-4 w-4 mr-2" /> Refazer
          </Button>
          <Button onClick={onQuit} className="bg-white text-[hsl(0_75%_25%)] hover:bg-white/90">
            Voltar ao Hub
          </Button>
        </div>
      </div>
    </div>
  );
}
