-- ============================================================
-- CJTF Portal — full schema, migrations 001 through 011 in order
-- ============================================================
-- Paste this whole file into the SQL editor of a fresh Supabase project and
-- run it once. It is the same statements as supabase/migrations/*.sql,
-- concatenated in dependency order, and is safe to re-run: every migration
-- uses IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS.
--
-- Generated for the move to project rhqtfgrzzywoldylrcju.



-- ============================================================
-- 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- CJTF Recruitment Portal — Initial Schema
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('applicant','ict','int','admin')),
  full_name   TEXT NOT NULL DEFAULT '',
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "profiles_self_read"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Staff can read all profiles (needed for notes display)
CREATE POLICY "profiles_staff_read" ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('ict','int','admin')
  ));

-- ============================================================
-- Applications
-- ============================================================
CREATE TABLE public.applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                          'DRAFT','PENDING_PAYMENT','PENDING_ICT_VERIFICATION',
                          'PENDING_INT_SCREENING','PENDING_ADMIN_APPROVAL',
                          'APPROVED_GENERATING_ID','COMPLETED','REJECTED'
                        )),
  -- personal info
  first_name            TEXT NOT NULL DEFAULT '',
  last_name             TEXT NOT NULL DEFAULT '',
  middle_name           TEXT,
  date_of_birth         DATE,
  gender                TEXT CHECK (gender IN ('male','female')),
  state_of_origin       TEXT NOT NULL DEFAULT '',
  lga_of_origin         TEXT NOT NULL DEFAULT '',
  residential_address   TEXT NOT NULL DEFAULT '',
  phone_number          TEXT NOT NULL DEFAULT '',
  email                 TEXT NOT NULL DEFAULT '',
  -- next of kin
  next_of_kin_name      TEXT NOT NULL DEFAULT '',
  next_of_kin_phone     TEXT NOT NULL DEFAULT '',
  next_of_kin_relationship TEXT NOT NULL DEFAULT '',
  -- uploads
  passport_photo_url    TEXT,
  id_document_url       TEXT,
  birth_cert_url        TEXT,
  -- generated
  cjtf_id_number        TEXT UNIQUE,
  id_card_pdf_url       TEXT,
  -- timestamps
  submitted_at          TIMESTAMPTZ,
  ict_verified_at       TIMESTAMPTZ,
  int_cleared_at        TIMESTAMPTZ,
  admin_approved_at     TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Applicants: own rows only
CREATE POLICY "applications_applicant_own" ON public.applications
  USING (applicant_id = auth.uid());

-- ICT: can see verification queue and ID generation queue
CREATE POLICY "applications_ict_read" ON public.applications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ict')
    AND status IN ('PENDING_ICT_VERIFICATION','APPROVED_GENERATING_ID')
  );

-- INT: can see intelligence screening queue
CREATE POLICY "applications_int_read" ON public.applications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'int')
    AND status = 'PENDING_INT_SCREENING'
  );

-- Admin: can see admin approval queue
CREATE POLICY "applications_admin_read" ON public.applications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    AND status = 'PENDING_ADMIN_APPROVAL'
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Payments
-- ============================================================
CREATE TABLE public.payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  applicant_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL CHECK (type IN ('id_card','training')),
  amount                INTEGER NOT NULL,  -- in kobo
  paystack_reference    TEXT UNIQUE NOT NULL,
  paystack_access_code  TEXT,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_applicant_own" ON public.payments FOR SELECT
  USING (applicant_id = auth.uid());

CREATE POLICY "payments_staff_read" ON public.payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ict','int','admin')
  ));

-- ============================================================
-- Application Notes (audit trail)
-- ============================================================
CREATE TABLE public.application_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note            TEXT NOT NULL DEFAULT '',
  action          TEXT NOT NULL CHECK (action IN (
                    'ict_verified','int_cleared','int_rejected',
                    'admin_approved','admin_rejected','id_generated'
                  )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.application_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_staff_read" ON public.application_notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ict','int','admin')
  ));

CREATE POLICY "notes_staff_insert" ON public.application_notes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ict','int','admin')
  ));

-- ============================================================
-- Auto-create profile on signup trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'applicant'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Storage buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('applicant-documents', 'applicant-documents', false),
  ('id-cards', 'id-cards', true)
ON CONFLICT DO NOTHING;

-- Applicants can upload to their own folder
CREATE POLICY "applicant_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'applicant-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "applicant_read_own" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'applicant-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "staff_read_docs" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'applicant-documents'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ict','int','admin'))
  );

CREATE POLICY "service_write_idcards" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'id-cards');

CREATE POLICY "applicant_read_idcard" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'id-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- 002_executive_role.sql
-- ============================================================

-- ============================================================
-- CJTF Recruitment Portal — Executive (DSS) read-only oversight role
-- ============================================================

-- 1. Allow the new 'executive' role on profiles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('applicant','ict','int','admin','executive'));

-- ============================================================
-- 2. Executive access log — records every applicant record an
--    executive/DSS user views. This is the accountability trail
--    for privileged, full-visibility oversight access.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.executive_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executive_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id  UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  action          TEXT NOT NULL CHECK (action IN ('view_dashboard','view_application')),
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS executive_access_log_executive_idx ON public.executive_access_log (executive_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS executive_access_log_application_idx ON public.executive_access_log (application_id);

-- RLS on: writes are performed by the service role (which bypasses RLS),
-- so no policies are defined — the table is not reachable by anon/authenticated.
ALTER TABLE public.executive_access_log ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 002_add_nin_to_applications.sql
-- ============================================================

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS nin TEXT;


-- ============================================================
-- 003_phone_verification.sql
-- ============================================================

-- ============================================================
-- CJTF Recruitment Portal — Phone (OTP) verification for applicants
-- ============================================================

-- 1. Verified flag on the profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;

-- 2. Pending OTP challenge — one current row per user.
--    Codes are stored hashed; rows are deleted on success/expiry.
CREATE TABLE IF NOT EXISTS public.phone_otps (
  user_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone         TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service-role only (OTP send/verify run server-side); no policies defined.
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 004_training_and_rejection.sql
-- ============================================================

-- ============================================================
-- CJTF Recruitment Portal — Batch 1
--  (a) Training stage between Admin approval and ID generation
--  (b) Rejection persistence + reactivation (resubmit after correction)
-- ============================================================

-- (a) New PENDING_TRAINING status
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications ADD CONSTRAINT applications_status_check CHECK (status IN (
  'DRAFT','PENDING_PAYMENT','PENDING_ICT_VERIFICATION','PENDING_INT_SCREENING',
  'PENDING_ADMIN_APPROVAL','PENDING_TRAINING','APPROVED_GENERATING_ID','COMPLETED','REJECTED'
));

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS trained_at TIMESTAMPTZ;

-- (b) Rejection metadata — persists who rejected, when, and why, so the
--     applicant can see it and the case can be routed back on resubmission.
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS rejected_by_role TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- New audit-trail actions
ALTER TABLE public.application_notes DROP CONSTRAINT IF EXISTS application_notes_action_check;
ALTER TABLE public.application_notes ADD CONSTRAINT application_notes_action_check CHECK (action IN (
  'ict_verified','int_cleared','int_rejected','admin_approved','admin_rejected',
  'id_generated','training_completed','resubmitted'
));


-- ============================================================
-- 005_extended_bio_data.sql
-- ============================================================

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


-- ============================================================
-- 006_identity_verification.sql
-- ============================================================

-- ============================================================
-- CJTF Recruitment Portal — Identity verification (Hyparrow KYC)
--  Applicant verifies NIN or BVN against the government record.
--  Verified name/DOB/gender are written by the server; these
--  flags record that the verification (or a staff waiver) happened.
-- ============================================================

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS identity_verified        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS identity_verify_method   TEXT;  -- 'nin' | 'bvn'
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS identity_verified_at     TIMESTAMPTZ;

-- Staff override (ICT/Admin can waive verification for edge cases:
-- applicant has no NIN/BVN, or the KYC provider was unreachable).
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS identity_verify_waived         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS identity_verify_waived_by      UUID REFERENCES public.profiles(id);
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS identity_verify_waived_reason  TEXT;

-- Allow the waiver action in the audit trail.
ALTER TABLE public.application_notes DROP CONSTRAINT IF EXISTS application_notes_action_check;
ALTER TABLE public.application_notes ADD CONSTRAINT application_notes_action_check CHECK (action IN (
  'ict_verified','int_cleared','int_rejected',
  'admin_approved','admin_rejected','id_generated',
  'training_completed','resubmitted','identity_waived'
));


-- ============================================================
-- 007_hyparrow_virtual_account.sql
-- ============================================================

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


-- ============================================================
-- 008_office_registration.sql
-- ============================================================

-- ============================================================
-- CJTF Portal — Office Registration & Certificate flow
--  A separate journey (distinct from recruitment): a registrant
--  registers a CJTF office in the FCT/environs, verifies identity
--  (NIN/BVN, reused KYC), pays, uploads office-space photos +
--  a signed District-Head endorsement, is screened by INT then
--  approved by Admin (final sign-off), and a certificate is issued.
--  Police involvement intentionally omitted.
-- ============================================================

-- ============================================================
-- Office registrations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.office_registrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registrant_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_PAYMENT','PENDING_INT_SCREENING','PENDING_ADMIN_APPROVAL','APPROVED_GENERATING_CERT','COMPLETED','REJECTED')),

  -- Registrant identity
  title                 TEXT,
  first_name            TEXT,
  middle_name           TEXT,
  last_name             TEXT,
  date_of_birth         DATE,
  gender                TEXT CHECK (gender IN ('male','female')),
  phone_number          TEXT,
  email                 TEXT,
  residential_address   TEXT,
  nin                   TEXT,
  bvn                   TEXT,

  -- Identity verification gate (mirrors applications, Hyparrow KYC)
  identity_verified           BOOLEAN NOT NULL DEFAULT FALSE,
  identity_verify_method      TEXT,  -- 'nin' | 'bvn'
  identity_verified_at        TIMESTAMPTZ,
  identity_verify_waived          BOOLEAN NOT NULL DEFAULT FALSE,
  identity_verify_waived_by       UUID REFERENCES public.profiles(id),
  identity_verify_waived_reason   TEXT,

  -- Office details
  office_name           TEXT,
  office_designation    TEXT,            -- e.g. "Zonal Office", "Ward Post"
  area_council          TEXT,
  district              TEXT,
  office_address        TEXT,
  landmark              TEXT,

  -- Inspection (registrant uploads office-space photos; staff verify online)
  office_photo_urls     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- District-Head endorsement (no login; signed copy uploaded by registrant or staff)
  district_head_name    TEXT,
  endorsement_doc_url   TEXT,

  -- Payment (dedicated Hyparrow virtual account, reused mechanism)
  hyparrow_customer_id  TEXT,
  va_account_number     TEXT,
  va_account_name       TEXT,
  va_bank_name          TEXT,
  va_bank_code          TEXT,
  va_created_at         TIMESTAMPTZ,

  -- Generated certificate
  cert_number           TEXT UNIQUE,
  cert_pdf_url          TEXT,

  -- Rejection metadata (mirrors applications)
  rejected_by_role      TEXT,
  rejected_at           TIMESTAMPTZ,
  rejection_reason      TEXT,

  -- Timestamps
  submitted_at          TIMESTAMPTZ,
  int_cleared_at        TIMESTAMPTZ,
  admin_approved_at     TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS office_registrations_registrant_idx ON public.office_registrations(registrant_id);
CREATE INDEX IF NOT EXISTS office_registrations_status_idx ON public.office_registrations(status);
CREATE INDEX IF NOT EXISTS office_registrations_customer_idx ON public.office_registrations(hyparrow_customer_id);

ALTER TABLE public.office_registrations ENABLE ROW LEVEL SECURITY;

-- Registrant: own rows only
CREATE POLICY "office_registrant_own" ON public.office_registrations
  USING (registrant_id = auth.uid());

-- INT: intelligence screening queue
CREATE POLICY "office_int_read" ON public.office_registrations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'int')
    AND status = 'PENDING_INT_SCREENING'
  );

-- Admin: approval + certificate-generation queue (admin is the final sign-off / CG)
CREATE POLICY "office_admin_read" ON public.office_registrations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    AND status IN ('PENDING_ADMIN_APPROVAL','APPROVED_GENERATING_CERT')
  );

-- updated_at trigger (reuses set_updated_at from 001)
DROP TRIGGER IF EXISTS office_registrations_updated_at ON public.office_registrations;
CREATE TRIGGER office_registrations_updated_at
  BEFORE UPDATE ON public.office_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Payments: allow rows tied to an office registration instead of an
-- application. Make application_id optional and add the office link + type.
-- ============================================================
ALTER TABLE public.payments ALTER COLUMN application_id DROP NOT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS office_registration_id
  UUID REFERENCES public.office_registrations(id) ON DELETE CASCADE;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_type_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_type_check
  CHECK (type IN ('id_card','training','office'));

-- Exactly one parent (application XOR office registration).
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_one_parent;
ALTER TABLE public.payments ADD CONSTRAINT payments_one_parent CHECK (
  (application_id IS NOT NULL AND office_registration_id IS NULL) OR
  (application_id IS NULL AND office_registration_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS payments_office_registration_idx
  ON public.payments(office_registration_id);

-- ============================================================
-- Office registration notes (audit trail, mirrors application_notes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.office_registration_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.office_registrations(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note            TEXT NOT NULL DEFAULT '',
  action          TEXT NOT NULL CHECK (action IN (
                    'int_cleared','int_rejected','admin_approved','admin_rejected',
                    'cert_generated','resubmitted','identity_waived','endorsement_uploaded'
                  )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.office_registration_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_notes_staff_read" ON public.office_registration_notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ict','int','admin')
  ));

CREATE POLICY "office_notes_staff_insert" ON public.office_registration_notes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ict','int','admin')
  ));

-- ============================================================
-- FCT localities reference (area council -> district) for dropdowns.
-- Scope: 6 FCT Area Councils + common environs. Adjustable.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fct_localities (
  id            SERIAL PRIMARY KEY,
  area_council  TEXT NOT NULL,
  district      TEXT NOT NULL,
  UNIQUE (area_council, district)
);

ALTER TABLE public.fct_localities ENABLE ROW LEVEL SECURITY;

-- Readable by any authenticated user (reference data only).
CREATE POLICY "fct_localities_read" ON public.fct_localities FOR SELECT
  USING (auth.role() = 'authenticated');

INSERT INTO public.fct_localities (area_council, district) VALUES
  -- Abuja Municipal Area Council (AMAC)
  ('AMAC','Garki'),('AMAC','Wuse'),('AMAC','Maitama'),('AMAC','Asokoro'),
  ('AMAC','Central Business District'),('AMAC','Gwarinpa'),('AMAC','Jabi'),
  ('AMAC','Utako'),('AMAC','Wuye'),('AMAC','Karu'),('AMAC','Nyanya'),
  ('AMAC','Gwagwa'),('AMAC','Karmo'),('AMAC','Lugbe'),('AMAC','Kabusa'),
  -- Bwari
  ('Bwari','Bwari Central'),('Bwari','Kubwa'),('Bwari','Dutse'),('Bwari','Ushafa'),
  ('Bwari','Byazhin'),('Bwari','Igu'),('Bwari','Shere'),('Bwari','Kuduru'),
  -- Gwagwalada
  ('Gwagwalada','Gwagwalada Central'),('Gwagwalada','Zuba'),('Gwagwalada','Dobi'),
  ('Gwagwalada','Paiko'),('Gwagwalada','Ikwa'),('Gwagwalada','Tungan Maje'),
  -- Kuje
  ('Kuje','Kuje Central'),('Kuje','Chibiri'),('Kuje','Gaube'),('Kuje','Gwargwada'),
  ('Kuje','Kwaku'),('Kuje','Rubochi'),
  -- Kwali
  ('Kwali','Kwali Central'),('Kwali','Yangoji'),('Kwali','Dafa'),('Kwali','Kilankwa'),
  ('Kwali','Pai'),('Kwali','Ashara'),
  -- Abaji
  ('Abaji','Abaji Central'),('Abaji','Yaba'),('Abaji','Nuku'),('Abaji','Gawu'),
  ('Abaji','Rimba'),('Abaji','Agyana'),
  -- Environs (neighbouring towns commonly served)
  ('Environs (Nasarawa)','Mararaba'),('Environs (Nasarawa)','Masaka'),
  ('Environs (Nasarawa)','New Karu'),('Environs (Nasarawa)','Ado'),
  ('Environs (Niger)','Suleja'),('Environs (Niger)','Tafa'),('Environs (Niger)','Gurara')
ON CONFLICT (area_council, district) DO NOTHING;

-- ============================================================
-- Certificates storage bucket (public, mirrors id-cards)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('certificates', 'certificates', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "service_write_certificates" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "registrant_read_certificate" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'certificates'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- 009_registration_fee.sql
-- ============================================================

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


-- ============================================================
-- 010_pilot_relaxed_checks.sql
-- ============================================================

-- ============================================================
-- Record when office submit gates were waived for the pilot
-- ============================================================
-- lib/pilot.ts lets an office registration be submitted without an office-space
-- photo or a verified NIN/BVN while the pilot runs. Each such submission writes
-- an audit note so those registrations can be found and re-verified when the
-- checks are hardened — which needs a new allowed value for notes.action.

ALTER TABLE public.office_registration_notes DROP CONSTRAINT IF EXISTS office_registration_notes_action_check;
ALTER TABLE public.office_registration_notes ADD CONSTRAINT office_registration_notes_action_check
  CHECK (action IN (
    'int_cleared','int_rejected','admin_approved','admin_rejected',
    'cert_generated','resubmitted','identity_waived','endorsement_uploaded',
    'pilot_checks_relaxed'
  ));


-- ============================================================
-- 011_rank_assignment.sql
-- ============================================================

-- ============================================================
-- Rank assignment in the applicant flow
-- ============================================================
-- After ICT forwards, INT recommends a rank when clearing to Admin, and Admin
-- picks the final rank when approving. ICT then prints that final rank on the
-- ID card, so `cjtf_rank` must be set before an application can reach COMPLETED.
--
-- Two columns rather than one: the recommendation is kept even when Admin
-- overrides it, so the trail shows what INT proposed vs. what Command issued.
--
-- The column is `cjtf_rank`, not `rank`: PostgREST resolves a bare `rank` in a
-- select list to the ordered-set aggregate of the same name and fails the
-- request with 42809 ("WITHIN GROUP is required for ordered-set aggregate
-- rank"). Confirmed against this database — any explicit select of a column
-- called `rank` would 400.

ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS recommended_rank TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS cjtf_rank TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS rank_assigned_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS rank_assigned_at TIMESTAMPTZ;

-- Signatures printed on the card back: the holder signs at the ICT desk, the
-- issuing officer's signature is drawn or uploaded from a scan. Stored as
-- public URLs in the applicant-documents bucket, so a card re-downloaded months
-- later still carries the signatures it was issued with.
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS holder_signature_url TEXT;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS officer_signature_url TEXT;

-- New audit-trail actions for the two rank writes.
ALTER TABLE public.application_notes DROP CONSTRAINT IF EXISTS application_notes_action_check;
ALTER TABLE public.application_notes ADD CONSTRAINT application_notes_action_check CHECK (action IN (
  'ict_verified','int_cleared','int_rejected','admin_approved','admin_rejected',
  'id_generated','training_completed','resubmitted','identity_waived',
  'rank_recommended','rank_assigned'
));
