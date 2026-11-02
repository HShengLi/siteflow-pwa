-- 在 Supabase SQL Editor 執行一次。單一使用者私有資料，非多人公司協作。
create table if not exists public.siteflow_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.siteflow_snapshots enable row level security;
revoke all on public.siteflow_snapshots from anon;
grant select, insert, update on public.siteflow_snapshots to authenticated;
drop policy if exists "snapshot_select_own" on public.siteflow_snapshots;
create policy "snapshot_select_own" on public.siteflow_snapshots for select to authenticated using (user_id = (select auth.uid()));
-- 僅透過安全的 RPC 寫入，禁止直接 update/insert。
revoke insert, update on public.siteflow_snapshots from authenticated;
create or replace function public.siteflow_save_snapshot(p_payload jsonb, p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_rev bigint;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if pg_catalog.pg_column_size(p_payload) > 4000000 then raise exception 'snapshot_too_large'; end if;
  insert into public.siteflow_snapshots(user_id,payload,revision,updated_at)
  values (v_uid,p_payload,1,now())
  on conflict (user_id) do update set payload=excluded.payload,
    revision=public.siteflow_snapshots.revision+1, updated_at=now()
  where public.siteflow_snapshots.revision = p_expected_revision
  returning revision into v_rev;
  if v_rev is null then raise exception 'revision_conflict'; end if;
  return v_rev;
end $$;
revoke all on function public.siteflow_save_snapshot(jsonb,bigint) from public, anon;
grant execute on function public.siteflow_save_snapshot(jsonb,bigint) to authenticated;
-- Supabase Storage: 私有 bucket；照片只能存取自己 user_id/ 路徑下的物件。
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('siteflow-photos','siteflow-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "siteflow_photos_read" on storage.objects;
create policy "siteflow_photos_read" on storage.objects for select to authenticated
using (bucket_id='siteflow-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "siteflow_photos_insert" on storage.objects;
create policy "siteflow_photos_insert" on storage.objects for insert to authenticated
with check (bucket_id='siteflow-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- 目前不允許覆寫或刪除雲端照片；避免跨裝置誤刪。後續可加安全清理流程。
