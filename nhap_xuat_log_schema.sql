CREATE TABLE IF NOT EXISTS public.nhap_xuat_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma_don TEXT NOT NULL,
    loai_don TEXT NOT NULL,
    hanh_dong TEXT NOT NULL,
    noi_dung TEXT NOT NULL,
    user_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nhap_xuat_log DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_nhap_xuat_log_ma_don ON public.nhap_xuat_log(ma_don);
CREATE INDEX IF NOT EXISTS idx_nhap_xuat_log_created_at ON public.nhap_xuat_log(created_at DESC);
