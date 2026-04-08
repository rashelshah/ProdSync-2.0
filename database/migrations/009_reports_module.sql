alter table public.project_locations
  alter column name type varchar(255);

create table if not exists public.budget_tracking (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  department varchar(32) not null,
  allocated_budget numeric(14,2) not null default 0,
  actual_spent numeric(14,2) not null default 0,
  committed_spend numeric(14,2) not null default 0,
  pending_approval_amount numeric(14,2) not null default 0,
  variance numeric(14,2) generated always as (actual_spent - allocated_budget) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint budget_tracking_department_check check (
    department in ('transport', 'crew', 'camera', 'art', 'wardrobe', 'post', 'production')
  ),
  constraint budget_tracking_allocated_non_negative check (allocated_budget >= 0),
  constraint budget_tracking_actual_non_negative check (actual_spent >= 0),
  constraint budget_tracking_committed_non_negative check (committed_spend >= 0),
  constraint budget_tracking_pending_non_negative check (pending_approval_amount >= 0),
  constraint budget_tracking_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  unique (project_id, department)
);

create index if not exists idx_budget_tracking_project on public.budget_tracking (project_id, department);

drop trigger if exists trg_budget_tracking_set_updated_at on public.budget_tracking;
create trigger trg_budget_tracking_set_updated_at
before update on public.budget_tracking
for each row execute function public.set_updated_at();

create table if not exists public.report_alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  department varchar(32),
  fingerprint text not null,
  type varchar(64) not null,
  severity varchar(16) not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  constraint report_alerts_department_check check (
    department is null or department in ('transport', 'crew', 'camera', 'art', 'wardrobe', 'post', 'production')
  ),
  constraint report_alerts_severity_check check (severity in ('GREEN', 'YELLOW', 'RED')),
  constraint report_alerts_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  unique (project_id, fingerprint)
);

create index if not exists idx_report_alerts_project on public.report_alerts (project_id, resolved, created_at desc);

drop trigger if exists trg_report_alerts_set_updated_at on public.report_alerts;
create trigger trg_report_alerts_set_updated_at
before update on public.report_alerts
for each row execute function public.set_updated_at();

