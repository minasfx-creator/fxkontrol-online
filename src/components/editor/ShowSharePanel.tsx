import { useState, useCallback } from 'react';
import { Share2, X, Copy, Check, Link, QrCode, Clock, Eye, Lock, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';

interface ShareSettings {
  isPublic: boolean;
  expiresIn: '1h' | '24h' | '7d' | '30d' | 'never';
  allowComments: boolean;
  showTimeline: boolean;
  showPositions: boolean;
  watermark: boolean;
  password: string;
}

export default function ShowSharePanel({ onClose }: { onClose: () => void }) {
  const projectName = useProjectStore(s => s.projectName);
  const [settings, setSettings] = useState<ShareSettings>({
    isPublic: false,
    expiresIn: '7d',
    allowComments: true,
    showTimeline: true,
    showPositions: false,
    watermark: true,
    password: '',
  });
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generateLink = useCallback(async () => {
    setGenerating(true);
    // Simulate link generation (would use backend in production)
    await new Promise(r => setTimeout(r, 800));
    const token = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const link = `${window.location.origin}/preview/${token}`;
    setShareLink(link);
    setGenerating(false);
    toast.success('Share link generated');
  }, []);

  const copyLink = useCallback(() => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }, [shareLink]);

  const EXPIRY_LABELS: Record<string, string> = {
    '1h': '1 Hour',
    '24h': '24 Hours',
    '7d': '7 Days',
    '30d': '30 Days',
    'never': 'Never',
  };

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border/60">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Share Preview</span>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3 text-xs">
        {/* Project info */}
        <div className="bg-surface-2/50 rounded p-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground text-[11px]">{projectName || 'Untitled Show'}</p>
            <p className="text-[9px] text-muted-foreground">Share a read-only preview</p>
          </div>
        </div>

        {/* Visibility */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Access
          </Label>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-primary" />
              <span className="text-muted-foreground">Public link</span>
            </div>
            <Switch
              checked={settings.isPublic}
              onCheckedChange={(v) => setSettings(prev => ({ ...prev, isPublic: v }))}
            />
          </div>

          {!settings.isPublic && (
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Password</span>
              </div>
              <Input
                type="password"
                placeholder="Optional password"
                className="h-7 text-[10px]"
                value={settings.password}
                onChange={(e) => setSettings(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Expires in</span>
            </div>
            <Select
              value={settings.expiresIn}
              onValueChange={(v) => setSettings(prev => ({ ...prev, expiresIn: v as ShareSettings['expiresIn'] }))}
            >
              <SelectTrigger className="h-7 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPIRY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Visible Content
          </Label>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Timeline</span>
            <Switch
              checked={settings.showTimeline}
              onCheckedChange={(v) => setSettings(prev => ({ ...prev, showTimeline: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Position details</span>
            <Switch
              checked={settings.showPositions}
              onCheckedChange={(v) => setSettings(prev => ({ ...prev, showPositions: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Allow comments</span>
            <Switch
              checked={settings.allowComments}
              onCheckedChange={(v) => setSettings(prev => ({ ...prev, allowComments: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Watermark</span>
            <Switch
              checked={settings.watermark}
              onCheckedChange={(v) => setSettings(prev => ({ ...prev, watermark: v }))}
            />
          </div>
        </div>

        {/* Generate */}
        <div className="space-y-2 pt-1">
          <Button
            variant="default"
            size="sm"
            className="w-full h-8 text-[11px]"
            onClick={generateLink}
            disabled={generating}
          >
            {generating ? (
              <div className="w-3 h-3 border border-primary-foreground border-t-transparent rounded-full animate-spin mr-1" />
            ) : (
              <Link className="w-3 h-3 mr-1" />
            )}
            {generating ? 'Generating...' : 'Generate Share Link'}
          </Button>

          {shareLink && (
            <div className="bg-surface-2 rounded p-2 space-y-1.5">
              <div className="flex items-center gap-1">
                <Input
                  readOnly
                  value={shareLink}
                  className="h-7 text-[9px] font-mono-code bg-surface-0"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={copyLink}
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
              <p className="text-[9px] text-muted-foreground">
                {settings.isPublic ? '🌐 Anyone with the link can view' : '🔒 Password protected'}
                {' · '} Expires: {EXPIRY_LABELS[settings.expiresIn]}
              </p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-surface-2/50 rounded p-2 text-[9px] text-muted-foreground space-y-1">
          <p><strong>Show Preview Sharing</strong></p>
          <p>Generate a link for clients to view a read-only 3D simulation of your show. They can play/pause the timeline and rotate the camera.</p>
        </div>
      </div>
    </div>
  );
}
