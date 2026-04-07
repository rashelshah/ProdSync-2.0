-- Shared functions for ProdSync RBAC, auditing, derived values, and Supabase auth sync.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

create or replace function public.shares_project_with(
  candidate_user_id uuid,
  viewer_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members viewer_member
    join public.project_members candidate_member
      on candidate_member.project_id = viewer_member.project_id
     and candidate_member.status = 'active'
    where viewer_member.user_id = viewer_user_id
      and viewer_member.status = 'active'
      and candidate_member.user_id = candidate_user_id
  );
$$;

create or replace function public.is_project_owner(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.owner_id = p_user_id
  );
$$;

create or replace function public.is_project_member(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_project_owner(p_project_id, p_user_id)
     or exists (
          select 1
          from public.project_members pm
          where pm.project_id = p_project_id
            and pm.user_id = p_user_id
            and pm.status = 'active'
        );
$$;

create or replace function public.get_user_role(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select pm.access_role
      from public.project_members pm
      where pm.project_id = p_project_id
        and pm.user_id = p_user_id
        and pm.status = 'active'
      limit 1
    ),
    (
      select case
        when p.owner_id = p_user_id then 'EP'::public.user_role
        else null
      end
      from public.projects p
      where p.id = p_project_id
      limit 1
    )
  );
$$;

create or replace function public.get_user_project_role(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns public.project_member_role
language sql
stable
security definer
set search_path = public
as $$
  select pm.role
  from public.project_members pm
  where pm.project_id = p_project_id
    and pm.user_id = p_user_id
    and pm.status = 'active'
  limit 1;
$$;

create or replace function public.get_user_department(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns public.department_code
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select pm.department
      from public.project_members pm
      where pm.project_id = p_project_id
        and pm.user_id = p_user_id
        and pm.status = 'active'
      limit 1
    ),
    (
      select u.department
      from public.users u
      where u.id = p_user_id
      limit 1
    )
  );
$$;

