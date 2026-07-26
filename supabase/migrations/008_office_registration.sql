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
