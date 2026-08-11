-- ============================================================
-- Collapse the applicant's two fees into one registration fee
-- ============================================================
-- The applicant used to pay an ID card fee and a training fee separately.
-- They now pay a single ₦5,000 registration fee, which needs a new payments.type.
--
-- The legacy 'id_card' and 'training' values stay permitted: historical rows
-- must remain valid, and lib/fees.ts still treats that pair as full payment so
-- applicants who already paid under the old scheme are not charged again.

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_type_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_type_check
  CHECK (type IN ('registration','id_card','training','office'));
