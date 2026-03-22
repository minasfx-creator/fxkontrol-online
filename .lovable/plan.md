

# Persistência Art-Net Modules no Banco de Dados

## Objetivo
Salvar/carregar configuração do controlador Art-Net e seus módulos FXK-M1 no banco de dados, vinculados ao projeto ativo, para que sobrevivam entre sessões.

## 1. Criar tabela `artnet_modules`

Migration SQL:
```sql
CREATE TABLE public.artnet_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'MODULE',
  module_address integer NOT NULL DEFAULT 0,
  dmx_universe integer NOT NULL DEFAULT 0,
  dmx_subnet integer NOT NULL DEFAULT 0,
  dmx_net integer NOT NULL DEFAULT 0,
  dmx_start_address integer NOT NULL DEFAULT 1,
  dmx_channel_count integer NOT NULL DEFAULT 32,
  ip text NOT NULL DEFAULT '192.168.1.100',
  port integer NOT NULL DEFAULT 6454,
  transport text NOT NULL DEFAULT 'lan',
  relay_token text,
  channel_count integer NOT NULL DEFAULT 32,
  label text,
  relay_server_url text,
  gps_lat numeric,
  gps_lng numeric,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.artnet_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own artnet modules"
  ON public.artnet_modules FOR ALL TO authenticated
  USING (is_project_owner(project_id))
  WITH CHECK (is_project_owner(project_id));
```

## 2. Criar hook `useArtNetModulePersistence`

**Arquivo**: `src/hooks/useArtNetModulePersistence.ts`

- Recebe `projectId` do store
- On mount: carrega módulos da tabela `artnet_modules` e popula o `artnetModuleService`
- Ao adicionar/remover/editar módulo: upsert/delete na tabela
- Debounce de 500ms para updates frequentes (latência, GPS, etc. ficam apenas em memória)
- Apenas dados de configuração são persistidos (IP, transport, DMX addressing, label, GPS)

## 3. Integrar no ArtNetModulePanel

- Importar `useArtNetModulePersistence(projectId)` no painel
- Obter `projectId` do `useProjectStore`
- Chamar `saveModule()` após `handleAddModule`
- Chamar `deleteModule()` após remove
- Carregar módulos salvos no `useEffect` inicial

## Arquivos
1. **Migration**: Nova tabela `artnet_modules` com RLS
2. **Novo**: `src/hooks/useArtNetModulePersistence.ts`
3. **Editar**: `src/components/editor/live-firing/ArtNetModulePanel.tsx` — integrar persistence hook

