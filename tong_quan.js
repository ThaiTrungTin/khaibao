let tongQuanBranchFilter = 'all'; 
let tongQuanIsInitialized = false;
let tongQuanRefreshTimer = null;

let tqStats = {
    todayIntakes: 0,
    newIntakes: 0,
    doneIntakes: 0,
    processingIntakes: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    nearExpiryCount: 0,
    expiredCount: 0,
    recentOrdersCount: 0,
    cn1Intakes: 0,
    cn2Intakes: 0,
    cn1Stock: 0,
    cn2Stock: 0
};

function getTongQuanSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        window.supabaseClient = supabaseClient;
        return supabaseClient;
    }
    if (typeof supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_PROJECT_URL') {
        try {
            window.supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            return window.supabaseClient;
        } catch (e) {
            console.error("GAIA TongQuan: Supabase initialization error:", e);
        }
    }
    return null;
}

function getTongQuanLoggedUser() {
    let u = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
    if (!u) {
        try {
            const saved = localStorage.getItem("gaia_logged_user");
            if (saved) u = JSON.parse(saved);
        } catch (e) {}
    }
    return u;
}

function isTongQuanManager(user) {
    if (!user) return false; 
    const roleLower = (user.role || "").toLowerCase().trim();
    const branchLower = (user.branch || "").toLowerCase().trim();

    return roleLower.includes("quản lý") || 
           roleLower.includes("quan ly") || 
           roleLower.includes("manager") ||
           branchLower.includes("toàn hệ thống") ||
           branchLower.includes("all");
}

function extractBranchCode(str) {
    if (!str) return '';
    const s = String(str).trim();
    if (!s) return '';
    const upper = s.toUpperCase();
    if (upper === 'ALL' || upper === 'TOÀN HỆ THỐNG' || upper === 'TOAN HE THONG' || upper.includes('TOÀN HỆ THỐNG') || upper.includes('TOAN HE THONG')) {
        return 'ALL';
    }

    const m = upper.match(/CN\s*(\d+)/i);
    if (m) {
        return `CN${parseInt(m[1], 10)}`;
    }

    const mChiNhanh = upper.match(/CHI\s*NH\xC1NH\s*(\d+)/i) || upper.match(/CHI\s*NHANH\s*(\d+)/i);
    if (mChiNhanh) {
        return `CN${parseInt(mChiNhanh[1], 10)}`;
    }

    if (upper.includes('HUỲNH TẤN PHÁT') || upper.includes('HUYNH TAN PHAT') || upper.includes('QUẬN 7') || upper.includes('QUAN 7') || upper.includes('HÀ NỘI') || upper.includes('HA NOI')) {
        return 'CN2';
    }
    if (upper.includes('HIỆP BÌNH') || upper.includes('HIEP BINH') || upper.includes('22 ROAD') || upper.includes('AN DƯƠNG VƯƠNG') || upper.includes('AN DUONG VUONG') || upper.includes('TP.HCM') || upper.includes('HCM')) {
        return 'CN1';
    }

    return '';
}

function extractOrderBranchCode(ord) {
    if (!ord) return '';
    if (ord.cn) {
        const c = extractBranchCode(ord.cn);
        if (c && c !== 'ALL') return c;
    }
    if (ord.branch) {
        const c = extractBranchCode(ord.branch);
        if (c && c !== 'ALL') return c;
    }
    if (ord.chi_nhanh) {
        const c = extractBranchCode(ord.chi_nhanh);
        if (c && c !== 'ALL') return c;
    }
    if (ord.user_name) {
        const c = extractBranchCode(ord.user_name);
        if (c && c !== 'ALL') return c;
    }
    if (ord.ma_don) {
        const m = String(ord.ma_don).match(/-(CN\d+)-/i) || String(ord.ma_don).match(/CN\d+/i);
        if (m) {
            return (m[1] ? m[1] : m[0]).toUpperCase();
        }
    }
    return '';
}

function extractIntakeBranchCode(r) {
    if (!r) return '';
    if (r.cn) {
        const c = extractBranchCode(r.cn);
        if (c && c !== 'ALL') return c;
    }
    if (r.branch) {
        const c = extractBranchCode(r.branch);
        if (c && c !== 'ALL') return c;
    }
    if (r.chi_nhanh) {
        const c = extractBranchCode(r.chi_nhanh);
        if (c && c !== 'ALL') return c;
    }
    if (r.user_name || r.bac_si_kham) {
        const c = extractBranchCode(r.user_name || r.bac_si_kham);
        if (c && c !== 'ALL') return c;
    }
    return '';
}

