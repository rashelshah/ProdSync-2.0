-- Row Level Security for ProdSync.

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_settings enable row level security;
alter table public.project_departments enable row level security;
alter table public.project_members enable row level security;
alter table public.project_join_requests enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.fuel_logs enable row level security;
alter table public.gps_logs enable row level security;
alter table public.transport_alerts enable row level security;
alter table public.assets enable row level security;
alter table public.rentals enable row level security;
alter table public.rental_items enable row level security;
alter table public.asset_checkouts enable row level security;
alter table public.asset_logs enable row level security;
alter table public.crew_members enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.overtime_logs enable row level security;
alter table public.wage_records enable row level security;
alter table public.batta_requests enable row level security;
alter table public.expenses enable row level security;
alter table public.petty_cash enable row level security;
alter table public.receipts enable row level security;
alter table public.vendor_payments enable row level security;
alter table public.costumes enable row level security;
alter table public.laundry_logs enable row level security;
alter table public.continuity_logs enable row level security;
alter table public.approvals enable row level security;
alter table public.approval_actions enable row level security;
alter table public.report_snapshots enable row level security;
alter table public.financial_metrics enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_acknowledgements enable row level security;
alter table public.activity_logs enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.integration_connections enable row level security;

alter table public.users force row level security;
alter table public.projects force row level security;
alter table public.project_settings force row level security;
alter table public.project_departments force row level security;
alter table public.project_members force row level security;
alter table public.project_join_requests force row level security;
alter table public.vehicles force row level security;
alter table public.trips force row level security;
alter table public.fuel_logs force row level security;
alter table public.gps_logs force row level security;
alter table public.transport_alerts force row level security;
alter table public.assets force row level security;
alter table public.rentals force row level security;
alter table public.rental_items force row level security;
alter table public.asset_checkouts force row level security;
alter table public.asset_logs force row level security;
alter table public.crew_members force row level security;
alter table public.attendance_logs force row level security;
alter table public.overtime_logs force row level security;
alter table public.wage_records force row level security;
alter table public.batta_requests force row level security;
alter table public.expenses force row level security;
alter table public.petty_cash force row level security;
alter table public.receipts force row level security;
alter table public.vendor_payments force row level security;
alter table public.costumes force row level security;
alter table public.laundry_logs force row level security;
alter table public.continuity_logs force row level security;
alter table public.approvals force row level security;
alter table public.approval_actions force row level security;
alter table public.report_snapshots force row level security;
alter table public.financial_metrics force row level security;
alter table public.alerts force row level security;
alter table public.alert_acknowledgements force row level security;
alter table public.activity_logs force row level security;
alter table public.user_notification_preferences force row level security;
alter table public.integration_connections force row level security;

-- User profile and tenancy core

create policy users_select_self_or_shared_project
on public.users
for select
using (auth.uid() = id or public.shares_project_with(id));

create policy users_insert_self
on public.users
for insert
with check (auth.uid() = id);

create policy users_update_self
on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy projects_select_member_scope
on public.projects
for select
using (public.is_project_member(id));

create policy projects_insert_producer_only
on public.projects
for insert
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('EP', 'LINE_PRODUCER')
  )
);

create policy projects_update_manager_only
on public.projects
for update
using (public.can_manage_project(id))
with check (public.can_manage_project(id));

create policy projects_delete_owner_only
on public.projects
for delete
using (public.is_project_owner(id));

create policy project_settings_select_member_scope
on public.project_settings
for select
using (public.is_project_member(project_id));

create policy project_settings_manage_project
on public.project_settings
for all
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

create policy project_departments_select_member_scope
on public.project_departments
for select
using (public.is_project_member(project_id));

create policy project_departments_manage_project
on public.project_departments
for all
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

create policy project_members_select_scoped
on public.project_members
for select
using (
  public.can_view_member_record(project_id, department, user_id)
);

create policy project_members_manage_project
on public.project_members
for all
using (public.can_manage_project(project_id))
with check (public.can_manage_project(project_id));

create policy project_join_requests_select_requester_or_manager
on public.project_join_requests
for select
using (
  user_id = auth.uid()
  or public.can_manage_project(project_id)
);

create policy project_join_requests_insert_requester
on public.project_join_requests
for insert
with check (
  user_id = auth.uid()
  and not public.is_project_member(project_id)
);

create policy project_join_requests_update_requester_or_manager
on public.project_join_requests
for update
using (
  user_id = auth.uid()
  or public.can_manage_project(project_id)
)
with check (
  user_id = auth.uid()
  or public.can_manage_project(project_id)
);

create policy project_join_requests_delete_requester_or_manager
on public.project_join_requests
for delete
using (
  user_id = auth.uid()
  or public.can_manage_project(project_id)
);

