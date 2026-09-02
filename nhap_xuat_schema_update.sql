-- ==========================================================================
-- GAIA Animal Hospital - Cập nhật bảng Nhập Xuất (Stock Import/Export Orders)
-- Ngày cập nhật: 02/09/2026
-- Tính năng: Thêm trạng thái đơn (Chờ / Done) để hỗ trợ tính năng quét hóa đơn PDF
-- ==========================================================================

-- Thêm cột trang_thai và file_url vào bảng nhap_xuat
ALTER TABLE public.nhap_xuat 
ADD COLUMN IF NOT EXISTS trang_thai TEXT DEFAULT 'Done' 
CHECK (trang_thai IN ('Chờ', 'Done'));

ALTER TABLE public.nhap_xuat 
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- ==========================================================================
-- TẠO BUCKET LƯU TRỮ PDF TRONG SUPABASE STORAGE
-- ==========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice_pdfs', 'invoice_pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Cho phép Public access vào bucket (Ai cũng có thể xem và upload)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'invoice_pdfs');

CREATE POLICY "Public Upload" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'invoice_pdfs');
