-- ============================================================
-- CJTF Recruitment Portal — Extended bio / KYC data (SIM-reg style)
--  + guarantor section (data + uploaded form) + age declaration upload
-- ============================================================

-- Personal / bio
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS title              TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS mother_maiden_name TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS place_of_birth     TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS nationality        TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS marital_status     TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS religion           TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS blood_group        TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS height             TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS distinguishing_marks TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS occupation         TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS education          TEXT;

-- Residence + identity
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS state_of_residence TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS lga_of_residence   TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS bvn                TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS means_of_id_type   TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS means_of_id_number TEXT;

-- Next of kin (address)
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS next_of_kin_address TEXT;

-- Guarantor (data + uploaded guarantor form)
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS guarantor_name     TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS guarantor_phone    TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS guarantor_title    TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS guarantor_address  TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS guarantor_form_url TEXT;

-- Age declaration document
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS age_declaration_url TEXT;
