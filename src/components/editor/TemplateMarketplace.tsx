import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/store/useProjectStore';
import { type ShowTemplate, type TemplateCategory, TEMPLATE_CATEGORIES, loadTemplates, saveTemplate } from '@/lib/showTemplates';
import { Cloud, Upload, Download, Search, Star, Users, Clock, X } from 'lucide-react';
import { toast } from 'sonner';

interface TemplateMarketplaceProps {
  onClose?: () => void;
}

interface CloudTemplate extends ShowTemplate {
  author: string;
  downloads: number;
  rating: number;
  isCloud: true;
}

const SAMPLE_CLOUD_TEMPLATES: CloudTemplate[] = [
  {
    id: 'cloud-1', name: 'New Year Countdown 2025', description: 'Spectacular 10-second countdown with number formations transitioning to fireworks burst',
    category: 'countdown', createdAt: new Date().toISOString(), duration: 120, droneCount: 500,
    formationCount: 12, formations: [], tags: ['countdown', 'nye', 'numbers'], author: 'DroneShow Pro',
    downloads: 1247, rating: 4.8, isCloud: true,
  },
  {
    id: 'cloud-2', name: 'Olympic Rings Ceremony', description: 'Five interlocking rings with color transitions and torch relay sequence',
    category: 'sports', createdAt: new Date().toISOString(), duration: 180, droneCount: 800,
    formationCount: 8, formations: [], tags: ['olympics', 'rings', 'ceremony'], author: 'SkyArt Studio',
    downloads: 892, rating: 4.9, isCloud: true,
  },
  {
    id: 'cloud-3', name: 'Aurora Borealis Flow', description: 'Organic flowing wave patterns mimicking northern lights with color shifts',
    category: 'abstract', createdAt: new Date().toISOString(), duration: 240, droneCount: 400,
    formationCount: 15, formations: [], tags: ['aurora', 'waves', 'organic'], author: 'NightSky Labs',
    downloads: 634, rating: 4.6, isCloud: true,
  },
  {
    id: 'cloud-4', name: 'Christmas Tree & Snowflakes', description: 'Animated Christmas tree with falling snowflake formations',
    category: 'holiday', createdAt: new Date().toISOString(), duration: 150, droneCount: 350,
    formationCount: 10, formations: [], tags: ['christmas', 'tree', 'snow'], author: 'FestiveDrones',
    downloads: 2103, rating: 4.7, isCloud: true,
  },
  {
    id: 'cloud-5', name: 'National Flag Wave', description: 'Dynamic waving flag animation with patriotic color sequences',
    category: 'patriotic', createdAt: new Date().toISOString(), duration: 90, droneCount: 600,
    formationCount: 6, formations: [], tags: ['flag', 'patriotic', 'wave'], author: 'SkyPatriot',
    downloads: 1560, rating: 4.5, isCloud: true,
  },
];

export default function TemplateMarketplace({ onClose }: TemplateMarketplaceProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [tab, setTab] = useState<'browse' | 'my' | 'publish'>('browse');
  const localTemplates = loadTemplates();

  const filtered = SAMPLE_CLOUD_TEMPLATES.filter(t => {
    if (category !== 'all' && t.category !== category) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.tags.some(tag => tag.includes(search.toLowerCase()))) return false;
    return true;
  });

  const handleDownload = (template: CloudTemplate) => {
    // Save downloaded template to local "My Templates"
    saveTemplate({
      name: template.name,
      description: template.description,
      category: template.category,
      duration: template.duration,
      droneCount: template.droneCount,
      formationCount: template.formationCount,
      formations: template.formations,
      tags: template.tags,
    });
    toast.success(`"${template.name}" added to My Templates`);
  };

  const handlePublish = () => {
    if (localTemplates.length === 0) {
      toast.error('No local templates to publish. Save a template first.');
      return;
    }
    toast.success('Template published to marketplace');
  };

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border/60">
      <div className="px-3 py-2.5 border-b border-border/40 flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-foreground uppercase tracking-[0.15em] flex items-center gap-1.5">
          <Cloud className="w-4 h-4 text-primary" />
          Marketplace
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tabs */}
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
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-6 text-[10px] pl-7"
                />
              </div>

              {/* Category filter — no emojis */}
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

              {/* Template cards */}
              <div className="space-y-2">
                {filtered.map(t => (
                  <div key={t.id} className="bg-surface-2/60 rounded-md p-2.5 border border-border/30 space-y-1.5 hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-[11px] font-bold text-foreground">{t.name}</h4>
                        <p className="text-[9px] text-muted-foreground">{t.author}</p>
                      </div>
                      <Badge variant="outline" className="text-[7px] h-3.5 uppercase font-semibold">
                        {t.category}
                      </Badge>
                    </div>

                    <p className="text-[9px] text-muted-foreground leading-relaxed">{t.description}</p>

                    <div className="flex items-center gap-3 text-[8px] text-muted-foreground font-mono">
                      <span className="flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                        {t.rating}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Download className="w-2.5 h-2.5" />
                        {t.downloads}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Users className="w-2.5 h-2.5" />
                        {t.droneCount}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {t.formationCount}
                      </span>
                    </div>

                    <div className="flex gap-1">
                      {t.tags.map(tag => (
                        <span key={tag} className="text-[7px] bg-surface-3/60 px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <Button size="sm" className="w-full h-5 text-[9px] mt-1" onClick={() => handleDownload(t)}>
                      <Download className="w-3 h-3 mr-1" /> Download to My Templates
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'my' && (
            <div className="space-y-2">
              {localTemplates.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-6">
                  No saved templates. Download from Browse or save from Templates panel.
                </p>
              ) : (
                localTemplates.map(t => (
                  <div key={t.id} className="bg-surface-2/60 rounded p-2 border border-border/30">
                    <h4 className="text-[10px] font-bold text-foreground">{t.name}</h4>
                    <p className="text-[9px] text-muted-foreground">{t.description}</p>
                    <div className="flex gap-1 mt-1.5">
                      <Button size="sm" variant="outline" className="flex-1 h-5 text-[9px]" onClick={handlePublish}>
                        <Upload className="w-3 h-3 mr-1" /> Publish
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
              <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider">Share Your Templates</h4>
              <p className="text-[9px] text-muted-foreground leading-relaxed">
                Publish your show templates to the marketplace for other designers to use.
              </p>
              <Button size="sm" className="text-[10px] h-6" onClick={handlePublish}>
                <Upload className="w-3 h-3 mr-1" /> Publish Local Template
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
