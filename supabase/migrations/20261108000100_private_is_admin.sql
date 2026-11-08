create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

drop policy if exists "furniture readable when published" on public.furniture;
create policy "furniture readable when published" on public.furniture
  for select to anon, authenticated
  using (published or (select private.is_admin()));

drop policy if exists "admins insert furniture" on public.furniture;
create policy "admins insert furniture" on public.furniture
  for insert to authenticated
  with check ((select private.is_admin()));

drop policy if exists "admins update furniture" on public.furniture;
create policy "admins update furniture" on public.furniture
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "admins delete furniture" on public.furniture;
create policy "admins delete furniture" on public.furniture
  for delete to authenticated
  using ((select private.is_admin()));

drop policy if exists "admins upload models" on storage.objects;
create policy "admins upload models" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'models' and (select private.is_admin()));

drop policy if exists "admins update models" on storage.objects;
create policy "admins update models" on storage.objects
  for update to authenticated
  using (bucket_id = 'models' and (select private.is_admin()))
  with check (bucket_id = 'models' and (select private.is_admin()));

drop policy if exists "admins delete models" on storage.objects;
create policy "admins delete models" on storage.objects
  for delete to authenticated
  using (bucket_id = 'models' and (select private.is_admin()));

drop function if exists public.is_admin();