create or replace function public.can_manage_project(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_project_owner(p_project_id, p_user_id)
     or public.get_user_role(p_project_id, p_user_id) in ('EP', 'LINE_PRODUCER');
$$;

create or replace function public.can_access_department(
  p_project_id uuid,
  p_department public.department_code,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_manage_project(p_project_id, p_user_id)
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = p_project_id
        and pm.user_id = p_user_id
        and pm.status = 'active'
        and pm.department = p_department
        and pm.access_role in ('HOD', 'SUPERVISOR')
    );
$$;

create or replace function public.can_view_member_record(
  p_project_id uuid,
  p_member_department public.department_code,
  p_member_user_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_manage_project(p_project_id, p_user_id)
    or p_member_user_id = p_user_id
    or public.can_access_department(p_project_id, p_member_department, p_user_id);
$$;

create or replace function public.can_view_financial_record(
  p_project_id uuid,
  p_department public.department_code,
  p_owner_user_id uuid default null,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.can_manage_project(p_project_id, p_user_id)
    or (
      p_owner_user_id is not null
      and p_owner_user_id = p_user_id
    )
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = p_project_id
        and pm.user_id = p_user_id
        and pm.status = 'active'
        and pm.department = p_department
        and pm.access_role in ('HOD', 'SUPERVISOR')
    );
$$;

create or replace function public.can_approve(
  p_user_id uuid,
  p_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_project(p_project_id, p_user_id);
$$;

create or replace function public.log_activity(
  p_project_id uuid,
  p_user_id uuid,
  p_action text,
  p_entity text,
  p_entity_id text default null,
  p_entity_label text default null,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  insert into public.activity_logs (
    project_id,
    user_id,
    action,
    entity,
    entity_id,
    entity_label,
    old_data,
    new_data,
    context
  )
  values (
    p_project_id,
    p_user_id,
    p_action,
    p_entity,
    p_entity_id,
    p_entity_label,
    p_old_data,
    p_new_data,
    coalesce(p_context, '{}'::jsonb)
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

create or replace function public.ensure_project_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := trim(both '-' from regexp_replace(lower(new.name), '[^a-z0-9]+', '-', 'g'));
  end if;

  return new;
end;
$$;

create or replace function public.sync_attendance_derived_values()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_standard_hours numeric(5,2);
  v_seconds numeric;
begin
  select coalesce(ps.standard_shift_hours, 10)
    into v_standard_hours
  from public.project_settings ps
  where ps.project_id = new.project_id;

  if new.check_in_at is not null and new.check_out_at is not null then
    v_seconds := extract(epoch from (new.check_out_at - new.check_in_at));
    new.shift_hours := round((v_seconds / 3600.0)::numeric, 2);
    new.overtime_minutes := greatest(floor(((new.shift_hours - v_standard_hours) * 60))::integer, 0);
  elsif new.shift_hours is null then
    new.shift_hours := 0;
    new.overtime_minutes := 0;
  end if;

  if new.overtime_minutes > 0 then
    new.status := 'ot';
  elsif new.check_out_at is not null then
    new.status := 'offduty';
  else
    new.status := 'active';
  end if;

  return new;
end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_id text;
  v_user_id uuid;
  v_project_id uuid;
begin
  v_user_id := auth.uid();

  if tg_op = 'DELETE' then
    v_entity_id := coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'user_id');
    v_project_id := nullif(to_jsonb(old)->>'project_id', '')::uuid;
    perform public.log_activity(
      v_project_id,
      v_user_id,
      lower(tg_op),
      tg_table_name,
      v_entity_id,
      tg_table_name,
      to_jsonb(old),
      null,
      jsonb_build_object('schema', tg_table_schema)
    );
    return old;
  end if;

  v_entity_id := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'user_id');
  v_project_id := nullif(to_jsonb(new)->>'project_id', '')::uuid;

  perform public.log_activity(
    v_project_id,
    v_user_id,
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    tg_table_name,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),
    jsonb_build_object('schema', tg_table_schema)
  );

  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_phone text;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1)
  );
  v_phone := nullif(new.raw_user_meta_data ->> 'phone', '');

  insert into public.users (
    id,
    full_name,
    email,
    phone,
    metadata
  )
  values (
    new.id,
    coalesce(v_full_name, 'ProdSync User'),
    new.email,
    v_phone,
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
  )
  on conflict (id) do update
    set email = excluded.email,
        phone = coalesce(excluded.phone, public.users.phone),
        metadata = coalesce(public.users.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
        updated_at = timezone('utc', now());

  insert into public.user_notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.ensure_project_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner public.users%rowtype;
  v_role public.project_member_role;
  v_department public.department_code;
begin
  select *
    into v_owner
  from public.users
  where id = new.owner_id;

  v_department := coalesce(v_owner.department, 'production');

  v_role := case v_owner.role
    when 'EP' then 'executive_producer'
    when 'LINE_PRODUCER' then 'line_producer'
    when 'HOD' then 'production_manager'
    when 'SUPERVISOR' then 'production_manager'
    when 'DRIVER' then 'driver'
    when 'DATA_WRANGLER' then 'data_wrangler'
    else 'crew_member'
  end;

  insert into public.project_members (
    user_id,
    project_id,
    role,
    access_role,
    department,
    permissions,
    is_owner,
    approved_at,
    approved_by
  )
  values (
    new.owner_id,
    new.id,
    v_role,
    case
      when v_owner.role in ('EP', 'LINE_PRODUCER') then v_owner.role
      else 'LINE_PRODUCER'::public.user_role
    end,
    v_department,
    '["project:*","budget:approve","member:approve"]'::jsonb,
    true,
    timezone('utc', now()),
    new.owner_id
  )
  on conflict (user_id, project_id) do update
    set is_owner = true,
        permissions = excluded.permissions,
        status = 'active',
        approved_at = timezone('utc', now()),
        approved_by = new.owner_id,
        updated_at = timezone('utc', now());

  insert into public.project_settings (project_id, base_location, ot_rules_label)
  values (new.id, new.location, 'Standard OT with producer approval')
  on conflict (project_id) do nothing;

  insert into public.project_departments (project_id, department, enabled)
  values
    (new.id, 'production', true),
    (new.id, 'camera', true),
    (new.id, 'art', false),
    (new.id, 'transport', false),
    (new.id, 'wardrobe', false),
    (new.id, 'post', false)
  on conflict (project_id, department) do nothing;

  return new;
end;
$$;

create or replace function public.apply_join_request_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status in ('approved', 'rejected') and new.reviewed_at is null then
    new.reviewed_at := timezone('utc', now());
  end if;

  if new.status = 'approved' and old.status <> 'approved' then
    insert into public.project_members (
      user_id,
      project_id,
      role,
      access_role,
      department,
      permissions,
      approved_at,
      approved_by
    )
    values (
      new.user_id,
      new.project_id,
      new.role_requested,
      new.access_role_requested,
      new.department,
      '["project:read","request:create"]'::jsonb,
      coalesce(new.reviewed_at, timezone('utc', now())),
      new.reviewed_by
    )
    on conflict (user_id, project_id) do update
      set role = excluded.role,
          access_role = excluded.access_role,
          department = excluded.department,
          status = 'active',
          approved_at = excluded.approved_at,
          approved_by = excluded.approved_by,
          updated_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

create or replace function public.sync_approval_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'approved' and new.approved_at is null then
    new.approved_at := timezone('utc', now());
  end if;

  if new.status = 'rejected' and new.rejected_at is null then
    new.rejected_at := timezone('utc', now());
  end if;

  if new.approvable_table = 'expenses' then
    update public.expenses
       set status = case
                      when new.status = 'approved' then 'approved'
                      when new.status = 'rejected' then 'rejected'
                      when new.status = 'cancelled' then 'cancelled'
                      else status
                    end,
           approval_id = new.id,
           updated_at = timezone('utc', now())
     where id = new.approvable_id;
  elsif new.approvable_table = 'batta_requests' then
    update public.batta_requests
       set status = case
                      when new.status = 'approved' then 'approved'
                      when new.status = 'rejected' then 'rejected'
                      when new.status = 'cancelled' then 'cancelled'
                      else status
                    end,
           approval_id = new.id,
           updated_at = timezone('utc', now())
     where id = new.approvable_id;
  elsif new.approvable_table = 'wage_records' then
    update public.wage_records
       set status = case
                      when new.status = 'approved' then 'approved'
                      when new.status = 'rejected' then 'rejected'
                      when new.status = 'cancelled' then 'cancelled'
                      else status
                    end,
           approval_id = new.id,
           updated_at = timezone('utc', now())
     where id = new.approvable_id;
  elsif new.approvable_table = 'vendor_payments' then
    update public.vendor_payments
       set status = case
                      when new.status = 'approved' then 'approved'
                      when new.status = 'rejected' then 'rejected'
                      when new.status = 'cancelled' then 'cancelled'
                      else status
                    end,
           approval_id = new.id,
           updated_at = timezone('utc', now())
     where id = new.approvable_id;
  elsif new.approvable_table = 'overtime_logs' then
    update public.overtime_logs
       set authorized = (new.status = 'approved'),
           approval_id = new.id,
           approved_by = new.approved_by,
           updated_at = timezone('utc', now())
     where id = new.approvable_id;
  elsif new.approvable_table = 'rentals' then
    update public.rentals
       set status = case
                      when new.status = 'approved' then 'active'
                      when new.status = 'rejected' then 'cancelled'
                      when new.status = 'cancelled' then 'cancelled'
                      else status
                    end,
           updated_at = timezone('utc', now())
     where id = new.approvable_id;
  end if;

  insert into public.approval_actions (
    approval_id,
    project_id,
    action,
    actor_id,
    note
  )
  values (
    new.id,
    new.project_id,
    (
      case
      when new.status = 'approved' then 'approved'
      when new.status = 'rejected' then 'rejected'
      when new.status = 'cancelled' then 'cancelled'
      else 'submitted'
      end
    )::public.approval_action_type,
    coalesce(new.approved_by, auth.uid()),
    coalesce(new.rejection_reason, new.request_description)
  );

  return new;
end;
$$;

create or replace function public.sync_transport_alert_to_alerts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.alerts (
    project_id,
    source,
    severity,
    title,
    message,
    status,
    entity_table,
    entity_id,
    acknowledged_at,
    acknowledged_by,
    resolved_at,
    resolved_by,
    metadata
  )
  values (
    new.project_id,
    'transport',
    new.severity,
    new.title,
    new.message,
    new.status,
    'transport_alerts',
    new.id,
    new.acknowledged_at,
    new.acknowledged_by,
    new.resolved_at,
    new.resolved_by,
    coalesce(new.metadata, '{}'::jsonb)
  )
  on conflict do nothing;

  update public.alerts
     set severity = new.severity,
         title = new.title,
         message = new.message,
         status = new.status,
         acknowledged_at = new.acknowledged_at,
         acknowledged_by = new.acknowledged_by,
         resolved_at = new.resolved_at,
         resolved_by = new.resolved_by,
         metadata = coalesce(new.metadata, '{}'::jsonb)
   where entity_table = 'transport_alerts'
     and entity_id = new.id;

  return new;
end;
$$;

create or replace function public.sync_approval_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_should_exist boolean;
begin
  v_should_exist := new.priority = 'emergency' and new.status = 'pending';

  if v_should_exist then
    insert into public.alerts (
      project_id,
      source,
      severity,
      title,
      message,
      status,
      entity_table,
      entity_id,
      metadata
    )
    values (
      new.project_id,
      'approvals',
      'critical',
      'Emergency Approval Required',
      coalesce(new.request_title, new.type::text) || ': ' || coalesce(new.request_description, ''),
      'open',
      'approvals',
      new.id,
      jsonb_build_object('approval_type', new.type, 'department', new.department)
    )
    on conflict do nothing;

    update public.alerts
       set message = coalesce(new.request_title, new.type::text) || ': ' || coalesce(new.request_description, ''),
           status = 'open',
           severity = 'critical',
           metadata = jsonb_build_object('approval_type', new.type, 'department', new.department)
     where entity_table = 'approvals'
       and entity_id = new.id;
  else
    update public.alerts
       set status = case
                      when new.status = 'approved' then 'resolved'
                      when new.status = 'rejected' then 'resolved'
                      when new.status = 'cancelled' then 'resolved'
                      else status
                    end,
           resolved_at = case
                           when new.status in ('approved', 'rejected', 'cancelled') then timezone('utc', now())
                           else resolved_at
                         end,
           resolved_by = coalesce(new.approved_by, resolved_by)
     where entity_table = 'approvals'
       and entity_id = new.id;
  end if;

  return new;
end;
$$;
