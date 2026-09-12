ALTER TABLE public.san_pham 
ADD COLUMN IF NOT EXISTS phong_ban TEXT,
ADD COLUMN IF NOT EXISTS ton_dau NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS nhap NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS xuat NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ton_cuoi NUMERIC DEFAULT 0;

DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'san_pham' AND column_name = 'so_luong_nhap'
    ) THEN
        EXECUTE 'UPDATE public.san_pham SET nhap = COALESCE(nhap, so_luong_nhap, 0) WHERE nhap = 0 OR nhap IS NULL';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'san_pham' AND column_name = 'so_luong_ton'
    ) THEN
        EXECUTE 'UPDATE public.san_pham SET ton_cuoi = COALESCE(ton_cuoi, so_luong_ton, 0) WHERE ton_cuoi = 0 OR ton_cuoi IS NULL';
    END IF;
END $$;

ALTER TABLE public.san_pham 
DROP COLUMN IF EXISTS tong_ton_kho,
DROP COLUMN IF EXISTS so_luong_nhap,
DROP COLUMN IF EXISTS so_luong_ton;

DROP VIEW IF EXISTS public.view_vattu_tong_hop CASCADE;

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
    COALESCE(SUM(GREATEST(0, (tk.ton_kho - tk.tong_nhap + tk.tong_xuat))), 0)::BIGINT AS ton_dau,
    COALESCE(SUM(tk.tong_nhap), 0)::BIGINT AS nhap,
    COALESCE(SUM(tk.tong_xuat), 0)::BIGINT AS xuat,
    COALESCE(SUM(tk.ton_kho), 0)::BIGINT AS ton_cuoi
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

GRANT SELECT ON public.view_vattu_tong_hop TO anon, authenticated, service_role;
