do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'costume_status'
      and e.enumlabel = 'in_storage'
  ) then
    alter type public.costume_status add value 'in_storage';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'costume_status'
      and e.enumlabel = 'in_laundry'
  ) then
    alter type public.costume_status add value 'in_laundry';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'costume_status'
      and e.enumlabel = 'missing'
  ) then
    alter type public.costume_status add value 'missing';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'laundry_status'
      and e.enumlabel = 'sent'
  ) then
    alter type public.laundry_status add value 'sent';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'laundry_status'
      and e.enumlabel = 'in_cleaning'
  ) then
    alter type public.laundry_status add value 'in_cleaning';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'laundry_status'
      and e.enumlabel = 'returned'
  ) then
    alter type public.laundry_status add value 'returned';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'laundry_status'
      and e.enumlabel = 'delayed'
  ) then
    alter type public.laundry_status add value 'delayed';
  end if;
end $$;

alter table public.costumes
  add column if not exists last_used_scene text;

alter table public.continuity_logs
  add column if not exists actor_name text;

alter table public.laundry_logs
  add column if not exists expected_return_date date;

create table if not exists public.accessory_inventory (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  item_name text not null,
  category text not null check (category in ('jewellery', 'accessory')),
  assigned_character text,
  status text not null default 'in_safe' check (status in ('on_set', 'in_safe', 'in_use', 'missing')),
  last_checkin_time timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_accessory_inventory_project_created
  on public.accessory_inventory (project_id, created_at desc);

alter table public.accessory_inventory enable row level security;
alter table public.accessory_inventory force row level security;

drop policy if exists accessory_inventory_select_scoped on public.accessory_inventory;
create policy accessory_inventory_select_scoped
on public.accessory_inventory
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'wardrobe')
  )
);

drop policy if exists accessory_inventory_manage_scoped on public.accessory_inventory;
create policy accessory_inventory_manage_scoped
on public.accessory_inventory
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'wardrobe')
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'wardrobe')
);
