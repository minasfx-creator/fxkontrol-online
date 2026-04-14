import { Button } from '@/components/ui/button';
import { ExternalLink, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportCardProps {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  isActive: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onDocx?: () => void;
}

export default function ReportCard({ label, desc, icon: Icon, color, isActive, onOpen, onDownload, onDocx }: ReportCardProps) {
  return (
    <div className={cn(
      "rounded-lg border p-2.5 transition-all duration-200",
      isActive
        ? "bg-primary/5 border-primary/30 shadow-sm shadow-primary/5"
        : "bg-card/50 border-border/30 hover:border-border/50"
    )}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("p-1 rounded", color === 'text-destructive' && "bg-destructive/10", color === 'text-primary' && "bg-primary/10", color === 'text-warning' && "bg-warning/10", color === 'text-success' && "bg-success/10", color === 'text-accent' && "bg-accent/10")}>
          <Icon className={cn("h-3.5 w-3.5", color)} />
        </div>
        <span className="text-[10px] font-semibold text-foreground flex-1">{label}</span>
      </div>
      <p className="text-[8px] text-muted-foreground mb-2.5 leading-relaxed pl-0.5">{desc}</p>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[8px] gap-1 flex-1 border-border/50 hover:bg-primary/10 hover:border-primary/30"
          onClick={onOpen}
        >
          <ExternalLink className="h-2.5 w-2.5" /> Abrir
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[8px] gap-1 flex-1 border-border/50 hover:bg-primary/10 hover:border-primary/30"
          onClick={onDownload}
        >
          <Download className="h-2.5 w-2.5" /> HTML
        </Button>
        {onDocx && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[8px] gap-1 border-border/50 hover:bg-accent/10 hover:border-accent/30"
            onClick={onDocx}
            title="Exportar DOCX"
          >
            <FileText className="h-2.5 w-2.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
