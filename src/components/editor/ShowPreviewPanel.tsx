/**
 * ShowPreviewPanel — Generate shareable show previews for clients.
 * QR code, WhatsApp/Email share, approval workflow.
 */
import { useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Share2, X, Copy, Mail, MessageCircle, QrCode, Video, CheckCircle, Send } from 'lucide-react';

interface ShowPreviewPanelProps {
  onClose?: () => void;
}

export default function ShowPreviewPanel({ onClose }: ShowPreviewPanelProps) {
  const projectName = useProjectStore((s) => s.projectName);
  const [previewUrl, setPreviewUrl] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sent, setSent] = useState(false);

  const generatePreview = async () => {
    setGenerating(true);
    // Simulate preview generation (in real app, would record canvas and upload)
    await new Promise(r => setTimeout(r, 2000));
    const fakeUrl = `https://fxkontrol.app/preview/${crypto.randomUUID().slice(0, 8)}`;
    setPreviewUrl(fakeUrl);
    setGenerating(false);
    toast.success('Preview gerado!');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(previewUrl);
    toast.success('Link copiado!');
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`🎆 Preview do show "${projectName}"\n${previewUrl}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const shareEmail = () => {
    const subject = encodeURIComponent(`Preview: ${projectName}`);
    const body = encodeURIComponent(`Olá ${clientName},\n\nSegue o preview do show "${projectName}":\n${previewUrl}\n\nAguardo aprovação!`);
    window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`, '_blank');
  };

  const sendApproval = () => {
    setSent(true);
    toast.success(`Solicitação de aprovação enviada para ${clientName || 'cliente'}!`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Preview & Share</span>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="p-3 space-y-4">
        {/* Generate section */}
        <Card className="bg-card border-border">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs text-foreground font-semibold">
              <Video className="h-4 w-4 text-primary" />
              Gerar Preview 3D
            </div>
            <p className="text-[10px] text-muted-foreground">
              Grava o show 3D e cria um link compartilhável para o cliente aprovar.
            </p>
            <Button
              size="sm"
              className="w-full h-8 text-xs"
              onClick={generatePreview}
              disabled={generating}
            >
              {generating ? 'Gerando...' : '🎬 Gerar Preview'}
            </Button>
          </CardContent>
        </Card>

        {/* Share section */}
        {previewUrl && (
          <>
            <Card className="bg-card border-border">
              <CardContent className="p-3 space-y-2">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Link do Preview</p>
                <div className="flex items-center gap-1">
                  <Input value={previewUrl} readOnly className="h-7 text-xs flex-1 font-mono" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyLink}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={shareWhatsApp}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={shareEmail}>
                    <Mail className="h-3.5 w-3.5" /> Email
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Approval workflow */}
            <Card className="bg-card border-border">
              <CardContent className="p-3 space-y-2">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Aprovação do Cliente</p>
                <Input
                  placeholder="Nome do cliente"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="h-7 text-xs"
                />
                <Input
                  placeholder="Email do cliente"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  className="h-7 text-xs"
                />
                {sent ? (
                  <div className="flex items-center gap-2 text-primary text-xs py-2">
                    <CheckCircle className="h-4 w-4" />
                    Aguardando aprovação
                  </div>
                ) : (
                  <Button size="sm" className="w-full h-8 text-xs gap-1" onClick={sendApproval} disabled={!clientName}>
                    <Send className="h-3.5 w-3.5" /> Enviar para Aprovação
                  </Button>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
