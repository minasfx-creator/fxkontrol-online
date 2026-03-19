import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Minimize2, Users, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import minasfxLogo from '@/assets/minasfx-logo-white.png';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  isOwn: boolean;
  avatar?: string;
}

const MOCK_CONTACTS = [
  { id: '1', name: 'Carlos Silva', status: 'online', role: 'Pyro Tech' },
  { id: '2', name: 'Ana Costa', status: 'online', role: 'Drone Pilot' },
  { id: '3', name: 'Pedro Lima', status: 'away', role: 'SFX Operator' },
  { id: '4', name: 'Julia Santos', status: 'offline', role: 'Show Director' },
];

const MOCK_MESSAGES: ChatMessage[] = [
  { id: '1', sender: 'Carlos Silva', text: 'O rack 3 está calibrado, pode disparar a sequência.', time: '14:32', isOwn: false },
  { id: '2', sender: 'Você', text: 'Perfeito! Vou iniciar o teste do módulo A em 5 min.', time: '14:33', isOwn: true },
  { id: '3', sender: 'Carlos Silva', text: 'OK, estou monitorando os canais DMX daqui.', time: '14:34', isOwn: false },
];

export function Messenger() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(2);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'Você',
      text: input.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
    };
    setMessages(prev => [...prev, msg]);
    setInput('');
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setUnread(0); }}
        className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 transition-transform"
      >
        <MessageCircle className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    );
  }

  if (minimized) {
    return (
      <div
        className="fixed bottom-5 right-5 z-50 w-64 rounded-xl bg-[hsl(var(--surface-1))] border border-border shadow-2xl cursor-pointer"
        onClick={() => setMinimized(false)}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <img src={minasfxLogo} alt="MinasFX" className="h-4 object-contain" />
          <span className="text-xs font-medium text-foreground flex-1">Messenger</span>
          <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" />
        </div>
      </div>
    );
  }

  const statusColor = (s: string) =>
    s === 'online' ? 'bg-emerald-400' : s === 'away' ? 'bg-yellow-400' : 'bg-muted-foreground/30';

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 h-[480px] rounded-xl bg-[hsl(var(--surface-1))] border border-border shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-[hsl(var(--surface-0))]">
        <img src={minasfxLogo} alt="MinasFX" className="h-4 object-contain" />
        <span className="text-xs font-semibold text-foreground flex-1">Messenger</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMinimized(true)}>
          <Minimize2 className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {!activeChat ? (
        /* Contacts list */
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2">
            <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Equipe Online</span>
          </div>
          {MOCK_CONTACTS.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveChat(c.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/20 transition-colors text-left"
            >
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary">{c.name.split(' ').map(n => n[0]).join('')}</span>
                </div>
                <div className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--surface-1))]', statusColor(c.status))} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                <p className="text-[9px] text-muted-foreground">{c.role}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Chat view */
        <>
          <button
            onClick={() => setActiveChat(null)}
            className="flex items-center gap-2 px-3 py-2 border-b border-border/30 hover:bg-muted/10 transition-colors"
          >
            <span className="text-[10px] text-primary">← Voltar</span>
            <span className="text-xs font-medium text-foreground">
              {MOCK_CONTACTS.find(c => c.id === activeChat)?.name}
            </span>
          </button>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={cn('flex flex-col max-w-[80%]', msg.isOwn ? 'ml-auto items-end' : 'items-start')}
              >
                <div className={cn(
                  'px-3 py-1.5 rounded-xl text-[11px] leading-relaxed',
                  msg.isOwn
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-[hsl(var(--surface-2))] text-foreground rounded-bl-sm'
                )}>
                  {msg.text}
                </div>
                <span className="text-[8px] text-muted-foreground/50 mt-0.5 px-1">{msg.time}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-2 border-t border-border/30">
            <div className="flex gap-1.5">
              <Input
                placeholder="Mensagem..."
                className="h-8 text-[11px] bg-[hsl(var(--surface-0))] border-border/50 flex-1"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={sendMessage} disabled={!input.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