async function initTongQuanBranchDropdown() {
    const branchSelect = document.getElementById("tq-branch-filter");
    if (!branchSelect) return;

    const loggedUser = getTongQuanLoggedUser();
    const isManager = isTongQuanManager(loggedUser);
    let userCN = loggedUser ? (loggedUser.cn || extractBranchCode(loggedUser.branch || "")) : "";
    userCN = userCN ? userCN.toUpperCase().trim() : "";
    const userBranchName = loggedUser ? (loggedUser.branch || "").trim() : "";

    let staffList = (typeof staffData !== 'undefined' && Array.isArray(staffData) && staffData.length > 0) ? staffData : [];
    if (staffList.length === 0) {
        const client = getTongQuanSupabaseClient();
        if (client) {
            try {
                const { data } = await client.from('staff').select('branch, cn').order('created_at', { ascending: false });
                if (data && data.length > 0) {
                    staffList = data;
                }
            } catch (e) {
                console.warn("GAIA TongQuan: Error fetching staff branches:", e);
            }
        }
    }

    const branchMap = new Map();

    // 1. Ưu tiên lấy từ bảng cài đặt cai_dat_he_thong
    if (typeof window.getSystemBranchesDetailed === 'function') {
        const sysBranches = window.getSystemBranchesDetailed();
        sysBranches.forEach(b => {
            if (b.code && b.code !== 'ALL') {
                const code = b.code.trim();
                const name = (b.name || '').trim();
                let displayLabel = name;
                if (name && name !== code) {
                    const prefixRegex = new RegExp(`^${code}\\s*-\\s*`, 'i');
                    const cleanName = name.replace(prefixRegex, '').trim();
                    displayLabel = `${code} - ${cleanName}`;
                } else {
                    displayLabel = code;
                }
                branchMap.set(code, displayLabel);
            }
        });
    }

    // 2. Dự phòng thêm từ danh sách nhân viên nếu có chi nhánh khác
    staffList.forEach(s => {
        const rawBranch = (s.branch || "").trim();
        if (rawBranch && rawBranch !== "Toàn hệ thống" && rawBranch.toLowerCase() !== "all") {
            const cnCode = extractBranchCode(s.cn || rawBranch);
            if (cnCode && cnCode !== "ALL" && !branchMap.has(cnCode)) {
                const prefixRegex = new RegExp(`^${cnCode}\\s*-\\s*`, 'i');
                const cleanName = rawBranch.replace(prefixRegex, '').trim();
                branchMap.set(cnCode, `${cnCode} - ${cleanName}`);
            }
        }
    });

    if (userBranchName && userBranchName !== "Toàn hệ thống" && userBranchName.toLowerCase() !== "all") {
        const cnCode = extractBranchCode(userBranchName);
        if (cnCode && cnCode !== "ALL" && !branchMap.has(cnCode)) {
            const prefixRegex = new RegExp(`^${cnCode}\\s*-\\s*`, 'i');
            const cleanName = userBranchName.replace(prefixRegex, '').trim();
            branchMap.set(cnCode, `${cnCode} - ${cleanName}`);
        }
    }

    if (branchMap.size === 0) {
        branchMap.set("CN1", "CN1 - Chi Nhánh 1");
    }

    const currentSelection = branchSelect.value;
    branchSelect.innerHTML = "";

    if (isManager) {
        branchSelect.disabled = false;
        branchSelect.style.opacity = "1";
        branchSelect.style.cursor = "pointer";
        branchSelect.title = "Lọc dữ liệu tổng quan theo chi nhánh";

        const optAll = document.createElement("option");
        optAll.value = "all";
        optAll.textContent = "🌐 Toàn Hệ Thống";
        branchSelect.appendChild(optAll);

        Array.from(branchMap.keys()).sort().forEach(cnCode => {
            const opt = document.createElement("option");
            opt.value = cnCode;
            opt.textContent = `📍 ${branchMap.get(cnCode)}`;
            branchSelect.appendChild(opt);
        });

        if (currentSelection && (currentSelection === 'all' || branchMap.has(currentSelection))) {
            branchSelect.value = currentSelection;
            tongQuanBranchFilter = currentSelection;
        } else {
            branchSelect.value = "all";
            tongQuanBranchFilter = "all";
        }
    } else {

        const finalCN = userCN || "CN1";
        const finalBranchLabel = branchMap.get(finalCN) || userBranchName || `Chi Nhánh ${finalCN}`;

        branchSelect.disabled = true;
        branchSelect.style.opacity = "0.85";
        branchSelect.style.cursor = "not-allowed";
        branchSelect.title = `Bạn chỉ có quyền xem dữ liệu của chi nhánh: ${finalBranchLabel}`;

        const opt = document.createElement("option");
        opt.value = finalCN;
        opt.textContent = `🔒 ${finalBranchLabel}`;
        branchSelect.appendChild(opt);
        branchSelect.value = finalCN;
        tongQuanBranchFilter = finalCN;
    }
}

window.initTongQuanDashboard = async function () {

    await initTongQuanBranchDropdown();

    if (!tongQuanIsInitialized) {
        tongQuanIsInitialized = true;

        setupTongQuanEventListeners();

        startDashboardLiveClock();

        setupTongQuanRealtime();
    }

    await refreshTongQuanData();
};

function setupTongQuanEventListeners() {
    const branchSelect = document.getElementById("tq-branch-filter");
    if (branchSelect) {
        branchSelect.addEventListener("change", (e) => {
            tongQuanBranchFilter = e.target.value;
            renderTongQuanDashboard();
        });
    }

    const refreshBtn = document.getElementById("tq-btn-refresh");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            refreshBtn.classList.add("spinning");
            await initTongQuanBranchDropdown();
            await refreshTongQuanData();
            setTimeout(() => refreshBtn.classList.remove("spinning"), 600);
        });
    }
}

