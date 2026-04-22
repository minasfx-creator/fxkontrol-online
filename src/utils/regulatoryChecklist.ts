/**
 * regulatoryChecklist — Mandatory documents per regulatory agency
 */

export type AgencyType = 'exercito' | 'decea' | 'bombeiros' | 'prefeitura' | 'anac';

export interface ChecklistItem {
  id: string;
  name: string;
  description: string;
  required: boolean;
  category: 'legal' | 'technical' | 'safety' | 'financial' | 'operational';
}

export interface AgencyChecklist {
  agency: AgencyType;
  label: string;
  fullName: string;
  icon: string;
  items: ChecklistItem[];
}

export const AGENCY_LABELS: Record<AgencyType, string> = {
  exercito: 'Exército (SFPC)',
  decea: 'DECEA / NOTAM',
  bombeiros: 'Corpo de Bombeiros',
  prefeitura: 'Prefeitura Municipal',
  anac: 'ANAC (Drones)',
};

export const REGULATORY_CHECKLISTS: AgencyChecklist[] = [
  {
    agency: 'exercito',
    label: 'Exército (SFPC)',
    fullName: 'Serviço de Fiscalização de Produtos Controlados',
    icon: '🪖',
    items: [
      { id: 'ex-cr', name: 'Certificado de Registro (CR)', description: 'CR válido e atualizado junto ao SFPC regional', required: true, category: 'legal' },
      { id: 'ex-tr', name: 'Título de Registro (TR)', description: 'TR para operação com produtos controlados', required: true, category: 'legal' },
      { id: 'ex-guia', name: 'Guia de Tráfego', description: 'Guia de tráfego para transporte dos produtos controlados', required: true, category: 'operational' },
      { id: 'ex-relacao', name: 'Relação de Produtos', description: 'Lista detalhada de todos os artefatos pirotécnicos (calibre, quantidade, NE)', required: true, category: 'technical' },
      { id: 'ex-r105', name: 'Conformidade R-105', description: 'Declaração de conformidade com o Regulamento R-105', required: true, category: 'legal' },
      { id: 'ex-blaster', name: 'Certificado de Habilitação (Blaster)', description: 'Certificado do responsável técnico para manuseio', required: true, category: 'technical' },
      { id: 'ex-seguro', name: 'Seguro RC Produtos Controlados', description: 'Seguro de Responsabilidade Civil para operação com explosivos', required: true, category: 'financial' },
      { id: 'ex-local', name: 'Croqui do Local de Armazenamento', description: 'Planta do depósito/paiol conforme normas do Exército', required: false, category: 'safety' },
    ],
  },
  {
    agency: 'decea',
    label: 'DECEA / NOTAM',
    fullName: 'Departamento de Controle do Espaço Aéreo',
    icon: '✈️',
    items: [
      { id: 'dc-notam', name: 'Solicitação de NOTAM', description: 'Formulário de solicitação ao SRPV regional (mínimo 72h antecedência)', required: true, category: 'legal' },
      { id: 'dc-coords', name: 'Coordenadas GPS do Evento', description: 'Coordenadas em graus/minutos/segundos do centro do evento', required: true, category: 'technical' },
      { id: 'dc-raio', name: 'Raio de Restrição (NM)', description: 'Raio de restrição em milhas náuticas (tipicamente 1-3 NM)', required: true, category: 'safety' },
      { id: 'dc-alt', name: 'Altitude Máxima (pés AGL)', description: 'Altitude máxima dos efeitos em pés acima do solo', required: true, category: 'technical' },
      { id: 'dc-periodo', name: 'Período (Data/Hora UTC)', description: 'Data e horário de início/fim em UTC e local', required: true, category: 'operational' },
      { id: 'dc-resp', name: 'Responsável Técnico', description: 'Nome, CPF e contato do responsável técnico', required: true, category: 'legal' },
      { id: 'dc-kmz', name: 'Arquivo KMZ', description: 'Arquivo KMZ com zonas de segurança para visualização', required: false, category: 'technical' },
    ],
  },
  {
    agency: 'bombeiros',
    label: 'Corpo de Bombeiros',
    fullName: 'Corpo de Bombeiros Militar',
    icon: '🚒',
    items: [
      { id: 'bm-avcb', name: 'AVCB / CLCB', description: 'Auto de Vistoria ou Certificado de Licença do Corpo de Bombeiros', required: true, category: 'legal' },
      { id: 'bm-plano', name: 'Plano de Segurança', description: 'Plano de prevenção e combate a incêndio do evento', required: true, category: 'safety' },
      { id: 'bm-laudo', name: 'Laudo Técnico de Segurança', description: 'Laudo assinado por engenheiro responsável', required: true, category: 'technical' },
      { id: 'bm-art', name: 'ART (Anotação de Responsabilidade Técnica)', description: 'ART registrada no CREA para a operação', required: true, category: 'legal' },
      { id: 'bm-planta', name: 'Planta de Distanciamento', description: 'Planta com raios de segurança conforme NFPA 1123', required: true, category: 'safety' },
      { id: 'bm-extintores', name: 'Relação de Extintores', description: 'Lista e posicionamento de extintores no local', required: false, category: 'safety' },
    ],
  },
  {
    agency: 'prefeitura',
    label: 'Prefeitura Municipal',
    fullName: 'Prefeitura Municipal — Licenciamento de Eventos',
    icon: '🏛️',
    items: [
      { id: 'pf-alvara', name: 'Alvará de Funcionamento', description: 'Alvará da empresa válido para o exercício', required: true, category: 'legal' },
      { id: 'pf-licenca', name: 'Licença de Evento', description: 'Autorização municipal para realização do evento', required: true, category: 'legal' },
      { id: 'pf-seguro', name: 'Seguro de Responsabilidade Civil', description: 'Seguro RC cobrindo o evento e público', required: true, category: 'financial' },
      { id: 'pf-contrato', name: 'Contrato Social da Empresa', description: 'Contrato social atualizado', required: true, category: 'legal' },
      { id: 'pf-ambiental', name: 'Licença Ambiental', description: 'Licença ambiental se em área de proteção', required: false, category: 'legal' },
    ],
  },
  {
    agency: 'anac',
    label: 'ANAC (Drones)',
    fullName: 'Agência Nacional de Aviação Civil — RPAS/Drones',
    icon: '🤖',
    items: [
      { id: 'an-sisant', name: 'Registro SISANT', description: 'Registro de todas as aeronaves não tripuladas no SISANT/ANAC', required: true, category: 'legal' },
      { id: 'an-sarpas', name: 'Autorização SARPAS', description: 'Autorização de voo via SARPAS/DECEA', required: true, category: 'legal' },
      { id: 'an-piloto', name: 'Certificado do Piloto', description: 'Certificado de habilitação do piloto remoto', required: true, category: 'technical' },
      { id: 'an-seguro', name: 'Seguro RETA', description: 'Seguro obrigatório para aeronaves não tripuladas', required: true, category: 'financial' },
      { id: 'an-rbac', name: 'Conformidade RBAC-E nº 94', description: 'Declaração de conformidade com RBAC-E nº 94', required: true, category: 'legal' },
      { id: 'an-manual', name: 'Manual de Operações', description: 'Manual de operações do drone show', required: false, category: 'operational' },
      { id: 'an-classe', name: 'Classificação de Operação', description: 'Documentação da classe de operação (1, 2 ou 3)', required: true, category: 'technical' },
    ],
  },
];

export function getChecklistForAgency(agency: AgencyType): AgencyChecklist | undefined {
  return REGULATORY_CHECKLISTS.find(c => c.agency === agency);
}

export function getRequiredItems(agency: AgencyType): ChecklistItem[] {
  const checklist = getChecklistForAgency(agency);
  return checklist?.items.filter(i => i.required) ?? [];
}
