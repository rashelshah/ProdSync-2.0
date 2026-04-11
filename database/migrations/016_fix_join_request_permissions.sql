-- Migration 016: Fix join request approval trigger
-- Fixes two bugs:
--   1. users.role / users.department / users.metadata were never updated on approval,
--      causing the auth session to always return the default CREW role.
--   2. The permissions jsonb was hardcoded to read-only regardless of role.

create or replace function public.apply_join_request_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_role_title text;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status in ('approved', 'rejected') and new.reviewed_at is null then
    new.reviewed_at := timezone('utc', now());
  end if;

  if new.status = 'approved' and old.status <> 'approved' then
    -- 1. Insert / update project membership
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
      case
        when new.access_role_requested in ('EP', 'LINE_PRODUCER') then '["project:*","budget:approve","member:approve"]'::jsonb
        else '["project:read","request:create"]'::jsonb
      end,
      coalesce(new.reviewed_at, timezone('utc', now())),
      new.reviewed_by
    )
    on conflict (user_id, project_id) do update
      set role        = excluded.role,
          access_role = excluded.access_role,
          department  = excluded.department,
          status      = 'active',
          approved_at = excluded.approved_at,
          approved_by = excluded.approved_by,
          updated_at  = timezone('utc', now());

    -- 2. Convert DB role enum back to human-readable title for metadata
    v_project_role_title := case new.role_requested
      when 'executive_producer'  then 'Executive Producer'
      when 'line_producer'       then 'Line Producer'
      when 'production_manager'  then 'Production Manager'
      when 'first_ad'            then '1st AD'
      when 'dop'                 then 'DOP'
      when 'first_ac'            then '1st AC'
      when 'camera_operator'     then 'Camera Operator'
      when 'art_director'        then 'Art Director'
      when 'art_assistant'       then 'Art Assistant'
      when 'transport_captain'   then 'Transport Captain'
      when 'driver'              then 'Driver'
      when 'editor'              then 'Editor'
      when 'colorist'            then 'Colorist'
      when 'costume_supervisor'  then 'Costume Supervisor'
      when 'wardrobe_stylist'    then 'Wardrobe Stylist'
      when 'data_wrangler'       then 'Data Wrangler'
      else 'Crew Member'
    end;

    -- 3. Update the users table so the auth session reflects the correct role
    --    This is the critical fix: without this, every user appears as CREW on login.
    update public.users
    set
      role       = new.access_role_requested,
      department = new.department,
      metadata   = coalesce(metadata, '{}'::jsonb)
                    || jsonb_build_object(
                         'role',               new.access_role_requested,
                         'department_id',      new.department,
                         'project_role_title', v_project_role_title,
                         'role_label',         v_project_role_title
                       ),
      updated_at = timezone('utc', now())
    where id = new.user_id;
  end if;

  return new;
end;
$$;
