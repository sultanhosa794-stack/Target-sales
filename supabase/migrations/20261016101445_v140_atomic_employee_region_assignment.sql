-- Target & Sales 1.4.0: account creation must include active region membership.
-- The profile, region membership, and legacy login credentials are created atomically.
CREATE OR REPLACE FUNCTION public.admin_create_employee(
  p_full_name text,
  p_username text,
  p_password text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_id uuid := gen_random_uuid();
  v_region_id uuid;
BEGIN
  IF public.current_profile_role() IS DISTINCT FROM 'system_admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF length(trim(p_full_name)) < 2
     OR length(trim(p_username)) < 2
     OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Invalid employee data';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE username = trim(p_username)
  ) THEN
    RAISE EXCEPTION 'Username already exists';
  END IF;

  SELECT id INTO STRICT v_region_id
  FROM public.regions
  WHERE name = 'الجنوبية'
    AND shift_type = 'evening'
    AND active = true;

  INSERT INTO public.profiles(id, full_name, username, role, active)
  VALUES (v_id, trim(p_full_name), trim(p_username), 'employee', true);

  INSERT INTO public.region_memberships(user_id, region_id, access_level)
  VALUES (v_id, v_region_id, 'employee');

  INSERT INTO public.login_credentials(profile_id, password_hash)
  VALUES (v_id, extensions.crypt(p_password, extensions.gen_salt('bf')));

  RETURN v_id;
END
$function$;

REVOKE ALL ON FUNCTION public.admin_create_employee(text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_employee(text, text, text)
  TO authenticated;
