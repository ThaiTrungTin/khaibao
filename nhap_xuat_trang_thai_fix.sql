-- Bỏ ràng buộc cũ (nếu có)
ALTER TABLE public.nhap_xuat DROP CONSTRAINT IF EXISTS nhap_xuat_trang_thai_check;

-- Thêm lại ràng buộc mới cho phép trạng thái 'Đã hủy'
ALTER TABLE public.nhap_xuat ADD CONSTRAINT nhap_xuat_trang_thai_check CHECK (trang_thai IN ('Chờ', 'Done', 'Đã hủy'));

-- Thêm cột nguon_don nếu chưa có (dành cho đơn phân biệt nguồn gốc PDF/Thư mục/Thủ công)
ALTER TABLE public.nhap_xuat ADD COLUMN IF NOT EXISTS nguon_don TEXT DEFAULT 'thu_cong';
