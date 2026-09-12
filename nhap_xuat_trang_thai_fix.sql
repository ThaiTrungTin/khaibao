ALTER TABLE public.nhap_xuat DROP CONSTRAINT IF EXISTS nhap_xuat_trang_thai_check;
ALTER TABLE public.nhap_xuat ADD CONSTRAINT nhap_xuat_trang_thai_check CHECK (trang_thai IN ('Chờ', 'Done', 'Đã hủy'));
ALTER TABLE public.nhap_xuat ADD COLUMN IF NOT EXISTS nguon_don TEXT DEFAULT 'thu_cong';
