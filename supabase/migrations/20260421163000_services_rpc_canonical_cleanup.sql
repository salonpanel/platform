-- Canonical cleanup for Servicios RPCs
-- Goal: remove legacy/unsafe signatures and keep only the hardened versions.

-- ---------------------------------------------------------------------
-- Drop legacy signatures (if they exist)
-- ---------------------------------------------------------------------

-- manage_list_services legacy signature (no price/buffer args)
drop function if exists public.manage_list_services(
  uuid,
  text,
  text,
  text,
  text,
  text
);

-- manage_create_service legacy signature (no media_url arg)
drop function if exists public.manage_create_service(
  uuid,
  text,
  integer,
  integer,
  text,
  integer,
  text,
  boolean,
  jsonb
);

-- manage_update_service legacy signature (no media_url arg)
drop function if exists public.manage_update_service(
  uuid,
  uuid,
  text,
  integer,
  integer,
  text,
  integer,
  text,
  boolean,
  jsonb
);

-- ---------------------------------------------------------------------
-- Revoke EXECUTE from anon/public on current signatures (defense in depth)
-- ---------------------------------------------------------------------

revoke execute on function public.manage_list_services(
  uuid, text, text, text, text, text, integer, integer, text
) from public;
revoke execute on function public.manage_list_services(
  uuid, text, text, text, text, text, integer, integer, text
) from anon;

revoke execute on function public.manage_create_service(
  uuid, text, integer, integer, text, integer, text, text, boolean, jsonb
) from public;
revoke execute on function public.manage_create_service(
  uuid, text, integer, integer, text, integer, text, text, boolean, jsonb
) from anon;

revoke execute on function public.manage_update_service(
  uuid, uuid, text, integer, integer, text, integer, text, text, boolean, jsonb
) from public;
revoke execute on function public.manage_update_service(
  uuid, uuid, text, integer, integer, text, integer, text, text, boolean, jsonb
) from anon;

revoke execute on function public.manage_duplicate_service(uuid, uuid) from public;
revoke execute on function public.manage_duplicate_service(uuid, uuid) from anon;

revoke execute on function public.manage_delete_service(uuid, uuid) from public;
revoke execute on function public.manage_delete_service(uuid, uuid) from anon;

-- ---------------------------------------------------------------------
-- Grants: authenticated + service_role only
-- ---------------------------------------------------------------------

grant execute on function public.manage_list_services(
  uuid, text, text, text, text, text, integer, integer, text
) to authenticated;
grant execute on function public.manage_list_services(
  uuid, text, text, text, text, text, integer, integer, text
) to service_role;

grant execute on function public.manage_create_service(
  uuid, text, integer, integer, text, integer, text, text, boolean, jsonb
) to authenticated;
grant execute on function public.manage_create_service(
  uuid, text, integer, integer, text, integer, text, text, boolean, jsonb
) to service_role;

grant execute on function public.manage_update_service(
  uuid, uuid, text, integer, integer, text, integer, text, text, boolean, jsonb
) to authenticated;
grant execute on function public.manage_update_service(
  uuid, uuid, text, integer, integer, text, integer, text, text, boolean, jsonb
) to service_role;

grant execute on function public.manage_duplicate_service(uuid, uuid) to authenticated;
grant execute on function public.manage_duplicate_service(uuid, uuid) to service_role;

grant execute on function public.manage_delete_service(uuid, uuid) to authenticated;
grant execute on function public.manage_delete_service(uuid, uuid) to service_role;