-- Transport

create policy vehicles_select_transport_scope
on public.vehicles
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'transport')
    or assigned_driver_user_id = auth.uid()
  )
);

create policy vehicles_manage_transport_scope
on public.vehicles
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'transport')
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'transport')
);

create policy trips_select_transport_scope
on public.trips
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'transport')
    or driver_user_id = auth.uid()
    or created_by = auth.uid()
  )
);

create policy trips_insert_transport_scope
on public.trips
for insert
with check (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'transport')
    or driver_user_id = auth.uid()
    or created_by = auth.uid()
  )
);

create policy trips_update_transport_scope
on public.trips
for update
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'transport')
  or driver_user_id = auth.uid()
  or created_by = auth.uid()
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'transport')
  or driver_user_id = auth.uid()
  or created_by = auth.uid()
);

create policy trips_delete_transport_scope
on public.trips
for delete
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'transport')
);

create policy fuel_logs_select_transport_scope
on public.fuel_logs
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_view_financial_record(project_id, 'transport', logged_by)
    or exists (
      select 1
      from public.vehicles v
      where v.id = fuel_logs.vehicle_id
        and v.assigned_driver_user_id = auth.uid()
    )
  )
);

create policy fuel_logs_manage_transport_scope
on public.fuel_logs
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'transport')
  or logged_by = auth.uid()
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'transport')
  or logged_by = auth.uid()
);

create policy gps_logs_select_transport_scope
on public.gps_logs
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'transport')
    or exists (
      select 1
      from public.vehicles v
      where v.id = gps_logs.vehicle_id
        and v.assigned_driver_user_id = auth.uid()
    )
  )
);

create policy gps_logs_manage_transport_scope
on public.gps_logs
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'transport')
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'transport')
);

create policy transport_alerts_select_project_scope
on public.transport_alerts
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'transport')
  )
);

create policy transport_alerts_manage_project_scope
on public.transport_alerts
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'transport')
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'transport')
);

-- Camera and assets

create policy assets_select_camera_scope
on public.assets
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, department)
    or department = 'camera' and public.get_user_role(project_id) = 'DATA_WRANGLER'
  )
);

create policy assets_manage_camera_scope
on public.assets
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, department)
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, department)
);

create policy rentals_select_camera_scope
on public.rentals
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_view_financial_record(project_id, department, created_by)
    or department = 'camera' and public.get_user_role(project_id) = 'DATA_WRANGLER'
  )
);

create policy rentals_manage_camera_scope
on public.rentals
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, department)
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, department)
);

create policy rental_items_select_camera_scope
on public.rental_items
for select
using (
  exists (
    select 1
    from public.rentals r
    where r.id = rental_items.rental_id
      and (
        public.can_manage_project(r.project_id)
        or public.can_view_financial_record(r.project_id, r.department, r.created_by)
        or (r.department = 'camera' and public.get_user_role(r.project_id) = 'DATA_WRANGLER')
      )
  )
);

create policy rental_items_manage_camera_scope
on public.rental_items
for all
using (
  exists (
    select 1
    from public.rentals r
    where r.id = rental_items.rental_id
      and (
        public.can_manage_project(r.project_id)
        or public.can_access_department(r.project_id, r.department)
      )
  )
)
with check (
  exists (
    select 1
    from public.rentals r
    where r.id = rental_items.rental_id
      and (
        public.can_manage_project(r.project_id)
        or public.can_access_department(r.project_id, r.department)
      )
  )
);

create policy asset_checkouts_select_camera_scope
on public.asset_checkouts
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or checkout_to_user_id = auth.uid()
    or exists (
      select 1
      from public.assets a
      where a.id = asset_checkouts.asset_id
        and public.can_access_department(asset_checkouts.project_id, a.department)
    )
  )
);

create policy asset_checkouts_manage_camera_scope
on public.asset_checkouts
for all
using (
  public.can_manage_project(project_id)
  or exists (
    select 1
    from public.assets a
    where a.id = asset_checkouts.asset_id
      and public.can_access_department(asset_checkouts.project_id, a.department)
  )
)
with check (
  public.can_manage_project(project_id)
  or exists (
    select 1
    from public.assets a
    where a.id = asset_checkouts.asset_id
      and public.can_access_department(asset_checkouts.project_id, a.department)
  )
);

create policy asset_logs_select_camera_scope
on public.asset_logs
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or exists (
      select 1
      from public.assets a
      where a.id = asset_logs.asset_id
        and public.can_access_department(asset_logs.project_id, a.department)
    )
    or actor_user_id = auth.uid()
  )
);

