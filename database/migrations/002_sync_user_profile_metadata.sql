create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_phone text;
  v_role public.user_role;
  v_department public.department_code;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1)
  );
  v_phone := nullif(new.raw_user_meta_data ->> 'phone', '');
  v_role := case new.raw_user_meta_data ->> 'role'
    when 'EP' then 'EP'::public.user_role
    when 'LineProducer' then 'LINE_PRODUCER'::public.user_role
    when 'HOD' then 'HOD'::public.user_role
    when 'Supervisor' then 'SUPERVISOR'::public.user_role
    when 'Crew' then 'CREW'::public.user_role
    when 'Driver' then 'DRIVER'::public.user_role
    when 'DataWrangler' then 'DATA_WRANGLER'::public.user_role
    else 'CREW'::public.user_role
  end;
  v_department := case new.raw_user_meta_data ->> 'department_id'
    when 'camera' then 'camera'::public.department_code
    when 'art' then 'art'::public.department_code
    when 'transport' then 'transport'::public.department_code
    when 'production' then 'production'::public.department_code
    when 'wardrobe' then 'wardrobe'::public.department_code
    when 'post' then 'post'::public.department_code
    else 'production'::public.department_code
  end;

  insert into public.users (
    id,
    full_name,
    email,
    phone,
    role,
    department,
    metadata
  )
  values (
    new.id,
    coalesce(v_full_name, 'ProdSync User'),
    new.email,
    v_phone,
    v_role,
    v_department,
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
  )
  on conflict (id) do update
    set email = excluded.email,
        phone = coalesce(excluded.phone, public.users.phone),
        role = coalesce(excluded.role, public.users.role),
        department = coalesce(excluded.department, public.users.department),
        metadata = coalesce(public.users.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
        updated_at = timezone('utc', now());

  insert into public.user_notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

update public.users
set
  role = case metadata ->> 'role'
    when 'EP' then 'EP'::public.user_role
    when 'LineProducer' then 'LINE_PRODUCER'::public.user_role
    when 'HOD' then 'HOD'::public.user_role
    when 'Supervisor' then 'SUPERVISOR'::public.user_role
    when 'Crew' then 'CREW'::public.user_role
    when 'Driver' then 'DRIVER'::public.user_role
    when 'DataWrangler' then 'DATA_WRANGLER'::public.user_role
    else role
  end,
  department = case metadata ->> 'department_id'
    when 'camera' then 'camera'::public.department_code
    when 'art' then 'art'::public.department_code
    when 'transport' then 'transport'::public.department_code
    when 'production' then 'production'::public.department_code
    when 'wardrobe' then 'wardrobe'::public.department_code
    when 'post' then 'post'::public.department_code
    else department
  end,
  full_name = coalesce(nullif(metadata ->> 'full_name', ''), nullif(metadata ->> 'name', ''), full_name),
  updated_at = timezone('utc', now())
where metadata is not null;
