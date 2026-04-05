-- Timestamp maintenance

create trigger trg_users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger trg_projects_ensure_slug
before insert or update on public.projects
for each row execute function public.ensure_project_slug();

create trigger trg_projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger trg_project_settings_set_updated_at
before update on public.project_settings
for each row execute function public.set_updated_at();

create trigger trg_project_departments_set_updated_at
before update on public.project_departments
for each row execute function public.set_updated_at();

create trigger trg_project_members_set_updated_at
before update on public.project_members
for each row execute function public.set_updated_at();

create trigger trg_project_join_requests_set_updated_at
before update on public.project_join_requests
for each row execute function public.set_updated_at();

create trigger trg_vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

create trigger trg_trips_set_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

create trigger trg_fuel_logs_set_updated_at
before update on public.fuel_logs
for each row execute function public.set_updated_at();

create trigger trg_rentals_set_updated_at
before update on public.rentals
for each row execute function public.set_updated_at();

create trigger trg_rental_items_set_updated_at
before update on public.rental_items
for each row execute function public.set_updated_at();

create trigger trg_asset_checkouts_set_updated_at
before update on public.asset_checkouts
for each row execute function public.set_updated_at();

create trigger trg_crew_members_set_updated_at
before update on public.crew_members
for each row execute function public.set_updated_at();

create trigger trg_attendance_logs_derive_values
before insert or update on public.attendance_logs
for each row execute function public.sync_attendance_derived_values();

create trigger trg_attendance_logs_set_updated_at
before update on public.attendance_logs
for each row execute function public.set_updated_at();

create trigger trg_overtime_logs_set_updated_at
before update on public.overtime_logs
for each row execute function public.set_updated_at();

create trigger trg_wage_records_set_updated_at
before update on public.wage_records
for each row execute function public.set_updated_at();

create trigger trg_batta_requests_set_updated_at
before update on public.batta_requests
for each row execute function public.set_updated_at();

create trigger trg_expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create trigger trg_petty_cash_set_updated_at
before update on public.petty_cash
for each row execute function public.set_updated_at();

create trigger trg_receipts_set_updated_at
before update on public.receipts
for each row execute function public.set_updated_at();

create trigger trg_vendor_payments_set_updated_at
before update on public.vendor_payments
for each row execute function public.set_updated_at();

create trigger trg_costumes_set_updated_at
before update on public.costumes
for each row execute function public.set_updated_at();

create trigger trg_laundry_logs_set_updated_at
before update on public.laundry_logs
for each row execute function public.set_updated_at();

create trigger trg_continuity_logs_set_updated_at
before update on public.continuity_logs
for each row execute function public.set_updated_at();

create trigger trg_approvals_set_updated_at
before update on public.approvals
for each row execute function public.set_updated_at();

create trigger trg_financial_metrics_set_updated_at
before update on public.financial_metrics
for each row execute function public.set_updated_at();

create trigger trg_user_notification_preferences_set_updated_at
before update on public.user_notification_preferences
for each row execute function public.set_updated_at();

create trigger trg_integration_connections_set_updated_at
before update on public.integration_connections
for each row execute function public.set_updated_at();

-- Auth/profile bootstrap

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Project lifecycle

create trigger trg_projects_owner_membership
after insert on public.projects
for each row execute function public.ensure_project_owner_membership();

create trigger trg_project_join_requests_review
before update on public.project_join_requests
for each row execute function public.apply_join_request_review();

-- Alerts and approval sync

create trigger trg_transport_alerts_sync_alerts
after insert or update on public.transport_alerts
for each row execute function public.sync_transport_alert_to_alerts();

create trigger trg_approvals_sync_target
before update on public.approvals
for each row execute function public.sync_approval_target();

create trigger trg_approvals_sync_alerts
after insert or update on public.approvals
for each row execute function public.sync_approval_alert();

-- Audit trail

create trigger trg_projects_audit
after insert or update or delete on public.projects
for each row execute function public.audit_row_change();

create trigger trg_project_members_audit
after insert or update or delete on public.project_members
for each row execute function public.audit_row_change();

create trigger trg_project_join_requests_audit
after insert or update or delete on public.project_join_requests
for each row execute function public.audit_row_change();

create trigger trg_trips_audit
after insert or update or delete on public.trips
for each row execute function public.audit_row_change();

create trigger trg_fuel_logs_audit
after insert or update or delete on public.fuel_logs
for each row execute function public.audit_row_change();

create trigger trg_transport_alerts_audit
after insert or update or delete on public.transport_alerts
for each row execute function public.audit_row_change();

create trigger trg_assets_audit
after insert or update or delete on public.assets
for each row execute function public.audit_row_change();

create trigger trg_asset_checkouts_audit
after insert or update or delete on public.asset_checkouts
for each row execute function public.audit_row_change();

create trigger trg_attendance_logs_audit
after insert or update or delete on public.attendance_logs
for each row execute function public.audit_row_change();

create trigger trg_overtime_logs_audit
after insert or update or delete on public.overtime_logs
for each row execute function public.audit_row_change();

create trigger trg_wage_records_audit
after insert or update or delete on public.wage_records
for each row execute function public.audit_row_change();

create trigger trg_batta_requests_audit
after insert or update or delete on public.batta_requests
for each row execute function public.audit_row_change();

create trigger trg_expenses_audit
after insert or update or delete on public.expenses
for each row execute function public.audit_row_change();

create trigger trg_vendor_payments_audit
after insert or update or delete on public.vendor_payments
for each row execute function public.audit_row_change();

create trigger trg_costumes_audit
after insert or update or delete on public.costumes
for each row execute function public.audit_row_change();

create trigger trg_continuity_logs_audit
after insert or update or delete on public.continuity_logs
for each row execute function public.audit_row_change();

create trigger trg_approvals_audit
after insert or update or delete on public.approvals
for each row execute function public.audit_row_change();

create trigger trg_alerts_audit
after insert or update or delete on public.alerts
for each row execute function public.audit_row_change();
