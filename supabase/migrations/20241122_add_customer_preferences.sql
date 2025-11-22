-- Migration: Add customer preferences for AI voice agent
-- Date: 2024-11-22
-- Description: Adds fields to customers table for AI agent Leo/Clara to provide personalized service

-- Add preference fields to customers table
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS internal_notes TEXT,
    ADD COLUMN IF NOT EXISTS preferred_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS preferred_time_of_day TEXT CHECK (preferred_time_of_day IN ('mañana', 'tarde', 'noche', NULL)),
    ADD COLUMN IF NOT EXISTS preferred_days TEXT[], -- Array of days: ['lunes', 'martes', etc.]
    ADD COLUMN IF NOT EXISTS last_call_status TEXT,
    ADD COLUMN IF NOT EXISTS last_call_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS next_due_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS call_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prefers_whatsapp BOOLEAN DEFAULT false;

-- Create index for AI queries
CREATE INDEX IF NOT EXISTS idx_customers_next_due_date ON public.customers(next_due_date) WHERE next_due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_preferred_staff ON public.customers(preferred_staff_id) WHERE preferred_staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_last_call_status ON public.customers(last_call_status) WHERE last_call_status IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.customers.internal_notes IS 'Internal notes about customer habits, preferences, etc. Visible to staff and AI agent.';
COMMENT ON COLUMN public.customers.preferred_time_of_day IS 'Customer preferred time slot: mañana, tarde, or noche';
COMMENT ON COLUMN public.customers.preferred_days IS 'Array of preferred days of the week';
COMMENT ON COLUMN public.customers.last_call_status IS 'Last call attempt status: answered, no_answer, voicemail, declined, scheduled';
COMMENT ON COLUMN public.customers.next_due_date IS 'Calculated next appointment due date based on service frequency';
COMMENT ON COLUMN public.customers.call_attempts IS 'Number of call attempts made for next appointment';
COMMENT ON COLUMN public.customers.prefers_whatsapp IS 'Customer prefers WhatsApp over phone calls';
