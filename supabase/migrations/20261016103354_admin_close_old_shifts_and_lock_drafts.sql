CREATE OR REPLACE FUNCTION private.guard_shift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
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
      select latitude, longitude, radius_m
        into loc_lat, loc_lng, radius
        from public.work_locations
       where id = new.start_location_id and active = true;
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
    if old.status = 'ended' and r = 'employee' then
      raise exception 'Ended shift cannot be edited';
    end if;
    if old.status = 'absent' and r = 'employee' and new.status <> 'absent' then
      raise exception 'Absence can only be cleared by management';
    end if;

    if old.status = 'open' and new.status = 'ended' then
      admin_close := r = 'system_admin'
        and new.legacy_review_status = 'admin_closed_missing_checkout'
        and old.business_date < (now() at time zone 'Asia/Riyadh')::date;

      if admin_close then
        new.end_latitude := null;
        new.end_longitude := null;
        new.end_distance_m := null;
        new.end_from_start_distance_m := null;
        new.ended_at := coalesce(new.ended_at, now());
      else
        if new.end_latitude is null or new.end_longitude is null then
          raise exception 'End GPS is required';
        end if;
        new.ended_at := coalesce(new.ended_at, now());
        if old.start_latitude is not null then
          new.end_from_start_distance_m := private.haversine_m(
            old.start_latitude, old.start_longitude, new.end_latitude, new.end_longitude
          );
        end if;
        if old.start_location_id is not null then
          select latitude, longitude
            into loc_lat, loc_lng
            from public.work_locations
           where id = old.start_location_id;
          if loc_lat is not null then
            new.end_distance_m := private.haversine_m(new.end_latitude, new.end_longitude, loc_lat, loc_lng);
          end if;
        end if;
      end if;
    end if;
  end if;
  return new;
end
$function$;

CREATE OR REPLACE FUNCTION public.admin_close_old_shifts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
declare
  closed_count integer;
begin
  if public.current_profile_role() is distinct from 'system_admin' then
    raise exception 'Only system administrators can close old shifts';
  end if;

  update public.shifts
     set status = 'ended',
         ended_at = now(),
         legacy_review_status = 'admin_closed_missing_checkout',
         updated_at = now()
   where status = 'open'
     and business_date < (now() at time zone 'Asia/Riyadh')::date;

  get diagnostics closed_count = row_count;
  return closed_count;
end
$function$;

REVOKE ALL ON FUNCTION public.admin_close_old_shifts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_close_old_shifts() TO authenticated;
