import { Loader2 } from 'lucide-react';

export default function ViewportBootingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Inicializando cena 3D…
      </div>
    </div>
  );
}
