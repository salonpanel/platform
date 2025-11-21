-- 0076_services_deposit_fields.sql
-- Agregar campos de configuración de depósitos a la tabla services

-- Agregar columnas de depósito si no existen
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS deposit_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deposit_type TEXT CHECK (deposit_type IN ('fixed', 'percent')),
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS deposit_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS online_payment_required BOOLEAN DEFAULT false;

-- Comentarios para documentación
COMMENT ON COLUMN public.services.deposit_enabled IS 'Indica si el servicio requiere un adelanto (depósito)';
COMMENT ON COLUMN public.services.deposit_type IS 'Tipo de depósito: fixed (monto fijo) o percent (porcentaje)';
COMMENT ON COLUMN public.services.deposit_amount IS 'Monto fijo del depósito si deposit_type es fixed';
COMMENT ON COLUMN public.services.deposit_percent IS 'Porcentaje del precio total si deposit_type es percent';
COMMENT ON COLUMN public.services.online_payment_required IS 'Indica si el pago online es obligatorio para este servicio';



