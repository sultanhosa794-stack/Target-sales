-- Non-destructive structural checks for 1.2.1
begin;
select to_regprocedure('public.admin_delete_employee(uuid)') is not null as delete_rpc_exists;
select to_regprocedure('public.admin_set_employee_active(uuid,boolean)') is not null as active_rpc_exists;
select count(*) >= 0 as historical_sales_readable from public.sales_entries;
select count(*) >= 0 as historical_shifts_readable from public.shifts;
rollback;
