-- FitCore Korvex — etapa 1 do backend no Supabase.
-- Rode uma vez no SQL Editor de um projeto Supabase só do FitCore (não use o projeto do briefing).
-- Pode rodar de novo sem perder dados.
--
-- Nesta etapa cada personal tem um "espaço de trabalho": o estado inteiro do app (alunos, treinos,
-- ciclos, registros) guardado como JSON, visível só para a própria conta. As tabelas separadas por
-- entidade (com acesso do aluno pelo próprio login) entram na etapa 2; ver docs/ARQUITETURA.md.

create table if not exists public.fitcore_workspaces (
  owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  state jsonb not null,
  schema_version integer not null,
  -- Sobe a cada gravação; o app só grava se a versão que ele leu ainda for a atual (evita uma aba apagar a outra).
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fitcore_workspaces_state_size check (pg_column_size(state) < 4000000)
);

alter table public.fitcore_workspaces enable row level security;

drop policy if exists "dono le" on public.fitcore_workspaces;
drop policy if exists "dono cria" on public.fitcore_workspaces;
drop policy if exists "dono altera" on public.fitcore_workspaces;
drop policy if exists "dono apaga" on public.fitcore_workspaces;

create policy "dono le" on public.fitcore_workspaces
  for select to authenticated using (owner = (select auth.uid()));
create policy "dono cria" on public.fitcore_workspaces
  for insert to authenticated with check (owner = (select auth.uid()));
create policy "dono altera" on public.fitcore_workspaces
  for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "dono apaga" on public.fitcore_workspaces
  for delete to authenticated using (owner = (select auth.uid()));

-- Visitantes sem login não têm acesso nenhum.
revoke all on public.fitcore_workspaces from anon;
grant select, insert, update, delete on public.fitcore_workspaces to authenticated;

create or replace function public.fitcore_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.owner := old.owner;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists fitcore_workspaces_touch on public.fitcore_workspaces;
create trigger fitcore_workspaces_touch
  before insert or update on public.fitcore_workspaces
  for each row execute function public.fitcore_touch();

-- ---------- Fotos de acompanhamento ----------
-- Bucket privado: nada é público, o app abre cada foto com um link que expira em poucos minutos.
-- Cada arquivo fica em <id da conta>/<aluno>/<avaliação>/..., e só a própria conta lê, envia ou apaga.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fitcore-fotos', 'fitcore-fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fitcore fotos dono le" on storage.objects;
drop policy if exists "fitcore fotos dono envia" on storage.objects;
drop policy if exists "fitcore fotos dono altera" on storage.objects;
drop policy if exists "fitcore fotos dono apaga" on storage.objects;

create policy "fitcore fotos dono le" on storage.objects
  for select to authenticated
  using (bucket_id = 'fitcore-fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fitcore fotos dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fitcore-fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fitcore fotos dono altera" on storage.objects
  for update to authenticated
  using (bucket_id = 'fitcore-fotos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'fitcore-fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fitcore fotos dono apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fitcore-fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
