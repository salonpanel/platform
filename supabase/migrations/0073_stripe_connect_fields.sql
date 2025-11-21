-- 0073_stripe_connect_fields.sql
-- Agregar campos necesarios para Stripe Connect Standard en la tabla tenants

-- Agregar columnas de Stripe Connect si no existen
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_onboarding_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT false;

-- Crear índice para búsquedas rápidas por stripe_account_id
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_account 
ON public.tenants(stripe_account_id) 
WHERE stripe_account_id IS NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN public.tenants.stripe_account_id IS 'ID de la cuenta Stripe Connect Standard asociada';
COMMENT ON COLUMN public.tenants.stripe_onboarding_status IS 'Estado del onboarding: pending, completed, restricted, disabled';
COMMENT ON COLUMN public.tenants.stripe_charges_enabled IS 'Indica si la cuenta Stripe puede recibir pagos';
COMMENT ON COLUMN public.tenants.stripe_payouts_enabled IS 'Indica si la cuenta Stripe puede recibir payouts';



