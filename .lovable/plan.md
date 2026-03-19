

# Plano: Plataforma Profissional de Eventos — Hub Completo

Transformar o FX KONTROL de um editor 3D puro em uma **plataforma completa para profissionais de eventos**, com dashboard principal, agenda de eventos, news ticker, e módulo de simulação de montagem de palco.

---

## Arquitetura de Navegação

Atualmente: Login → Editor 3D direto.
Novo fluxo: Login → **Dashboard Hub** com sidebar → Navegar entre módulos.

```text
/auth          → Login/Signup (já existe)
/              → Dashboard Hub (novo)
/editor        → Editor 3D (mover Index atual)
/agenda        → Agenda de Eventos (novo)
/training      → Simulador de Montagem (novo)
```

---

## 1. App Router + Sidebar Layout

Reestruturar `App.tsx` com layout compartilhado usando **SidebarProvider** do shadcn. A sidebar terá:
- **Dashboard** — visão geral, métricas, projetos recentes
- **Editor 3D** — o editor atual (Index.tsx movido para /editor)
- **Agenda** — calendário de próximos eventos
- **Training** — simulação de montagem em terceira pessoa
- **News ticker** lateral — feed de notícias do mundo dos eventos

**Arquivos**: `App.tsx`, novo `src/components/AppSidebar.tsx`, novo `src/layouts/MainLayout.tsx`

---

## 2. Dashboard Hub (página principal `/`)

Página com cards e widgets:
- **Projetos Recentes** — lista dos projetos salvos com preview
- **Próximos Eventos** — preview da agenda (3 próximos)
- **Quick Stats** — total de shows, horas de simulação, equipamentos
- **Ações Rápidas** — Novo Projeto, Abrir Editor, Iniciar Simulação
- **News Ticker** sidebar — feed scrollante estilo bolsa de valores

**Arquivo**: Novo `src/pages/Dashboard.tsx`

---

## 3. News Ticker — Notícias do Mundo dos Eventos

Sidebar vertical com feed scrollante automático estilo terminal financeiro:
- Título curto + timestamp + categoria (Pirotecnia, Drones, SFX, Iluminação, Festivais)
- Cores por categoria (verde = positivo, vermelho = alerta, amarelo = tendência)
- Dados mock iniciais (notícias reais do setor)
- Animação de scroll contínuo vertical
- Ícone de "pulse" para notícias recentes

**Arquivo**: Novo `src/components/NewsTicker.tsx`

---

## 4. Agenda de Eventos (`/agenda`)

Calendário profissional com:
- **Visão mensal** com eventos marcados
- **Lista de próximos eventos** com detalhes (local, cliente, tipo, equipamentos)
- **Formulário de novo evento** (nome, data, local, cliente, notas, tipo: pyro/drone/sfx/misto)
- **Status**: planejado, confirmado, em montagem, executado
- Persistência no banco via nova tabela `events`

**Arquivos**: Novo `src/pages/Agenda.tsx`, migration para tabela `events`

---

## 5. Simulador de Montagem de Palco (`/training`)

Modo de simulação em **terceira pessoa** onde o usuário:
- Vê um palco 3D (reutiliza SFXStageEnvironment)
- Tem um inventário lateral de equipamentos (treliças, canhões, flamers, sparkulars, fog machines)
- Faz **drag-and-drop** dos equipamentos para posições no palco
- Vê feedback visual de montagem (snap to truss, snap to floor)
- **Score/progresso** — completar montagem de setups predefinidos (tutorial)
- Controles de câmera em terceira pessoa ao redor do palco

**Arquivo**: Novo `src/pages/Training.tsx`

---

## 6. Tabela `events` no Banco

```sql
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  event_date date,
  event_time time,
  location text DEFAULT '',
  client_name text DEFAULT '',
  event_type text DEFAULT 'mixed',
  status text DEFAULT 'planned',
  notes text DEFAULT '',
  project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own events"
  ON public.events FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Resumo de Entregas

| Ação | Arquivo | O que faz |
|------|---------|-----------|
| Criar | `src/layouts/MainLayout.tsx` | Layout com sidebar + news ticker |
| Criar | `src/components/AppSidebar.tsx` | Sidebar de navegação principal |
| Criar | `src/components/NewsTicker.tsx` | Feed de notícias estilo bolsa de valores |
| Criar | `src/pages/Dashboard.tsx` | Hub principal com projetos e stats |
| Criar | `src/pages/Agenda.tsx` | Calendário e agenda de eventos |
| Criar | `src/pages/Training.tsx` | Simulador de montagem em 3a pessoa |
| Editar | `App.tsx` | Novas rotas + MainLayout wrapper |
| Editar | `src/pages/Index.tsx` | Mover para rota /editor |
| Migration | `events` table | Tabela de eventos com RLS |

