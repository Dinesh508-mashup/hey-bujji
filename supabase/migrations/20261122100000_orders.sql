-- Food orders and cab rides Amma asks for by voice.
-- Food: Bujji builds a cart -> status 'pending' -> Ravi approves or rejects on the dashboard.
--   No real order is placed from this table (demo cart; Swiggy MCP needs the owner's OAuth login).
-- Cab: simulated booking with a mock driver and OTP (status 'assigned'), shown on both screens.
-- DEMO DATA ONLY: anon key can read/write family demo-1, same as the other tables.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  family_id text not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('food', 'cab')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'assigned', 'cancelled', 'completed')),
  items jsonb not null default '[]'::jsonb,     -- food: ["banana", "bread"]
  destination text,                            -- cab: "Hospital"
  details jsonb not null default '{}'::jsonb,   -- driver, car, plate, otp, eta, source ...
  said text,                                    -- what Amma said (text only)
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists orders_family on public.orders (family_id, created_at desc);

alter table public.orders replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;

alter table public.orders enable row level security;
create policy "demo read orders" on public.orders for select to anon, authenticated using (family_id = 'demo-1');
create policy "demo add orders" on public.orders for insert to anon, authenticated with check (family_id = 'demo-1');
create policy "demo edit orders" on public.orders for update to anon, authenticated using (family_id = 'demo-1') with check (family_id = 'demo-1');
