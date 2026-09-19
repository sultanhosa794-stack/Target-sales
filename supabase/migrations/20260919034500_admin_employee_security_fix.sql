-- Target & Sales 1.2.0: preserve baseline while fixing admin employee operations.
-- The functions remain callable only by authenticated users and enforce system_admin internally.

create or replace function public.admin_create_employee(p_full_name text, p_username text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'private', 'extensions'
as $$
declare v_id uuid := gen_random_uuid();
begin
 if public.current_profile_role() <> 'system_admin' then raise exception 'Not authorized'; end if;
 if length(trim(p_full_name)) < 2 or length(trim(p_username)) < 2 or length(p_password) < 8 then raise exception 'Invalid employee data'; end if;
 if exists(select 1 from public.profiles where username=trim(p_username)) then raise exception 'Username already exists'; end if;
 insert into public.profiles(id,full_name,username,role,active) values(v_id,trim(p_full_name),trim(p_username),'employee',true);
 insert into private.legacy_credentials(profile_id,password_hash,must_change_password) values(v_id,crypt(p_password,gen_salt('bf')),false);
 return v_id;
end $$;

create or replace function public.admin_set_employee_active(p_employee_id uuid, p_active boolean)
returns boolean
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
begin
 if public.current_profile_role() <> 'system_admin' then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.profiles where id=p_employee_id and role='employee') then raise exception 'Employee not found'; end if;
 update public.profiles set active=p_active,updated_at=now() where id=p_employee_id;
 perform private.log_event(public.current_profile_id(),case when p_active then 'activate_employee' else 'suspend_employee' end,'profile',p_employee_id::text,null,jsonb_build_object('active',p_active));
 return true;
end $$;

create or replace function public.admin_delete_employee(p_employee_id uuid)
returns boolean
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
begin
 if public.current_profile_role() <> 'system_admin' then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.profiles where id=p_employee_id and role='employee') then raise exception 'Employee not found'; end if;
 update public.profiles set active=false, username='deleted_'||p_employee_id::text, full_name=full_name||' (محذوف)', updated_at=now() where id=p_employee_id;
 delete from private.legacy_credentials where profile_id=p_employee_id;
 update public.device_bindings set active=false where employee_id=p_employee_id and active=true;
 return true;
end $$;

revoke all on function public.admin_create_employee(text,text,text) from public, anon;
revoke all on function public.admin_set_employee_active(uuid,boolean) from public, anon;
revoke all on function public.admin_delete_employee(uuid) from public, anon;
grant execute on function public.admin_create_employee(text,text,text) to authenticated;
grant execute on function public.admin_set_employee_active(uuid,boolean) to authenticated;
grant execute on function public.admin_delete_employee(uuid) to authenticated;

-- The 01:30 alert is server/cron driven; clients do not need direct execute permission.
revoke all on function public.send_open_shift_0130_alert() from public, anon, authenticated;
grant execute on function public.send_open_shift_0130_alert() to service_role;
