/**
 * OfficeHubCards — top-of-page hub for the Office area.
 *
 * Renders the 6 blueprint cards (New Show / Open / Templates / Academy /
 * Reports / Devices) above the existing tab navigation. Pure presentational
 * layer that delegates routing to react-router.
 */
import { useNavigate } from 'react-router-dom';
import {
  Plus, FolderOpen, LayoutTemplate, GraduationCap, BarChart3, Cable,
} from 'lucide-react';
import ActionCard from '@/features/create-flow/components/ActionCard';

interface Props {
  onOpenProject?: () => void;
}

export default function OfficeHubCards({ onOpenProject }: Props) {
  const navigate = useNavigate();
  return (
    <div className="px-4 sm:px-6 pt-6 pb-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">O que você quer fazer?</h1>
          <p className="text-xs text-muted-foreground mt-1">Office Dashboard — pontos de partida do FX KONTROL.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ActionCard
            icon={Plus}
            title="Criar Novo Show"
            description="Do zero, com template ou via IA."
            onClick={() => navigate('/create')}
          />
          <ActionCard
            icon={FolderOpen}
            title="Abrir Projeto"
            description="Continuar um show recente."
            onClick={() => onOpenProject?.()}
            disabled={!onOpenProject}
          />
          <ActionCard
            icon={LayoutTemplate}
            title="Templates"
            description="Pacotes prontos PYRO, DRONES, LIGHT."
            onClick={() => navigate('/create/template')}
          />
          <ActionCard
            icon={GraduationCap}
            title="Academy"
            description="Tutoriais e simulação guiada."
            onClick={() => navigate('/office?tab=training')}
          />
          <ActionCard
            icon={BarChart3}
            title="Relatórios"
            description="KPIs e relatórios executivos."
            onClick={() => navigate('/office?tab=reports')}
          />
          <ActionCard
            icon={Cable}
            title="Hardware / Devices"
            description="Pareamento, USB, BLE, Art-Net."
            onClick={() => navigate('/pairing/usb')}
          />
        </div>
      </div>
    </div>
  );
}
