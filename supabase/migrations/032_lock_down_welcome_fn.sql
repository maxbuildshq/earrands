-- notify_welcome_email() is a trigger function, not an API endpoint.
-- Revoke public execute so it can't be called via /rest/v1/rpc/.
-- Must revoke from PUBLIC (not just anon/authenticated) since they inherit from it.

REVOKE EXECUTE ON FUNCTION public.notify_welcome_email() FROM PUBLIC;
