import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BridgeSecurityDiagnostic } from '@/lib/bridgeGateway';

interface BridgeSecurityAlertProps {
  diagnostic: BridgeSecurityDiagnostic;
  className?: string;
  compact?: boolean;
}

const severityIcon = {
  info: Info,
  warning: AlertTriangle,
  error: ShieldAlert,
} as const;

export default function BridgeSecurityAlert({ diagnostic, className, compact = false }: BridgeSecurityAlertProps) {
  const Icon = severityIcon[diagnostic.severity];
  const destructive = diagnostic.severity === 'error';

  return (
    <Alert variant={destructive ? 'destructive' : 'default'} className={cn('border-border/60 bg-background/60', className)}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="flex flex-wrap items-center gap-2 text-sm">
        <span>Bridge local</span>
        <Badge variant="outline">{diagnostic.bridgeProtocol.replace(':', '').toUpperCase()}</Badge>
        <Badge variant="outline">{diagnostic.host}</Badge>
        {diagnostic.mdnsHost ? <Badge variant="outline">mDNS</Badge> : null}
        {diagnostic.standalonePwa ? <Badge variant="outline">PWA</Badge> : null}
        {diagnostic.iosWebKit ? <Badge variant="outline">iPhone/iPad</Badge> : null}
      </AlertTitle>
      <AlertDescription className={cn('space-y-2 text-xs text-muted-foreground', compact && 'space-y-1')}>
        <p>{diagnostic.summary}</p>
        <p>{diagnostic.recommendedAction}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline">Contexto seguro: {diagnostic.isSecureContext ? 'OK' : 'bloqueado'}</Badge>
          <Badge variant="outline">Mixed content: {diagnostic.mixedContentBlocked ? 'sim' : 'não'}</Badge>
          <Badge variant="outline">Compatível iPhone/PWA: {diagnostic.compatibleWithIOSPwa ? 'sim' : 'não'}</Badge>
          <Badge variant="outline">Watchdog: {diagnostic.watchdogRequired ? 'obrigatório' : 'opcional'}</Badge>
        </div>
        {diagnostic.mixedContentResources.length > 0 ? (
          <div className="space-y-1 pt-1">
            <p className="text-xs text-destructive">Recursos bloqueados por mixed content</p>
            {diagnostic.mixedContentResources.map((resource) => (
              <Badge key={resource} variant="outline">{resource}</Badge>
            ))}
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}