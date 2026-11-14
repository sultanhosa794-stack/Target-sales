-- Allow system administrators to correct sales even when no sales row exists yet.
-- A new entry is linked to the day's shift region, or the employee's active region membership.
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
  v_shift_id uuid;
  v_region_id uuid;
  v_created boolean := false;
  v_before jsonb;
  v_after jsonb;
  v_units integer;
  v_points integer;
begin
  if public.current_profile_role() is distinct from 'system_admin' then
    raise exception 'not_allowed';
  end if;

  if least(p35,p58,p75,p104) < 0
     or greatest(p35,p58,p75,p104) > 100
     or p35+p58+p75+p104 > 100 then
    raise exception 'invalid_quantity';
  end if;

  select * into v_entry
  from public.sales_entries
  where employee_id=p_employee_id and business_date=p_business_date
  for update;

  if not found then
    select s.id, s.region_id
      into v_shift_id, v_region_id
    from public.shifts s
    where s.employee_id=p_employee_id and s.business_date=p_business_date;

    if v_region_id is null then
      select rm.region_id
        into v_region_id
      from public.region_memberships rm
      join public.regions r on r.id=rm.region_id and r.active=true
      where rm.user_id=p_employee_id and rm.access_level='employee'
      order by rm.created_at desc
      limit 1;
    end if;

    if v_region_id is null then
      raise exception 'no_region';
    end if;

    insert into public.sales_entries(
      employee_id, region_id, business_date, shift_id,
      status, reviewed_by, reviewed_at
    )
    values (
      p_employee_id, v_region_id, p_business_date, v_shift_id,
      'approved', v_actor, now()
    )
    on conflict (employee_id, business_date) do nothing
    returning * into v_entry;

    if found then
      v_created := true;
    else
      -- Another admin may have created the row while this call was running.
      select * into v_entry
      from public.sales_entries
      where employee_id=p_employee_id and business_date=p_business_date
      for update;
      if not found then raise exception 'sales_not_found'; end if;
    end if;
  end if;

  if v_created then
    v_before := null;
  else
    select jsonb_build_object(
      'status', v_entry.status,
      'items', coalesce(
        jsonb_agg(jsonb_build_object(
          'package_code', package_code,
          'quantity', quantity
        ) order by package_code),
        '[]'::jsonb
      )
    )
    into v_before
    from public.sales_items
    where sales_entry_id=v_entry.id;
  end if;

  insert into public.sales_items(sales_entry_id,package_code,quantity,points_per_unit)
  values
    (v_entry.id,'35',p35,5),
    (v_entry.id,'58',p58,10),
    (v_entry.id,'75',p75,10),
    (v_entry.id,'104',p104,12)
  on conflict (sales_entry_id,package_code)
  do update set quantity=excluded.quantity, points_per_unit=excluded.points_per_unit;

  update public.sales_entries
  set reviewed_by=v_actor, reviewed_at=now(), updated_at=now()
  where id=v_entry.id
  returning * into v_entry;

  select jsonb_build_object(
    'status', v_entry.status,
    'items', jsonb_agg(jsonb_build_object(
      'package_code', package_code,
      'quantity', quantity
    ) order by package_code)
  )
  into v_after
  from public.sales_items
  where sales_entry_id=v_entry.id;

  perform private.log_event(
    v_actor, 'admin_adjust_sales', 'sales_entry', v_entry.id::text,
    v_before, v_after
  );

  v_units := p35+p58+p75+p104;
  v_points := p35*5+p58*10+p75*10+p104*12;

  return jsonb_build_object(
    'sales_entry_id', v_entry.id,
    'total_units', v_units,
    'total_points', v_points,
    'status', v_entry.status
  );
end;
$$;

revoke all on function public.admin_adjust_employee_sales(uuid,date,integer,integer,integer,integer)
  from public, anon;
grant execute on function public.admin_adjust_employee_sales(uuid,date,integer,integer,integer,integer)
  to authenticated;
