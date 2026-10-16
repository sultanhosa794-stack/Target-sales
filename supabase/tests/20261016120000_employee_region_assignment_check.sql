-- Lightweight migration regression check: account creation must stay atomic and region-aware.
DO $$
DECLARE
  definition text;
BEGIN
  SELECT pg_get_functiondef('public.admin_create_employee(text,text,text)'::regprocedure)
    INTO definition;

  IF definition NOT ILIKE '%current_profile_role()%'
     OR definition NOT ILIKE '%system_admin%'
     OR definition NOT ILIKE '%region_memberships%'
     OR definition NOT ILIKE '%login_credentials%'
     OR definition NOT ILIKE '%الجنوبية%'
     OR definition NOT ILIKE '%evening%' THEN
    RAISE EXCEPTION 'admin_create_employee is missing an authorization, membership, or credential step';
  END IF;
END;
$$;
