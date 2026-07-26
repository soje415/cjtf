-- Hyparrow dedicated virtual account for collecting application fees by bank transfer.
-- Each applicant gets one persistent NUBAN (issued via Hyparrow, settled on Wema).
-- A single transfer that covers the combined fee total clears BOTH fees at once,
-- after which the application auto-advances to ICT verification (see /api/hyparrow/webhook).

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS hyparrow_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS va_account_number    TEXT,
  ADD COLUMN IF NOT EXISTS va_account_name      TEXT,
  ADD COLUMN IF NOT EXISTS va_bank_name         TEXT,
  ADD COLUMN IF NOT EXISTS va_bank_code         TEXT,
  ADD COLUMN IF NOT EXISTS va_created_at         TIMESTAMPTZ;

-- The webhook matches an incoming credit to an application by Hyparrow customer id.
CREATE INDEX IF NOT EXISTS applications_hyparrow_customer_id_idx
  ON public.applications (hyparrow_customer_id);
