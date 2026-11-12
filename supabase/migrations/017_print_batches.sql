-- 017: ID-card print batches (sector / sub-sector) + 3 MB upload ceiling.
--
-- INT / Admin send completed ID cards to ICT for printing, grouped by Sector
-- Command and Sub Sector. Every send / print / collect / reprint is audited.
-- All access is through the service-role key (the portal never queries these
-- with a user session — see the RLS-recursion note), so RLS is enabled with no
-- policies: anon/authenticated users cannot read or write these tables.

-- ── per-card print state ──────────────────────────────────────────────────
alter table public.applications
  add column if not exists print_status text not null default 'not_queued'
    check (print_status in ('not_queued', 'queued', 'printed', 'collected'));

create index if not exists applications_print_status_idx
  on public.applications (print_status)
  where status = 'COMPLETED';

-- ── batches ───────────────────────────────────────────────────────────────
create sequence if not exists public.print_batch_seq;

create table if not exists public.print_batches (
  id              uuid primary key default gen_random_uuid(),
  batch_no        text not null unique default (
                    'PB-' || to_char(now(), 'YYYY') || '-' ||
                    lpad(nextval('public.print_batch_seq')::text, 4, '0')
                  ),
  sector_command  text not null,
  sub_sector      text not null,
  group_key       text not null,
  status          text not null default 'sent'
                    check (status in ('sent', 'printed', 'collected', 'cancelled')),
  card_count      integer not null default 0,
  requested_by    uuid references public.profiles(id),
  requested_role  text,
  note            text,
  printed_by      uuid references public.profiles(id),
  printed_at      timestamptz,
  collected_by    uuid references public.profiles(id),
  collected_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists print_batches_status_idx on public.print_batches (status, created_at desc);

create table if not exists public.print_batch_items (
  batch_id        uuid not null references public.print_batches(id) on delete cascade,
  application_id  uuid not null references public.applications(id),
  primary key (batch_id, application_id)
);

create index if not exists print_batch_items_app_idx on public.print_batch_items (application_id);

-- ── audit trail ───────────────────────────────────────────────────────────
create table if not exists public.print_events (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.print_batches(id) on delete cascade,
  actor_id        uuid references public.profiles(id),
  actor_role      text,
  action          text not null
                    check (action in ('sent', 'downloaded', 'printed', 'collected', 'cancelled', 'reprint_requested')),
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists print_events_batch_idx on public.print_events (batch_id, created_at);

alter table public.print_batches      enable row level security;
alter table public.print_batch_items  enable row level security;
alter table public.print_events       enable row level security;

-- ── upload ceiling: 3 MB per file, enforced by storage itself ─────────────
-- The browser compresses photos before upload and the API rejects oversize
-- requests; this is the backstop that nothing can bypass.
update storage.buckets
   set file_size_limit = 3145728
 where id = 'applicant-documents';
