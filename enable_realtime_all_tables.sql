-- ==========================================================================
-- GAIA Animal Hospital - SQL KÍCH HOẠT REALTIME CHO TOÀN BỘ CÁC BẢNG SUPABASE
-- ==========================================================================
-- Chức năng:
-- 1. Đảm bảo publication 'supabase_realtime' đã tồn tại trên database.
-- 2. Đặt REPLICA IDENTITY FULL cho từng bảng (giúp gửi đầy đủ dữ liệu khi UPDATE/DELETE).
-- 3. Đưa tất cả các bảng chính vào publication Realtime để tự động phát sóng websocket.
-- ==========================================================================

-- 1. Bật REPLICA IDENTITY FULL cho các bảng (nếu bảng tồn tại)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pet_intakes' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE public.pet_intakes REPLICA IDENTITY FULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'san_pham' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE public.san_pham REPLICA IDENTITY FULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nhap_xuat' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE public.nhap_xuat REPLICA IDENTITY FULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nhap_xuat_log' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE public.nhap_xuat_log REPLICA IDENTITY FULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'the_kho' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE public.the_kho REPLICA IDENTITY FULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kiem_kho' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE public.kiem_kho REPLICA IDENTITY FULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kiem_kho_chi_tiet' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE public.kiem_kho_chi_tiet REPLICA IDENTITY FULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quet_chi_tiet' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE public.quet_chi_tiet REPLICA IDENTITY FULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kiem_kho_can_bang' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE public.kiem_kho_can_bang REPLICA IDENTITY FULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff' AND table_type = 'BASE TABLE') THEN
        ALTER TABLE public.staff REPLICA IDENTITY FULL;
    END IF;
END $$;

-- 2. Thêm từng bảng vào publication 'supabase_realtime'
DO $$
DECLARE
    t TEXT;
    tbls TEXT[] := ARRAY[
        'pet_intakes',
        'san_pham',
        'nhap_xuat',
        'nhap_xuat_log',
        'the_kho',
        'kiem_kho',
        'kiem_kho_chi_tiet',
        'quet_chi_tiet',
        'kiem_kho_can_bang',
        'staff'
    ];
BEGIN
    -- Tạo publication nếu chưa có
    IF NOT EXISTS (SELECT FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    FOREACH t IN ARRAY tbls LOOP
        -- Kiểm tra bảng có tồn tại là BASE TABLE không
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t AND table_type = 'BASE TABLE') THEN
            -- Nếu bảng chưa có trong publication thì add vào
            IF NOT EXISTS (
                SELECT 1 
                FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' 
                  AND schemaname = 'public' 
                  AND tablename = t
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
            END IF;
        END IF;
    END LOOP;

    RAISE NOTICE '>>> ĐÃ KÍCH HOẠT REALTIME CHO TOÀN BỘ CÁC BẢNG THÀNH CÔNG! <<<';
END $$;

-- 3. Danh sách các bảng đang được phát sóng Realtime
SELECT 
    schemaname AS schema,
    tablename AS bang_da_bat_realtime
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
