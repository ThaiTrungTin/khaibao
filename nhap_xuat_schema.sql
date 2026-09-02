-- ==========================================================================
-- GAIA Animal Hospital - Nhập Xuất (Stock Import/Export Orders) Schema
-- Table: public.nhap_xuat
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.nhap_xuat (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma_don TEXT UNIQUE NOT NULL,
    loai_don TEXT NOT NULL CHECK (loai_don IN ('Nhập', 'Xuất')),
    muc_dich TEXT,
    trang_thai TEXT DEFAULT 'Done' CHECK (trang_thai IN ('Chờ', 'Done')),
    file_url TEXT,
    user_name TEXT NOT NULL,
    chi_tiet_san_pham JSONB DEFAULT '[]'::jsonb,
    tong_so_luong INT DEFAULT 0,
    ngay_tao TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turn off Row Level Security (RLS) for seamless app usage
ALTER TABLE public.nhap_xuat DISABLE ROW LEVEL SECURITY;

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_nhap_xuat_ma_don ON public.nhap_xuat(ma_don);
CREATE INDEX IF NOT EXISTS idx_nhap_xuat_loai_don ON public.nhap_xuat(loai_don);
CREATE INDEX IF NOT EXISTS idx_nhap_xuat_created_at ON public.nhap_xuat(created_at DESC);

-- Seed Sample Demo Orders
INSERT INTO public.nhap_xuat (ma_don, loai_don, muc_dich, user_name, chi_tiet_san_pham, tong_so_luong, created_at)
VALUES 
(
    'NK-20260901-001',
    'Nhập',
    'Nhập kho định kỳ từ Mekophar',
    'Thái Trung Tín - CN1',
    '[{"ma_qr": "QR-AMOX-500", "ma_vach": "8935001234567", "lot": "LOT202601", "date_expiry": "2026-12-31", "ten_hang_hoa": "Thuốc Kháng Sinh Amoxicillin 500mg", "so_luong": 100}]'::jsonb,
    100,
    NOW() - INTERVAL '2 days'
),
(
    'XK-20260901-002',
    'Xuất',
    'Xuất sử dụng ca điều trị #1042',
    'Bác sĩ Thú y Hùng - CN1',
    '[{"ma_qr": "QR-AMOX-500", "ma_vach": "8935001234567", "lot": "LOT202601", "date_expiry": "2026-12-31", "ten_hang_hoa": "Thuốc Kháng Sinh Amoxicillin 500mg", "so_luong": 2}]'::jsonb,
    2,
    NOW() - INTERVAL '5 hours'
)
ON CONFLICT (ma_don) DO NOTHING;
