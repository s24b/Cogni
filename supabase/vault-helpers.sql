-- Run this in the Supabase SQL editor after enabling Vault.
-- Creates a public-schema wrapper so the JS client can call store_user_api_key via RPC.

create or replace function store_user_api_key(p_user_id uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_name text := 'api_key_' || p_user_id::text;
  existing_id uuid;
begin
  select id into existing_id from vault.secrets where name = secret_name;

  if existing_id is not null then
    perform vault.update_secret(existing_id, p_key, secret_name, 'User AI API key');
  else
    perform vault.create_secret(p_key, secret_name, 'User AI API key');
  end if;
end;
$$;

-- Grant execute to authenticated role so API routes using service key can call it
grant execute on function store_user_api_key(uuid, text) to service_role;
