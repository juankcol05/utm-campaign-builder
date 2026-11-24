-- Shared schema for Banfondesa UTM Campaign Builder.
-- Ejecutar solo en un proyecto de Supabase autorizado.
create schema if not exists private;
create table if not exists public.utm_team_members (
  email text primary key,
  is_admin boolean not null default false,
  added_at timestamptz not null default now()
);
alter table public.utm_team_members enable row level security;
create table if not exists public.utm_links (
  id bigint generated always as identity primary key,
  client_id text not null unique,
  created_at timestamptz not null default now(),
  label text not null default '',
  source text not null,
  medium text not null,
  campaign text not null,
  term text not null default '',
  content text not null default '',
  destination_url text not null,
  generated_url text not null,
  short_url text not null default '',
  constraint utm_links_valid_destination check (destination_url ~* '^https?://'),
  constraint utm_links_valid_generated check (generated_url ~* '^https?://')
);
create index if not exists utm_links_created_at_idx on public.utm_links (created_at desc);
alter table public.utm_links enable row level security;
create or replace function private.is_utm_member()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.utm_team_members m
    where auth.uid() is not null
      and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );
$$;
create or replace function private.is_utm_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.utm_team_members m
    where auth.uid() is not null
      and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      and m.is_admin
      and (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );
$$;
create or replace function public.utm_membership()
returns boolean language sql stable security invoker set search_path = ''
as $ select private.is_utm_member(); $;
revoke all on public.utm_links from anon, authenticated;
revoke all on public.utm_team_members from anon, authenticated;
revoke all on function public.utm_membership() from public, anon;
revoke all on function private.is_utm_member() from public, anon;
revoke all on function private.is_utm_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_utm_member() to authenticated;
grant execute on function private.is_utm_admin() to authenticated;
grant execute on function public.utm_membership() to authenticated;
grant select, insert, delete on public.utm_links to authenticated;
grant update (short_url) on public.utm_links to authenticated;
drop policy if exists "utm_read_team" on public.utm_links;
create policy "utm_read_team" on public.utm_links for select to authenticated using (private.is_utm_member());
drop policy if exists "utm_insert_team" on public.utm_links;
create policy "utm_insert_team" on public.utm_links for insert to authenticated with check (private.is_utm_member());
drop policy if exists "utm_update_short_team" on public.utm_links;
create policy "utm_update_short_team" on public.utm_links for update to authenticated
using (private.is_utm_member()) with check (private.is_utm_member());
drop policy if exists "utm_delete_admin" on public.utm_links;
create policy "utm_delete_admin" on public.utm_links for delete to authenticated using (private.is_utm_admin());
-- Ejecutar una sola vez; si la tabla ya participa en Realtime, no repetir.
do $
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'utm_links'
  ) then
    alter publication supabase_realtime add table public.utm_links;
  end if;
end $;
-- Primer administrador, ejemplo. Reemplazar con correo real autorizado:
-- insert into public.utm_team_members (email, is_admin)
-- values ('responsable@empresa.com', true)
-- on conflict (email) do update set is_admin = excluded.is_admin;
