-- ===== 云端历史版本表（待用户执行）=====
-- 作用：在 清空/载入演示/导入/手动存档 时把整份数据快照存入本表，
--      之后任何一台设备都能查看并一键恢复云端历史。
-- 执行：Supabase 控制台 → SQL Editor → 粘贴 → Run。

create table if not exists public.user_snapshots (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  reason     text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_snapshots enable row level security;

drop policy if exists user_snapshots_owner on public.user_snapshots;
create policy user_snapshots_owner on public.user_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 只保留最近 20 份，避免无限增长
create or replace function public.prune_user_snapshots()
returns trigger language plpgsql as $$
begin
  delete from public.user_snapshots
  where user_id = new.user_id
    and id not in (
      select id from public.user_snapshots
      where user_id = new.user_id
      order by created_at desc
      limit 20
    );
  return new;
end $$;

drop trigger if exists trg_prune_user_snapshots on public.user_snapshots;
create trigger trg_prune_user_snapshots
  after insert on public.user_snapshots
  for each row execute function public.prune_user_snapshots();
