-- Migration: Add public_subdomain field to tenants table
-- Purpose: Allow tenants to have a custom subdomain (e.g., barberia-demo.bookfast.es)
-- This enables wildcard domain routing without manual Vercel configuration per tenant

-- Add public_subdomain column (nullable, unique)
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS public_subdomain TEXT;

-- Create unique index on public_subdomain (only for non-null values)
-- This ensures that each subdomain can only be used by one tenant
CREATE UNIQUE INDEX IF NOT EXISTS tenants_public_subdomain_unique_idx 
ON tenants (public_subdomain) 
WHERE public_subdomain IS NOT NULL;

-- Add constraint to ensure public_subdomain follows the same rules as slug
-- (lowercase, alphanumeric + hyphens, no reserved subdomains)
-- Note: We'll enforce this at the application level, but the unique index prevents duplicates

-- Optional: Add comment to document the field
COMMENT ON COLUMN tenants.public_subdomain IS 'Custom subdomain for tenant (e.g., barberia-demo). Must be unique and follow slug validation rules. Used for wildcard domain routing (*.bookfast.es)';



