-- ===== 我的财务台 · 云同步数据库结构（Supabase）=====
-- 用途：单人使用的个人财务管理（用户名+密码登录，注册后关闭开放注册）
-- 说明：数据以整份 JSON 文档形式存储（个人体量足够），端到端加密的密码箱密文也在其中/单独字段。

-- 1) 用户主数据（整份账本 JSON）
create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) 用户资料（用户名映射 + 找回邮箱 + 密码箱密文）
create table if not exists public.user_meta (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email    text,
  vault    jsonb,               -- 密码保险箱密文 {salt,iv,data}
  created_at timestamptz not null default now()
);

-- 行级安全：只允许本人读写自己的数据
alter table public.user_state enable row level security;
alter table public.user_meta  enable row level security;

drop policy if exists user_state_owner on public.user_state;
create policy user_state_owner on public.user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_meta_owner on public.user_meta;
create policy user_meta_owner on public.user_meta
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 实时同步（一处修改，其它设备自动更新）
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.user_state;
  end if;
end $$;

-- 触发更新时间
create or replace function public.touch_user_state()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_user_state on public.user_state;
create trigger trg_user_state before update on public.user_state
  for each row execute function public.touch_user_state();
