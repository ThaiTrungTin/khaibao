-- ==============================================================================
-- CẬP NHẬT KIỂU DỮ LIỆU SỐ THẬP PHÂN CHO NHẬP XUẤT VÀ THẺ KHO
-- ==============================================================================

-- 1. Tạm thời xóa các VIEW phụ thuộc vào cột so_luong của the_kho
DROP VIEW IF EXISTS public.view_vattu_tong_hop CASCADE;
DROP VIEW IF EXISTS public.view_the_kho_tong_hop CASCADE;
DROP VIEW IF EXISTS public.ton_kho_detail CASCADE;

-- 2. Chuyển cột tong_so_luong của bảng nhap_xuat sang NUMERIC(15, 4)
ALTER TABLE public.nhap_xuat 
ALTER COLUMN tong_so_luong TYPE NUMERIC(15, 4) USING tong_so_luong::NUMERIC(15, 4);

-- 3. Chuyển cột so_luong của bảng the_kho sang NUMERIC(15, 4)
ALTER TABLE public.the_kho 
ALTER COLUMN so_luong TYPE NUMERIC(15, 4) USING so_luong::NUMERIC(15, 4);

-- 4. Tạo lại VIEW ton_kho_detail
CREATE OR REPLACE VIEW public.ton_kho_detail AS
SELECT 
    COALESCE(
        UPPER(SUBSTRING(user_name FROM '(?i)CN\d+')), 
        CASE 
            WHEN user_name LIKE '%-%' THEN UPPER(TRIM(SPLIT_PART(user_name, '-', 2)))
            ELSE 'CN1' 
        END
    ) AS chi_nhanh,
    COALESCE(NULLIF(TRIM(ma_qr), ''), ma_vach) AS ma_qr,
    ma_vach,
    ten_hang_hoa,
    COALESCE(NULLIF(TRIM(lot), ''), '-') AS lot,
    date_expiry,
    COALESCE(SUM(CASE WHEN loai = 'Nhập' THEN so_luong ELSE 0 END), 0) AS tong_nhap,
    COALESCE(SUM(CASE WHEN loai = 'Xuất' THEN so_luong ELSE 0 END), 0) AS tong_xuat,
    COALESCE(SUM(CASE WHEN loai = 'Nhập' THEN so_luong WHEN loai = 'Xuất' THEN -so_luong ELSE 0 END), 0) AS ton_kho,
    MAX(created_at) AS cap_nhat_cuoi
FROM 
    public.the_kho
GROUP BY 
    1,
    COALESCE(NULLIF(TRIM(ma_qr), ''), ma_vach),
    ma_vach,
    ten_hang_hoa,
    COALESCE(NULLIF(TRIM(lot), ''), '-'),
    date_expiry
ORDER BY 
    chi_nhanh ASC,
    ten_hang_hoa ASC,
    date_expiry ASC;

-- 5. Tạo lại VIEW view_vattu_tong_hop
CREATE OR REPLACE VIEW public.view_vattu_tong_hop AS
SELECT 
    sp.id,
    sp.ma_vach,
    sp.ten_mat_hang,
    sp.ten_hoa_don,
    sp.nha_san_xuat,
    sp.danh_muc,
    sp.nhom_hang,
    sp.phan_loai,
    sp.phong_ban,
    sp.don_vi,
    sp.cach_dung,
    sp.gia_von_ton_kho_trung_binh,
    COALESCE(tk.chi_nhanh, 'Tất cả chi nhánh') AS chi_nhanh,
    COALESCE(SUM(GREATEST(0, (tk.ton_kho - tk.tong_nhap + tk.tong_xuat))), 0)::NUMERIC AS ton_dau,
    COALESCE(SUM(tk.tong_nhap), 0)::NUMERIC AS nhap,
    COALESCE(SUM(tk.tong_xuat), 0)::NUMERIC AS xuat,
    COALESCE(SUM(tk.ton_kho), 0)::NUMERIC AS ton_cuoi
FROM public.san_pham sp
LEFT JOIN public.ton_kho_detail tk 
    ON LOWER(TRIM(sp.ma_vach)) = LOWER(TRIM(tk.ma_vach)) 
    OR LOWER(TRIM(sp.ma_vach)) = LOWER(TRIM(tk.ma_qr))
GROUP BY 
    sp.id,
    sp.ma_vach,
    sp.ten_mat_hang,
    sp.ten_hoa_don,
    sp.nha_san_xuat,
    sp.danh_muc,
    sp.nhom_hang,
    sp.phan_loai,
    sp.phong_ban,
    sp.don_vi,
    sp.cach_dung,
    sp.gia_von_ton_kho_trung_binh,
    tk.chi_nhanh;

-- 6. Cấp quyền truy cập VIEW
GRANT SELECT ON public.ton_kho_detail TO anon, authenticated, service_role;
GRANT SELECT ON public.view_vattu_tong_hop TO anon, authenticated, service_role;
