import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, X, Circle, MousePointer, Wifi, WifiOff, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { joinSession, type CollaboratorPresence, type EditOperation } from '@/lib/collaborationEngine';
import { useProjectStore } from '@/store/useProjectStore';

export default function CollaborationPanel({ onClose }: { onClose: () => void }) {
  const projectId = useProjectStore(s => s.projectId);
  const projectName = useProjectStore(s => s.projectName);
  const [connected, setConnected] = useState(false);
  const [userName, setUserName] = useState('');
  const [presences, setPresences] = useState<CollaboratorPresence[]>([]);
  const [showCursors, setShowCursors] = useState(true);
  const [editLog, setEditLog] = useState<EditOperation[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [copied, setCopied] = useState(false);
  const sessionRef = useRef<ReturnType<typeof joinSession> | null>(null);

  const handleConnect = useCallback(() => {
    if (!userName.trim()) {
      toast.error('Enter your name first');
      return;
    }
    const code = roomCode || projectId || `room-${Date.now().toString(36)}`;
    setRoomCode(code);

    const userId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const session = joinSession(
      code,
      userId,
      userName.trim(),
      (p) => setPresences(p),
      (op) => setEditLog(prev => [op, ...prev].slice(0, 50)),
    );

    sessionRef.current = session;
    setConnected(true);
    toast.success('Connected to collaboration session');
  }, [userName, roomCode, projectId]);

  const handleDisconnect = useCallback(() => {
    sessionRef.current?.leave();
    sessionRef.current = null;
    setConnected(false);
    setPresences([]);
    toast.info('Disconnected from session');
  }, []);

  const copyRoomCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    toast.success('Room code copied');
    setTimeout(() => setCopied(false), 2000);
  }, [roomCode]);

  useEffect(() => {
    return () => {
      sessionRef.current?.leave();
    };
  }, []);

  const otherUsers = presences.filter(p => p.isOnline);

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border/60">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Collaboration</span>
          {connected && (
            <span className="flex items-center gap-0.5 text-[9px] text-green-400">
              <Circle className="w-1.5 h-1.5 fill-current" />
              Live
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3 text-xs">
        {!connected ? (
          <>
            {/* Join Session */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Join Session
              </Label>

              <div className="space-y-1">
                <span className="text-muted-foreground">Your Name</span>
                <Input
                  placeholder="Enter your name"
                  className="h-7 text-[10px]"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                />
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground">Room Code (optional)</span>
                <Input
                  placeholder="Leave blank to create new"
                  className="h-7 text-[10px] font-mono-code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                />
              </div>

              <Button
                variant="default"
                size="sm"
                className="w-full h-8 text-[11px]"
                onClick={handleConnect}
                disabled={!userName.trim()}
              >
                <Wifi className="w-3 h-3 mr-1" />
                Connect
              </Button>
            </div>

            <div className="bg-surface-2/50 rounded p-2 text-[9px] text-muted-foreground space-y-1">
              <p><strong>Real-Time Collaboration</strong></p>
              <p>Connect to edit the same show with other designers. Share the room code for others to join.</p>
            </div>
          </>
        ) : (
          <>
            {/* Room Info */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Room
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  readOnly
                  value={roomCode}
                  className="h-7 text-[9px] font-mono-code bg-surface-0 flex-1"
                />
                <Button variant="outline" size="icon" className="h-7 w-7 flex-shrink-0" onClick={copyRoomCode}>
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            {/* Online Users */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Online ({otherUsers.length})
              </Label>
              <div className="space-y-1">
                {otherUsers.length === 0 ? (
                  <p className="text-[9px] text-muted-foreground italic">Waiting for others to join...</p>
                ) : (
                  otherUsers.map((user) => (
                    <div
                      key={user.userId}
                      className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-surface-2/50"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: user.color }}
                      />
                      <span className="text-foreground truncate flex-1">{user.userName}</span>
                      <MousePointer className="w-2.5 h-2.5 text-muted-foreground" />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Settings
              </Label>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Show cursors</span>
                <Switch checked={showCursors} onCheckedChange={setShowCursors} />
              </div>
            </div>

            {/* Activity Log */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Activity
              </Label>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {editLog.length === 0 ? (
                  <p className="text-[9px] text-muted-foreground italic">No activity yet</p>
                ) : (
                  editLog.slice(0, 15).map((op) => (
                    <div key={op.id} className="text-[9px] text-muted-foreground px-1 py-0.5 bg-surface-2/30 rounded">
                      <span className="text-foreground">{op.type.replace(/_/g, ' ')}</span>
                      <span className="ml-1 opacity-60">
                        {new Date(op.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Disconnect */}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleDisconnect}
            >
              <WifiOff className="w-3 h-3 mr-1" />
              Disconnect
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
