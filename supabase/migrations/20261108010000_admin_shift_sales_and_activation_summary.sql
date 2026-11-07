-- System-admin controls for employee sales corrections and shift closure.
-- Sales package detail is preserved and every correction is audited.

create or replace function private.guard_shift()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare
  loc_lat double precision;
  loc_lng double precision;
  radius integer;
  d double precision;
  r text;
  admin_close boolean := false;
begin
  r := public.current_profile_role();
  if tg_op = 'INSERT' then
    if r = 'employee' and new.employee_id <> public.current_profile_id() then
      raise exception 'Cannot create shift for another employee';
    end if;
    if new.status = 'open' then
      if new.start_location_id is null or new.start_latitude is null or new.start_longitude is null then
        raise exception 'GPS and start location are required';
      end if;
      select latitude, longitude, radius_m into loc_lat, loc_lng, radius
      from public.work_locations where id = new.start_location_id and active = true;
      if loc_lat is null then raise exception 'Invalid or inactive location'; end if;
      d := private.haversine_m(new.start_latitude, new.start_longitude, loc_lat, loc_lng);
      new.start_distance_m := d;
      if d > radius then raise exception 'Outside allowed GPS radius'; end if;
      new.started_at := coalesce(new.started_at, now());
    end if;
  else
    if r = 'employee' and new.employee_id <> public.current_profile_id() then
      raise exception 'Cannot edit another employee shift';
    end if;
    if old.status = 'ended' and r = 'employee' then raise exception 'Ended shift cannot be edited'; end if;
    if old.status = 'absent' and r = 'employee' and new.status <> 'absent' then
      raise exception 'Absence can only be cleared by management';
    end if;
    if old.status = 'open' and new.status = 'ended' then
      admin_close := r = 'system_admin'
        and new.legacy_review_status = 'admin_closed_missing_checkout';
      if admin_close then
        new.end_latitude := null;
        new.end_longitude := null;
        new.end_distance_m := null;
        new.end_from_start_distance_m := null;
        new.ended_at := coalesce(new.ended_at, now());
      else
        if new.end_latitude is null or new.end_longitude is null then raise exception 'End GPS is required'; end if;
        new.ended_at := coalesce(new.ended_at, now());
        if old.start_latitude is not null then
          new.end_from_start_distance_m := private.haversine_m(old.start_latitude, old.start_longitude, new.end_latitude, new.end_longitude);
        end if;
        if old.start_location_id is not null then
          select latitude, longitude into loc_lat, loc_lng from public.work_locations where id = old.start_location_id;
          if loc_lat is not null then new.end_distance_m := private.haversine_m(new.end_latitude, new.end_longitude, loc_lat, loc_lng); end if;
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.admin_close_employee_shift(p_employee_id uuid, p_business_date date)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare
  v_shift public.shifts%rowtype;
  v_actor uuid := public.current_profile_id();
begin
  if public.current_profile_role() is distinct from 'system_admin' then raise exception 'not_allowed'; end if;
  select * into v_shift from public.shifts
   where employee_id = p_employee_id and business_date = p_business_date for update;
  if not found then raise exception 'shift_not_found'; end if;
  if v_shift.status <> 'open' then raise exception 'shift_not_open'; end if;
  update public.shifts set status='ended', ended_at=now(),
    legacy_review_status='admin_closed_missing_checkout', updated_at=now()
   where id=v_shift.id;
  perform private.log_event(v_actor,'admin_close_shift','shift',v_shift.id::text,
    to_jsonb(v_shift),jsonb_build_object('status','ended','business_date',p_business_date,'reason','system_admin_manual_close'));
  return true;
end;
$$;

create or replace function public.admin_adjust_employee_sales(
  p_employee_id uuid, p_business_date date,
  p35 integer, p58 integer, p75 integer, p104 integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare
  v_actor uuid := public.current_profile_id();
  v_entry public.sales_entries%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_units integer;
  v_points integer;
begin
  if public.current_profile_role() is distinct from 'system_admin' then raise exception 'not_allowed'; end if;
  if least(p35,p58,p75,p104) < 0 or greatest(p35,p58,p75,p104) > 100 or p35+p58+p75+p104 > 100 then
    raise exception 'invalid_quantity';
  end if;
  select * into v_entry from public.sales_entries
   where employee_id=p_employee_id and business_date=p_business_date for update;
  if not found then raise exception 'sales_not_found'; end if;
  select jsonb_build_object('status',v_entry.status,'items',coalesce(jsonb_agg(jsonb_build_object('package_code',package_code,'quantity',quantity) order by package_code),'[]'::jsonb))
    into v_before from public.sales_items where sales_entry_id=v_entry.id;
  insert into public.sales_items(sales_entry_id,package_code,quantity,points_per_unit) values
    (v_entry.id,'35',p35,5),(v_entry.id,'58',p58,10),(v_entry.id,'75',p75,10),(v_entry.id,'104',p104,12)
  on conflict(sales_entry_id,package_code) do update set quantity=excluded.quantity,points_per_unit=excluded.points_per_unit;
  update public.sales_entries set reviewed_by=v_actor, reviewed_at=now(), updated_at=now() where id=v_entry.id returning * into v_entry;
  select jsonb_build_object('status',v_entry.status,'items',jsonb_agg(jsonb_build_object('package_code',package_code,'quantity',quantity) order by package_code))
    into v_after from public.sales_items where sales_entry_id=v_entry.id;
  perform private.log_event(v_actor,'admin_adjust_sales','sales_entry',v_entry.id::text,v_before,v_after);
  v_units:=p35+p58+p75+p104;
  v_points:=p35*5+p58*10+p75*10+p104*12;
  return jsonb_build_object('sales_entry_id',v_entry.id,'total_units',v_units,'total_points',v_points,'status',v_entry.status);
end;
$$;

revoke all on function public.admin_close_employee_shift(uuid,date) from public, anon;
revoke all on function public.admin_adjust_employee_sales(uuid,date,integer,integer,integer,integer) from public, anon;
grant execute on function public.admin_close_employee_shift(uuid,date) to authenticated;
grant execute on function public.admin_adjust_employee_sales(uuid,date,integer,integer,integer,integer) to authenticated;
