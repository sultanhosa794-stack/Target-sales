-- Confirm only one authenticated SELECT policy is defined for region memberships.
DO $$
DECLARE
  policy_count integer;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'region_memberships'
    AND cmd = 'SELECT'
    AND 'authenticated' = ANY (roles);

  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Expected one authenticated SELECT policy on region_memberships, found %', policy_count;
  END IF;
END;
$$;
