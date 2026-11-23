-- 018: print batches become an INT → Admin → ICT hand-off pipeline.
--
-- A batch is now a *group of approved applicants* (same Sector Command + Sub
-- Sector), not a pile of finished cards. INT builds it and sends it to Admin;
-- Admin reviews and forwards it to ICT; ICT generates each person's ID card
-- individually, then prints and hands over the batch.
--
--   with_admin → with_ict → printed → collected        (cancelled from the first two)
--
-- Admin may also create a batch directly, which starts at with_ict.
-- Existing 'sent' batches (cards were already generated, waiting on ICT to
-- print) map onto 'with_ict'.

-- ── batch status ──────────────────────────────────────────────────────────
alter table public.print_batches drop constraint if exists print_batches_status_check;

update public.print_batches set status = 'with_ict' where status = 'sent';

alter table public.print_batches
  add constraint print_batches_status_check
    check (status in ('with_admin', 'with_ict', 'printed', 'collected', 'cancelled'));

alter table public.print_batches alter column status set default 'with_admin';

-- who forwarded it to ICT, and when
alter table public.print_batches
  add column if not exists forwarded_by uuid references public.profiles(id),
  add column if not exists forwarded_at timestamptz;

drop index if exists public.print_batches_status_idx;
create index if not exists print_batches_status_idx on public.print_batches (status, created_at desc);

-- ── audit actions ─────────────────────────────────────────────────────────
alter table public.print_events drop constraint if exists print_events_action_check;
alter table public.print_events
  add constraint print_events_action_check
    check (action in ('sent', 'forwarded', 'returned', 'downloaded', 'printed', 'collected', 'cancelled', 'reprint_requested'));

-- ── eligibility index ─────────────────────────────────────────────────────
-- Applicants eligible for batching: approved (awaiting ID) or already carded,
-- and not yet in a batch.
drop index if exists public.applications_print_status_idx;
create index if not exists applications_batch_eligible_idx
  on public.applications (sector_command, sub_sector)
  where status in ('APPROVED_GENERATING_ID', 'COMPLETED') and print_status = 'not_queued';