function startDashboardLiveClock() {
    const clockEl = document.getElementById("tq-live-clock");
    const dateEl = document.getElementById("tq-live-date");
    const greetingEl = document.getElementById("tq-user-greeting");

    function update() {
        const now = new Date();
        if (clockEl) {
            clockEl.textContent = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        if (dateEl) {
            const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
            const dayName = days[now.getDay()];
            const d = String(now.getDate()).padStart(2, '0');
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const y = now.getFullYear();
            dateEl.textContent = `${dayName}, ${d}/${m}/${y}`;
        }
        if (greetingEl) {
            const loggedUser = getTongQuanLoggedUser();
            const name = loggedUser ? (loggedUser.full_name || loggedUser.name || loggedUser.username || "Bác sĩ / Nhân viên") : "Quản Trị Viên";
            const hour = now.getHours();
            let greet = "Chào buổi sáng";
            if (hour >= 12 && hour < 18) greet = "Chào buổi chiều";
            else if (hour >= 18) greet = "Chào buổi tối";
            greetingEl.textContent = `${greet}, ${name}! 👋`;
        }
    }

    update();
    setInterval(update, 1000);
}

window.refreshTongQuanData = async function () {
    const client = getTongQuanSupabaseClient();
    if (!client) {
        renderTongQuanDashboard();
        return;
    }

    try {

        if (typeof fetchInitialIntakes === 'function' && (!window.intakesData || window.intakesData.length === 0)) {
            await fetchInitialIntakes();
        } else {

            const { data: intakes } = await client.from('pet_intakes').select('*').order('created_at', { ascending: false }).limit(200);
            if (intakes) {
                if (typeof intakesData !== 'undefined') intakesData = intakes;
                window.intakesData = intakes;
            }
        }

        if (typeof vatTuData === 'undefined' || !vatTuData || vatTuData.length === 0) {
            const { data: vts } = await client.from('san_pham').select('*').limit(1500);
            if (vts) {
                if (typeof vatTuData !== 'undefined') vatTuData = vts;
                window.vatTuData = vts;
            }
        }

        if (typeof tonKhoDetailData === 'undefined' || !tonKhoDetailData || tonKhoDetailData.length === 0) {
            const { data: details } = await client.from('ton_kho_detail').select('*');
            if (details) {
                if (typeof tonKhoDetailData !== 'undefined') tonKhoDetailData = details;
                window.tonKhoDetailData = details;
            }
        }

        if (typeof theKhoData === 'undefined' || !theKhoData || theKhoData.length === 0) {
            const { data: tks } = await client.from('the_kho').select('*').order('created_at', { ascending: false }).limit(2000);
            if (tks) {
                if (typeof theKhoData !== 'undefined') theKhoData = tks;
                window.theKhoData = tks;
            }
        }

        if (typeof nhapXuatData === 'undefined' || !nhapXuatData || nhapXuatData.length === 0) {
            const { data: nxs } = await client.from('nhap_xuat').select('*').order('created_at', { ascending: false }).limit(60);
            if (nxs) {
                if (typeof nhapXuatData !== 'undefined') nhapXuatData = nxs;
                window.nhapXuatData = nxs;
            }
        }
    } catch (e) {
        console.warn("GAIA TongQuan: Data refresh warning:", e);
    }

    renderTongQuanDashboard();
};

function setupTongQuanRealtime() {
    const client = getTongQuanSupabaseClient();
    if (!client) return;

    try {
        client.channel('gaia_tong_quan_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pet_intakes' }, () => {
                if (tongQuanRefreshTimer) clearTimeout(tongQuanRefreshTimer);
                tongQuanRefreshTimer = setTimeout(() => refreshTongQuanData(), 600);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'san_pham' }, () => {
                if (tongQuanRefreshTimer) clearTimeout(tongQuanRefreshTimer);
                tongQuanRefreshTimer = setTimeout(() => refreshTongQuanData(), 600);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'the_kho' }, () => {
                if (tongQuanRefreshTimer) clearTimeout(tongQuanRefreshTimer);
                tongQuanRefreshTimer = setTimeout(() => refreshTongQuanData(), 600);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ton_kho_detail' }, () => {
                if (tongQuanRefreshTimer) clearTimeout(tongQuanRefreshTimer);
                tongQuanRefreshTimer = setTimeout(() => refreshTongQuanData(), 600);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'nhap_xuat' }, () => {
                if (tongQuanRefreshTimer) clearTimeout(tongQuanRefreshTimer);
                tongQuanRefreshTimer = setTimeout(() => refreshTongQuanData(), 600);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, async () => {
                await initTongQuanBranchDropdown();
                renderTongQuanDashboard();
            })
            .subscribe();
    } catch (e) {
        console.warn("GAIA TongQuan: Realtime setup warning:", e);
    }
}

function getProductStockForBranch(item, branch, details) {
    if (!item || !branch) return 0;
    const rawBarcode = (item.ma_vach || '').trim().toLowerCase();
    const matching = (details || []).filter(d => {
        const dBarcode = (d.ma_vach || '').trim().toLowerCase();
        const dQr = (d.ma_qr || '').trim().toLowerCase();
        return (dBarcode && dBarcode === rawBarcode) || (dQr && dQr === rawBarcode);
    });

    if (matching.length > 0) {
        if (branch === 'all') {
            return matching.reduce((sum, r) => sum + (Number(r.ton_kho) || 0), 0);
        } else {
            const branchMatches = matching.filter(d => extractBranchCode(d.chi_nhanh) === branch);
            if (branchMatches.length > 0) {
                return branchMatches.reduce((sum, r) => sum + (Number(r.ton_kho) || 0), 0);
            }
            return 0;
        }
    }

    const lowerBranch = branch.toLowerCase();
    if (item[`so_luong_${lowerBranch}`] !== undefined && item[`so_luong_${lowerBranch}`] !== null) {
        return Number(item[`so_luong_${lowerBranch}`]) || 0;
    }

    if (branch === 'CN1') {
        if (item.so_luong_cn1 !== undefined && item.so_luong_cn1 !== null) return Number(item.so_luong_cn1) || 0;
        return Number(item.ton_cuoi ?? item.so_luong ?? 0);
    } else if (branch === 'CN2') {
        if (item.so_luong_cn2 !== undefined && item.so_luong_cn2 !== null) return Number(item.so_luong_cn2) || 0;
        return 0;
    }
    return 0;
}

window.renderTongQuanDashboard = function () {
    const rawIntakes = (typeof intakesData !== 'undefined' && Array.isArray(intakesData)) ? intakesData : (window.intakesData || []);
    const rawVatTu = (typeof vatTuData !== 'undefined' && Array.isArray(vatTuData)) ? vatTuData : (window.vatTuData || []);
    const rawDetails = (typeof tonKhoDetailData !== 'undefined' && Array.isArray(tonKhoDetailData)) ? tonKhoDetailData : (window.tonKhoDetailData || []);
    const rawTheKho = (typeof theKhoData !== 'undefined' && Array.isArray(theKhoData)) ? theKhoData : (window.theKhoData || []);
    const rawNhapXuat = (typeof nhapXuatData !== 'undefined' && Array.isArray(nhapXuatData)) ? nhapXuatData : (window.nhapXuatData || []);

    const branch = tongQuanBranchFilter; 

    const intakes = rawIntakes.filter(r => {
        if (branch === 'all') return true;
        const cn = extractIntakeBranchCode(r);
        return cn === branch;
    });

    const nhapXuatList = rawNhapXuat.filter(order => {
        if (branch === 'all') return true;
        const cn = extractOrderBranchCode(order);
        return cn === branch;
    });

    const todayStr = new Date().toISOString().substring(0, 10);

    const todayIntakesList = intakes.filter(r => {
        const d = (r.created_at || r.date_signed || "").substring(0, 10);
        return d === todayStr;
    });
    const todayCount = todayIntakesList.length;
    const newCount = todayIntakesList.filter(r => !r.trang_thai || r.trang_thai === 'new').length;
    const doneCount = todayIntakesList.filter(r => r.trang_thai === 'done' || r.trang_thai === 'kham_xong' || r.trang_thai === 'tiep_nhan').length;
    const processingCount = todayIntakesList.filter(r => r.trang_thai === 'processing' || r.trang_thai === 'dang_kham' || r.trang_thai === 'can_lam_sang').length;

    const outOfStockItems = [];
    const lowStockItems = [];
    const nearExpiryItems = [];
    const expiredItems = [];

    rawVatTu.forEach(item => {
        const stock = getProductStockForBranch(item, branch, rawDetails);
        const minStock = Number(item.ton_toi_thieu ?? item.min_stock ?? 5);

        if (stock <= 0) {
            outOfStockItems.push({ ...item, computedTon: stock });
        } else if (stock <= minStock) {
            lowStockItems.push({ ...item, computedTon: stock });
        }

        const expDate = parseExpiryDate(item.date_expiry || item.date || item.han_su_dung);
        if (expDate && stock > 0) {
            const diffDays = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
                expiredItems.push({ ...item, daysLeft: diffDays, computedTon: stock });
            } else if (diffDays <= 60) {
                nearExpiryItems.push({ ...item, daysLeft: diffDays, computedTon: stock });
            }
        }
    });

    const recentOrdersCount = nhapXuatList.length;

    // Tra cứu tên chuẩn từ bảng vật tư (san_pham)
    const vatTuNameMap = new Map();
    (rawVatTu || []).forEach(v => {
        const k = (v.ma_vach || '').trim().toLowerCase();
        const name = (v.ten_mat_hang || v.ten_san_pham || v.ten_hang_hoa || '').trim();
        if (k && name) vatTuNameMap.set(k, name);
    });

    const exportMap = {};

    // 1. Tính xuất kho từ bảng the_kho
    if (rawTheKho.length > 0) {
        rawTheKho.forEach(tk => {
            const loai = (tk.loai || tk.loai_don || '').toLowerCase().trim();
            if (loai !== 'xuất') return;

            if (branch !== 'all') {
                const tkBranch = extractBranchCode(tk.user_name || tk.chi_nhanh || tk.branch || '');
                if (tkBranch && tkBranch !== branch) return;
            }

            const rawKey = (tk.ma_vach || tk.ma_qr || '').trim();
            if (!rawKey) return;
            const keyLower = rawKey.toLowerCase();

            const nameFromVatTu = vatTuNameMap.get(keyLower);
            const name = nameFromVatTu || (tk.ten_hang_hoa || tk.ten_mat_hang || '').trim() || rawKey;
            const qty = Number(tk.so_luong) || 0;
            if (qty <= 0) return;

            if (!exportMap[rawKey]) {
                exportMap[rawKey] = {
                    ma_vach: rawKey,
                    ten_mat_hang: name,
                    don_vi: tk.don_vi || 'cái',
                    tongXuat: 0
                };
            } else if (nameFromVatTu && exportMap[rawKey].ten_mat_hang === rawKey) {
                exportMap[rawKey].ten_mat_hang = nameFromVatTu;
            }
            exportMap[rawKey].tongXuat += qty;
        });
    }

    // 2. Bổ sung từ đơn xuất kho trong nhap_xuat (nếu có đơn xuất chưa vào thẻ kho)
    if (rawNhapXuat.length > 0) {
        rawNhapXuat.forEach(ord => {
            const loai = (ord.loai_don || '').toLowerCase().trim();
            if (loai !== 'xuất' || ord.trang_thai === 'Đã hủy') return;

            if (branch !== 'all') {
                const ordBranch = extractOrderBranchCode(ord);
                if (ordBranch && ordBranch !== branch) return;
            }

            const items = ord.chi_tiet_san_pham || [];
            items.forEach(it => {
                const rawKey = (it.ma_vach || it.ten_hang_hoa || '').trim();
                if (!rawKey) return;
                const keyLower = rawKey.toLowerCase();

                const nameFromVatTu = vatTuNameMap.get(keyLower);
                const name = nameFromVatTu || (it.ten_hang_hoa || it.ten_mat_hang || '').trim() || rawKey;
                const qty = Number(it.so_luong) || 0;
                if (qty <= 0) return;

                if (!exportMap[rawKey]) {
                    exportMap[rawKey] = {
                        ma_vach: it.ma_vach || rawKey,
                        ten_mat_hang: name,
                        don_vi: it.don_vi || 'cái',
                        tongXuat: 0
                    };
                }
                // Nếu chưa có trong thẻ kho thì cộng từ đơn xuất
                if (rawTheKho.length === 0) {
                    exportMap[rawKey].tongXuat += qty;
                }
            });
        });
    }

    const topExportItems = Object.values(exportMap)
        .filter(x => x.tongXuat > 0)
        .sort((a, b) => b.tongXuat - a.tongXuat)
        .slice(0, 8);

    const loggedUserForRender = getTongQuanLoggedUser();
    const isManagerForRender = isTongQuanManager(loggedUserForRender);

    const branchComparisonWidget = document.getElementById('tq-widget-branch-comparison');
    if (branchComparisonWidget) {
        branchComparisonWidget.style.display = isManagerForRender ? '' : 'none';
    }

    updateKpiCards({
        todayCount,
        newCount,
        doneCount,
        processingCount,
        lowStockTotal: lowStockItems.length + outOfStockItems.length,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        expiryTotal: nearExpiryItems.length + expiredItems.length,
        nearExpiryCount: nearExpiryItems.length,
        expiredCount: expiredItems.length,
        recentOrdersCount: nhapXuatList.length
    });

    renderRecentIntakesTable(intakes.slice(0, 6));
    renderTopExportList(topExportItems, rawVatTu, rawDetails, branch);
    renderExpiryWatchlist([...expiredItems, ...nearExpiryItems].slice(0, 6));
    renderRecentWarehouseTimeline(nhapXuatList.slice(0, 5));

    if (isManagerForRender) {
        const compBranches = getTongQuanComparisonBranches(rawIntakes, rawDetails, rawVatTu);
        const compData = compBranches.map(b => {
            const bIntakesCount = rawIntakes.filter(r => extractIntakeBranchCode(r) === b.code && (r.created_at || '').substring(0, 10) === todayStr).length;
            let bStockSum = 0;
            rawVatTu.forEach(item => {
                bStockSum += getProductStockForBranch(item, b.code, rawDetails);
            });
            return {
                code: b.code,
                name: b.name,
                intakesCount: bIntakesCount,
                stockSum: bStockSum
            };
        });
        renderDynamicBranchComparison(compData);
    }
};

