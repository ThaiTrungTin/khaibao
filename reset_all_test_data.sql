DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kiem_kho_can_bang' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.kiem_kho_can_bang RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quet_chi_tiet' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.quet_chi_tiet RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kiem_kho_chi_tiet' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.kiem_kho_chi_tiet RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kiem_kho' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.kiem_kho RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nhap_xuat_log' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.nhap_xuat_log RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nhap_xuat' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.nhap_xuat RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'the_kho' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.the_kho RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'san_pham' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.san_pham RESTART IDENTITY CASCADE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pet_intakes' AND table_type = 'BASE TABLE') THEN
        TRUNCATE TABLE public.pet_intakes RESTART IDENTITY CASCADE;
    END IF;
END $$;

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
