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
