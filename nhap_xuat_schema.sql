CREATE TABLE IF NOT EXISTS public.nhap_xuat (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma_don TEXT UNIQUE NOT NULL,
    loai_don TEXT NOT NULL CHECK (loai_don IN ('Nhập', 'Xuất')),
    muc_dich TEXT,
    trang_thai TEXT DEFAULT 'Done' CHECK (trang_thai IN ('Chờ', 'Done', 'Đã hủy')),
    file_url TEXT,
    user_name TEXT NOT NULL,
    chi_tiet_san_pham JSONB DEFAULT '[]'::jsonb,
    tong_so_luong INT DEFAULT 0,
    ngay_tao TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nhap_xuat DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_nhap_xuat_ma_don ON public.nhap_xuat(ma_don);
CREATE INDEX IF NOT EXISTS idx_nhap_xuat_loai_don ON public.nhap_xuat(loai_don);
CREATE INDEX IF NOT EXISTS idx_nhap_xuat_created_at ON public.nhap_xuat(created_at DESC);
