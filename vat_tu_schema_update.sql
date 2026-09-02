-- ==============================================================================
-- GAIA Animal Hospital - SQL Migration for public.san_pham Table
-- Updates: Adds Tồn Đầu, Nhập, Xuất, Tồn Cuối (NUMERIC) & drops old columns
-- ==============================================================================

-- 1. Thêm các cột tồn kho mới kiểu NUMERIC (Cho phép cả số nguyên và số thập phân)
ALTER TABLE public.san_pham 
ADD COLUMN IF NOT EXISTS ton_dau NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS nhap NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS xuat NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ton_cuoi NUMERIC DEFAULT 0;

-- 2. Chuyển đổi dữ liệu tồn kho hiện có từ các cột cũ sang cột mới trước khi xóa
UPDATE public.san_pham 
SET 
  nhap = COALESCE(nhap, so_luong_nhap, 0),
  ton_cuoi = COALESCE(ton_cuoi, so_luong_ton, 0)
WHERE (nhap = 0 OR nhap IS NULL) AND (ton_cuoi = 0 OR ton_cuoi IS NULL);

-- 3. Xóa vĩnh viễn các cột cũ (tong_ton_kho, so_luong_nhap, so_luong_ton)
ALTER TABLE public.san_pham 
DROP COLUMN IF EXISTS tong_ton_kho,
DROP COLUMN IF EXISTS so_luong_nhap,
DROP COLUMN IF EXISTS so_luong_ton;

-- 4. Chú thích tài liệu cho các cột mới
COMMENT ON COLUMN public.san_pham.ton_dau IS 'Số lượng tồn đầu kỳ (Kiểu NUMERIC)';
COMMENT ON COLUMN public.san_pham.nhap IS 'Số lượng nhập trong kỳ (Kiểu NUMERIC)';
COMMENT ON COLUMN public.san_pham.xuat IS 'Số lượng xuất trong kỳ (Kiểu NUMERIC)';
COMMENT ON COLUMN public.san_pham.ton_cuoi IS 'Số lượng tồn cuối kỳ (Kiểu NUMERIC)';
