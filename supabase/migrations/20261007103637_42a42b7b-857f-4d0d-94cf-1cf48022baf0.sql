CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  filename text NOT NULL,
  storage_path text,
  upload_status text NOT NULL DEFAULT 'processing',
  page_count integer NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_workspace_idx ON public.documents(workspace_id);
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.document_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  extracted_text text NOT NULL DEFAULT '',
  section text,
  content_type text NOT NULL DEFAULT 'text',
  has_visuals boolean NOT NULL DEFAULT false,
  image_path text,
  processing_status text NOT NULL DEFAULT 'processed',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, page_number)
);
GRANT ALL ON public.document_pages TO service_role;
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.analysis_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  question text NOT NULL,
  document_ids uuid[] NOT NULL DEFAULT '{}',
  pages_used jsonb NOT NULL DEFAULT '[]',
  response jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.analysis_requests TO service_role;
ALTER TABLE public.analysis_requests ENABLE ROW LEVEL SECURITY;