-- 0074_create_payments_table.sql
-- Crear tabla payments para registrar pagos de Stripe Connect

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  stripe_session_id TEXT,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  barberia_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  amount DECIMAL(10,2) NOT NULL,
  deposit DECIMAL(10,2),
  total_price DECIMAL(10,2),
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'refunded', 'disputed', 'failed')),
  balance_status TEXT CHECK (balance_status IN ('pending', 'available', 'paid_out')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'payments_updated_at'
  ) THEN
    CREATE TRIGGER payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_payments_stripe_charge ON public.payments(stripe_charge_id);
CREATE INDEX IF NOT EXISTS idx_payments_balance_status ON public.payments(balance_status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON public.payments(created_at);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


COMMENT ON TABLE public.payments IS 'Registro de pagos procesados a través de Stripe Connect';
COMMENT ON COLUMN public.payments.stripe_payment_intent_id IS 'ID del Payment Intent de Stripe';
COMMENT ON COLUMN public.payments.stripe_charge_id IS 'ID del Charge de Stripe';
COMMENT ON COLUMN public.payments.balance_status IS 'Estado del balance: pending (retenido), available (disponible), paid_out (transferido)';
COMMENT ON COLUMN public.payments.status IS 'Estado del pago: pending, succeeded, refunded, disputed, failed';



