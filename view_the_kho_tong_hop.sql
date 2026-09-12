DROP VIEW IF EXISTS public.view_the_kho_tong_hop CASCADE;
DROP VIEW IF EXISTS public.ton_kho_detail CASCADE;

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

GRANT SELECT ON public.ton_kho_detail TO anon, authenticated, service_role;