create policy asset_logs_manage_camera_scope
on public.asset_logs
for all
using (
  public.can_manage_project(project_id)
  or actor_user_id = auth.uid()
)
with check (
  public.can_manage_project(project_id)
  or actor_user_id = auth.uid()
);

-- Crew and wages

create policy crew_members_select_scoped
on public.crew_members
for select
using (
  public.can_view_member_record(project_id, department, user_id)
);

create policy crew_members_manage_scoped
on public.crew_members
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, department)
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, department)
);

create policy attendance_logs_select_scoped
on public.attendance_logs
for select
using (
  public.can_view_member_record(
    project_id,
    (select cm.department from public.crew_members cm where cm.id = attendance_logs.crew_member_id),
    user_id
  )
);

create policy attendance_logs_manage_scoped
on public.attendance_logs
for all
using (
  public.can_manage_project(project_id)
  or auth.uid() = user_id
  or public.can_access_department(
    project_id,
    (select cm.department from public.crew_members cm where cm.id = attendance_logs.crew_member_id)
  )
)
with check (
  public.can_manage_project(project_id)
  or auth.uid() = user_id
  or public.can_access_department(
    project_id,
    (select cm.department from public.crew_members cm where cm.id = attendance_logs.crew_member_id)
  )
);

create policy overtime_logs_select_scoped
on public.overtime_logs
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, department)
    or exists (
      select 1
      from public.crew_members cm
      where cm.id = overtime_logs.crew_member_id
        and cm.user_id = auth.uid()
    )
  )
);

create policy overtime_logs_manage_scoped
on public.overtime_logs
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, department)
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, department)
);

create policy wage_records_select_scoped
on public.wage_records
for select
using (
  public.can_view_financial_record(
    project_id,
    (select cm.department from public.crew_members cm where cm.id = wage_records.crew_member_id),
    (select cm.user_id from public.crew_members cm where cm.id = wage_records.crew_member_id)
  )
);

create policy wage_records_manage_scoped
on public.wage_records
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(
    project_id,
    (select cm.department from public.crew_members cm where cm.id = wage_records.crew_member_id)
  )
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(
    project_id,
    (select cm.department from public.crew_members cm where cm.id = wage_records.crew_member_id)
  )
);

create policy batta_requests_select_scoped
on public.batta_requests
for select
using (
  public.can_view_financial_record(
    project_id,
    (select cm.department from public.crew_members cm where cm.id = batta_requests.crew_member_id),
    requested_by
  )
);

create policy batta_requests_manage_scoped
on public.batta_requests
for all
using (
  public.can_manage_project(project_id)
  or requested_by = auth.uid()
  or public.can_access_department(
    project_id,
    (select cm.department from public.crew_members cm where cm.id = batta_requests.crew_member_id)
  )
)
with check (
  public.can_manage_project(project_id)
  or requested_by = auth.uid()
  or public.can_access_department(
    project_id,
    (select cm.department from public.crew_members cm where cm.id = batta_requests.crew_member_id)
  )
);

-- Expenses and finance

create policy expenses_select_scoped
on public.expenses
for select
using (
  public.can_view_financial_record(project_id, department, requested_by)
);

create policy expenses_manage_scoped
on public.expenses
for all
using (
  public.can_manage_project(project_id)
  or requested_by = auth.uid()
  or public.can_access_department(project_id, department)
)
with check (
  public.can_manage_project(project_id)
  or requested_by = auth.uid()
  or public.can_access_department(project_id, department)
);

create policy petty_cash_select_scoped
on public.petty_cash
for select
using (
  public.can_view_financial_record(project_id, department, custodian_user_id)
);

create policy petty_cash_manage_scoped
on public.petty_cash
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, department)
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, department)
);

create policy receipts_select_scoped
on public.receipts
for select
using (
  public.is_project_member(project_id)
  and (
    uploaded_by = auth.uid()
    or public.can_manage_project(project_id)
    or (
      expense_id is not null
      and exists (
        select 1
        from public.expenses e
        where e.id = receipts.expense_id
          and public.can_view_financial_record(e.project_id, e.department, e.requested_by)
      )
    )
    or (
      fuel_log_id is not null
      and exists (
        select 1
        from public.fuel_logs fl
        where fl.id = receipts.fuel_log_id
          and (
            public.can_manage_project(fl.project_id)
            or public.can_view_financial_record(fl.project_id, 'transport', fl.logged_by)
          )
      )
    )
  )
);

create policy receipts_manage_scoped
on public.receipts
for all
using (
  uploaded_by = auth.uid()
  or public.can_manage_project(project_id)
)
with check (
  uploaded_by = auth.uid()
  or public.can_manage_project(project_id)
);

create policy vendor_payments_select_scoped
on public.vendor_payments
for select
using (
  public.can_view_financial_record(project_id, department)
);

