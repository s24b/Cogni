-- Run these in Supabase → SQL Editor and paste the results back.

-- Query 1: list all API key secrets in vault (we confirmed this works — row exists).

-- Query 3: call the RPC directly with your known user_id.
-- If this returns NULL, the RPC function body has a bug.
-- If this returns a long key string, the function is fine and the app is passing
-- a different user_id.
select get_user_api_key('15c7342f-3d3c-42b7-b52b-e0616e448053'::uuid) as key_via_rpc;

-- Query 4: run the same lookup the RPC does, but inline — proves whether
-- vault.decrypted_secrets is accessible under the current role.
select decrypted_secret is not null as direct_lookup_works
from vault.decrypted_secrets
where name = 'api_key_15c7342f-3d3c-42b7-b52b-e0616e448053';
