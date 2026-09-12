-- ==========================================================================
-- GAIA Animal Hospital - SQL XÓA TOÀN BỘ DỮ LIỆU TEST (GIỮ LẠI BẢNG NHÂN SỰ)
-- ==========================================================================
-- Chức năng:
-- 1. Xóa sạch dữ liệu test ở tất cả các bảng vật lý (BASE TABLE):
--    - Ca Khám / Tiếp nhận (pet_intakes)
--    - Danh mục Sản phẩm / Vật Tư / Thuốc (san_pham)
--    - Đơn Nhập / Xuất Kho (nhap_xuat, nhap_xuat_log)
--    - Sổ Thẻ Kho (the_kho) -> View ảo ton_kho_detail tự động về 0
--    - Kiểm Kho & Cân Bằng Kho (kiem_kho, kiem_kho_chi_tiet, quet_chi_tiet, kiem_kho_can_bang)
-- 2. TUYỆT ĐỐI GIỮ NGUYÊN BẢNG NHÂN SỰ (staff) để phục vụ đăng nhập & phân quyền.
-- 3. Reset lại số thứ tự tự tăng (ID Auto-increment) về 1.
-- ==========================================================================

DO $$ 
BEGIN
    -- 1. Xóa dữ liệu Cân Bằng Kho GPET (nếu có)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kiem_kho_can_bang' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.kiem_kho_can_bang RESTART IDENTITY CASCADE;
    END IF;

    -- 2. Xóa dữ liệu Nhật Ký Quét Chi Tiết (nếu có)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quet_chi_tiet' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.quet_chi_tiet RESTART IDENTITY CASCADE;
    END IF;

    -- 3. Xóa dữ liệu Chi Tiết Kiểm Kho (nếu có)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kiem_kho_chi_tiet' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.kiem_kho_chi_tiet RESTART IDENTITY CASCADE;
    END IF;

    -- 4. Xóa dữ liệu Phiếu Kiểm Kho (nếu có)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kiem_kho' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.kiem_kho RESTART IDENTITY CASCADE;
    END IF;

    -- 5. Xóa dữ liệu Nhật Ký Thay Đổi Đơn Nhập Xuất (nếu có)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nhap_xuat_log' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.nhap_xuat_log RESTART IDENTITY CASCADE;
    END IF;

    -- 6. Xóa dữ liệu Đơn Nhập Xuất Kho (nếu có)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nhap_xuat' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.nhap_xuat RESTART IDENTITY CASCADE;
    END IF;

    -- 7. Xóa dữ liệu Sổ Thẻ Kho (nếu có)
    -- (View ảo ton_kho_detail tính toán từ the_kho sẽ tự động sạch dữ liệu)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'the_kho' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.the_kho RESTART IDENTITY CASCADE;
    END IF;

    -- 8. Xóa dữ liệu Danh Mục Sản Phẩm / Vật Tư / Thuốc (nếu có)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'san_pham' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.san_pham RESTART IDENTITY CASCADE;
    END IF;

    -- 9. Xóa dữ liệu Ca Khám Thú Cưng / Lịch Khám Tiếp Nhận (nếu có)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pet_intakes' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.pet_intakes RESTART IDENTITY CASCADE;
    END IF;

    RAISE NOTICE '>>> ĐÃ XÓA SẠCH DỮ LIỆU TEST VÀ GIỮ NGUYÊN BẢNG NHÂN SỰ (STAFF) THÀNH CÔNG! <<<';
END $$;

-- Kiểm tra lại số lượng bản ghi còn lại trong các bảng
SELECT 'staff (Nhân sự - GIỮ NGUYÊN)' AS bang, COUNT(*) AS so_luong FROM public.staff
UNION ALL
SELECT 'pet_intakes (Lịch khám)', COUNT(*) FROM public.pet_intakes
UNION ALL
SELECT 'san_pham (Vật tư)', COUNT(*) FROM public.san_pham
UNION ALL
SELECT 'nhap_xuat (Đơn nhập xuất)', COUNT(*) FROM public.nhap_xuat
UNION ALL
SELECT 'the_kho (Thẻ kho)', COUNT(*) FROM public.the_kho
UNION ALL
SELECT 'kiem_kho (Kiểm kho)', COUNT(*) FROM public.kiem_kho;