drop materialized view if exists public.view_daily_burn_rate;
create materialized view public.view_daily_burn_rate as
with expense_rollup as (
  select
    e.project_id,
    e.incurred_on as spend_date,
    sum(case when e.department = 'camera' then e.amount else 0 end) as camera_cost,
    sum(case when e.department = 'art' then e.amount else 0 end) as art_cost,
    sum(case when e.department = 'wardrobe' then e.amount else 0 end) as wardrobe_cost,
    sum(case when e.department = 'post' then e.amount else 0 end) as post_cost,
    sum(case when e.department = 'production' then e.amount else 0 end) as production_cost,
    sum(case when e.department = 'transport' then e.amount else 0 end) as transport_misc_cost
  from public.expenses e
  where e.status in ('approved', 'paid', 'reimbursed')
  group by e.project_id, e.incurred_on
),
vendor_rollup as (
  select
    vp.project_id,
    coalesce(vp.paid_at::date, vp.due_date, vp.created_at::date) as spend_date,
    sum(case when vp.department = 'camera' then vp.amount else 0 end) as camera_cost,
    sum(case when vp.department = 'art' then vp.amount else 0 end) as art_cost,
    sum(case when vp.department = 'wardrobe' then vp.amount else 0 end) as wardrobe_cost,
    sum(case when vp.department = 'post' then vp.amount else 0 end) as post_cost,
    sum(case when vp.department = 'production' then vp.amount else 0 end) as production_cost,
    sum(case when vp.department = 'transport' then vp.amount else 0 end) as transport_misc_cost
  from public.vendor_payments vp
  where vp.status in ('approved', 'paid')
  group by vp.project_id, coalesce(vp.paid_at::date, vp.due_date, vp.created_at::date)
),
rental_rollup as (
  select
    r.project_id,
    series.spend_date,
    sum(case when r.department = 'camera' then series.daily_amount else 0 end) as camera_cost,
    sum(case when r.department = 'art' then series.daily_amount else 0 end) as art_cost,
    sum(case when r.department = 'wardrobe' then series.daily_amount else 0 end) as wardrobe_cost,
    sum(case when r.department = 'post' then series.daily_amount else 0 end) as post_cost,
    sum(case when r.department = 'production' then series.daily_amount else 0 end) as production_cost,
    sum(case when r.department = 'transport' then series.daily_amount else 0 end) as transport_misc_cost
  from public.rentals r
  cross join lateral (
    select
      generate_series(
        r.starts_on,
        coalesce(r.ends_on, r.starts_on),
        interval '1 day'
      )::date as spend_date,
      case
        when coalesce(r.total_amount, 0) > 0 then
          r.total_amount / greatest((coalesce(r.ends_on, r.starts_on) - r.starts_on) + 1, 1)
        else coalesce(r.daily_rate, 0)
      end as daily_amount
  ) as series
  where r.status in ('active', 'returned', 'closed')
  group by r.project_id, series.spend_date
),
fuel_rollup as (
  select
    fl.project_id,
    fl.log_date as spend_date,
    sum(coalesce(fl.cost_amount, 0)) as transport_cost
  from public.fuel_logs fl
  group by fl.project_id, fl.log_date
),
wage_rollup as (
  select
    cm.project_id,
    wr.period_end as spend_date,
    sum(wr.amount) as crew_cost
  from public.wage_records wr
  join public.crew_members cm
    on cm.id = wr.crew_member_id
  where wr.status in ('approved', 'paid')
  group by cm.project_id, wr.period_end
),
payout_rollup as (
  select
    da.project_id,
    date(timezone('Asia/Kolkata', wp.created_at)) as spend_date,
    sum(wp.amount) as crew_cost
  from public.wage_payouts wp
  join public.daily_attendance da
    on da.attendance_id = wp.attendance_id
  where lower(coalesce(wp.status, '')) in ('approved', 'paid')
  group by da.project_id, date(timezone('Asia/Kolkata', wp.created_at))
),
legacy_batta_rollup as (
  select
    cm.project_id,
    br.requested_for_date as spend_date,
    sum(br.amount) as crew_cost
  from public.batta_requests br
  join public.crew_members cm
    on cm.id = br.crew_member_id
  where br.status in ('approved', 'paid')
    and coalesce(br.metadata ->> 'wagePayoutId', '') = ''
  group by cm.project_id, br.requested_for_date
),
rolled as (
  select
    fr.project_id,
    fr.spend_date,
    fr.transport_cost as transport_cost,
    0::numeric as crew_cost,
    0::numeric as camera_cost,
    0::numeric as art_cost,
    0::numeric as wardrobe_cost,
    0::numeric as post_cost,
    0::numeric as production_cost
  from fuel_rollup fr

  union all

  select
    wr.project_id,
    wr.spend_date,
    0::numeric,
    wr.crew_cost,
    0::numeric,
    0::numeric,
    0::numeric,
    0::numeric,
    0::numeric
  from wage_rollup wr

  union all

  select
    pr.project_id,
    pr.spend_date,
    0::numeric,
    pr.crew_cost,
    0::numeric,
    0::numeric,
    0::numeric,
    0::numeric,
    0::numeric
  from payout_rollup pr

  union all

  select
    br.project_id,
    br.spend_date,
    0::numeric,
    br.crew_cost,
    0::numeric,
    0::numeric,
    0::numeric,
    0::numeric,
    0::numeric
  from legacy_batta_rollup br

  union all

  select
    er.project_id,
    er.spend_date,
    er.transport_misc_cost,
    0::numeric,
    er.camera_cost,
    er.art_cost,
    er.wardrobe_cost,
    er.post_cost,
    er.production_cost
  from expense_rollup er

  union all

  select
    vr.project_id,
    vr.spend_date,
    vr.transport_misc_cost,
    0::numeric,
    vr.camera_cost,
    vr.art_cost,
    vr.wardrobe_cost,
    vr.post_cost,
    vr.production_cost
  from vendor_rollup vr

  union all

  select
    rr.project_id,
    rr.spend_date,
    rr.transport_misc_cost,
    0::numeric,
    rr.camera_cost,
    rr.art_cost,
    rr.wardrobe_cost,
    rr.post_cost,
    rr.production_cost
  from rental_rollup rr
)
select
  project_id,
  spend_date as date,
  round(sum(transport_cost), 2) as total_transport_cost,
  round(sum(crew_cost), 2) as total_crew_cost,
  round(sum(camera_cost), 2) as total_camera_cost,
  round(sum(art_cost), 2) as total_art_cost,
  round(sum(wardrobe_cost), 2) as total_wardrobe_cost,
  round(sum(post_cost), 2) as total_post_cost,
  round(sum(production_cost), 2) as total_production_cost,
  round(
    sum(transport_cost)
    + sum(crew_cost)
    + sum(camera_cost)
    + sum(art_cost)
    + sum(wardrobe_cost)
    + sum(post_cost)
    + sum(production_cost),
    2
  ) as grand_total_daily_spend
