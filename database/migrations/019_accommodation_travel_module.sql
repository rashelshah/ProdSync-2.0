create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  hotel_name text not null,
  address text not null,
  city text not null,
  contact_person text null,
  contact_number text null,
  latitude double precision null,
  longitude double precision null,
  created_at timestamptz not null default now()
);

create table if not exists public.hotel_allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  person_name text not null,
  role_title text null,
  department text null,
  hotel_name text not null,
  room_number text not null,
  check_in_date date not null,
  check_out_date date not null,
  booking_status text not null default 'confirmed',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_allocations_booking_status_check check (booking_status in ('confirmed', 'checked_in', 'checked_out', 'cancelled')),
  constraint hotel_allocations_checkout_after_checkin check (check_out_date >= check_in_date)
);

create index if not exists idx_hotel_allocations_project_id
  on public.hotel_allocations(project_id, check_in_date desc);

create index if not exists idx_hotel_allocations_room
  on public.hotel_allocations(hotel_name, room_number);

create table if not exists public.hotel_reminders (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.hotel_allocations(id) on delete cascade,
  reminder_type text not null,
  reminder_time timestamptz not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint hotel_reminders_type_check check (reminder_type in ('checkin', 'checkout')),
  constraint hotel_reminders_status_check check (status in ('pending', 'sent'))
);

create index if not exists idx_hotel_reminders_allocation_id
  on public.hotel_reminders(allocation_id, reminder_time desc);

create table if not exists public.stay_logs (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.hotel_allocations(id) on delete cascade,
  date date not null,
  status text not null default 'present',
  remarks text null,
  created_at timestamptz not null default now(),
  constraint stay_logs_status_check check (status in ('present', 'checked_out', 'extended'))
);

create index if not exists idx_stay_logs_allocation_id
  on public.stay_logs(allocation_id, date desc);
