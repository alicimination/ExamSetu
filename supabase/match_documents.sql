/**
 * ExamSetu — Supabase RPC function for vector similarity search.
 * Run this in Supabase SQL Editor after creating the schema.
 * 
 * This function is called by the RAG chat to find relevant document chunks.
 */

-- Create the match_documents function for pgvector similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_count int DEFAULT 5,
  filter_notification_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  notification_id uuid,
  chunk_text text,
  page_ref int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.notification_id,
    dc.chunk_text,
    dc.page_ref,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE
    (filter_notification_id IS NULL OR dc.notification_id = filter_notification_id)
    AND dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
