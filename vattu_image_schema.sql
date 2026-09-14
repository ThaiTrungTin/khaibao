-- =========================================================================
-- GAIA INVENTORY: SCHEMA BỔ SUNG CỘT ẢNH & SUPABASE STORAGE BUCKET
-- =========================================================================

-- 1. Bổ sung cột 'anh' (TEXT) vào bảng san_pham (khung sườn vật tư gốc)
ALTER TABLE public.san_pham 
ADD COLUMN IF NOT EXISTS anh TEXT;

-- 2. Cập nhật view_vattu_tong_hop để bao gồm cột 'anh' từ san_pham
DROP VIEW IF EXISTS public.view_vattu_tong_hop CASCADE;

CREATE OR REPLACE VIEW public.view_vattu_tong_hop AS
SELECT 
    sp.id,
    sp.ma_vach,
    sp.anh,
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
    sp.anh,
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

-- 3. Tạo Storage Bucket 'vattu_images' trên Supabase Storage (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vattu_images', 'vattu_images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Thiết lập RLS policies cho bucket 'vattu_images'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access Vattu Images'
    ) THEN
        CREATE POLICY "Public Access Vattu Images" ON storage.objects
        FOR SELECT USING (bucket_id = 'vattu_images');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow Upload Vattu Images'
    ) THEN
        CREATE POLICY "Allow Upload Vattu Images" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'vattu_images');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow Update Vattu Images'
    ) THEN
        CREATE POLICY "Allow Update Vattu Images" ON storage.objects
        FOR UPDATE USING (bucket_id = 'vattu_images');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow Delete Vattu Images'
    ) THEN
        CREATE POLICY "Allow Delete Vattu Images" ON storage.objects
        FOR DELETE USING (bucket_id = 'vattu_images');
    END IF;
END $$;
