alter table public.users
add column if not exists auth_provider varchar not null default 'email';

alter table public.users
add column if not exists supabase_user_id uuid references auth.users (id) on delete set null;

alter table public.users
add column if not exists is_google_linked boolean not null default false;

create index if not exists users_supabase_user_id_idx
  on public.users (supabase_user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint con
    join lateral (
      select array_agg(att.attname order by att.attnum) as columns
      from unnest(con.conkey) as key(attnum)
      join pg_attribute att
        on att.attrelid = con.conrelid
       and att.attnum = key.attnum
    ) cols on true
    where con.conrelid = 'public.users'::regclass
      and con.contype = 'u'
      and cols.columns::text[] = array['email']::text[]
  ) then
    alter table public.users
      add constraint unique_email unique (email);
  end if;
end
$$;

update public.users
set
  auth_provider = case
    when coalesce(is_google_linked, false) then 'both'
    when lower(coalesce(auth_provider, 'email')) in ('email', 'google', 'both') then lower(coalesce(auth_provider, 'email'))
    else 'email'
  end,
  onboarding_completed_at = coalesce(
    onboarding_completed_at,
    case
      when metadata ? 'department_id' and metadata ? 'project_role_title'
        then updated_at
      else null
    end
  )
where true;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_user public.users%rowtype;
  v_full_name text;
  v_phone text;
  v_role public.user_role;
  v_department public.department_code;
  v_provider text;
  v_avatar_url text;
  v_merged_metadata jsonb;
  v_auth_provider text;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1)
  );
  v_phone := nullif(new.raw_user_meta_data ->> 'phone', '');
  v_avatar_url := nullif(new.raw_user_meta_data ->> 'avatar_url', '');
  v_provider := lower(coalesce(
    new.raw_app_meta_data ->> 'provider',
    new.raw_user_meta_data ->> 'provider',
    'email'
  ));
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
  v_merged_metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  select *
    into v_existing_user
  from public.users
  where email = new.email
  limit 1;

  if v_existing_user.id is not null and v_existing_user.id <> new.id then
    v_auth_provider := case
      when lower(coalesce(v_existing_user.auth_provider, 'email')) = 'both' then 'both'
      when lower(coalesce(v_existing_user.auth_provider, 'email')) = v_provider then lower(coalesce(v_existing_user.auth_provider, 'email'))
      when lower(coalesce(v_existing_user.auth_provider, 'email')) = 'google' and v_provider = 'email' then 'both'
      when lower(coalesce(v_existing_user.auth_provider, 'email')) = 'email' and v_provider = 'google' then 'both'
      when v_provider = 'google' then 'google'
      else 'email'
    end;

    update public.users
    set
      email = coalesce(new.email, v_existing_user.email),
      full_name = coalesce(v_existing_user.full_name, v_full_name, 'ProdSync User'),
      phone = coalesce(v_existing_user.phone, v_phone),
      avatar_url = coalesce(v_existing_user.avatar_url, v_avatar_url),
      role = coalesce(v_existing_user.role, v_role, 'CREW'::public.user_role),
      department = coalesce(v_existing_user.department, v_department, 'production'::public.department_code),
      auth_provider = v_auth_provider,
      supabase_user_id = case
        when v_provider = 'google' then new.id
        else v_existing_user.supabase_user_id
      end,
      is_google_linked = coalesce(v_existing_user.is_google_linked, false) or v_provider = 'google',
      metadata = coalesce(v_existing_user.metadata, '{}'::jsonb) || v_merged_metadata,
      updated_at = timezone('utc', now())
    where id = v_existing_user.id;

    insert into public.user_notification_preferences (user_id)
    values (v_existing_user.id)
    on conflict (user_id) do nothing;

    return new;
  end if;

  insert into public.users (
    id,
    full_name,
    email,
    phone,
    role,
    department,
    avatar_url,
    auth_provider,
    supabase_user_id,
    is_google_linked,
    metadata
  )
  values (
    new.id,
    coalesce(v_full_name, 'ProdSync User'),
    new.email,
    v_phone,
    v_role,
    v_department,
    v_avatar_url,
    case when v_provider = 'google' then 'google' else 'email' end,
    case when v_provider = 'google' then new.id else null end,
    v_provider = 'google',
    v_merged_metadata
  )
  on conflict (id) do update
    set email = excluded.email,
        phone = coalesce(excluded.phone, public.users.phone),
        full_name = coalesce(public.users.full_name, excluded.full_name),
        role = coalesce(excluded.role, public.users.role),
        department = coalesce(excluded.department, public.users.department),
        avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url),
        auth_provider = case
          when lower(coalesce(public.users.auth_provider, 'email')) = 'both' then 'both'
          when lower(coalesce(public.users.auth_provider, 'email')) = lower(coalesce(excluded.auth_provider, 'email')) then lower(coalesce(public.users.auth_provider, 'email'))
          when lower(coalesce(public.users.auth_provider, 'email')) = 'google' and lower(coalesce(excluded.auth_provider, 'email')) = 'email' then 'both'
          when lower(coalesce(public.users.auth_provider, 'email')) = 'email' and lower(coalesce(excluded.auth_provider, 'email')) = 'google' then 'both'
          else lower(coalesce(excluded.auth_provider, public.users.auth_provider, 'email'))
        end,
        supabase_user_id = coalesce(excluded.supabase_user_id, public.users.supabase_user_id),
        is_google_linked = coalesce(public.users.is_google_linked, false) or coalesce(excluded.is_google_linked, false),
        metadata = coalesce(public.users.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
        updated_at = timezone('utc', now());

  insert into public.user_notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
