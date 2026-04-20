-- RAG vector similarity search function
-- Run in Supabase SQL Editor before using Phase 17 RAG features.

create or replace function match_material_chunks(
  p_user_id    uuid,
  p_course_id  uuid,
  p_query_embedding vector(1536),
  p_top_k      integer default 5
)
returns table (
  material_id  uuid,
  chunk_index  integer,
  content      text
)
language sql
stable
as $$
  select
    me.material_id,
    me.chunk_index,
    me.content
  from material_embeddings me
  join materials m on m.material_id = me.material_id
  where me.user_id = p_user_id
    and m.course_id = p_course_id
    and me.embedding is not null
  order by me.embedding <=> p_query_embedding
  limit p_top_k;
$$;

grant execute on function match_material_chunks(uuid, uuid, vector, integer) to service_role;
