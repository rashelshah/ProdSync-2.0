create table if not exists public.art_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  description text not null,
  category text not null,
  quantity integer not null default 1,
  manual_amount numeric(14,2) not null default 0,
  extracted_amount numeric(14,2) not null default 0,
  anomaly boolean not null default false,
  ocr_text text,
  receipt_url text,
  status text not null default 'pending_review' check (status in ('verified', 'anomaly', 'pending_review')),
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.art_expenses add column if not exists quantity integer not null default 1;
alter table public.art_expenses add column if not exists manual_amount numeric(14,2) not null default 0;
alter table public.art_expenses add column if not exists extracted_amount numeric(14,2) not null default 0;
alter table public.art_expenses add column if not exists anomaly boolean not null default false;
alter table public.art_expenses add column if not exists ocr_text text;
alter table public.art_expenses add column if not exists receipt_url text;
alter table public.art_expenses add column if not exists status text not null default 'pending_review';
alter table public.art_expenses add column if not exists created_by uuid;
alter table public.art_expenses add column if not exists created_at timestamptz not null default timezone('utc', now());

create index if not exists idx_art_expenses_project_created on public.art_expenses (project_id, created_at desc);
