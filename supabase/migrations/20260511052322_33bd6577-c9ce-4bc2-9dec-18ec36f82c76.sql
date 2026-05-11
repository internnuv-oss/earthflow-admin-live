
-- Profiles (NOT linked to auth.users — admin can create SE rows freely)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile text,
  email text,
  role text NOT NULL DEFAULT 'SE' CHECK (role IN ('SE','TH')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales_executive (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_profile_complete boolean NOT NULL DEFAULT false,
  personal_details jsonb DEFAULT '{}'::jsonb,
  organization_details jsonb DEFAULT '{}'::jsonb,
  financial_details jsonb DEFAULT '{}'::jsonb,
  assets_details jsonb DEFAULT '{}'::jsonb,
  documents jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  se_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  firm_name text,
  owner_name text,
  contact_person text,
  contact_mobile text,
  email text,
  address text,
  city text,
  state text,
  taluka text,
  pincode text,
  gst_number text,
  pan_number text,
  est_year text,
  firm_type text,
  bank_details jsonb DEFAULT '{}'::jsonb,
  scoring jsonb DEFAULT '{}'::jsonb,
  business_scope jsonb DEFAULT '{}'::jsonb,
  dealer_network jsonb DEFAULT '{}'::jsonb,
  commitments jsonb DEFAULT '{}'::jsonb,
  documents jsonb DEFAULT '{}'::jsonb,
  annexures jsonb DEFAULT '{}'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  total_score numeric,
  band text,
  status text DEFAULT 'DRAFT',
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dealers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  se_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  primary_shop_name text,
  contact_person text,
  contact_mobile text,
  primary_address text,
  gst_number text,
  pan_number text,
  est_year text,
  firm_type text,
  bank_details jsonb DEFAULT '{}'::jsonb,
  scoring jsonb DEFAULT '{}'::jsonb,
  total_score numeric,
  category text,
  commitments jsonb DEFAULT '{}'::jsonb,
  documents jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'DRAFT',
  annexures jsonb DEFAULT '{}'::jsonb,
  owners_list jsonb DEFAULT '[]'::jsonb,
  additional_locations jsonb DEFAULT '[]'::jsonb,
  distributor_links jsonb DEFAULT '[]'::jsonb,
  demo_farmers_data jsonb DEFAULT '[]'::jsonb,
  primary_shop_location jsonb DEFAULT '{}'::jsonb,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.farmers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  se_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  dealer_id uuid REFERENCES public.dealers(id) ON DELETE SET NULL,
  full_name text,
  mobile text,
  village text,
  status text DEFAULT 'DRAFT',
  personal_details jsonb DEFAULT '{}'::jsonb,
  farm_details jsonb DEFAULT '{}'::jsonb,
  history_details jsonb DEFAULT '{}'::jsonb,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_executive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;

-- Admin tool: any authenticated user can read/write all rows
CREATE POLICY "auth all profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all se" ON public.sales_executive FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all distributors" ON public.distributors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all dealers" ON public.dealers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all farmers" ON public.farmers FOR ALL TO authenticated USING (true) WITH CHECK (true);
