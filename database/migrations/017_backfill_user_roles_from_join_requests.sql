-- Migration 017: Backfill users.role and users.department for already-approved join requests
-- This fixes users who were approved before the trigger was corrected.

update public.users u
set
  role       = jr.access_role_requested,
  department = jr.department,
  metadata   = coalesce(u.metadata, '{}'::jsonb)
                || jsonb_build_object(
                     'role',               jr.access_role_requested,
                     'department_id',      jr.department,
                     'project_role_title', case jr.role_requested
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
                     end,
                     'role_label', case jr.role_requested
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
                     end
                   ),
  updated_at = timezone('utc', now())
from public.project_join_requests jr
where jr.user_id = u.id
  and jr.status  = 'approved'
  -- Only update users whose role is still the default CREW (i.e. was never updated)
  -- Remove this condition if you want to unconditionally overwrite all approved users
  and u.role = 'CREW';
