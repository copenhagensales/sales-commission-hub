create table public.salary_additions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_master_data(id) on delete cascade,
  column_key text not null check (column_key in (
    'commission','cancellations','vacationPay','diet','sickDays','dailyBonus','referralBonus'
  )),
  amount numeric not null,
  period_start date not null,
  period_end date not null,
  note text,
  created_at timestamptz default now()
);

alter table public.salary_additions enable row level security;

create policy "Auth users manage salary_additions"
  on public.salary_additions for all to authenticated using (true) with check (true);