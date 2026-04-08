alter table public.projects
  alter column currency_code set default 'INR';

update public.projects
set currency_code = 'INR'
where currency_code is null or btrim(currency_code) = '';

alter table public.projects
  drop constraint if exists projects_currency_code_check;

alter table public.projects
  add constraint projects_currency_code_check
  check (currency_code in ('INR', 'USD', 'EUR'));
