-- ==========================================================================
-- GAIA Animal Hospital - Nhập Xuất Order Audit Log Schema
-- Table: public.nhap_xuat_log
-- Records all order actions: Create, Add Item, Delete Item, Change Qty, Edit Purpose, Delete Order
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.nhap_xuat_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma_don TEXT NOT NULL,
    loai_don TEXT NOT NULL,
    hanh_dong TEXT NOT NULL, -- 'TẠO_ĐƠN', 'THÊM_SP', 'XÓA_SP', 'SỬA_SL', 'CẬP_NHẬT_ĐƠN', 'XÓA_ĐƠN'
    noi_dung TEXT NOT NULL,
    user_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turn off Row Level Security (RLS) for seamless app usage
ALTER TABLE public.nhap_xuat_log DISABLE ROW LEVEL SECURITY;

-- Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_nhap_xuat_log_ma_don ON public.nhap_xuat_log(ma_don);
CREATE INDEX IF NOT EXISTS idx_nhap_xuat_log_created_at ON public.nhap_xuat_log(created_at DESC);

-- Seed Sample Demo Log Entries
INSERT INTO public.nhap_xuat_log (ma_don, loai_don, hanh_dong, noi_dung, user_name, created_at)
VALUES 
(
    'NK-20260901-001',
    'Nhập',
    'TẠO_ĐƠN',
    'Khởi tạo phiếu nhập kho với 100x Thuốc Kháng Sinh Amoxicillin 500mg',
    'Thái Trung Tín - CN1',
    NOW() - INTERVAL '2 days'
),
(
    'XK-20260901-002',
    'Xuất',
    'TẠO_ĐƠN',
    'Khởi tạo phiếu xuất kho ca điều trị #1042 với 2x Thuốc Kháng Sinh Amoxicillin 500mg',
    'Bác sĩ Thú y Hùng - CN1',
    NOW() - INTERVAL '5 hours'
);
