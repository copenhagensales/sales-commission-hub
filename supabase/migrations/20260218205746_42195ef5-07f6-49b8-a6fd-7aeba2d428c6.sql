
-- KPI platform foundation: dual-read compare, health metrics and reconcile schedule metadata

create table if not exists public.kpi_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('unified', 'legacy')),
  contract_version text not null,
  scope_type text not null,
  scope_id uuid null,
  period_type text not null,
  data_as_of timestamptz not null,
  freshness_lag_seconds numeric not null default 0,
  total_sales numeric not null default 0,
  total_revenue numeric not null default 0,
  total_commission numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_kpi_health_snapshots_scope_period
  on public.kpi_health_snapshots (scope_type, scope_id, period_type, created_at desc);

-- RLS for kpi_health_snapshots
alter table public.kpi_health_snapshots enable row level security;

create policy "Teamleder+ can read kpi_health_snapshots"
  on public.kpi_health_snapshots for select
  using (public.is_teamleder_or_above(auth.uid()));

create policy "Service role can insert kpi_health_snapshots"
  on public.kpi_health_snapshots for insert
  with check (true);

create table if not exists public.kpi_dual_read_compare (
  id uuid primary key default gen_random_uuid(),
  contract_version text not null,
  scope_type text not null,
  scope_id uuid null,
  period_type text not null,
  unified_data_as_of timestamptz not null,
  legacy_data_as_of timestamptz not null,
  unified_sales numeric not null,
  legacy_sales numeric not null,
  unified_revenue numeric not null,
  legacy_revenue numeric not null,
  unified_commission numeric not null,
  legacy_commission numeric not null,
  sales_delta_pct numeric not null,
  revenue_delta_pct numeric not null,
  commission_delta_pct numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_kpi_dual_read_compare_scope_period
  on public.kpi_dual_read_compare (scope_type, scope_id, period_type, created_at desc);

-- RLS for kpi_dual_read_compare
alter table public.kpi_dual_read_compare enable row level security;

create policy "Teamleder+ can read kpi_dual_read_compare"
  on public.kpi_dual_read_compare for select
  using (public.is_teamleder_or_above(auth.uid()));

create policy "Service role can insert kpi_dual_read_compare"
  on public.kpi_dual_read_compare for insert
  with check (true);

create table if not exists public.kpi_reconcile_schedule (
  id uuid primary key default gen_random_uuid(),
  schedule_name text not null unique,
  reconcile_mode text not null check (reconcile_mode in ('mini', 'full')),
  cadence text not null,
  lookback_window text not null,
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- RLS for kpi_reconcile_schedule
alter table public.kpi_reconcile_schedule enable row level security;

create policy "Teamleder+ can read kpi_reconcile_schedule"
  on public.kpi_reconcile_schedule for select
  using (public.is_teamleder_or_above(auth.uid()));

create policy "Owners can manage kpi_reconcile_schedule"
  on public.kpi_reconcile_schedule for all
  using (public.is_owner(auth.uid()));

-- Seed reconcile schedule
insert into public.kpi_reconcile_schedule (schedule_name, reconcile_mode, cadence, lookback_window, config)
values
  ('kpi-mini-reconcile-5m', 'mini', '*/5 * * * *', '24h', jsonb_build_object('target_scopes', array['global','client','team'])),
  ('kpi-full-reconcile-nightly', 'full', '15 2 * * *', '90d', jsonb_build_object('target_scopes', array['global','client','team']))
on conflict (schedule_name) do update
set reconcile_mode = excluded.reconcile_mode,
    cadence = excluded.cadence,
    lookback_window = excluded.lookback_window,
    config = excluded.config,
    updated_at = now();
