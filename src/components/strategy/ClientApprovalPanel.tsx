import { useState } from 'react';
import { Eye, MessageSquare, FileSignature, ShieldOff } from 'lucide-react';
import { ClaimBadge } from './ClaimBadge';

interface Comment {
  id: string;
  author: string;
  text: string;
  at: string;
}

export function ClientApprovalPanel() {
  const [scope, setScope] = useState('Show NYE 2026 — 8 min · 200 drones · 30 pyro cues');
  const [version, setVersion] = useState('v3 (preview)');
  const [comments, setComments] = useState<Comment[]>([
    { id: 'c1', author: 'Client · Marketing', text: 'Make the amber finale 4 seconds longer.', at: '2 days ago' },
    { id: 'c2', author: 'Client · Producer', text: 'Confirm 30 pyro cues fit safety radius.', at: 'yesterday' },
  ]);
  const [draft, setDraft] = useState('');
  const [approved, setApproved] = useState(false);

  const addComment = () => {
    if (!draft.trim()) return;
    setComments([...comments, { id: `c${comments.length + 1}`, author: 'Client · You', text: draft.trim(), at: 'now' }]);
    setDraft('');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-background/30 p-3 flex items-start gap-2">
        <ShieldOff className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div className="text-[11px]">
          <p className="font-semibold text-foreground">Visual & contractual only</p>
          <p className="text-muted-foreground">
            Client approval covers preview version, comments and scope. <strong>Real commands stay outside this flow.</strong>
            Operational arming, firing and E-STOP remain in the Go-Live Center under operator control.
          </p>
          <div className="mt-2"><ClaimBadge status="validated" /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-md border border-border bg-background/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-3.5 w-3.5 text-primary" />
            <h5 className="text-xs font-semibold">Preview version</h5>
          </div>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs ds-mono"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Linked to a SkyCanvas previs render — read-only for the client.</p>
        </div>

        <div className="rounded-md border border-border bg-background/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileSignature className="h-3.5 w-3.5 text-primary" />
            <h5 className="text-xs font-semibold">Scope</h5>
          </div>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            rows={2}
            className="w-full bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs ds-mono resize-none"
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-background/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
          <h5 className="text-xs font-semibold">Comments</h5>
          <span className="ml-auto text-[9px] ds-mono text-muted-foreground">{comments.length}</span>
        </div>
        <ul className="space-y-2 mb-3">
          {comments.map((c) => (
            <li key={c.id} className="text-[11px]">
              <div className="flex items-center gap-2 text-[9px] ds-mono uppercase tracking-wider text-muted-foreground">
                <span>{c.author}</span><span>·</span><span>{c.at}</span>
              </div>
              <p className="text-foreground mt-0.5">{c.text}</p>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addComment()}
            placeholder="Add a comment…"
            className="flex-1 bg-background/40 border border-border rounded-md px-2 py-1.5 text-xs"
          />
          <button onClick={addComment} className="rounded-md bg-primary/10 border border-primary/40 px-3 py-1.5 text-xs ds-mono uppercase tracking-wider text-primary hover:bg-primary/20">
            Send
          </button>
        </div>
      </div>

      <button
        onClick={() => setApproved(!approved)}
        className={`w-full rounded-md border p-3 text-sm ds-mono uppercase tracking-wider transition-colors ${
          approved
            ? 'border-green-500/50 bg-green-500/10 text-green-500'
            : 'border-border bg-background/40 text-foreground hover:border-primary/40'
        }`}
      >
        {approved ? '✓ Preview approved by client' : 'Mark preview as approved'}
      </button>
    </div>
  );
}