create policy vendor_payments_manage_scoped
on public.vendor_payments
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, department)
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, department)
);

-- Wardrobe

create policy costumes_select_scoped
on public.costumes
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'wardrobe')
  )
);

create policy costumes_manage_scoped
on public.costumes
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'wardrobe')
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'wardrobe')
);

create policy laundry_logs_select_scoped
on public.laundry_logs
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'wardrobe')
    or logged_by = auth.uid()
  )
);

create policy laundry_logs_manage_scoped
on public.laundry_logs
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'wardrobe')
  or logged_by = auth.uid()
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'wardrobe')
  or logged_by = auth.uid()
);

create policy continuity_logs_select_scoped
on public.continuity_logs
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or public.can_access_department(project_id, 'wardrobe')
    or logged_by = auth.uid()
  )
);

create policy continuity_logs_manage_scoped
on public.continuity_logs
for all
using (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'wardrobe')
  or logged_by = auth.uid()
)
with check (
  public.can_manage_project(project_id)
  or public.can_access_department(project_id, 'wardrobe')
  or logged_by = auth.uid()
);

-- Approvals and reporting

create policy approvals_select_scoped
on public.approvals
for select
using (
  public.is_project_member(project_id)
  and (
    public.can_manage_project(project_id)
    or requested_by = auth.uid()
    or public.can_access_department(project_id, department)
  )
);

create policy approvals_insert_scoped
on public.approvals
for insert
with check (
  requested_by = auth.uid()
  and public.is_project_member(project_id)
);

create policy approvals_update_scoped
on public.approvals
for update
using (
  public.can_approve(auth.uid(), project_id)
  or requested_by = auth.uid()
)
with check (
  public.can_approve(auth.uid(), project_id)
  or requested_by = auth.uid()
);

create policy approvals_delete_manager_only
on public.approvals
for delete
using (
  public.can_manage_project(project_id)
);

create policy approval_actions_select_scoped
on public.approval_actions
for select
using (
  public.is_project_member(project_id)
);

create policy approval_actions_insert_scoped
on public.approval_actions
for insert
with check (
  actor_id = auth.uid()
  and (
    public.can_approve(auth.uid(), project_id)
    or public.is_project_member(project_id)
  )
);

create policy report_snapshots_select_manager_only
on public.report_snapshots
for select
using (
  public.can_manage_project(project_id)
);

create policy report_snapshots_manage_manager_only
on public.report_snapshots
for all
using (
  public.can_manage_project(project_id)
)
with check (
  public.can_manage_project(project_id)
);

create policy financial_metrics_select_scoped
on public.financial_metrics
for select
using (
  public.can_manage_project(project_id)
  or (
    department is not null
    and public.can_access_department(project_id, department)
  )
);

create policy financial_metrics_manage_manager_only
on public.financial_metrics
for all
using (
  public.can_manage_project(project_id)
)
with check (
  public.can_manage_project(project_id)
);

-- Alerts, audit, and settings

create policy alerts_select_project_scope
on public.alerts
for select
using (
  public.is_project_member(project_id)
);

create policy alerts_update_leads_only
on public.alerts
for update
using (
  public.can_manage_project(project_id)
  or public.get_user_role(project_id) in ('HOD', 'SUPERVISOR')
)
with check (
  public.can_manage_project(project_id)
  or public.get_user_role(project_id) in ('HOD', 'SUPERVISOR')
);

create policy alert_acknowledgements_select_own
on public.alert_acknowledgements
for select
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.alerts a
    where a.id = alert_acknowledgements.alert_id
      and public.is_project_member(a.project_id)
  )
);

create policy alert_acknowledgements_insert_own
on public.alert_acknowledgements
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.alerts a
    where a.id = alert_acknowledgements.alert_id
      and public.is_project_member(a.project_id)
  )
);

create policy alert_acknowledgements_delete_own
on public.alert_acknowledgements
for delete
using (user_id = auth.uid());

create policy activity_logs_select_project_scope
on public.activity_logs
for select
using (
  (project_id is null and user_id = auth.uid())
  or (project_id is not null and public.is_project_member(project_id))
);

create policy user_notification_preferences_select_own
on public.user_notification_preferences
for select
using (user_id = auth.uid());

create policy user_notification_preferences_manage_own
on public.user_notification_preferences
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy integration_connections_select_scoped
on public.integration_connections
for select
using (
  created_by = auth.uid()
  or (project_id is not null and public.is_project_member(project_id))
);

create policy integration_connections_manage_scoped
on public.integration_connections
for all
using (
  created_by = auth.uid()
  or (project_id is not null and public.can_manage_project(project_id))
)
with check (
  created_by = auth.uid()
  and (project_id is null or public.can_manage_project(project_id))
);
