/* ==========================================================================
   GAIA Animal Hospital - Bảng Điều Khiển Tổng Quan (tong_quan.js)
   Realtime Aggregation Dashboard: Lịch Khám, Vật Tư, Nhập Xuất, Kiểm Kho & Thẻ Kho
   Branch RBAC: Dynamically loaded from Staff Table 'branch' column
   ========================================================================== */

let tongQuanBranchFilter = 'all'; // 'all' | 'CN1' | 'CN2' | ...
let tongQuanIsInitialized = false;
let tongQuanRefreshTimer = null;

// Cache local aggregations
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

// --- 1. Supabase Client Helper ---
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

// --- Helper: Get Logged User & Check Permissions from Staff Table ---
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
    if (!user) return false; // If no session → default staff view (locked)
    const roleLower = (user.role || "").toLowerCase().trim();
    const branchLower = (user.branch || "").toLowerCase().trim();
    // Only "Quản lý" role can freely choose all branches
    // Admin and Nhân viên are locked to their own branch
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
    
    // Explicit regex match for CN followed by digit(s) e.g. CN1, CN2, CN01, etc.
    const m = upper.match(/CN\s*(\d+)/i);
    if (m) {
        return `CN${parseInt(m[1], 10)}`;
    }
    
    const mChiNhanh = upper.match(/CHI\s*NH\xC1NH\s*(\d+)/i) || upper.match(/CHI\s*NHANH\s*(\d+)/i);
    if (mChiNhanh) {
        return `CN${parseInt(mChiNhanh[1], 10)}`;
    }

    // Keywords matching known branch names from DB
    if (upper.includes('HUỲNH TẤN PHÁT') || upper.includes('HUYNH TAN PHAT') || upper.includes('QUẬN 7') || upper.includes('QUAN 7') || upper.includes('HÀ NỘI') || upper.includes('HA NOI')) {
        return 'CN2';
    }
    if (upper.includes('HIỆP BÌNH') || upper.includes('HIEP BINH') || upper.includes('22 ROAD') || upper.includes('AN DƯƠNG VƯƠNG') || upper.includes('AN DUONG VUONG') || upper.includes('TP.HCM') || upper.includes('HCM')) {
        return 'CN1';
    }

    return '';
}

// Dedicated helper for extracting branch code from an Order (nhap_xuat / the_kho)
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

// Dedicated helper for extracting branch code from a Pet Intake record
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

