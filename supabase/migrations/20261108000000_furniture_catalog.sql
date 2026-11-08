create table if not exists public.furniture (
  id text primary key,
  name text not null,
  category text not null,
  styles text[] not null default '{}',
  source text not null,
  license text not null check (length(trim(license)) > 0),
  author text,
  source_url text,
  file_path text not null,
  thumbnail_path text,
  size jsonb not null,
  raw_size jsonb not null,
  raw_min jsonb not null,
  scale double precision not null default 1,
  procedural jsonb,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists furniture_published_sort_idx on public.furniture (published, sort_order, id);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists furniture_set_updated_at on public.furniture;
create trigger furniture_set_updated_at before update on public.furniture for each row execute function public.set_updated_at();

alter table public.furniture enable row level security;
alter table public.admins enable row level security;

drop policy if exists "furniture readable when published" on public.furniture;
create policy "furniture readable when published" on public.furniture
  for select to anon, authenticated
  using (published or (select public.is_admin()));

drop policy if exists "admins insert furniture" on public.furniture;
create policy "admins insert furniture" on public.furniture
  for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "admins update furniture" on public.furniture;
create policy "admins update furniture" on public.furniture
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admins delete furniture" on public.furniture;
create policy "admins delete furniture" on public.furniture
  for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists "users see own admin row" on public.admins;
create policy "users see own admin row" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('models', 'models', true, 52428800, array['model/gltf-binary', 'application/octet-stream', 'image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins upload models" on storage.objects;
create policy "admins upload models" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'models' and (select public.is_admin()));

drop policy if exists "admins update models" on storage.objects;
create policy "admins update models" on storage.objects
  for update to authenticated
  using (bucket_id = 'models' and (select public.is_admin()))
  with check (bucket_id = 'models' and (select public.is_admin()));

drop policy if exists "admins delete models" on storage.objects;
create policy "admins delete models" on storage.objects
  for delete to authenticated
  using (bucket_id = 'models' and (select public.is_admin()));
