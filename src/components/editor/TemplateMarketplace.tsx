/**
 * TemplateMarketplace — REAL data only.
 *
 * Browse tab is wired to `public.effect_packages` via
 * `marketplace-online/registryClient`. Empty state directs users to the
 * Golden Catalog (`/dev/golden-shows`) which contains exportable, verified
 * shows. No more SAMPLE_CLOUD_TEMPLATES.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { type TemplateCategory, TEMPLATE_CATEGORIES, loadTemplates, saveTemplate } from '@/lib/showTemplates';
import { Cloud, Upload, Download, Search, X, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { listPackages, searchPackages } from '@/modules/swarmgpt/marketplace-online/registryClient';
import { installOnlinePackage } from '@/modules/swarmgpt/marketplace-online';
import type { OnlinePackageSummary } from '@/modules/swarmgpt/marketplace-online/types';

interface TemplateMarketplaceProps {
  onClose?: () => void;
}

export default function TemplateMarketplace({ onClose }: TemplateMarketplaceProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [tab, setTab] = useState<'browse' | 'my' | 'publish'>('browse');
  const [cloudPkgs, setCloudPkgs] = useState<OnlinePackageSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const localTemplates = loadTemplates();

  // Real fetch — debounced search against the Supabase-backed registry.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setLoadError(null);
        const rows = search.trim()
          ? await searchPackages(search.trim())
          : await listPackages();
        if (!cancelled) setCloudPkgs(rows);
      } catch (err) {
        if (!cancelled) {
          setCloudPkgs([]);
          setLoadError(err instanceof Error ? err.message : 'Falha ao carregar marketplace.');
        }
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search]);

  const filtered = useMemo(() => {
    if (!cloudPkgs) return [];
    if (category === 'all') return cloudPkgs;
    return cloudPkgs.filter(p => p.category === category);
  }, [cloudPkgs, category]);

  const handleDownload = async (pkg: OnlinePackageSummary) => {
    if (!pkg.latestVersion) {
      toast.error('Pacote sem versão publicada.');
      return;
    }
    setInstalling(pkg.packageId);
    try {
      await installOnlinePackage(pkg.packageId, 'latest');
      toast.success(`"${pkg.name}" instalado.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na instalação';
      toast.error(`Instalação falhou: ${msg}`);
    } finally {
      setInstalling(null);
    }
  };

  const handlePublish = () => {
    if (localTemplates.length === 0) {
      toast.error('Sem templates locais. Salve um template primeiro.');
      return;
    }
    toast.info('Publicação de templates locais ainda não habilitada — use a Edge Function "marketplace-publish".');
  };

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border/60">
      <div className="px-3 py-2.5 border-b border-border/40 flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-foreground uppercase tracking-[0.15em] flex items-center gap-1.5">
          <Cloud className="w-4 h-4 text-primary" />
          Marketplace
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex border-b border-border/40">
        {(['browse', 'my', 'publish'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              tab === t ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'browse' ? 'Browse' : t === 'my' ? 'My Templates' : 'Publish'}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {tab === 'browse' && (
            <>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar pacotes…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-6 text-[10px] pl-7"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                <Badge
                  variant={category === 'all' ? 'default' : 'outline'}
                  className="text-[8px] cursor-pointer h-4 font-semibold uppercase"
                  onClick={() => setCategory('all')}
                >
                  All
                </Badge>
                {Object.entries(TEMPLATE_CATEGORIES).map(([key, val]) => (
                  <Badge
                    key={key}
                    variant={category === key ? 'default' : 'outline'}
                    className="text-[8px] cursor-pointer h-4 font-semibold uppercase"
                    onClick={() => setCategory(key as TemplateCategory)}
                  >
                    {val.label}
                  </Badge>
                ))}
              </div>

              {/* Loading */}
              {cloudPkgs === null && (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-[10px] font-mono uppercase tracking-wider">Carregando catálogo…</span>
                </div>
              )}

              {/* Error */}
              {loadError && cloudPkgs?.length === 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[10px] text-destructive">
                  {loadError}
                </div>
              )}

              {/* Empty state — honest */}
              {cloudPkgs?.length === 0 && !loadError && (
                <div className="space-y-3 text-center py-6 px-2 border border-dashed border-border/40 rounded-md">
                  <Cloud className="w-7 h-7 text-muted-foreground/50 mx-auto" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Nenhum pacote publicado no marketplace ainda.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[10px] h-7"
                    onClick={() => navigate('/dev/golden-shows')}
                  >
                    <Sparkles className="w-3 h-3 mr-1" /> Abrir Golden Catalog
                  </Button>
                </div>
              )}

              {/* Cards */}
              {filtered.length > 0 && (
                <div className="space-y-2">
                  {filtered.map(p => (
                    <div key={p.id} className="bg-surface-2/60 rounded-md p-2.5 border border-border/30 space-y-1.5 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <h4 className="text-[11px] font-bold text-foreground truncate">{p.name}</h4>
                          <p className="text-[9px] text-muted-foreground truncate">{p.author}</p>
                        </div>
                        <Badge variant="outline" className="text-[7px] h-3.5 uppercase font-semibold shrink-0">
                          {p.category}
                        </Badge>
                      </div>

                      {p.description && (
                        <p className="text-[9px] text-muted-foreground leading-relaxed line-clamp-2">{p.description}</p>
                      )}

                      <div className="flex items-center gap-3 text-[8px] text-muted-foreground font-mono">
                        {p.latestVersion && <span>v{p.latestVersion}</span>}
                        <span>{new Date(p.updatedAt).toLocaleDateString('pt-BR')}</span>
                      </div>

                      {p.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {p.tags.slice(0, 6).map(tag => (
                            <span key={tag} className="text-[7px] bg-surface-3/60 px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <Button
                        size="sm"
                        className="w-full h-5 text-[9px] mt-1"
                        disabled={installing === p.packageId || !p.latestVersion}
                        onClick={() => handleDownload(p)}
                      >
                        {installing === p.packageId ? (
                          <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Instalando…</>
                        ) : (
                          <><Download className="w-3 h-3 mr-1" /> Instalar</>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'my' && (
            <div className="space-y-2">
              {localTemplates.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-6">
                  Nenhum template salvo. Crie um a partir do painel de Templates.
                </p>
              ) : (
                localTemplates.map(t => (
                  <div key={t.id} className="bg-surface-2/60 rounded p-2 border border-border/30">
                    <h4 className="text-[10px] font-bold text-foreground">{t.name}</h4>
                    <p className="text-[9px] text-muted-foreground">{t.description}</p>
                    <div className="flex gap-1 mt-1.5">
                      <Button size="sm" variant="outline" className="flex-1 h-5 text-[9px]" onClick={handlePublish}>
                        <Upload className="w-3 h-3 mr-1" /> Publicar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'publish' && (
            <div className="space-y-3 text-center py-4">
              <Cloud className="w-8 h-8 text-primary mx-auto" />
              <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider">Compartilhar templates</h4>
              <p className="text-[9px] text-muted-foreground leading-relaxed">
                Publique pacotes assinados via Edge Function <code className="bg-surface-3/60 px-1 rounded">marketplace-publish</code>.
              </p>
              <Button size="sm" className="text-[10px] h-6" onClick={handlePublish}>
                <Upload className="w-3 h-3 mr-1" /> Publicar template local
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
