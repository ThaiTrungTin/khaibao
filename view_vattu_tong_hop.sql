-- ==========================================================================
-- VIEW VẬT TƯ TỔNG HỢP (VIEW_VATTU_TONG_HOP)
-- Tự động tính toán Tồn Đầu, Nhập, Xuất, Tồn Cuối cho từng Vật Tư theo Chi Nhánh trên Supabase Server
-- ==========================================================================

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
    sp.don_vi,
    sp.cach_dung,
    sp.gia_von_ton_kho_trung_binh,
    tk.chi_nhanh;
