/**
 * VVIZExportDialog — Configure and download VVIZ export for Finale 3D
 */
import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';
import { Download, FileJson } from 'lucide-react';
import { useEntitlements } from '@/hooks/useEntitlements';
import { promptUpgrade } from '@/lib/upgradePrompt';

const getExportEngine = () => import('@/lib/exportEngine');

interface VVIZExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VVIZExportDialog({ open, onOpenChange }: VVIZExportDialogProps) {
    const projectName = useProjectStore(s => s.projectName);
  const duration = useProjectStore(s => s.duration);
  const timelineItems = useProjectStore(s => s.timelineItems);
  const positions = useProjectStore(s => s.positions);
  const trajectories = useProjectStore(s => s.trajectories);
  const droneFormations = useProjectStore(s => s.droneFormations);

  const [showName, setShowName] = useState(projectName);
  const [positionRate, setPositionRate] = useState(10);
  const [colorRate, setColorRate] = useState(20);
  const [coordFrame, setCoordFrame] = useState<'standard' | 'ogl'>('standard');
  const [noTrail, setNoTrail] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { canExport } = useEntitlements();

  const totalPerfs = timelineItems.length + trajectories.length + (droneFormations[0]?.droneCount ?? 0);
  const handleExport = useCallback(async () => {
    if (!canExport) {
      promptUpgrade({ reason: 'export', feature: 'VVIZ (Finale 3D)' });
      onOpenChange(false);
      return;
    }
    setExporting(true);
    try {
      const { exportVVIZ, downloadFile } = await getExportEngine();
      const content = exportVVIZ(
        projectName, duration, timelineItems, positions, trajectories, droneFormations,
        { showName, positionRate, colorRate, coordinateFrame: coordFrame, noTrail }
      );
      downloadFile(content, `${showName.replace(/\s+/g, '_')}.vviz`, 'application/json');
      toast.success('VVIZ exportado com sucesso!');
      onOpenChange(false);
    } catch (err) {
      toast.error('Erro ao exportar VVIZ');
      console.error(err);
    } finally {
      setExporting(false);
    }
  }, [projectName, duration, timelineItems, positions, trajectories, droneFormations, showName, positionRate, colorRate, coordFrame, noTrail, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background border-border/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileJson className="w-5 h-5 text-primary" />
            Exportar VVIZ
          </DialogTitle>
          <DialogDescription>
            Configurar exportação para Finale 3D
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome do Show</Label>
            <Input
              value={showName}
              onChange={(e) => setShowName(e.target.value)}
              className="h-8 text-sm bg-muted/20 border-border/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Position Rate (Hz)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={positionRate}
                onChange={(e) => setPositionRate(Number(e.target.value))}
                className="h-8 text-sm bg-muted/20 border-border/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Color Rate (Hz)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={colorRate}
                onChange={(e) => setColorRate(Number(e.target.value))}
                className="h-8 text-sm bg-muted/20 border-border/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sistema de Coordenadas</Label>
            <div className="flex gap-2">
              <Button
                variant={coordFrame === 'standard' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => setCoordFrame('standard')}
              >
                VVIZ Standard
              </Button>
              <Button
                variant={coordFrame === 'ogl' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => setCoordFrame('ogl')}
              >
                OpenGL/Three.js
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              {coordFrame === 'standard' ? 'Z-flip aplicado (Three.js → VVIZ)' : 'Sem transformação de eixos'}
            </p>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-xs text-muted-foreground">Suprimir Trails (No Trail)</Label>
              <p className="text-[10px] text-muted-foreground/60">Cores VDL com "Tip" ou "No Trail"</p>
            </div>
            <Button
              variant={noTrail ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setNoTrail(!noTrail)}
            >
              {noTrail ? 'ON' : 'OFF'}
            </Button>
          </div>

          <div className="rounded-lg bg-muted/10 border border-border/20 p-3 text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>Performances:</span><span className="font-mono text-foreground">{timelineItems.length + trajectories.length + (droneFormations[0]?.droneCount ?? 0)}</span></div>
            <div className="flex justify-between"><span>Formações:</span><span className="font-mono text-foreground">{droneFormations.length}</span></div>
            <div className="flex justify-between"><span>Trajectórias:</span><span className="font-mono text-foreground">{trajectories.length}</span></div>
            <div className="flex justify-between"><span>Quantização VDL:</span><span className="font-mono text-primary">25 cores</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exportando...' : 'Exportar .vviz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
