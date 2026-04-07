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