// --- 2. Dynamic Branch Dropdown based on Staff Table ---
async function initTongQuanBranchDropdown() {
    const branchSelect = document.getElementById("tq-branch-filter");
    if (!branchSelect) return;

    const loggedUser = getTongQuanLoggedUser();
    const isManager = isTongQuanManager(loggedUser);
    let userCN = loggedUser ? (loggedUser.cn || extractBranchCode(loggedUser.branch || "")) : "";
    userCN = userCN ? userCN.toUpperCase().trim() : "";
    const userBranchName = loggedUser ? (loggedUser.branch || "").trim() : "";

    // 1. Fetch/Collect unique branches from staff table
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

    // Map of CN Code -> Full Branch Display Name from staff table
    const branchMap = new Map(); // e.g. "CN1" => "CN1 - No. 2D, 22 Road...", "CN2" => "CN2 - Huỳnh Tấn Phát..."
    
    staffList.forEach(s => {
        const rawBranch = (s.branch || "").trim();
        if (rawBranch && rawBranch !== "Toàn hệ thống" && rawBranch.toLowerCase() !== "all") {
            const cnCode = extractBranchCode(s.cn || rawBranch);
            if (cnCode && cnCode !== "ALL") {
                if (!branchMap.has(cnCode) || rawBranch.length > (branchMap.get(cnCode) || '').length) {
                    branchMap.set(cnCode, rawBranch);
                }
            }
        }
    });

    // Ensure loggedUser branch is in map if present
    if (userBranchName && userBranchName !== "Toàn hệ thống" && userBranchName.toLowerCase() !== "all") {
        const cnCode = extractBranchCode(userBranchName);
        if (cnCode && cnCode !== "ALL" && !branchMap.has(cnCode)) {
            branchMap.set(cnCode, userBranchName);
        }
    }

    // Fallbacks if database has no records yet
    if (!branchMap.has("CN1")) branchMap.set("CN1", "CN1 - No. 2D, 22 Road, Hiep Binh Ward, Ho Chi Minh City");
    if (!branchMap.has("CN2")) branchMap.set("CN2", "CN2 - Huỳnh Tấn Phát, Quận 7, Ho Chi Minh City");

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
        // Strict lock for Staff / Doctor to their own branch from staff table
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

// --- 3. Initialize Dashboard ---
window.initTongQuanDashboard = async function () {
    // Populate branch filter dropdown dynamically from Staff Table & User permissions
    await initTongQuanBranchDropdown();

    if (!tongQuanIsInitialized) {
        tongQuanIsInitialized = true;
        // Bind Event Listeners
        setupTongQuanEventListeners();
        // Start Live Clock
        startDashboardLiveClock();
        // Setup Supabase Realtime Listeners
        setupTongQuanRealtime();
    }

    // Initial Data Fetch & Render
    await refreshTongQuanData();
};

// --- 4. Setup Event Listeners ---
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

// --- 5. Live Clock & Greeting ---
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

// --- 6. Fetch / Refresh All Needed Data ---
window.refreshTongQuanData = async function () {
    const client = getTongQuanSupabaseClient();
    if (!client) {
        renderTongQuanDashboard();
        return;
    }

    try {
        // Fetch pet_intakes if intakesData empty or stale
        if (typeof fetchInitialIntakes === 'function' && (!window.intakesData || window.intakesData.length === 0)) {
            await fetchInitialIntakes();
        } else {
            // Background fetch latest pet_intakes
            const { data: intakes } = await client.from('pet_intakes').select('*').order('created_at', { ascending: false }).limit(200);
            if (intakes) {
                if (typeof intakesData !== 'undefined') intakesData = intakes;
                window.intakesData = intakes;
            }
        }

        // Fetch san_pham if vatTuData empty
        if (typeof vatTuData === 'undefined' || !vatTuData || vatTuData.length === 0) {
            const { data: vts } = await client.from('san_pham').select('*').limit(1500);
            if (vts) {
                if (typeof vatTuData !== 'undefined') vatTuData = vts;
                window.vatTuData = vts;
            }
        }

        // Fetch ton_kho_detail for accurate branch calculations
        if (typeof tonKhoDetailData === 'undefined' || !tonKhoDetailData || tonKhoDetailData.length === 0) {
            const { data: details } = await client.from('ton_kho_detail').select('*');
            if (details) {
                if (typeof tonKhoDetailData !== 'undefined') tonKhoDetailData = details;
                window.tonKhoDetailData = details;
            }
        }

        // Fetch nhap_xuat if nhapXuatData empty
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

// --- 7. Realtime Subscription ---
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

// --- Helper: Calculate Product Stock For Branch ---
function getProductStockForBranch(item, branch, details) {
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

    // Fallback to direct fields
    if (branch === 'CN1') {
        if (item.so_luong_cn1 !== undefined && item.so_luong_cn1 !== null) return Number(item.so_luong_cn1) || 0;
        return Number(item.ton_cuoi ?? item.so_luong ?? 0);
    } else if (branch === 'CN2') {
        if (item.so_luong_cn2 !== undefined && item.so_luong_cn2 !== null) return Number(item.so_luong_cn2) || 0;
        return 0;
    }
    return Number(item.ton_cuoi ?? item.so_luong ?? 0);
}

// --- 8. Main Render Logic ---
window.renderTongQuanDashboard = function () {
    const rawIntakes = (typeof intakesData !== 'undefined' && Array.isArray(intakesData)) ? intakesData : (window.intakesData || []);
    const rawVatTu = (typeof vatTuData !== 'undefined' && Array.isArray(vatTuData)) ? vatTuData : (window.vatTuData || []);
    const rawDetails = (typeof tonKhoDetailData !== 'undefined' && Array.isArray(tonKhoDetailData)) ? tonKhoDetailData : (window.tonKhoDetailData || []);
    const rawNhapXuat = (typeof nhapXuatData !== 'undefined' && Array.isArray(nhapXuatData)) ? nhapXuatData : (window.nhapXuatData || []);

    const branch = tongQuanBranchFilter; // 'all', 'CN1', 'CN2', ...

    // Filter Intakes by branch
    const intakes = rawIntakes.filter(r => {
        if (branch === 'all') return true;
        const cn = extractIntakeBranchCode(r);
        return cn === branch;
    });

    // Filter Nhap Xuat by branch
    const nhapXuatList = rawNhapXuat.filter(order => {
        if (branch === 'all') return true;
        const cn = extractOrderBranchCode(order);
        return cn === branch;
    });

    // --- Compute Key Metrics ---
    const todayStr = new Date().toISOString().substring(0, 10);
    
    // 1. Intakes Metrics
    const todayIntakesList = intakes.filter(r => {
        const d = (r.created_at || r.date_signed || "").substring(0, 10);
        return d === todayStr;
    });
    const todayCount = todayIntakesList.length;
    const newCount = todayIntakesList.filter(r => !r.trang_thai || r.trang_thai === 'new').length;
    const doneCount = todayIntakesList.filter(r => r.trang_thai === 'done' || r.trang_thai === 'kham_xong' || r.trang_thai === 'tiep_nhan').length;
    const processingCount = todayIntakesList.filter(r => r.trang_thai === 'processing' || r.trang_thai === 'dang_kham').length;

    // 2. Inventory Metrics (Evaluated according to active branch filter!)
    let lowStockItems = [];
    let outOfStockItems = [];
    let nearExpiryItems = [];
    let expiredItems = [];

    const now = new Date();
    const sixtyDaysAhead = new Date();
    sixtyDaysAhead.setDate(sixtyDaysAhead.getDate() + 60);

    rawVatTu.forEach(item => {
        const ton = getProductStockForBranch(item, branch, rawDetails);
        const minStock = Number(item.ton_kho_an_toan ?? 5);

        const itemWithComputedTon = { ...item, computedTon: ton };

        if (ton <= 0) {
            outOfStockItems.push(itemWithComputedTon);
        } else if (ton <= minStock) {
            lowStockItems.push(itemWithComputedTon);
        }

        // Check Expiry Date
        const dateStr = item.date || item.date_expiry || item.han_su_dung;
        if (dateStr && dateStr !== '-' && dateStr !== 'null') {
            const expDate = parseExpiryDate(dateStr);
            if (expDate) {
                if (expDate < now) {
                    expiredItems.push({ ...itemWithComputedTon, expDate, daysLeft: Math.round((expDate - now) / (1000 * 60 * 60 * 24)) });
                } else if (expDate <= sixtyDaysAhead) {
                    nearExpiryItems.push({ ...itemWithComputedTon, expDate, daysLeft: Math.round((expDate - now) / (1000 * 60 * 60 * 24)) });
                }
            }
        }
    });

    // Sort expiry items by days left ascending
    nearExpiryItems.sort((a, b) => a.daysLeft - b.daysLeft);
    expiredItems.sort((a, b) => a.daysLeft - b.daysLeft);

    // 3. Stock Movement Metrics
    const recentOrdersCount = nhapXuatList.length;

    // 4. Top Export Items (compute from theKhoData)
    const rawTheKho = (typeof theKhoData !== 'undefined' && Array.isArray(theKhoData)) ? theKhoData : (window.theKhoData || []);
    const exportMap = {};
    rawTheKho.forEach(tk => {
        if ((tk.loai || '').toLowerCase() !== 'xuất') return;
        // Filter by branch if needed
        if (branch !== 'all') {
            const tkBranch = extractBranchCode(tk.user_name || '');
            if (tkBranch && tkBranch !== branch) return;
        }
        const key = tk.ma_vach || tk.ten_hang_hoa || '';
        if (!key) return;
        if (!exportMap[key]) {
            exportMap[key] = {
                ma_vach: tk.ma_vach || '',
                ten_mat_hang: tk.ten_hang_hoa || tk.ten_mat_hang || key,
                don_vi: tk.don_vi || 'cái',
                tongXuat: 0
            };
        }
        exportMap[key].tongXuat += Number(tk.so_luong) || 0;
    });
    // If theKhoData empty, fallback to nhapXuatData items
    if (Object.keys(exportMap).length === 0) {
        rawNhapXuat.forEach(ord => {
            if ((ord.loai_don || '').toLowerCase() !== 'xuất') return;
            if (branch !== 'all') {
                const ordBranch = extractOrderBranchCode(ord);
                if (ordBranch && ordBranch !== branch) return;
            }
            const items = ord.chi_tiet_san_pham || [];
            items.forEach(it => {
                const key = it.ma_vach || it.ten_hang_hoa || '';
                if (!key) return;
                if (!exportMap[key]) {
                    exportMap[key] = {
                        ma_vach: it.ma_vach || '',
                        ten_mat_hang: it.ten_hang_hoa || key,
                        don_vi: it.don_vi || 'cái',
                        tongXuat: 0
                    };
                }
                exportMap[key].tongXuat += Number(it.so_luong) || 0;
            });
        });
    }
    const topExportItems = Object.values(exportMap)
        .sort((a, b) => b.tongXuat - a.tongXuat)
        .slice(0, 8);

    // 5. Branch Breakdown Stats (Comparison CN1 vs CN2) — Manager only
    const loggedUserForRender = getTongQuanLoggedUser();
    const isManagerForRender = isTongQuanManager(loggedUserForRender);

    const cn1IntakesCount = rawIntakes.filter(r => extractIntakeBranchCode(r) === 'CN1' && (r.created_at || '').substring(0, 10) === todayStr).length;
    const cn2IntakesCount = rawIntakes.filter(r => extractIntakeBranchCode(r) === 'CN2' && (r.created_at || '').substring(0, 10) === todayStr).length;
    
    let cn1StockSum = 0;
    let cn2StockSum = 0;
    rawVatTu.forEach(item => {
        cn1StockSum += getProductStockForBranch(item, 'CN1', rawDetails);
        cn2StockSum += getProductStockForBranch(item, 'CN2', rawDetails);
    });

    // Show/hide Widget 5 (Branch Comparison) based on role: Manager only
    const branchComparisonWidget = document.getElementById('tq-widget-branch-comparison');
    if (branchComparisonWidget) {
        branchComparisonWidget.style.display = isManagerForRender ? '' : 'none';
    }

    // --- Update KPI DOM Elements ---
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
        recentOrdersCount
    });

    // --- Render Sub-Sections ---
    renderRecentIntakesTable(intakes.slice(0, 6));
    renderTopExportList(topExportItems, rawVatTu, rawDetails, branch);
    renderExpiryWatchlist([...expiredItems, ...nearExpiryItems].slice(0, 6));
    renderRecentWarehouseTimeline(nhapXuatList.slice(0, 5));
    if (isManagerForRender) {
        renderBranchComparisonBars({
            cn1Intakes: cn1IntakesCount,
            cn2Intakes: cn2IntakesCount,
            cn1Stock: cn1StockSum,
            cn2Stock: cn2StockSum
        });
    }
};

// --- Helper: Parse Expiry Date ---
function parseExpiryDate(dateStr) {
    if (!dateStr || dateStr === '-') return null;
    const s = String(dateStr).trim();
    
    // Case DD/MM/YYYY
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
    // Case YYYY-MM-DD
    if (s.includes('-')) {
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

// --- 9. Update Top KPI Cards ---
function updateKpiCards(stats) {
    // 1. Ca Khám Hôm Nay
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

    // 2. Tồn Kho Cảnh Báo (Out of Stock / Low Stock)
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

    // 3. Dược Phẩm Cận Hạn Dùng
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

    // 4. Hoạt Động Kho & Nhập Xuất
    const kpi4Val = document.getElementById("tq-kpi-orders-val");
    const kpi4Desc = document.getElementById("tq-kpi-orders-desc");
    if (kpi4Val) kpi4Val.textContent = `${stats.recentOrdersCount} đơn`;
    if (kpi4Desc) {
        kpi4Desc.textContent = `Đơn nhập, xuất & luân chuyển gần đây`;
    }
}

// --- 10. Render Recent Intakes Table ---
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

// --- 11. Render Low Stock Table ---
// --- 11. Render Top Export Items List ---
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

        // Compute current stock for this branch
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

// --- 12. Render Expiry Watchlist ---
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

// --- 13. Render Recent Warehouse Movement Timeline ---
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
        const isNhap = (ord.loai_don || '').toLowerCase().includes('nhap');
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

        html += `
            <div class="tq-timeline-item" onclick="jumpToNxOrder('${escapeHtml(ord.id || ord.ma_don)}')">
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
}

// --- 14. Render Branch Comparison Progress Bars ---
function renderBranchComparisonBars(data) {
    const totalIntakes = (data.cn1Intakes || 0) + (data.cn2Intakes || 0);
    let cn1IntakePct = 50;
    let cn2IntakePct = 50;
    if (totalIntakes > 0) {
        cn1IntakePct = Math.round(((data.cn1Intakes || 0) / totalIntakes) * 100);
        cn2IntakePct = 100 - cn1IntakePct;
    }

    const totalStock = (data.cn1Stock || 0) + (data.cn2Stock || 0);
    let cn1StockPct = 50;
    let cn2StockPct = 50;
    if (totalStock > 0) {
        cn1StockPct = Math.round(((data.cn1Stock || 0) / totalStock) * 100);
        cn2StockPct = 100 - cn1StockPct;
    }

    const elIntakeCn1 = document.getElementById("tq-bar-intake-cn1");
    const elIntakeCn2 = document.getElementById("tq-bar-intake-cn2");
    const elIntakeTxtCn1 = document.getElementById("tq-txt-intake-cn1");
    const elIntakeTxtCn2 = document.getElementById("tq-txt-intake-cn2");

    if (elIntakeCn1) elIntakeCn1.style.width = `${cn1IntakePct}%`;
    if (elIntakeCn2) elIntakeCn2.style.width = `${cn2IntakePct}%`;
    if (elIntakeTxtCn1) elIntakeTxtCn1.textContent = `CN1: ${data.cn1Intakes || 0} ca (${cn1IntakePct}%)`;
    if (elIntakeTxtCn2) elIntakeTxtCn2.textContent = `CN2: ${data.cn2Intakes || 0} ca (${cn2IntakePct}%)`;

    const elStockCn1 = document.getElementById("tq-bar-stock-cn1");
    const elStockCn2 = document.getElementById("tq-bar-stock-cn2");
    const elStockTxtCn1 = document.getElementById("tq-txt-stock-cn1");
    const elStockTxtCn2 = document.getElementById("tq-txt-stock-cn2");

    if (elStockCn1) elStockCn1.style.width = `${cn1StockPct}%`;
    if (elStockCn2) elStockCn2.style.width = `${cn2StockPct}%`;
    if (elStockTxtCn1) elStockTxtCn1.textContent = `CN1: ${(data.cn1Stock || 0).toLocaleString('vi-VN')} đv (${cn1StockPct}%)`;
    if (elStockTxtCn2) elStockTxtCn2.textContent = `CN2: ${(data.cn2Stock || 0).toLocaleString('vi-VN')} đv (${cn2StockPct}%)`;
}

// --- Helper Functions for Navigation & Jump ---
window.jumpToView = function (viewName) {
    window.location.hash = viewName;
};

// Jump to Vật Tư view and filter specifically for Out of Stock (Tồn Cuối = 0)
window.jumpToVatTuLowStock = function () {
    window.location.hash = 'vat-tu';
    setTimeout(() => {
        if (typeof window.filterVatTuOutOfStock === 'function') {
            window.filterVatTuOutOfStock();
        }
    }, 250);
};

// Jump to Vật Tư view and filter specifically for Near Expiry / Expired products (≤ 60d)
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
    // Trigger navigation click to activate the view
    const navEl = document.querySelector('[data-view="nhap-xuat"], [href="#nhap-xuat"]');
    if (navEl) navEl.click();

    setTimeout(() => {
        // Find the order in nhapXuatData and open it
        const rawNx = (typeof nhapXuatData !== 'undefined' && Array.isArray(nhapXuatData))
            ? nhapXuatData
            : (window.nhapXuatData || []);
        const order = rawNx.find(o => String(o.id) === String(orderId) || String(o.ma_don) === String(orderId));
        if (order && typeof window.selectNxOrderForView === 'function') {
            window.selectNxOrderForView(order);
        } else {
            // Fallback: scroll to matching card
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

// --- Helpers: Formatting & Icons ---
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
