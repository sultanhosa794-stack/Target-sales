-- Target & Sales 1.4.0: keep equivalent region membership read access with one RLS policy.
DROP POLICY IF EXISTS region_memberships_read_own ON public.region_memberships;
DROP POLICY IF EXISTS region_memberships_read_staff ON public.region_memberships;
CREATE POLICY region_memberships_read_self_or_staff
ON public.region_memberships
FOR SELECT TO authenticated
USING (
  user_id = public.current_profile_id()
  OR public.current_profile_role() = ANY (ARRAY['system_admin'::text, 'manager'::text])
);
