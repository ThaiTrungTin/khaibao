-- ==========================================================================
-- GAIA Hospital - View Ảo Tổng Hợp Thẻ Kho Chi Tiết (ton_kho_detail)
-- Chạy script này trên Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ==========================================================================

-- Xóa view cũ nếu có
DROP VIEW IF EXISTS public.view_the_kho_tong_hop CASCADE;
DROP VIEW IF EXISTS public.ton_kho_detail CASCADE;

CREATE OR REPLACE VIEW public.ton_kho_detail AS
SELECT 
    -- 1. Trích xuất Chi Nhánh dựa theo user_name (Ví dụ: "Thái Trung Tín - CN1" -> "CN1")
    COALESCE(
        UPPER(SUBSTRING(user_name FROM '(?i)CN\d+')), 
        CASE 
            WHEN user_name LIKE '%-%' THEN UPPER(TRIM(SPLIT_PART(user_name, '-', 2)))
            ELSE 'CN1' 
        END
    ) AS chi_nhanh,

    -- 2. Thông tin mã QR, Mã Vạch, Tên Hàng Hóa, LOT và Hạn Sử Dụng
    COALESCE(NULLIF(TRIM(ma_qr), ''), ma_vach) AS ma_qr,
    ma_vach,
    ten_hang_hoa,
    COALESCE(NULLIF(TRIM(lot), ''), '-') AS lot,
    date_expiry,

    -- 3. Tổng hợp số lượng Nhập, Xuất và Tồn Kho thực tế
    COALESCE(SUM(CASE WHEN loai = 'Nhập' THEN so_luong ELSE 0 END), 0) AS tong_nhap,
    COALESCE(SUM(CASE WHEN loai = 'Xuất' THEN so_luong ELSE 0 END), 0) AS tong_xuat,
    COALESCE(SUM(CASE WHEN loai = 'Nhập' THEN so_luong WHEN loai = 'Xuất' THEN -so_luong ELSE 0 END), 0) AS ton_kho,

    -- 4. Thời điểm phát sinh giao dịch gần nhất
    MAX(created_at) AS cap_nhat_cuoi

FROM 
    public.the_kho

GROUP BY 
    1,                                           -- chi_nhanh
    COALESCE(NULLIF(TRIM(ma_qr), ''), ma_vach), -- ma_qr
    ma_vach,
    ten_hang_hoa,
    COALESCE(NULLIF(TRIM(lot), ''), '-'),        -- lot
    date_expiry

ORDER BY 
    chi_nhanh ASC,
    ten_hang_hoa ASC,
    date_expiry ASC;

-- 5. Cấp quyền SELECT công khai để ứng dụng có thể đọc View ảo này mượt mà
GRANT SELECT ON public.ton_kho_detail TO anon, authenticated, service_role;
