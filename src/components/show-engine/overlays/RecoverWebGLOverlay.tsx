import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RecoverWebGLOverlay({ onRecover }: { onRecover: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm">
      <div className="text-sm text-amber-300">Contexto WebGL perdido</div>
      <Button size="sm" variant="outline" onClick={onRecover} className="gap-2">
        <RefreshCw className="h-4 w-4" /> Recuperar WebGL
      </Button>
    </div>
  );
}
