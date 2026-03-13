import { useState } from 'react';
import { X, MessageSquare, CheckCircle, XCircle, Clock, Send, ThumbsUp, ThumbsDown, User, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type CommentStatus = 'pending' | 'resolved' | 'rejected';
type ApprovalStatus = 'draft' | 'pending-review' | 'changes-requested' | 'approved';

interface ReviewComment {
  id: string;
  author: string;
  text: string;
  timestamp: number;
  status: CommentStatus;
  formationRef?: string;
  timeRef?: number;
  replies: { author: string; text: string; timestamp: number }[];
}

interface ApprovalRequest {
  id: string;
  title: string;
  status: ApprovalStatus;
  createdAt: number;
  reviewedAt?: number;
  reviewer?: string;
  comments: ReviewComment[];
}

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  draft: { label: 'Rascunho', color: 'text-muted-foreground', bg: 'bg-muted/20 border-muted/30', icon: Clock },
  'pending-review': { label: 'Aguardando Revisão', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: Clock },
  'changes-requested': { label: 'Alterações Solicitadas', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', icon: XCircle },
  approved: { label: 'Aprovado', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', icon: CheckCircle },
};

const COMMENT_STATUS_COLORS: Record<CommentStatus, string> = {
  pending: 'text-yellow-400',
  resolved: 'text-green-400',
  rejected: 'text-red-400',
};

export default function ClientApprovalPanel({ onClose }: { onClose: () => void }) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([
    {
      id: 'apr-1',
      title: 'Show Réveillon 2027 — Versão Final',
      status: 'draft',
      createdAt: Date.now(),
      comments: [],
    },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>('apr-1');
  const [newComment, setNewComment] = useState('');
  const [newReply, setNewReply] = useState<{ commentId: string; text: string } | null>(null);
  const [filter, setFilter] = useState<CommentStatus | 'all'>('all');
  const [clientName, setClientName] = useState('Cliente');

  const selected = approvals.find(a => a.id === selectedId);

  const addComment = () => {
    if (!newComment.trim() || !selected) return;
    const comment: ReviewComment = {
      id: `cmt-${Date.now()}`,
      author: clientName,
      text: newComment,
      timestamp: Date.now(),
      status: 'pending',
      replies: [],
    };
    setApprovals(prev => prev.map(a =>
      a.id === selected.id ? { ...a, comments: [...a.comments, comment] } : a
    ));
    setNewComment('');
  };

  const addReply = (commentId: string) => {
    if (!newReply?.text.trim() || !selected) return;
    setApprovals(prev => prev.map(a =>
      a.id === selected.id ? {
        ...a,
        comments: a.comments.map(c =>
          c.id === commentId ? {
            ...c,
            replies: [...c.replies, { author: 'Designer', text: newReply.text, timestamp: Date.now() }],
          } : c
        ),
      } : a
    ));
    setNewReply(null);
  };

  const setCommentStatus = (commentId: string, status: CommentStatus) => {
    if (!selected) return;
    setApprovals(prev => prev.map(a =>
      a.id === selected.id ? {
        ...a,
        comments: a.comments.map(c => c.id === commentId ? { ...c, status } : c),
      } : a
    ));
  };

  const setApprovalStatus = (status: ApprovalStatus) => {
    if (!selected) return;
    setApprovals(prev => prev.map(a =>
      a.id === selected.id ? { ...a, status, reviewedAt: Date.now(), reviewer: clientName } : a
    ));
  };

  const createNewApproval = () => {
    const newApproval: ApprovalRequest = {
      id: `apr-${Date.now()}`,
      title: `Revisão ${approvals.length + 1}`,
      status: 'draft',
      createdAt: Date.now(),
      comments: [],
    };
    setApprovals(prev => [...prev, newApproval]);
    setSelectedId(newApproval.id);
  };

  const filteredComments = selected?.comments.filter(c => filter === 'all' || c.status === filter) || [];

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">Aprovação</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Client name */}
        <div className="flex items-center gap-1">
          <User className="w-3 h-3 text-muted-foreground" />
          <Input
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            className="h-6 text-[9px] bg-surface-2"
            placeholder="Nome do revisor"
          />
        </div>

        {/* Approval list */}
        <div className="space-y-1">
          {approvals.map(a => {
            const cfg = STATUS_CONFIG[a.status];
            const Icon = cfg.icon;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={cn(
                  'w-full flex items-center gap-1.5 p-1.5 rounded-sm border text-left transition-colors',
                  selectedId === a.id ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-surface-1 hover:bg-surface-2',
                )}
              >
                <Icon className={cn('w-3 h-3 flex-shrink-0', cfg.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-foreground truncate">{a.title}</p>
                  <p className={cn('text-[7px]', cfg.color)}>{cfg.label}</p>
                </div>
                <span className="text-[7px] text-muted-foreground">{a.comments.length}💬</span>
              </button>
            );
          })}
          <Button variant="ghost" size="sm" className="w-full h-6 text-[8px]" onClick={createNewApproval}>
            + Nova Revisão
          </Button>
        </div>

        {selected && (
          <>
            {/* Status Banner */}
            <div className={cn('p-2 rounded-sm border', STATUS_CONFIG[selected.status].bg)}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn('text-[10px] font-bold uppercase', STATUS_CONFIG[selected.status].color)}>
                  {STATUS_CONFIG[selected.status].label}
                </span>
                {selected.reviewer && (
                  <span className="text-[7px] text-muted-foreground">por {selected.reviewer}</span>
                )}
              </div>
              {/* Action buttons */}
              <div className="flex gap-1 mt-1">
                {selected.status !== 'approved' && (
                  <>
                    <Button size="sm" className="h-6 text-[8px] flex-1 gap-0.5" onClick={() => setApprovalStatus('pending-review')}>
                      <Send className="w-2.5 h-2.5" />Enviar para Revisão
                    </Button>
                  </>
                )}
                {selected.status === 'pending-review' && (
                  <>
                    <Button size="sm" variant="outline" className="h-6 text-[8px] gap-0.5 text-green-400 border-green-500/30" onClick={() => setApprovalStatus('approved')}>
                      <ThumbsUp className="w-2.5 h-2.5" />Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[8px] gap-0.5 text-orange-400 border-orange-500/30" onClick={() => setApprovalStatus('changes-requested')}>
                      <ThumbsDown className="w-2.5 h-2.5" />Solicitar Alterações
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Comment filter */}
            <div className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-muted-foreground" />
              {(['all', 'pending', 'resolved', 'rejected'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'text-[7px] px-1.5 py-0.5 rounded-sm border transition-colors',
                    filter === f ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendentes' : f === 'resolved' ? 'Resolvidos' : 'Rejeitados'}
                </button>
              ))}
            </div>

            {/* Comments */}
            <div className="space-y-1.5">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">
                Comentários ({filteredComments.length})
              </span>
              {filteredComments.map(c => (
                <div key={c.id} className="p-1.5 rounded-sm border border-border/50 bg-surface-1/50 space-y-1">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1">
                      <User className="w-2.5 h-2.5 text-muted-foreground" />
                      <span className="text-[8px] font-semibold text-foreground">{c.author}</span>
                      <span className="text-[7px] text-muted-foreground">{new Date(c.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <span className={cn('text-[7px] uppercase font-bold', COMMENT_STATUS_COLORS[c.status])}>{c.status}</span>
                  </div>
                  <p className="text-[9px] text-foreground/80">{c.text}</p>

                  {/* Status controls */}
                  <div className="flex gap-0.5">
                    <button onClick={() => setCommentStatus(c.id, 'resolved')} className="text-[7px] text-green-400 hover:underline">✓ Resolver</button>
                    <button onClick={() => setCommentStatus(c.id, 'rejected')} className="text-[7px] text-red-400 hover:underline ml-2">✗ Rejeitar</button>
                  </div>

                  {/* Replies */}
                  {c.replies.map((r, ri) => (
                    <div key={ri} className="ml-3 pl-2 border-l border-border/30 mt-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[7px] font-semibold text-primary">{r.author}</span>
                        <span className="text-[6px] text-muted-foreground">{new Date(r.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[8px] text-foreground/70">{r.text}</p>
                    </div>
                  ))}

                  {/* Reply input */}
                  {newReply?.commentId === c.id ? (
                    <div className="flex gap-1 mt-1">
                      <Input
                        value={newReply.text}
                        onChange={e => setNewReply({ ...newReply, text: e.target.value })}
                        className="h-5 text-[8px] flex-1 bg-surface-2"
                        placeholder="Responder..."
                        onKeyDown={e => e.key === 'Enter' && addReply(c.id)}
                      />
                      <Button size="sm" className="h-5 w-5 p-0" onClick={() => addReply(c.id)}>
                        <Send className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewReply({ commentId: c.id, text: '' })}
                      className="text-[7px] text-primary hover:underline"
                    >
                      Responder
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* New comment */}
            <div className="space-y-1">
              <Textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Adicionar comentário..."
                className="h-14 text-[9px] bg-surface-2 resize-none"
              />
              <Button size="sm" className="w-full h-7 text-[9px] gap-1" onClick={addComment} disabled={!newComment.trim()}>
                <MessageSquare className="w-3 h-3" />
                Comentar
              </Button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 text-[7px] font-mono-code text-muted-foreground bg-surface-2 rounded-sm px-2 py-1">
              <span>📝 {selected.comments.length} comentários</span>
              <span>·</span>
              <span className="text-green-400">✓ {selected.comments.filter(c => c.status === 'resolved').length}</span>
              <span className="text-yellow-400">⏳ {selected.comments.filter(c => c.status === 'pending').length}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
