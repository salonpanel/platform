-- Adds robust support for deposit payments on bookings.
-- We store:
-- - deposit_amount_cents: integer cents (EUR)
-- - deposit_percent_bp: integer basis points (0..10000) representing 0..100%
-- - deposit_currency: ISO currency code (default 'EUR')
--
-- Invariants:
-- - If payment_status = 'deposit' => exactly one of (deposit_amount_cents, deposit_percent_bp) must be present and > 0
-- - Else => both must be NULL

alter table public.bookings
  add column if not exists deposit_amount_cents integer,
  add column if not exists deposit_percent_bp integer,
  add column if not exists deposit_currency text;

alter table public.bookings
  alter column deposit_currency set default 'EUR';

-- Backfill currency where missing but deposit fields exist (defensive)
update public.bookings
set deposit_currency = 'EUR'
where deposit_currency is null
  and (deposit_amount_cents is not null or deposit_percent_bp is not null);

-- Basic ranges
alter table public.bookings
  drop constraint if exists bookings_deposit_amount_cents_check,
  drop constraint if exists bookings_deposit_percent_bp_check;

alter table public.bookings
  add constraint bookings_deposit_amount_cents_check
    check (deposit_amount_cents is null or deposit_amount_cents > 0),
  add constraint bookings_deposit_percent_bp_check
    check (deposit_percent_bp is null or (deposit_percent_bp > 0 and deposit_percent_bp <= 10000));

-- Coherence with payment_status
alter table public.bookings
  drop constraint if exists bookings_payment_deposit_coherence_check;

alter table public.bookings
  add constraint bookings_payment_deposit_coherence_check
    check (
      (
        payment_status = 'deposit'
        and (
          (deposit_amount_cents is not null and deposit_percent_bp is null)
          or
          (deposit_amount_cents is null and deposit_percent_bp is not null)
        )
      )
      or
      (
        payment_status <> 'deposit'
        and deposit_amount_cents is null
        and deposit_percent_bp is null
      )
    );

