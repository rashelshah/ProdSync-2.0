do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'department_code'
      and e.enumlabel = 'actors'
  ) then
    alter type public.department_code add value 'actors';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'project_member_role'
      and e.enumlabel = 'actor_coordinator'
  ) then
    alter type public.project_member_role add value 'actor_coordinator';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'project_member_role'
      and e.enumlabel = 'junior_artist_coordinator'
  ) then
    alter type public.project_member_role add value 'junior_artist_coordinator';
  end if;
end $$;

create table if not exists public.junior_artists_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  shoot_date date not null,
  agent_name text not null,
  number_of_artists integer not null default 0,
  rate_per_artist numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint junior_artists_logs_number_non_negative check (number_of_artists >= 0),
  constraint junior_artists_logs_rate_non_negative check (rate_per_artist >= 0),
  constraint junior_artists_logs_total_non_negative check (total_cost >= 0)
);

create table if not exists public.call_sheets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  shoot_date date not null,
  location text not null,
  call_time time not null,
  actor_name text not null,
  character_name text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.actor_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_name text not null,
  payment_type text not null,
  amount numeric(14,2) not null default 0,
  payment_date date not null,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint actor_payments_type_check check (payment_type in ('batta', 'remuneration')),
  constraint actor_payments_status_check check (status in ('pending', 'paid')),
  constraint actor_payments_amount_non_negative check (amount >= 0)
);

create table if not exists public.actor_looks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_name text not null,
  character_name text,
  image_url text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint actor_looks_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_junior_artists_logs_project_shoot_date
  on public.junior_artists_logs (project_id, shoot_date desc, created_at desc);

create index if not exists idx_call_sheets_project_shoot_date
  on public.call_sheets (project_id, shoot_date asc, call_time asc);

create index if not exists idx_actor_payments_project_payment_date
  on public.actor_payments (project_id, payment_date desc, created_at desc);

create index if not exists idx_actor_looks_project_created
  on public.actor_looks (project_id, created_at desc);

drop trigger if exists trg_junior_artists_logs_set_updated_at on public.junior_artists_logs;
create trigger trg_junior_artists_logs_set_updated_at
before update on public.junior_artists_logs
for each row execute function public.set_updated_at();

drop trigger if exists trg_call_sheets_set_updated_at on public.call_sheets;
create trigger trg_call_sheets_set_updated_at
before update on public.call_sheets
for each row execute function public.set_updated_at();

drop trigger if exists trg_actor_payments_set_updated_at on public.actor_payments;
create trigger trg_actor_payments_set_updated_at
before update on public.actor_payments
for each row execute function public.set_updated_at();

drop trigger if exists trg_actor_looks_set_updated_at on public.actor_looks;
create trigger trg_actor_looks_set_updated_at
before update on public.actor_looks
for each row execute function public.set_updated_at();

alter table public.junior_artists_logs enable row level security;
alter table public.call_sheets enable row level security;
alter table public.actor_payments enable row level security;
alter table public.actor_looks enable row level security;

alter table public.junior_artists_logs force row level security;
alter table public.call_sheets force row level security;
alter table public.actor_payments force row level security;
alter table public.actor_looks force row level security;

drop policy if exists junior_artists_logs_select_scoped on public.junior_artists_logs;
create policy junior_artists_logs_select_scoped
on public.junior_artists_logs
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'actors')
  )
);

drop policy if exists junior_artists_logs_manage_scoped on public.junior_artists_logs;
create policy junior_artists_logs_manage_scoped
on public.junior_artists_logs
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'actors')
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'actors')
);

drop policy if exists call_sheets_select_scoped on public.call_sheets;
create policy call_sheets_select_scoped
on public.call_sheets
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'actors')
  )
);

drop policy if exists call_sheets_manage_scoped on public.call_sheets;
create policy call_sheets_manage_scoped
on public.call_sheets
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'actors')
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'actors')
);

drop policy if exists actor_payments_select_scoped on public.actor_payments;
create policy actor_payments_select_scoped
on public.actor_payments
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'actors')
  )
);

drop policy if exists actor_payments_manage_scoped on public.actor_payments;
create policy actor_payments_manage_scoped
on public.actor_payments
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'actors')
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'actors')
);

drop policy if exists actor_looks_select_scoped on public.actor_looks;
create policy actor_looks_select_scoped
on public.actor_looks
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'actors')
  )
);

drop policy if exists actor_looks_manage_scoped on public.actor_looks;
create policy actor_looks_manage_scoped
on public.actor_looks
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'actors')
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'actors')
);

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

    v_project_role_title := case new.role_requested
      when 'executive_producer' then 'Executive Producer'
      when 'line_producer' then 'Line Producer'
      when 'production_manager' then 'Production Manager'
      when 'first_ad' then '1st AD'
      when 'dop' then 'DOP'
      when 'first_ac' then '1st AC'
      when 'camera_operator' then 'Camera Operator'
      when 'art_director' then 'Art Director'
      when 'art_assistant' then 'Art Assistant'
      when 'transport_captain' then 'Transport Captain'
      when 'driver' then 'Driver'
      when 'editor' then 'Editor'
      when 'colorist' then 'Colorist'
      when 'costume_supervisor' then 'Costume Supervisor'
      when 'wardrobe_stylist' then 'Wardrobe Stylist'
      when 'actor_coordinator' then 'Actor Coordinator'
      when 'junior_artist_coordinator' then 'Junior Artist Coordinator'
      when 'data_wrangler' then 'Data Wrangler'
      else 'Crew Member'
    end;

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
    when 'actors' then 'actors'::public.department_code
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