from rolled
group by project_id, spend_date;

create unique index idx_view_daily_burn_rate_project_date
  on public.view_daily_burn_rate (project_id, date);

drop materialized view if exists public.view_ot_liability;
create materialized view public.view_ot_liability as
with today_attendance as (
  select
    da.project_id,
    da.user_id,
    da.check_in_time,
    da.check_out_time,
    greatest(
      0,
      case
        when da.check_in_time is null then 0
        when da.check_out_time is not null and coalesce(da.ot_minutes, 0) > 0 then da.ot_minutes
        else floor(
          extract(
            epoch from (
              greatest(
                coalesce(da.check_out_time, timezone('utc', now())),
                (
                  (
                    date(timezone('Asia/Kolkata', coalesce(da.check_in_time, da.created_at)))
                    + time '18:00'
                  ) at time zone 'Asia/Kolkata'
                )
              )
              - greatest(
                da.check_in_time,
                (
                  (
                    date(timezone('Asia/Kolkata', coalesce(da.check_in_time, da.created_at)))
                    + time '18:00'
                  ) at time zone 'Asia/Kolkata'
                )
              )
            )
          ) / 60
        )
      end
    ) as ot_minutes
  from public.daily_attendance da
  where date(timezone('Asia/Kolkata', coalesce(da.check_in_time, da.created_at)))
    = date(timezone('Asia/Kolkata', timezone('utc', now())))
)
select
  ta.project_id,
  date(timezone('Asia/Kolkata', timezone('utc', now()))) as current_shift_date,
  count(*) filter (where ta.check_in_time is not null and ta.check_out_time is null) as active_crew_count,
  round(sum(ta.ot_minutes) / 60.0, 2) as total_ot_hours,
  round(sum(
    (
      ta.ot_minutes / 60.0
    ) * coalesce(
      nullif(cm.day_rate, 0) / greatest(nullif(cm.shift_hours_planned, 0), 1),
      0
    ) * 1.5
  ), 2) as estimated_ot_cost
from today_attendance ta
left join public.crew_members cm
  on cm.project_id = ta.project_id
 and cm.user_id = ta.user_id
group by ta.project_id;

create unique index idx_view_ot_liability_project_date
  on public.view_ot_liability (project_id, current_shift_date);

create or replace function public.refresh_reports_materialized_views()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view public.view_daily_burn_rate;
  refresh materialized view public.view_ot_liability;
end;
$$;

select public.refresh_reports_materialized_views();
