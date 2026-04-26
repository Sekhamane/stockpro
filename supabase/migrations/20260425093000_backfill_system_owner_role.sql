-- Backfill system owner role for the configured owner email.
-- This handles the case where the user already existed before role-based admin was introduced.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'system_owner'::public.app_role
FROM auth.users
WHERE lower(email) = 'sekhamane@digniholdings.com'
ON CONFLICT (user_id, role) DO NOTHING;
