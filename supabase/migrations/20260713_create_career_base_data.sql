create table if not exists public.career_base_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  events jsonb not null default '[]'::jsonb,
  todos jsonb not null default '[]'::jsonb,
  companies jsonb not null default '[]'::jsonb,
  memos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.career_base_data enable row level security;

revoke all on public.career_base_data from anon;
grant select, insert, update, delete on public.career_base_data to authenticated;

drop policy if exists "Users can read their own Career Base data" on public.career_base_data;
drop policy if exists "Users can insert their own Career Base data" on public.career_base_data;
drop policy if exists "Users can update their own Career Base data" on public.career_base_data;
drop policy if exists "Users can delete their own Career Base data" on public.career_base_data;

create policy "Users can read their own Career Base data" on public.career_base_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own Career Base data" on public.career_base_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own Career Base data" on public.career_base_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own Career Base data" on public.career_base_data for delete to authenticated using ((select auth.uid()) = user_id);
