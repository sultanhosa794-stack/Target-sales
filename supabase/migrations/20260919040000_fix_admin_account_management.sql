-- Target & Sales 1.2.1 account-management hotfix
-- Preserve historical shifts/sales; only account/profile/device access is changed.

create or replace function public.admin_delete_employee(p_employee_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_role text;
begin
  v_role := public.current_profile_role();
  if v_role <> 'system_admin' then
    raise exception 'Not authorized';
  end if;

  if not exists(select 1 from public.profiles where id=p_employee_id and role='employee') then
    raise exception 'Employee not found';
  end if;

  update public.profiles
     set active=false,
         username='deleted_' || p_employee_id::text,
         full_name=case when full_name like '% (محذوف)' then full_name else full_name || ' (محذوف)' end,
         updated_at=now()
   where id=p_employee_id and role='employee';

  delete from private.legacy_credentials where profile_id=p_employee_id;
  update public.device_bindings set active=false where employee_id=p_employee_id and active=true;
  update public.device_change_requests set status='rejected', reviewed_at=now()
   where employee_id=p_employee_id and status='pending';

  return true;
end;
$$;

create or replace function public.admin_set_employee_active(p_employee_id uuid,p_active boolean)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if public.current_profile_role() <> 'system_admin' then
    raise exception 'Not authorized';
  end if;
  if not exists(select 1 from public.profiles where id=p_employee_id and role='employee') then
    raise exception 'Employee not found';
  end if;
  if p_active and exists(select 1 from public.profiles where id=p_employee_id and full_name like '% (محذوف)') then
    raise exception 'Deleted account cannot be reactivated';
  end if;
  update public.profiles set active=p_active,updated_at=now() where id=p_employee_id and role='employee';
  if not p_active then
    update public.device_bindings set active=false where employee_id=p_employee_id and active=true;
  end if;
  return true;
end;
$$;

revoke all on function public.admin_delete_employee(uuid) from public, anon, authenticated;
revoke all on function public.admin_set_employee_active(uuid,boolean) from public, anon, authenticated;
grant execute on function public.admin_delete_employee(uuid) to authenticated;
grant execute on function public.admin_set_employee_active(uuid,boolean) to authenticated;
