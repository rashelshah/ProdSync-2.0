-- Dashboard and reporting views.

create or replace view public.project_summary
with (security_invoker = true)
as
select
  p.id as project_id,
  p.name,
  p.slug,
  p.owner_id,
  owner.full_name as owner_name,
  p.status,
  p.location,
  p.start_date,
  p.end_date,
  p.budget,
  p.currency_code,
  coalesce(member_stats.active_members, 0) as active_member_count,
  coalesce(member_stats.active_crew_members, 0) as active_crew_count,
  coalesce(finance.total_spend, 0) as total_spend,
  coalesce(finance.pending_approvals, 0) as pending_approval_amount,
  coalesce(finance.total_spend, 0) - p.budget as variance_amount,
  case
    when p.progress_percent > 0 then p.progress_percent
    when p.start_date is not null
      and p.end_date is not null
      and p.end_date > p.start_date
    then round(
      greatest(
        0,
        least(
          100,
          (
            (current_date - p.start_date)::numeric
            / nullif((p.end_date - p.start_date)::numeric, 0)
          ) * 100
        )
      ),
      2
    )
    else 0
  end as progress_percent
from public.projects p
join public.users owner
  on owner.id = p.owner_id
left join (
  select
    pm.project_id,
    count(*) filter (where pm.status = 'active') as active_members,
    count(*) filter (where pm.status = 'active' and pm.access_role in ('CREW', 'DRIVER', 'DATA_WRANGLER', 'SUPERVISOR', 'HOD')) as active_crew_members
  from public.project_members pm
  group by pm.project_id
) member_stats
  on member_stats.project_id = p.id
left join (
  select
    project_id,
    sum(spend_amount) as total_spend,
    sum(pending_amount) as pending_approvals
  from (
    select e.project_id, sum(e.amount) as spend_amount, 0::numeric as pending_amount
    from public.expenses e
    where e.status in ('approved', 'paid', 'reimbursed')
    group by e.project_id

    union all

    select vp.project_id, sum(vp.amount) as spend_amount, 0::numeric as pending_amount
    from public.vendor_payments vp
    where vp.status in ('approved', 'paid')
    group by vp.project_id

    union all

    select fl.project_id, sum(coalesce(fl.cost_amount, 0)) as spend_amount, 0::numeric as pending_amount
    from public.fuel_logs fl
    group by fl.project_id

    union all

    select wr.project_id, sum(wr.amount) as spend_amount, 0::numeric as pending_amount
    from public.wage_records wr
    where wr.status in ('approved', 'paid')
    group by wr.project_id

    union all

    select br.project_id, sum(br.amount) as spend_amount, 0::numeric as pending_amount
    from public.batta_requests br
    where br.status in ('approved', 'paid')
    group by br.project_id

    union all

    select a.project_id, 0::numeric as spend_amount, sum(coalesce(a.amount, 0)) as pending_amount
    from public.approvals a
    where a.status = 'pending'
    group by a.project_id
  ) rolled
  group by project_id
) finance
  on finance.project_id = p.id;

create or replace view public.financial_overview
with (security_invoker = true)
as
select
  fm.project_id,
  p.name as project_name,
  fm.department,
  fm.metric_date,
  fm.period,
  fm.budget_amount,
  fm.actual_spend_amount,
  fm.committed_amount,
  fm.pending_approval_amount,
  fm.overtime_cost_amount,
  (fm.actual_spend_amount + fm.committed_amount + fm.pending_approval_amount) as projected_spend_amount,
  (fm.budget_amount - fm.actual_spend_amount) as remaining_budget_amount,
  fm.variance_amount
from public.financial_metrics fm
join public.projects p
  on p.id = fm.project_id;

create or replace view public.active_alerts
with (security_invoker = true)
as
select
  a.id as alert_id,
  a.project_id,
  p.name as project_name,
  a.source,
  a.severity,
  a.title,
  a.message,
  a.status,
  a.entity_table,
  a.entity_id,
  a.created_at,
  a.acknowledged_at,
  a.resolved_at,
  a.metadata
from public.alerts a
join public.projects p
  on p.id = a.project_id
where a.status in ('open', 'acknowledged')
order by
  case a.severity
    when 'critical' then 1
    when 'warning' then 2
    else 3
  end,
  a.created_at desc;
