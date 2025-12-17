-- Enable pg_trgm for fuzzy search performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for fast ILIKE/Trigram searches
-- Indexes for 'name' are critical. Email and phone often benefit from standard btree for exact prefix, 
-- but trgm is safer for 'contains' queries (ILIKE '%query%').
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_email_trgm ON customers USING gin (email gin_trgm_ops);
-- Phone numbers are usually searched by suffix or prefix, trgm handles both well.
CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm ON customers USING gin (phone gin_trgm_ops);

-- Define the RPC
CREATE OR REPLACE FUNCTION search_customers_v1(
  p_tenant_id uuid,
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict Access Control
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure user belongs to tenant (using existing helper)
  -- This prevents cross-tenant access even if someone guesses a tenant_id
  IF NOT user_has_role_for_tenant(p_tenant_id, NULL) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  -- Return query with OR conditions optimized by the GIN indexes
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.email,
    c.phone,
    c.notes,
    c.created_at
  FROM customers c
  WHERE c.tenant_id = p_tenant_id
    AND (
      p_query IS NULL OR p_query = '' OR
      c.name ILIKE '%' || p_query || '%' OR
      c.email ILIKE '%' || p_query || '%' OR
      -- Minimal sanitization for phone search could happen here, keeping it simple for now
      c.phone ILIKE '%' || p_query || '%'
    )
  ORDER BY 
      -- Simple ranking: exact matches or starts-with could be boosted, 
      -- but for now updated_at/created_at or name sorting is sufficient. 
      -- Let's prioritize by name relevance or simple recency?
      -- User requested "ordenados por relevancia". 
      -- Postgres similarity() is good for relevance but might be slight overkill for basic search.
      -- Let's use simple similarity sorting derived from pg_trgm if query is present.
      CASE WHEN p_query IS NOT NULL AND p_query != '' THEN
        similarity(c.name, p_query)
      ELSE
        0
      END DESC,
      c.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
