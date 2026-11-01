create table if not exists public.monthly_report_overrides (
  employee_id uuid not null references public.profiles(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  employee_name text not null,
  total_points numeric not null check (total_points >= 0),
  total_units integer not null check (total_units >= 0),
  attended_days integer not null check (attended_days >= 0 and attended_days <= 31),
  absent_days integer not null check (absent_days >= 0 and absent_days <= 31),
  reported_percent numeric not null check (reported_percent >= 0),
  report_source text not null default 'company_report',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (employee_id, year, month),
  check (attended_days + absent_days <= 31)
);

alter table public.monthly_report_overrides enable row level security;

create policy monthly_report_overrides_read
on public.monthly_report_overrides
for select
to authenticated
using (
  employee_id = public.current_profile_id()
  or public.current_profile_role() in ('system_admin', 'manager', 'viewer')
);

grant select on public.monthly_report_overrides to authenticated;