function parseExpiryDate(dateStr) {
    if (!dateStr || dateStr === '-') return null;
    const s = String(dateStr).trim();

    if (s.includes('/')) {
        const parts = s.split('/');
        if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            let y = parseInt(parts[2], 10);
            if (y < 100) y += 2000;
            return new Date(y, m, d);
        } else if (parts.length === 2) {
            const m = parseInt(parts[0], 10) - 1;
            let y = parseInt(parts[1], 10);
            if (y < 100) y += 2000;
            return new Date(y, m, 28);
        }
    }

    if (s.includes('-')) {
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

function updateKpiCards(stats) {

    const kpi1Val = document.getElementById("tq-kpi-intakes-val");
    const kpi1Badge = document.getElementById("tq-kpi-intakes-badge");
    const kpi1Desc = document.getElementById("tq-kpi-intakes-desc");
    if (kpi1Val) kpi1Val.textContent = `${stats.todayCount} ca`;
    if (kpi1Badge) {
        if (stats.newCount > 0) {
            kpi1Badge.className = "tq-card-badge badge-warning pulse";
            kpi1Badge.textContent = `${stats.newCount} ca mới`;
            kpi1Badge.style.display = "inline-flex";
        } else {
            kpi1Badge.className = "tq-card-badge badge-success";
            kpi1Badge.textContent = `Đã xong hết`;
            kpi1Badge.style.display = stats.todayCount > 0 ? "inline-flex" : "none";
        }
    }
    if (kpi1Desc) {
        kpi1Desc.textContent = `${stats.doneCount} đã khám xong • ${stats.processingCount} đang tiếp nhận`;
    }

    const kpi2Val = document.getElementById("tq-kpi-stock-val");
    const kpi2Badge = document.getElementById("tq-kpi-stock-badge");
    const kpi2Desc = document.getElementById("tq-kpi-stock-desc");
    if (kpi2Val) kpi2Val.textContent = `${stats.lowStockTotal} loại`;
    if (kpi2Badge) {
        if (stats.outOfStockCount > 0) {
            kpi2Badge.className = "tq-card-badge badge-danger";
            kpi2Badge.textContent = `${stats.outOfStockCount} hết hàng (tồn 0)`;
            kpi2Badge.style.display = "inline-flex";
        } else if (stats.lowStockCount > 0) {
            kpi2Badge.className = "tq-card-badge badge-warning";
            kpi2Badge.textContent = `${stats.lowStockCount} sắp hết`;
            kpi2Badge.style.display = "inline-flex";
        } else {
            kpi2Badge.className = "tq-card-badge badge-success";
            kpi2Badge.textContent = `Tồn kho ổn định`;
            kpi2Badge.style.display = "inline-flex";
        }
    }
    if (kpi2Desc) {
        kpi2Desc.textContent = `${stats.outOfStockCount} đã hết sạch (tồn 0) • ${stats.lowStockCount} dưới mức an toàn`;
    }

    const kpi3Val = document.getElementById("tq-kpi-expiry-val");
    const kpi3Badge = document.getElementById("tq-kpi-expiry-badge");
    const kpi3Desc = document.getElementById("tq-kpi-expiry-desc");
    if (kpi3Val) kpi3Val.textContent = `${stats.expiryTotal} loại`;
    if (kpi3Badge) {
        if (stats.expiredCount > 0) {
            kpi3Badge.className = "tq-card-badge badge-danger";
            kpi3Badge.textContent = `${stats.expiredCount} đã quá hạn!`;
            kpi3Badge.style.display = "inline-flex";
        } else if (stats.nearExpiryCount > 0) {
            kpi3Badge.className = "tq-card-badge badge-warning";
            kpi3Badge.textContent = `${stats.nearExpiryCount} cận hạn ≤60d`;
            kpi3Badge.style.display = "inline-flex";
        } else {
            kpi3Badge.className = "tq-card-badge badge-success";
            kpi3Badge.textContent = `Date an toàn`;
            kpi3Badge.style.display = "inline-flex";
        }
    }
    if (kpi3Desc) {
        kpi3Desc.textContent = `${stats.expiredCount} quá hạn • ${stats.nearExpiryCount} cận date (≤60 ngày)`;
    }

    const kpi4Val = document.getElementById("tq-kpi-orders-val");
    const kpi4Desc = document.getElementById("tq-kpi-orders-desc");
    if (kpi4Val) kpi4Val.textContent = `${stats.recentOrdersCount} đơn`;
    if (kpi4Desc) {
        kpi4Desc.textContent = `Đơn nhập, xuất & luân chuyển gần đây`;
    }
}

function renderRecentIntakesTable(records) {
    const container = document.getElementById("tq-recent-intakes-list");
    if (!container) return;

    if (!records || records.length === 0) {
        container.innerHTML = `
            <div class="tq-empty-state">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <p>Chưa có ca khám nào được ghi nhận hôm nay</p>
            </div>`;
        return;
    }

    let html = `
        <div class="tq-table-responsive">
            <table class="tq-table">
                <thead>
                    <tr>
                        <th>Thú Cưng & Bệnh Án</th>
                        <th>Chủ Nuôi</th>
                        <th>Chi Nhánh</th>
                        <th>Trạng Thái</th>
                        <th>Thời Gian</th>
                        <th style="text-align: right;">Xem</th>
                    </tr>
                </thead>
                <tbody>
    `;

    records.forEach(r => {
        const isNew = !r.trang_thai || r.trang_thai === 'new';
        const isDone = r.trang_thai === 'done' || r.trang_thai === 'kham_xong';
        const isProcessing = r.trang_thai === 'processing' || r.trang_thai === 'dang_kham';

        let statusBadge = `<span class="badge-status-new">Chờ Xử Lý</span>`;
        if (isDone) statusBadge = `<span class="badge-status-done">Đã Khám</span>`;
        else if (isProcessing) statusBadge = `<span class="badge-status-processing">Đang Xử Lý</span>`;

        const petInfo = escapeHtml(r.pet_name || 'Thú Cưng');
        const breedInfo = r.pet_breed ? `(${escapeHtml(r.pet_breed)}${r.pet_weight ? ' - ' + escapeHtml(r.pet_weight) + 'kg' : ''})` : '';
        const ownerName = escapeHtml(r.owner_name || 'Khách Vãng Lai');
        const ownerPhone = escapeHtml(r.owner_phone || '-');
        const cnCode = extractIntakeBranchCode(r) || 'CN1';
        const cnBadge = cnCode === 'CN2' 
            ? `<span class="tq-badge-branch badge-cn2">CN2</span>` 
            : `<span class="tq-badge-branch badge-cn1">${cnCode}</span>`;

        const timeStr = formatTqTime(r.created_at || r.date_signed);

        html += `
            <tr class="tq-interactive-row" onclick="jumpToIntakeRecord('${escapeHtml(r.id)}')">
                <td>
                    <div class="tq-pet-cell">
                        <div class="tq-pet-avatar">${getPetIconSvg(r.pet_breed)}</div>
                        <div>
                            <div class="tq-pet-name">${petInfo} <span class="tq-pet-breed">${breedInfo}</span></div>
                            <div class="tq-pet-id">${escapeHtml(r.patient_id || 'ID: #' + String(r.id).slice(-4))}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="tq-owner-name">${ownerName}</div>
                    <div class="tq-owner-phone">${ownerPhone}</div>
                </td>
                <td>${cnBadge}</td>
                <td>${statusBadge}</td>
                <td><span class="tq-time-text">${timeStr}</span></td>
                <td style="text-align: right;">
                    <button class="tq-btn-mini-view" title="Xem hồ sơ">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function renderTopExportList(topItems, rawVatTu, rawDetails, branch) {
    const container = document.getElementById('tq-top-export-list');
    if (!container) return;

    if (!topItems || topItems.length === 0) {
        container.innerHTML = `
            <div class="tq-empty-state">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                <p style="color: var(--text-muted);">Chưa có dữ liệu xuất kho</p>
            </div>`;
        return;
    }

    let html = `<div class="tq-table-responsive"><table class="tq-table"><thead><tr>
        <th style="width:32px;">#</th>
        <th>Mặt Hàng</th>
        <th style="text-align:center;">Xuất</th>
        <th style="text-align:center;">Tồn</th>
        <th style="text-align:right;">Thao Tác</th>
    </tr></thead><tbody>`;

    topItems.forEach((item, idx) => {
        const rank = idx + 1;
        const rankClass = rank === 1 ? 'tq-rank-1' : rank === 2 ? 'tq-rank-2' : rank === 3 ? 'tq-rank-3' : 'tq-rank-other';

        const vatTuItem = rawVatTu.find(v => v.ma_vach === item.ma_vach);
        const ton = vatTuItem ? getProductStockForBranch(vatTuItem, branch, rawDetails) : 0;
        const stockClass = ton <= 0 ? 'zero-stock' : 'has-stock';
        const stockLabel = ton <= 0 ? 'Hết hàng' : ton.toLocaleString('vi-VN');

        html += `
            <tr class="tq-interactive-row" onclick="navigateToTheKhoFilter && navigateToTheKhoFilter('${escapeHtml(item.ma_vach || '')}', '', '')">
                <td><span class="tq-rank-badge ${rankClass}">${rank}</span></td>
                <td>
                    <div class="tq-item-title" style="font-size:13px;">${escapeHtml(item.ten_mat_hang || item.ma_vach || '-')}</div>
                    <div class="tq-item-code">${escapeHtml(item.ma_vach || '-')}</div>
                </td>
                <td style="text-align:center;">
                    <span style="font-weight: 700; color: var(--text-primary); font-size: 13px;">${item.tongXuat.toLocaleString('vi-VN')}</span>
                </td>
                <td style="text-align:center;">
                    <span class="tq-badge-stock-count ${stockClass}">${stockLabel}</span>
                </td>
                <td style="text-align:right;">
                    <button class="tq-btn-mini-action" onclick="event.stopPropagation(); typeof navigateToTheKhoFilter === 'function' && navigateToTheKhoFilter('${escapeHtml(item.ma_vach || '')}', '', '')" title="Xem Thẻ Kho" style="background: rgba(56,189,248,0.1); color:#38bdf8; border-color:rgba(56,189,248,0.3);">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        <span>Thẻ Kho</span>
                    </button>
                </td>
            </tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function renderLowStockTable(items) {
    const container = document.getElementById("tq-low-stock-list");
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="tq-empty-state">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <p style="color: #10b981; font-weight: 600;">Tất cả vật tư đều trên mức an toàn!</p>
            </div>`;
        return;
    }

    let html = `
        <div class="tq-table-responsive">
            <table class="tq-table">
                <thead>
                    <tr>
                        <th>Mặt Hàng Vật Tư / Thuốc</th>
                        <th>Tồn Hiện Tại</th>
                        <th>Mức An Toàn</th>
                        <th>Đơn Vị</th>
                        <th style="text-align: right;">Thao Tác</th>
                    </tr>
                </thead>
                <tbody>
    `;

    items.forEach(item => {
        const ton = Number(item.computedTon ?? item.ton_cuoi ?? item.so_luong ?? 0);
        const min = Number(item.ton_kho_an_toan ?? 5);
        const isZero = ton <= 0;

        const stockBadge = isZero 
            ? `<span class="tq-stock-badge badge-out-of-stock">Hết hàng (0)</span>`
            : `<span class="tq-stock-badge badge-low-stock">${ton}</span>`;

        html += `
            <tr class="tq-interactive-row" onclick="jumpToVatTuItem('${escapeHtml(item.ma_vach || '')}')">
                <td>
                    <div class="tq-item-title">${escapeHtml(item.ten_mat_hang || item.ten_hoa_don || 'Vật tư')}</div>
                    <div class="tq-item-code">${escapeHtml(item.ma_vach || '-')} • ${escapeHtml(item.danh_muc || item.nhom_hang || 'Chung')}</div>
                </td>
                <td>${stockBadge}</td>
                <td><span style="font-weight: 600; color: var(--text-secondary);">${min}</span></td>
                <td><span style="font-size: 12px; color: var(--text-muted);">${escapeHtml(item.don_vi || 'Cái')}</span></td>
                <td style="text-align: right; display: flex; gap: 6px; justify-content: flex-end;">
                    <button class="tq-btn-mini-action" style="background: rgba(56,189,248,0.1); color:#38bdf8; border-color:rgba(56,189,248,0.3);" onclick="event.stopPropagation(); typeof navigateToTheKhoFilter === 'function' && navigateToTheKhoFilter('${escapeHtml(item.ma_vach || '')}', '', '')" title="Xem Thẻ Kho">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        <span>Thẻ Kho</span>
                    </button>
                    <button class="tq-btn-mini-action" onclick="event.stopPropagation(); jumpToCreateImportOrder('${escapeHtml(item.ma_vach || '')}', '${escapeHtml(item.ten_mat_hang || '')}')" title="Tạo đơn nhập hàng">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        <span>Nhập Hàng</span>
                    </button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function renderExpiryWatchlist(items) {
    const container = document.getElementById("tq-expiry-watchlist");
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="tq-empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                <p style="color: #10b981;">Không có thuốc nào cận date (≤60 ngày)</p>
            </div>`;
        return;
    }

    let html = `<div class="tq-expiry-list">`;

    items.forEach(item => {
        const isExpired = item.daysLeft < 0;
        const badgeClass = isExpired ? 'badge-expired' : (item.daysLeft <= 30 ? 'badge-near-critical' : 'badge-near-warning');
        const badgeText = isExpired ? `Quá hạn ${Math.abs(item.daysLeft)} ngày` : `Còn ${item.daysLeft} ngày`;

        const dateStr = item.date || item.date_expiry || '-';
        const ton = Number(item.computedTon ?? item.ton_cuoi ?? item.so_luong ?? 0);

        html += `
            <div class="tq-expiry-card" onclick="jumpToVatTuItem('${escapeHtml(item.ma_vach || '')}')">
                <div class="tq-expiry-main">
                    <div class="tq-expiry-badge ${badgeClass}">${badgeText}</div>
                    <div class="tq-expiry-title">${escapeHtml(item.ten_mat_hang || item.ten_hoa_don || 'Dược phẩm')}</div>
                    <div class="tq-expiry-meta">
                        <span>Hạn SD: <strong>${escapeHtml(dateStr)}</strong></span>
                        <span>LOT: <strong>${escapeHtml(item.lot || '-')}</strong></span>
                    </div>
                </div>
                <div class="tq-expiry-stock">
                    <span class="tq-stock-num">${ton}</span>
                    <span class="tq-stock-unit">${escapeHtml(item.don_vi || 'đv')}</span>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

function renderRecentWarehouseTimeline(orders) {
    const container = document.getElementById("tq-recent-orders-timeline");
    if (!container) return;

    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="tq-empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                <p>Chưa có đơn nhập xuất nào gần đây</p>
            </div>`;
        return;
    }

    let html = `<div class="tq-timeline-list">`;

    orders.forEach(ord => {
        const rawLoai = String(ord.loai_don || '').trim();
        const normalizedLoai = rawLoai.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const isNhap = normalizedLoai.includes('nhap');
        const iconSvg = isNhap 
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>`;

        const typeBadge = isNhap 
            ? `<span class="badge-type-nhap">Nhập Kho</span>` 
            : `<span class="badge-type-xuat">Xuất Kho</span>`;

        const timeStr = formatTqTime(ord.created_at || ord.ngay_tao);
        const code = escapeHtml(ord.ma_don || 'ĐƠN-KHO');
        const creator = escapeHtml(ord.user_name || 'Kho GAIA');
        const branch = extractOrderBranchCode(ord) || 'CN1';
        const orderRef = String(ord.id || ord.ma_don || '');

        html += `
            <div class="tq-timeline-item" data-order-id="${escapeHtml(orderRef)}">
                <div class="tq-timeline-icon-wrap ${isNhap ? 'is-nhap' : 'is-xuat'}">${iconSvg}</div>
                <div class="tq-timeline-content">
                    <div class="tq-timeline-header">
                        <span class="tq-order-code">${code}</span>
                        ${typeBadge}
                        <span class="tq-badge-branch ${branch === 'CN2' ? 'badge-cn2' : 'badge-cn1'}">${branch}</span>
                    </div>
                    <div class="tq-timeline-sub">
                        <span>Bởi: <strong>${creator}</strong></span> • 
                        <span>${timeStr}</span>
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;

    if (!container.dataset.timelineClickBound) {
        container.addEventListener('click', (e) => {
            const card = e.target.closest('.tq-timeline-item');
            if (!card) return;
            const orderId = card.getAttribute('data-order-id') || '';
            if (orderId) {
                if (typeof window.jumpToNxOrder === 'function') {
                    window.jumpToNxOrder(orderId);
                }
            }
        });
        container.dataset.timelineClickBound = '1';
    }
}

const BRANCH_PALETTES = [
    { color: '#10b981', gradient: 'linear-gradient(90deg, #10b981, #059669)' },
    { color: '#6366f1', gradient: 'linear-gradient(90deg, #6366f1, #4f46e5)' },
    { color: '#f59e0b', gradient: 'linear-gradient(90deg, #f59e0b, #d97706)' },
    { color: '#ec4899', gradient: 'linear-gradient(90deg, #ec4899, #db2777)' },
    { color: '#06b6d4', gradient: 'linear-gradient(90deg, #06b6d4, #0891b2)' },
    { color: '#8b5cf6', gradient: 'linear-gradient(90deg, #8b5cf6, #7c3aed)' },
    { color: '#14b8a6', gradient: 'linear-gradient(90deg, #14b8a6, #0d9488)' },
    { color: '#f97316', gradient: 'linear-gradient(90deg, #f97316, #ea580c)' }
];

function getTongQuanComparisonBranches(rawIntakes, rawDetails, rawVatTu) {
    const map = new Map();

    // 1. Từ danh sách cấu hình chi nhánh hệ thống
    if (typeof window.getSystemBranchesDetailed === 'function') {
        try {
            const sys = window.getSystemBranchesDetailed();
            if (Array.isArray(sys) && sys.length > 0) {
                sys.forEach(b => {
                    const code = (b.code || '').trim().toUpperCase();
                    if (code && code !== 'ALL' && !map.has(code)) {
                        map.set(code, {
                            code: code,
                            name: b.name || code,
                            fullName: b.name ? `${b.name} (${code})` : code
                        });
                    }
                });
            }
        } catch (e) {
            console.warn("GAIA TongQuan: Error getting system branches for comparison:", e);
        }
    }

    // 2. Từ dữ liệu tồn kho chi tiết
    if (Array.isArray(rawDetails)) {
        rawDetails.forEach(d => {
            const code = extractBranchCode(d.chi_nhanh);
            if (code && code !== 'ALL' && !map.has(code)) {
                map.set(code, {
                    code: code,
                    name: (d.chi_nhanh || code).trim(),
                    fullName: `${(d.chi_nhanh || code).trim()} (${code})`
                });
            }
        });
    }

    // 3. Từ ca khám
    if (Array.isArray(rawIntakes)) {
        rawIntakes.forEach(r => {
            const code = extractIntakeBranchCode(r);
            if (code && code !== 'ALL' && !map.has(code)) {
                map.set(code, {
                    code: code,
                    name: code,
                    fullName: code
                });
            }
        });
    }

    if (map.size === 0) {
        map.set('CN1', { code: 'CN1', name: 'Chi Nhánh 1', fullName: 'Chi Nhánh 1 (CN1)' });
    }

    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

function renderDynamicBranchComparison(branchesData) {
    const container = document.getElementById("tq-branch-comparison-container");
    const titleEl = document.getElementById("tq-widget-branch-title");
    const subtitleEl = document.getElementById("tq-widget-branch-subtitle");

    if (!container || !Array.isArray(branchesData) || branchesData.length === 0) return;

    const branchCount = branchesData.length;

    // Cập nhật tiêu đề linh hoạt theo số lượng chi nhánh thực tế
    if (titleEl) {
        if (branchCount === 1) {
            titleEl.textContent = `Tổng Quan: ${branchesData[0].name || branchesData[0].code}`;
        } else if (branchCount === 2) {
            titleEl.textContent = `Tương Quan ${branchesData[0].code} vs ${branchesData[1].code}`;
        } else {
            titleEl.textContent = `Tương Quan Các Chi Nhánh (${branchCount} Chi Nhánh)`;
        }
    }

    if (subtitleEl) {
        if (branchCount === 1) {
            subtitleEl.textContent = `Số liệu ca khám hôm nay & tổng tồn kho`;
        } else {
            subtitleEl.textContent = `Tỷ lệ ca khám & tồn kho thực tế`;
        }
    }

    // Tính tổng để chia %
    const totalIntakes = branchesData.reduce((sum, b) => sum + (b.intakesCount || 0), 0);
    const totalStock = branchesData.reduce((sum, b) => sum + (b.stockSum || 0), 0);

    const calculated = branchesData.map((b, idx) => {
        const palette = BRANCH_PALETTES[idx % BRANCH_PALETTES.length];
        let intakePct = 0;
        let stockPct = 0;

        if (totalIntakes > 0) {
            intakePct = Math.round(((b.intakesCount || 0) / totalIntakes) * 100);
        } else {
            intakePct = Math.round(100 / branchCount);
        }

        if (totalStock > 0) {
            stockPct = Math.round(((b.stockSum || 0) / totalStock) * 100);
        } else {
            stockPct = Math.round(100 / branchCount);
        }

        return {
            ...b,
            palette,
            intakePct,
            stockPct
        };
    });

    // Điều chỉnh làm tròn sao cho tổng % = 100% nếu có từ 2 chi nhánh trở lên
    if (branchCount >= 2) {
        const sumIntakePct = calculated.reduce((s, b) => s + b.intakePct, 0);
        if (sumIntakePct > 0 && sumIntakePct !== 100) {
            calculated[calculated.length - 1].intakePct += (100 - sumIntakePct);
        }
        const sumStockPct = calculated.reduce((s, b) => s + b.stockPct, 0);
        if (sumStockPct > 0 && sumStockPct !== 100) {
            calculated[calculated.length - 1].stockPct += (100 - sumStockPct);
        }
    }

    // 1. Render Ca Khám
    const intakeValuesHtml = calculated.map(b => `
        <span style="color: ${b.palette.color}; font-weight: 700;">${escapeHtml(b.code)}: ${b.intakesCount || 0} ca ${branchCount > 1 ? `(${b.intakePct}%)` : ''}</span>
    `).join(' <span style="color: var(--text-muted); opacity: 0.5;">•</span> ');

    const intakeBarsHtml = calculated.map(b => `
        <div class="tq-bar-segment" style="width: ${b.intakePct}%; background: ${b.palette.gradient};" title="${escapeHtml(b.name)}: ${b.intakesCount || 0} ca (${b.intakePct}%)"></div>
    `).join('');

    // 2. Render Tồn Kho
    const stockValuesHtml = calculated.map(b => `
        <span style="color: ${b.palette.color}; font-weight: 700;">${escapeHtml(b.code)}: ${(b.stockSum || 0).toLocaleString('vi-VN')} đv ${branchCount > 1 ? `(${b.stockPct}%)` : ''}</span>
    `).join(' <span style="color: var(--text-muted); opacity: 0.5;">•</span> ');

    const stockBarsHtml = calculated.map(b => `
        <div class="tq-bar-segment" style="width: ${b.stockPct}%; background: ${b.palette.gradient};" title="${escapeHtml(b.name)}: ${(b.stockSum || 0).toLocaleString('vi-VN')} đv (${b.stockPct}%)"></div>
    `).join('');

    // 3. Legend (nếu có từ 2 chi nhánh trở lên)
    let legendHtml = '';
    if (branchCount >= 2) {
        legendHtml = `
            <div class="tq-comp-legend-row" style="display: flex; flex-wrap: wrap; gap: 10px 14px; margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--card-border, rgba(255,255,255,0.08)); font-size: 11.5px; color: var(--text-secondary, #94a3b8);">
                ${calculated.map(b => `
                    <div style="display: inline-flex; align-items: center; gap: 6px;">
                        <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: ${b.palette.color}; box-shadow: 0 0 6px ${b.palette.color}66;"></span>
                        <strong style="color: var(--text-primary, #f1f5f9);">${escapeHtml(b.code)}</strong>: <span>${escapeHtml(b.name)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = `
        <div class="tq-comp-item">
            <div class="tq-comp-label-row">
                <span>Ca Khám Hôm Nay</span>
                <div class="tq-comp-values" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
                    ${intakeValuesHtml}
                </div>
            </div>
            <div class="tq-comp-bar-container" style="display: flex; overflow: hidden; height: 10px; border-radius: 6px; background: var(--input-bg, #0f172a); border: 1px solid var(--card-border, rgba(255,255,255,0.08)); margin-top: 6px;">
                ${intakeBarsHtml}
            </div>
        </div>

        <div class="tq-comp-item" style="margin-top: 16px;">
            <div class="tq-comp-label-row">
                <span>Tổng Số Lượng Tồn Kho</span>
                <div class="tq-comp-values" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
                    ${stockValuesHtml}
                </div>
            </div>
            <div class="tq-comp-bar-container" style="display: flex; overflow: hidden; height: 10px; border-radius: 6px; background: var(--input-bg, #0f172a); border: 1px solid var(--card-border, rgba(255,255,255,0.08)); margin-top: 6px;">
                ${stockBarsHtml}
            </div>
        </div>

        ${legendHtml}
    `;
}

function renderBranchComparisonBars(data) {
    if (!data) return;
    // Hỗ trợ hàm cũ nếu có nơi nào gọi
    renderDynamicBranchComparison([
        { code: 'CN1', name: 'Chi Nhánh 1', intakesCount: data.cn1Intakes || 0, stockSum: data.cn1Stock || 0 },
        { code: 'CN2', name: 'Chi Nhánh 2', intakesCount: data.cn2Intakes || 0, stockSum: data.cn2Stock || 0 }
    ]);
}

window.jumpToView = function (viewName) {
    window.location.hash = viewName;
};

window.jumpToVatTuLowStock = function () {
    window.location.hash = 'vat-tu';
    setTimeout(() => {
        if (typeof window.filterVatTuOutOfStock === 'function') {
            window.filterVatTuOutOfStock();
        }
    }, 250);
};

window.jumpToVatTuExpiryWatch = function () {
    window.location.hash = 'vat-tu';
    setTimeout(() => {
        if (typeof window.handleVatTuExpiryFilterChange === 'function') {
            window.handleVatTuExpiryFilterChange('near_60');
        }
    }, 250);
};

window.jumpToIntakeRecord = function (recordId) {
    window.location.hash = 'lich-kham';
    setTimeout(() => {
        const rawIntakes = (typeof intakesData !== 'undefined' && Array.isArray(intakesData)) ? intakesData : (window.intakesData || []);
        const rec = rawIntakes.find(r => String(r.id) === String(recordId));
        if (rec && typeof openIntakeDetails === 'function') {
            openIntakeDetails(rec);
        }
    }, 250);
};

window.jumpToVatTuItem = function (maVach) {
    window.location.hash = 'vat-tu';
    setTimeout(() => {
        const searchInp = document.getElementById("vattu-search-input") || document.getElementById("vattu-search");
        if (searchInp && maVach) {
            searchInp.value = maVach;
            searchInp.dispatchEvent(new Event('input'));
        }
    }, 250);
};

window.jumpToCreateImportOrder = function (maVach, tenMatHang) {
    window.location.hash = 'nhap-xuat';
    setTimeout(() => {
        const typeSelect = document.getElementById("nx-form-type");
        if (typeSelect) {
            typeSelect.value = "nhap";
            typeSelect.dispatchEvent(new Event('change'));
        }
        const barcodeInp = document.getElementById("nx-barcode-input");
        if (barcodeInp && maVach) {
            barcodeInp.value = maVach;
            barcodeInp.focus();
        }
    }, 250);
};

window.jumpToNxOrder = function (orderId) {
    window.location.hash = 'nhap-xuat';

    const navEl = document.querySelector('[data-view="nhap-xuat"], [href="#nhap-xuat"]');
    if (navEl) navEl.click();

    setTimeout(() => {

        const rawNx = (typeof nhapXuatData !== 'undefined' && Array.isArray(nhapXuatData))
            ? nhapXuatData
            : (window.nhapXuatData || []);
        const order = rawNx.find(o => String(o.id) === String(orderId) || String(o.ma_don) === String(orderId));
        if (order && typeof window.selectNxOrderForView === 'function') {
            window.selectNxOrderForView(order);
        } else {

            const cards = document.querySelectorAll('.nx-order-card');
            cards.forEach(card => {
                const codeEl = card.querySelector('.nx-card-code');
                if (codeEl && (codeEl.textContent.trim() === String(orderId) || card.dataset.orderId === String(orderId))) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.click();
                }
            });
        }
    }, 350);
};

function formatTqTime(iso) {
    if (!iso) return '-';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        return `${hh}:${mm} • ${dd}/${mo}`;
    } catch (e) {
        return String(iso);
    }
}

function getPetIconSvg(breed) {
    const b = (breed || "").toLowerCase();
    if (b.includes("mèo") || b.includes("meo") || b.includes("cat")) {
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 4.5-2.26 5.5-2.26 0 1.5-.5 3.5-1.5 4.5 1.5 2 1.5 4.5 1 6.5-1 4-4 6-7 6s-6-2-7-6c-.5-2-.5-4.5 1-6.5-1-1-1.5-3-1.5-4.5 1 0 3.72.26 5.5 2.26.65-.17 1.33-.26 2-.26z"></path><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle></svg>`;
    }
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"></path><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path><polygon points="8 14 5 13 9 22 14 22 18 13 15 14 12 17 8 14"></polygon></svg>`;
}

function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
