-- Add deployment fields (Sector Command / Sub Sector / Unit) to applications
-- and office registrations. Sector Command and Sub Sector are mandatory; Unit is
-- optional. These are printed on the back of the generated ID card.

alter table public.applications
  add column if not exists sector_command text,
  add column if not exists sub_sector text,
  add column if not exists unit text;

alter table public.office_registrations
  add column if not exists sector_command text,
  add column if not exists sub_sector text,
  add column if not exists unit text;
