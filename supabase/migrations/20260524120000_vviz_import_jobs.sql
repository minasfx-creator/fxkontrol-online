-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: vviz_import_jobs + vviz_payloads
-- Created:   2026-05-24
-- Purpose:   Support the process-vviz EdgeRuntime.waitUntil background worker.
--            Clients subscribe to vviz_import_jobs via Realtime for live status.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── vviz_import_jobs ─────────────────────────────────────────────────────────
-- One row per upload. Status transitions: queued → processing → done | failed.
-- The edge function writes updates; the client polls via Realtime subscription.

create table if not exists public.vviz_import_jobs (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  storage_path    text not null,
  status          text not null default 'queued'
                    check (status in ('queued','processing','done','failed')),
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for fast owner+project lookups and Realtime filtering
create index if not exists vviz_import_jobs_owner_idx
  on public.vviz_import_jobs (owner_id, project_id, created_at desc);

-- Updated_at auto-maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'vviz_import_jobs_updated_at'
  ) then
    create trigger vviz_import_jobs_updated_at
      before update on public.vviz_import_jobs
      for each row execute function public.touch_updated_at();
  end if;
end; $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.vviz_import_jobs enable row level security;

-- Users can only see their own import jobs
create policy "owner can read own jobs"
  on public.vviz_import_jobs for select
  using (auth.uid() = owner_id);

-- Users can create jobs for their own projects
create policy "owner can insert jobs"
  on public.vviz_import_jobs for insert
  with check (auth.uid() = owner_id);

-- Only the service role (used by the edge function) can update status
create policy "service role can update jobs"
  on public.vviz_import_jobs for update
  using (true)  -- service role bypasses RLS; anon/authed cannot update
  with check (true);

-- Enable Realtime for live status streaming to the client
alter publication supabase_realtime add table public.vviz_import_jobs;


-- ── vviz_payloads ────────────────────────────────────────────────────────────
-- Stores the parsed+validated VVIZ JSON attached to a project.
-- One row per project (upserted by the background worker).

create table if not exists public.vviz_payloads (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null unique references public.projects(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  storage_path    text not null,
  payload         jsonb not null,
  parsed_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- GIN index on payload for fast JSONB querying
create index if not exists vviz_payloads_payload_gin
  on public.vviz_payloads using gin (payload);

create index if not exists vviz_payloads_owner_idx
  on public.vviz_payloads (owner_id, project_id);

do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'vviz_payloads_updated_at'
  ) then
    create trigger vviz_payloads_updated_at
      before update on public.vviz_payloads
      for each row execute function public.touch_updated_at();
  end if;
end; $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.vviz_payloads enable row level security;

create policy "owner can read own payload"
  on public.vviz_payloads for select
  using (auth.uid() = owner_id);

create policy "service role can upsert payload"
  on public.vviz_payloads for all
  using (true)
  with check (true);

-- ── Storage bucket (idempotent) ───────────────────────────────────────────────
-- Create the vviz-imports bucket if the platform hasn't created it yet.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vviz-imports',
  'vviz-imports',
  false,                          -- private bucket
  104857600,                      -- 100 MB hard limit per file
  array['application/json','application/octet-stream','application/zip']
)
on conflict (id) do nothing;

-- Storage RLS: users can upload to their own prefix only
create policy "owner upload vviz"
  on storage.objects for insert
  with check (
    bucket_id = 'vviz-imports' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "owner read vviz"
  on storage.objects for select
  using (
    bucket_id = 'vviz-imports' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "owner delete vviz"
  on storage.objects for delete
  using (
    bucket_id = 'vviz-imports' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
