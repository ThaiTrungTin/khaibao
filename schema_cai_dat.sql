-- =========================================================================
-- GAIA SYSTEM: BẢNG CÀI ĐẶT THÔNG TIN BỆNH VIỆN & CHI NHÁNH
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.cai_dat_he_thong (
    id BIGSERIAL PRIMARY KEY,
    ma_chi_nhanh TEXT NOT NULL UNIQUE,
    ten_chi_nhanh TEXT,
    logo_url TEXT,
    menu_title TEXT DEFAULT 'GAIA Hospital',
    menu_subtitle TEXT DEFAULT 'Hệ thống quản lý',
    header_title TEXT DEFAULT 'GAIA Animal Hospital Ho Chi Minh City',
    dia_chi TEXT DEFAULT 'No. 2D, 22 Road, Hiep Binh Ward, Ho Chi Minh City',
    maps_url TEXT DEFAULT 'https://maps.google.com/?q=No.+2D,+22+Road,+Hiep+Binh+Ward,+Ho+Chi+Minh+City',
    sdt_zalo TEXT DEFAULT '0934 395 168 (Zalo)',
    website TEXT DEFAULT 'www.gaialifestyle.vn',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- Cấp quyền truy cập
GRANT ALL ON public.cai_dat_he_thong TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cai_dat_he_thong_id_seq TO anon, authenticated, service_role;

-- Chèn dữ liệu mặc định ban đầu cho các chi nhánh
INSERT INTO public.cai_dat_he_thong (
    ma_chi_nhanh, 
    ten_chi_nhanh, 
    logo_url, 
    menu_title, 
    menu_subtitle, 
    header_title, 
    dia_chi, 
    maps_url, 
    sdt_zalo, 
    website
) VALUES 
(
    'CN1', 
    'Chi Nhánh TP.HCM', 
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQfZlyZoMKUpHV2xiHp5ye-OgqCT0_MYlHEIA&s', 
    'GAIA Hospital', 
    'Hệ thống quản lý', 
    'GAIA Animal Hospital Ho Chi Minh City', 
    'No. 2D, 22 Road, Hiep Binh Ward, Ho Chi Minh City', 
    'https://maps.google.com/?q=No.+2D,+22+Road,+Hiep+Binh+Ward,+Ho+Chi+Minh+City', 
    '0934 395 168 (Zalo)', 
    'www.gaialifestyle.vn'
),
(
    'CN2', 
    'Chi Nhánh Hà Nội', 
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQfZlyZoMKUpHV2xiHp5ye-OgqCT0_MYlHEIA&s', 
    'GAIA Hospital', 
    'Hệ thống quản lý', 
    'GAIA Animal Hospital Ha Noi', 
    'Số 15, Phố Duy Tân, Quận Cầu Giấy, Hà Nội', 
    'https://maps.google.com/?q=Duy+Tan,+Cau+Giay,+Ha+Noi', 
    '0934 395 168 (Zalo)', 
    'www.gaialifestyle.vn'
),
(
    'ALL', 
    'Toàn Hệ Thống (Mặc định)', 
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQfZlyZoMKUpHV2xiHp5ye-OgqCT0_MYlHEIA&s', 
    'GAIA Hospital', 
    'Hệ thống quản lý', 
    'GAIA Animal Hospital System', 
    'Trụ sở chính: No. 2D, 22 Road, Hiep Binh Ward, Ho Chi Minh City', 
    'https://maps.google.com/?q=No.+2D,+22+Road,+Hiep+Binh+Ward,+Ho+Chi+Minh+City', 
    '0934 395 168 (Zalo)', 
    'www.gaialifestyle.vn'
)
ON CONFLICT (ma_chi_nhanh) DO NOTHING;
