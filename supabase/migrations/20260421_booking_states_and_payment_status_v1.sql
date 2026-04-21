-- Normalize booking state model:
-- - booking_state: pending | confirmed | in_progress | completed | cancelled | no_show
-- - payment_status: unpaid | deposit | paid
--
-- Backfill legacy bookings.status into the two new columns and enforce constraints.

-- 1) Backfill booking_state from legacy status
update public.bookings
set booking_state =
  case
    when status = 'cancelled' then 'cancelled'
    when status = 'no_show' then 'no_show'
    when status = 'completed' then 'completed'
    when status = 'confirmed' then 'confirmed'
    when status = 'paid' then 'confirmed'
    when status = 'pending' then 'pending'
    when status = 'hold' then 'pending'
    else coalesce(booking_state, 'pending')
  end
where booking_state is null;

-- 2) Backfill payment_status from legacy status + existing payment_status values
update public.bookings
set payment_status =
  case
    when payment_status in ('paid', 'deposit', 'unpaid') then payment_status
    when payment_status = 'pending' then 'unpaid'
    when status in ('paid', 'completed') then 'paid'
    else 'unpaid'
  end
where payment_status is null or payment_status = 'pending';

-- 3) Defaults + NOT NULL
alter table public.bookings
  alter column booking_state set default 'pending',
  alter column payment_status set default 'unpaid';

update public.bookings set booking_state = 'pending' where booking_state is null;
update public.bookings set payment_status = 'unpaid' where payment_status is null;

alter table public.bookings
  alter column booking_state set not null,
  alter column payment_status set not null;

-- 4) Check constraints (idempotent)
alter table public.bookings
  drop constraint if exists bookings_booking_state_check,
  drop constraint if exists bookings_payment_status_check;

alter table public.bookings
  add constraint bookings_booking_state_check
    check (booking_state in ('pending','confirmed','in_progress','completed','cancelled','no_show')),
  add constraint bookings_payment_status_check
    check (payment_status in ('unpaid','deposit','paid'));

