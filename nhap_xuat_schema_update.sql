ALTER TABLE public.nhap_xuat 
ADD COLUMN IF NOT EXISTS trang_thai TEXT DEFAULT 'Done' 
CHECK (trang_thai IN ('Chờ', 'Done', 'Đã hủy'));

ALTER TABLE public.nhap_xuat 
ADD COLUMN IF NOT EXISTS file_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice_pdfs', 'invoice_pdfs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'invoice_pdfs');

CREATE POLICY "Public Upload" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'invoice_pdfs');
