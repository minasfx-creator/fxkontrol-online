/**
 * UserAvatarFloat — Bottom-right floating user avatar (Mockup #4).
 *
 * Sits above the timeline by default; click reveals a small popover with
 * profile info and sign-out. No new auth logic — reuses useAuth + useProfile.
 *
 * Visual: Vantablack glass per Mission Control palette memory.
 */

import { useEffect, useRef, useState } from 'react';
import { LogOut, Settings as SettingsIcon, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useNavigate } from 'react-router-dom';

interface Props {
  /** Distance from bottom (px). Used only when `inline` is false. */
  bottomOffset?: number;
  /** When true, render as an inline trigger (no fixed positioning) so the
   *  caller (Toolbar) controls placement. The popover still floats. */
  inline?: boolean;
  className?: string;
}

export default function UserAvatarFloat({ bottomOffset = 12, inline = false, className }: Props) {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!user) return null;

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('') || 'U';
  const avatarUrl = profile?.avatar_url;
  const role = profile?.role_title;

  const wrapperClass = inline
    ? cn('relative pointer-events-auto', className)
    : cn('fixed z-[60] right-3 pointer-events-auto', className);
  const wrapperStyle = inline ? undefined : { bottom: bottomOffset };

  const triggerClass = inline
    ? cn(
        'h-7 w-7 rounded-full overflow-hidden flex items-center justify-center',
        'bg-muted/30 border border-border/30',
        'hover:border-cyan-400/50 hover:bg-cyan-500/10 transition-all',
      )
    : cn(
        'h-12 w-12 rounded-full overflow-hidden flex items-center justify-center',
        'bg-[#050810]/85 backdrop-blur-xl border border-cyan-500/40',
        'shadow-[0_10px_30px_-8px_rgba(0,255,255,0.35)] hover:border-cyan-400/70 transition-all',
      );

  return (
    <div ref={ref} className={wrapperClass} style={wrapperStyle}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={displayName}
        className={triggerClass}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[11px] font-bold tracking-wider text-cyan-200">{initials}</span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 w-56 z-[60]',
            inline ? 'top-full mt-2' : 'bottom-full mb-2',
            'rounded-xl bg-[#050810]/92 backdrop-blur-xl border border-cyan-500/25',
            'shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)]',
            'p-3 text-foreground',
          )}
        >
          <div className="flex items-center gap-3 pb-2 border-b border-cyan-500/15">
            <div className="h-9 w-9 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-[11px] font-bold text-cyan-200">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold truncate">{displayName}</div>
              {role ? (
                <div className="text-[10px] text-muted-foreground truncate">{role}</div>
              ) : (
                <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
              )}
            </div>
          </div>
          <div className="pt-2 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/office?tab=profile');
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-cyan-200 hover:bg-cyan-500/10 transition-colors"
            >
              <UserIcon className="h-3.5 w-3.5" />
              Perfil
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/office?tab=settings');
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-cyan-200 hover:bg-cyan-500/10 transition-colors"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
              Configurações
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
