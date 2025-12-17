-- 0007_staff_overlap.sql

create extension if not exists btree_gist with schema extensions;

alter table public.appointments
  add column if not exists slot tstzrange
  generated always as (tstzrange(starts_at, ends_at, '[)')) stored;

create index if not exists idx_appt_staff_slot
  on public.appointments using gist (staff_id, slot);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'excl_staff_overlap'
  ) then
    alter table public.appointments
      add constraint excl_staff_overlap
      exclude using gist (
        staff_id with =,
        slot with &&
      )
      where (status in ('hold','confirmed'));
  end if;
end$$;

