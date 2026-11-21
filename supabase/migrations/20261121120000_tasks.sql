-- Tasks and reminders the family sets from the web dashboard; the parent app
-- shows them under "From Ravi", schedules daily notifications and marks them done.
-- DEMO DATA ONLY: anon key can read/write family demo-1, same as the other tables.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id text not null references public.families(id) on delete cascade,
  kind text not null default 'custom'
    check (kind in ('medicine', 'breathing', 'chair_stand', 'memory', 'walk', 'call', 'custom')),
  title text not null,
  note text,
  time text check (time is null or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), -- daily HH:MM, null = any time
  active boolean not null default true,
  last_done_at timestamptz,
  created_by text not null default 'Ravi',
  created_at timestamptz not null default now()
);
create index if not exists tasks_family on public.tasks (family_id, time);

alter table public.tasks replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null; end $$;

alter table public.tasks enable row level security;
create policy "demo read tasks" on public.tasks for select to anon, authenticated using (family_id = 'demo-1');
create policy "demo add tasks" on public.tasks for insert to anon, authenticated with check (family_id = 'demo-1');
create policy "demo edit tasks" on public.tasks for update to anon, authenticated using (family_id = 'demo-1') with check (family_id = 'demo-1');
create policy "demo delete tasks" on public.tasks for delete to anon, authenticated using (family_id = 'demo-1');

insert into public.tasks (family_id, kind, title, note, time) values
  ('demo-1', 'medicine', 'Amlodipine (BP tablet)', 'After breakfast', '08:00'),
  ('demo-1', 'walk', 'Evening walk, 15 minutes', 'Around the colony with Lakshmi garu', '17:30'),
  ('demo-1', 'breathing', 'Breathing check', null, '19:00');
