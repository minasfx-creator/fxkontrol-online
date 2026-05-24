/**
 * Info panel for selected PCB component
 */
import { X, Cpu, Zap, Radio, Battery } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ComponentInfo {
  ref: string;
  label: string;
  desc: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  U1: <Cpu className="w-4 h-4" />,
  U6: <Radio className="w-4 h-4" />,
  U9: <Battery className="w-4 h-4" />,
  U10: <Zap className="w-4 h-4" />,
};

function getIcon(ref: string) {
  if (ICON_MAP[ref]) return ICON_MAP[ref];
  if (ref.startsWith('Q')) return <Zap className="w-4 h-4" />;
  if (ref.startsWith('U')) return <Cpu className="w-4 h-4" />;
  return <Cpu className="w-4 h-4" />;
}

function getCategoryColor(ref: string) {
  if (ref === 'U1') return 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10';
  if (ref === 'U6') return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
  if (ref.startsWith('Q')) return 'text-amber-400 border-amber-400/30 bg-amber-400/10';
  if (ref.startsWith('U') && parseInt(ref.slice(1)) >= 7) return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
  if (ref === 'U9' || ref === 'U10') return 'text-red-400 border-red-400/30 bg-red-400/10';
  return 'text-foreground border-border bg-muted/20';
}

export default function PCBInfoPanel({ info, onClose }: { info: ComponentInfo | null; onClose: () => void }) {
  if (!info) return (
    <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 bg-card/90 backdrop-blur-xl border border-border/30 rounded-xl p-4 shadow-2xl">
      <p className="text-xs text-muted-foreground font-mono">
        Clique em um componente para ver detalhes técnicos
      </p>
    </div>
  );

  const catClass = getCategoryColor(info.ref);

  return (
    <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-96 bg-card/95 backdrop-blur-xl border border-border/30 rounded-xl p-4 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${catClass}`}>
            {getIcon(info.ref)}
          </div>
          <div>
            <span className="font-mono text-xs font-bold text-primary">{info.ref}</span>
            <h3 className="text-sm font-semibold text-foreground">{info.label}</h3>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{info.desc}</p>
    </div>
  );
}
