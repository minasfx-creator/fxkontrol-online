import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ViewportErrorOverlay({
  message,
  onReset,
}: {
  message?: string;
  onReset?: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4" />
        Falha ao renderizar a cena
      </div>
      {message && <p className="text-xs text-muted-foreground max-w-md text-center">{message}</p>}
      {onReset && (
        <Button size="sm" variant="outline" onClick={onReset}>
          Resetar cena
        </Button>
      )}
    </div>
  );
}
