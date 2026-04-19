-- Run this in the Supabase SQL editor to enable API key retrieval.

create or replace function get_user_api_key(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'api_key_' || p_user_id::text;
  return v_key;
end;
$$;

grant execute on function get_user_api_key(uuid) to service_role;
