/**
 * OfficeHubCards — top-of-page hub for the Office area.
 *
 * Renders the 6 blueprint cards (New Show / Open / Templates / Academy /
 * Reports / Devices) above the existing tab navigation, using the
 * FXKONTROL Design System v1 tokens (Vantablack panels, cyan accents).
 */
import { useNavigate } from 'react-router-dom';
import {
  Plus, FolderOpen, LayoutTemplate, GraduationCap, BarChart3, Cable, LayoutGrid,
  type LucideIcon,
} from 'lucide-react';
import { DsCard, DsCardTitle, DsCardDescription, DsCardCta } from '@/components/ds';

interface Props {
  onOpenProject?: () => void;
}

interface HubAction {
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  onClick?: () => void;
  disabled?: boolean;
}

function HubActionCard({ icon: Icon, title, description, cta, onClick, disabled }: HubAction) {
  return (
    <DsCard
      interactive={!disabled}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && onClick?.()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={disabled ? 'opacity-50 cursor-not-allowed' : ''}
    >
      <div className="flex items-start gap-ds-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-ds-md border border-ds-border-subtle bg-ds-surface-elevated text-status-sync">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <DsCardTitle className="text-[15px]">{title}</DsCardTitle>
          <DsCardDescription className="mt-1 text-[12px]">{description}</DsCardDescription>
        </div>
      </div>
      <DsCardCta>{cta}</DsCardCta>
    </DsCard>
  );
}

export default function OfficeHubCards({ onOpenProject }: Props) {
  const navigate = useNavigate();

  const actions: HubAction[] = [
    { icon: Plus,           title: 'Criar Novo Show',  description: 'Do zero, com template ou via IA.',         cta: 'Criar →',     onClick: () => navigate('/create') },
    { icon: FolderOpen,     title: 'Abrir Projeto',    description: 'Continuar um show recente.',               cta: 'Abrir →',     onClick: () => onOpenProject?.(), disabled: !onOpenProject },
    { icon: LayoutTemplate, title: 'Templates',        description: 'Pacotes prontos PYRO, DRONES, LIGHT.',     cta: 'Browse →',    onClick: () => navigate('/create/template') },
    { icon: GraduationCap,  title: 'Academy',          description: 'Tutoriais e simulação guiada.',            cta: 'Aprender →',  onClick: () => navigate('/office?tab=training') },
    { icon: BarChart3,      title: 'Relatórios',       description: 'KPIs e relatórios executivos.',            cta: 'Ver →',       onClick: () => navigate('/office?tab=reports') },
    { icon: Cable,          title: 'Hardware / Devices', description: 'Pareamento, USB, BLE, Art-Net.',         cta: 'Conectar →',  onClick: () => navigate('/pairing/usb') },
  ];

  return (
    <div className="bg-ds-background px-ds-4 sm:px-ds-6 pt-ds-6 pb-ds-4">
      <div className="mx-auto max-w-6xl space-y-ds-4">
        <header>
          <h1 className="text-[20px] sm:text-[24px] font-semibold text-ds-text-primary">
            O que você quer fazer?
          </h1>
          <p className="mt-1 ds-caption">
            Office Dashboard — pontos de partida do FX KONTROL.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-ds-3 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map((a) => (
            <HubActionCard key={a.title} {...a} />
          ))}
        </div>
      </div>
    </div>
  );
}
