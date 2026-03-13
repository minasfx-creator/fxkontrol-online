import { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Trash2, Clock, FileJson, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useProjectPersistence } from '@/hooks/useProjectPersistence';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProjectRow {
  id: string;
  name: string;
  updated_at: string;
  duration: number;
}

export default function ProjectBrowser({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { listProjects, loadProject, deleteProject } = useProjectPersistence();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await listProjects();
    setProjects(data);
    setLoading(false);
  }, [listProjects]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    const ok = await loadProject(id);
    setLoadingId(null);
    if (ok) {
      toast.success('Projeto carregado!');
      onOpenChange(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deletar "${name}"?`)) return;
    const ok = await deleteProject(id);
    if (ok) {
      toast.success('Projeto deletado');
      refresh();
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FolderOpen className="h-4 w-4 text-primary" />
            Meus Projetos
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Abra um projeto salvo anteriormente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8">
              <FileJson className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhum projeto salvo</p>
              <p className="text-[10px] text-muted-foreground/60">Use Ctrl+S para salvar o projeto atual</p>
            </div>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-sm cursor-pointer transition-colors border",
                  loadingId === p.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-transparent hover:bg-surface-3"
                )}
                onClick={() => handleLoad(p.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-mono-code">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{formatDate(p.updated_at)}</span>
                    <span>·</span>
                    <span>{p.duration}s</span>
                  </div>
                </div>
                {loadingId === p.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <button
                    className="text-muted-foreground/40 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
