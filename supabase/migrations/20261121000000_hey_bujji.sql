-- Hey Bujji demo schema. DEMO DATA ONLY: there is no sign-in, so the anon key
-- can read and write family demo-1. Drop or lock these tables after the event.

create table if not exists public.families (
  id text primary key,
  parent_name text not null,
  parent_age int,
  parent_city text,
  son_name text,
  son_city text
);

create table if not exists public.medicines (
  id uuid primary key default gen_random_uuid(),
  family_id text not null references public.families(id) on delete cascade,
  name text not null,
  purpose text,
  variants text[] not null default '{}',
  dose_times text[] not null default '{}'
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  family_id text not null references public.families(id) on delete cascade,
  name text not null,
  relation text not null,
  phone text not null,
  nicknames text[] not null default '{}'
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  family_id text not null references public.families(id) on delete cascade,
  type text not null,          -- medicine_taken | reminder_set | call | red_flag | scam | breathing | chair_stand | memory
  summary text not null,       -- what Ravi sees on the dashboard
  details jsonb not null default '{}',
  urgency text not null default 'normal' check (urgency in ('normal', 'high', 'urgent')),
  sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists events_family_time on public.events (family_id, created_at desc);

-- Live feed for the son's dashboard
alter table public.events replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;

-- Demo-scoped access for the anon key (family demo-1 only)
alter table public.families enable row level security;
alter table public.medicines enable row level security;
alter table public.contacts enable row level security;
alter table public.events enable row level security;

create policy "demo read families" on public.families for select to anon, authenticated using (id = 'demo-1');
create policy "demo read medicines" on public.medicines for select to anon, authenticated using (family_id = 'demo-1');
create policy "demo read contacts" on public.contacts for select to anon, authenticated using (family_id = 'demo-1');
create policy "demo read events" on public.events for select to anon, authenticated using (family_id = 'demo-1');
create policy "demo add events" on public.events for insert to anon, authenticated with check (family_id = 'demo-1' and sample = false);
create policy "demo reset events" on public.events for delete to anon, authenticated using (family_id = 'demo-1' and sample = false);

-- Evaluation clips recorded in the app (consented, deleted after the event)
insert into storage.buckets (id, name, public) values ('eval-clips', 'eval-clips', false)
on conflict (id) do nothing;
create policy "demo upload eval clips" on storage.objects for insert to anon, authenticated with check (bucket_id = 'eval-clips');
create policy "demo read eval clips" on storage.objects for select to anon, authenticated using (bucket_id = 'eval-clips');

-- ---------- seed: the fixed demo family ----------
insert into public.families (id, parent_name, parent_age, parent_city, son_name, son_city)
values ('demo-1', 'Amma', 68, 'Vijayawada', 'Ravi', 'Bengaluru')
on conflict (id) do nothing;

insert into public.medicines (family_id, name, purpose, variants, dose_times) values
  ('demo-1', 'Amlodipine', 'bp', array['amlo', 'amlong', 'amlodipin', 'BP tablet'], array['08:00']),
  ('demo-1', 'Metformin', 'sugar', array['glycomet', 'metformin', 'sugar tablet'], array['08:00', '20:00']);

-- Replace these placeholder numbers with real ones before the demo so the dialler opens a real contact.
insert into public.contacts (family_id, name, relation, phone, nicknames) values
  ('demo-1', 'Ravi', 'son', '+919000000001', array['ravi', 'abbayi', 'abbai', 'babu', 'koduku', 'beta', 'bete', 'son']),
  ('demo-1', 'Priya', 'daughter', '+919000000002', array['priya', 'ammayi', 'ammai', 'kuthuru', 'beti', 'bitiya', 'daughter']);

insert into public.events (family_id, type, summary, urgency, sample, created_at, details) values
  ('demo-1', 'medicine_taken', 'Amma took Amlodipine (BP) (sample)', 'normal', true, now() - interval '1 day 2 hours', '{"source":"sample"}'),
  ('demo-1', 'reminder_set', 'Amma set a reminder: Metformin at 8:00 PM (sample)', 'normal', true, now() - interval '1 day 1 hour', '{"source":"sample"}'),
  ('demo-1', 'breathing', 'Breathing check: 16 breaths/min, steady (sample)', 'normal', true, now() - interval '20 hours', '{"source":"sample"}');
