// =========================================================================
// GAIA HOSPITAL: MODULE CÀI ĐẶT THÔNG TIN THƯƠNG HIỆU & CHI NHÁNH
// Quản lý tạo chi nhánh -> Nhân sự lấy chi nhánh -> Realtime đồng bộ tức thì
// =========================================================================

let currentCaiDatBranch = '';
let caiDatBranchConfigs = {};
let pendingLogoUploadFile = null;
let caiDatRealtimeChannel = null;

function getCaiDatSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        window.supabaseClient = supabaseClient;
        return supabaseClient;
    }
    if (typeof supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url) {
        try {
            window.supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            return window.supabaseClient;
        } catch (e) {
            console.error("GAIA CaiDat: Error initializing Supabase client:", e);
        }
    }
    return null;
}

// Convert Google Drive share links to direct image preview links
function normalizeImagePublicUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';

    const gdMatch1 = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
    if (gdMatch1 && gdMatch1[1]) {
        return `https://lh3.googleusercontent.com/d/${gdMatch1[1]}`;
    }

    const gdMatch2 = trimmed.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([a-zA-Z0-9_-]+)/i);
    if (gdMatch2 && gdMatch2[1]) {
        return `https://lh3.googleusercontent.com/d/${gdMatch2[1]}`;
    }

    return trimmed;
}

// Extract CN code from branch string
function parseBranchCode(branchStr) {
    if (!branchStr) return '';
    const str = String(branchStr).trim().toUpperCase();
    if (caiDatBranchConfigs && caiDatBranchConfigs[str]) return str;
    
    const match = str.match(/CN\s*(\d+)/i) || str.match(/CHI\s*NH\xC1NH\s*(\d+)/i) || str.match(/CHI\s*NHANH\s*(\d+)/i);
    if (match) {
        return `CN${match[1]}`;
    }

    if (str.includes('TP.HCM') || str.includes('HỒ CHÍ MINH') || str.includes('HCM') || str.includes('HIỆP BÌNH') || str.includes('HIEP BINH')) return 'CN1';
    if (str.includes('HÀ NỘI') || str.includes('HA NOI') || str.includes('HN') || str.includes('HUỲNH TẤN PHÁT') || str.includes('HUYNH TAN PHAT')) return 'CN2';
    if (str.includes('ĐÀ NẴNG') || str.includes('DA NANG') || str.includes('DN')) return 'CN3';
    if (str.includes('TOÀN HỆ THỐNG') || str === 'ALL') return 'ALL';
    
    return str;
}

function getSystemBranches() {
    const list = [];
    const keys = Object.keys(caiDatBranchConfigs);
    keys.forEach(k => {
        const item = caiDatBranchConfigs[k];
        if (item && item.ten_chi_nhanh) {
            list.push(item.ten_chi_nhanh.trim());
        } else if (item && item.ma_chi_nhanh) {
            list.push(item.ma_chi_nhanh.trim());
        }
    });
    return list;
}

// Lấy danh sách chi tiết tất cả chi nhánh (code, name, dia_chi,...)
function getSystemBranchesDetailed() {
    const list = [];
    const keys = Object.keys(caiDatBranchConfigs);
    keys.forEach(k => {
        const item = caiDatBranchConfigs[k];
        if (item) {
            list.push({
                code: item.ma_chi_nhanh || k,
                name: item.ten_chi_nhanh || item.ma_chi_nhanh || k,
                address: item.dia_chi || '',
                phone: item.sdt_zalo || '',
                logo_url: item.logo_url || '',
                raw: item
            });
        }
    });
    return list;
}

// Thông báo đồng bộ dropdown chi nhánh cho toàn bộ các module (Vật tư, Nhập xuất, Tổng quan, Nhân sự, Admin)
function notifyAllModulesBranchUpdated() {
    // 1. Staff module
    if (typeof updateBranchDropdowns === 'function') {
        try { updateBranchDropdowns(); } catch (e) {}
    }
    // 2. Vat Tu module
    if (typeof initVatTuBranchFilterForManager === 'function') {
        try { initVatTuBranchFilterForManager(); } catch (e) {}
    }
    // 3. Nhap Xuat module
    if (typeof populateNxManagerBranches === 'function') {
        try { populateNxManagerBranches(); } catch (e) {}
    }
    // 4. Tong Quan Dashboard
    if (typeof initTongQuanBranchDropdown === 'function') {
        try { initTongQuanBranchDropdown(); } catch (e) {}
    }
    // 5. Admin module
    if (typeof initBranchFilterDropdown === 'function') {
        try { initBranchFilterDropdown(); } catch (e) {}
    }
}

// Check user role for settings
function getLoggedUserInfo() {
    const loggedUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem("gaia_logged_user") || "null");
    const roleLower = loggedUser ? (loggedUser.role || "").toLowerCase().trim() : "";
    const isManager = roleLower.includes("quản lý") || roleLower.includes("quan ly") || roleLower.includes("manager");
    const isAdmin = roleLower === "admin";
    const isEmployee = !isManager && !isAdmin;
    const userBranch = loggedUser ? (loggedUser.branch || "").trim() : "";
    const myBranchCode = parseBranchCode(userBranch);

    return {
        user: loggedUser,
        roleLower,
        isManager,
        isAdmin,
        isEmployee,
        userBranch,
        myBranchCode
    };
}

// Update Role Permissions & Branch Select Dropdown
function updateCaiDatRolePermissions() {
    const { isManager, isAdmin, userBranch, myBranchCode } = getLoggedUserInfo();

    const branchSelect = document.getElementById('cai-dat-branch-select');
    const bannerSub = document.querySelector('.cai-dat-banner-sub');
    const btnSave = document.querySelector('.btn-cai-dat-save');
    const btnReset = document.querySelector('.btn-cai-dat-reset');
    const btnAddBranch = document.getElementById('btn-add-cai-dat-branch');
    const btnDelBranch = document.getElementById('btn-delete-cai-dat-branch');

    const branchKeys = Object.keys(caiDatBranchConfigs);

    if (isManager) {
        // Quản lý Toàn hệ thống: Có thể Thêm, Xóa, Xem và Sửa mọi chi nhánh
        if (btnAddBranch) btnAddBranch.style.display = "inline-flex";
        if (btnDelBranch) btnDelBranch.style.display = branchKeys.length > 0 ? "inline-flex" : "none";

        if (branchSelect) {
            branchSelect.innerHTML = "";
            if (branchKeys.length === 0) {
                const opt = document.createElement("option");
                opt.value = "";
                opt.textContent = "(Chưa có chi nhánh - Bấm '+ Thêm Chi Nhánh')";
                branchSelect.appendChild(opt);
                currentCaiDatBranch = "";
            } else {
                branchKeys.forEach(code => {
                    const item = caiDatBranchConfigs[code];
                    const opt = document.createElement("option");
                    opt.value = code;
                    opt.textContent = `🏢 ${item.ten_chi_nhanh || code} (${code})`;
                    branchSelect.appendChild(opt);
                });

                if (!currentCaiDatBranch || !caiDatBranchConfigs[currentCaiDatBranch]) {
                    currentCaiDatBranch = branchKeys[0];
                }
                branchSelect.value = currentCaiDatBranch;
            }
            branchSelect.disabled = false;
            branchSelect.style.opacity = "1";
            branchSelect.style.cursor = "default";
        }

        if (bannerSub) {
            bannerSub.innerHTML = 'Tùy chỉnh Logo, Tên Menu, Header, Địa chỉ và Thông tin liên hệ cho từng chi nhánh <i>(Quyền Quản lý toàn hệ thống)</i>';
        }
        if (btnSave) btnSave.style.display = branchKeys.length > 0 ? "inline-flex" : "none";
        if (btnReset) btnReset.style.display = branchKeys.length > 0 ? "inline-flex" : "none";

    } else if (isAdmin) {
        // Admin: Chỉ xuất hiện và sửa đúng chi nhánh của mình
        if (btnAddBranch) btnAddBranch.style.display = "none";
        if (btnDelBranch) btnDelBranch.style.display = "none";

        const cleanCode = myBranchCode || parseBranchCode(userBranch);
        currentCaiDatBranch = cleanCode || userBranch;

        if (branchSelect) {
            branchSelect.innerHTML = "";
            const opt = document.createElement("option");
            opt.value = currentCaiDatBranch;
            const currentItem = caiDatBranchConfigs[currentCaiDatBranch] || caiDatBranchConfigs[cleanCode];
            const displayTitle = currentItem?.ten_chi_nhanh ? `${currentItem.ten_chi_nhanh} (${currentCaiDatBranch})` : (userBranch || currentCaiDatBranch);
            opt.textContent = `🏢 ${displayTitle}`;
            branchSelect.appendChild(opt);
            branchSelect.value = currentCaiDatBranch;
            branchSelect.disabled = true;
            branchSelect.style.opacity = "0.85";
            branchSelect.style.cursor = "not-allowed";
        }

        if (bannerSub) {
            bannerSub.innerHTML = `<span style="color: #f59e0b; font-weight: 700;">🔒 Phân quyền Admin:</span> Bạn chỉ có quyền xem và cấu hình thông tin thương hiệu của <b>${userBranch || 'chi nhánh của bạn'}</b>.`;
        }
        if (btnSave) btnSave.style.display = "inline-flex";
        if (btnReset) btnReset.style.display = "inline-flex";

    } else {
        // Nhân viên thông thường: Không có quyền sửa
        if (btnAddBranch) btnAddBranch.style.display = "none";
        if (btnDelBranch) btnDelBranch.style.display = "none";

        currentCaiDatBranch = myBranchCode || userBranch;

        if (branchSelect) {
            branchSelect.innerHTML = "";
            const opt = document.createElement("option");
            opt.value = currentCaiDatBranch;
            opt.textContent = `🏢 ${userBranch || currentCaiDatBranch || 'Chi nhánh của bạn'}`;
            branchSelect.appendChild(opt);
            branchSelect.value = currentCaiDatBranch;
            branchSelect.disabled = true;
        }

        if (bannerSub) {
            bannerSub.innerHTML = `<span style="color: #94a3b8;">👁️ Chế độ chỉ xem: Nhân viên không có quyền thay đổi thông tin cài đặt thương hiệu.</span>`;
        }
        if (btnSave) btnSave.style.display = "none";
        if (btnReset) btnReset.style.display = "none";
    }
}

// Switch between sub-tabs: 'nhan-su' and 'thong-tin'
function switchCaiDatTab(tabName) {
    const tabNhanSuBtn = document.getElementById('tab-btn-cai-dat-nhansu');
    const tabThongTinBtn = document.getElementById('tab-btn-cai-dat-thongtin');
    const panelNhanSu = document.getElementById('cai-dat-panel-nhansu');
    const panelThongTin = document.getElementById('cai-dat-panel-thongtin');

    if (!panelNhanSu || !panelThongTin) return;

    if (tabName === 'thong-tin') {
        if (tabNhanSuBtn) tabNhanSuBtn.classList.remove('active');
        if (tabThongTinBtn) tabThongTinBtn.classList.add('active');
        panelNhanSu.style.display = 'none';
        panelThongTin.style.display = 'block';

        updateCaiDatRolePermissions();
        loadCaiDatBranchForm(currentCaiDatBranch);
    } else {
        if (tabNhanSuBtn) tabNhanSuBtn.classList.add('active');
        if (tabThongTinBtn) tabThongTinBtn.classList.remove('active');
        panelNhanSu.style.display = 'block';
        panelThongTin.style.display = 'none';

        if (typeof fetchStaffData === 'function') {
            fetchStaffData();
        }
    }

    // Synchronize active state for sidebar sub-items
    const subItems = document.querySelectorAll('.sidebar-sub-item');
    subItems.forEach(item => {
        const viewAttr = item.getAttribute('data-view');
        if (viewAttr === 'nhan-su' || viewAttr === 'thong-tin') {
            if (viewAttr === tabName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        }
    });
}

// Fetch all branch branding settings from Supabase & LocalStorage
async function fetchAllCaiDatSettings() {
    try {
        const cached = localStorage.getItem('gaia_branch_branding_config');
        if (cached) {
            try {
                caiDatBranchConfigs = JSON.parse(cached) || {};
            } catch (e) {}
        }

        const client = getCaiDatSupabaseClient();
        if (client) {
            const { data, error } = await client
                .from('cai_dat_he_thong')
                .select('*')
                .order('id', { ascending: true });

            if (!error && Array.isArray(data)) {
                caiDatBranchConfigs = {};
                data.forEach(item => {
                    if (item.ma_chi_nhanh) {
                        caiDatBranchConfigs[item.ma_chi_nhanh] = item;
                    }
                });
                localStorage.setItem('gaia_branch_branding_config', JSON.stringify(caiDatBranchConfigs));
            }
        }
    } catch (e) {
        console.warn("GAIA CaiDat: Error fetching settings:", e);
    }

    updateCaiDatRolePermissions();
    loadCaiDatBranchForm(currentCaiDatBranch);
    notifyAllModulesBranchUpdated();

    // Apply branding for current user's branch
    const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
    const currentBranch = loggedUser ? (loggedUser.branch || '') : '';
    if (currentBranch) {
        applyBranchBranding(currentBranch);
    }
}

// Supabase Realtime Sync
function initCaiDatRealtime() {
    const client = getCaiDatSupabaseClient();
    if (!client) return;

    if (caiDatRealtimeChannel) {
        try { client.removeChannel(caiDatRealtimeChannel); } catch (e) {}
        caiDatRealtimeChannel = null;
    }

    try {
        caiDatRealtimeChannel = client
            .channel('cai_dat_realtime_sync_' + Math.random().toString(36).substring(7))
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cai_dat_he_thong' },
                (payload) => {
                    console.log("GAIA Realtime CaiDat Event received:", payload);
                    handleRealtimeCaiDatChange(payload);
                }
            )
            .subscribe((status) => {
                console.log("GAIA Realtime CaiDat Channel Status:", status);
            });
    } catch (e) {
        console.warn("GAIA CaiDat: Realtime init error:", e);
    }
}

// Lắng nghe sự kiện storage liên tab trên cùng trình duyệt (0ms latency)
window.addEventListener('storage', (e) => {
    if (e.key === 'gaia_branch_branding_config') {
        try {
            caiDatBranchConfigs = JSON.parse(e.newValue || '{}');
            updateCaiDatRolePermissions();
            notifyAllModulesBranchUpdated();

            const loggedUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem("gaia_logged_user") || "null");
            const userBranch = loggedUser ? (loggedUser.branch || '') : '';
            const userBranchCode = parseBranchCode(userBranch);

            if (userBranchCode) {
                applyBranchBranding(userBranchCode);
            } else if (userBranch) {
                applyBranchBranding(userBranch);
            }

            const panelThongTin = document.getElementById('cai-dat-panel-thongtin');
            if (panelThongTin && panelThongTin.style.display !== 'none') {
                loadCaiDatBranchForm(currentCaiDatBranch);
            }
        } catch (err) {}
    }
});

// Xử lý sự kiện Realtime khi có thay đổi trong bảng cai_dat_he_thong
function handleRealtimeCaiDatChange(payload) {
    const eventType = payload.eventType;
    const newRecord = payload.new;
    const oldRecord = payload.old;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (newRecord && newRecord.ma_chi_nhanh) {
            caiDatBranchConfigs[newRecord.ma_chi_nhanh] = newRecord;
            localStorage.setItem('gaia_branch_branding_config', JSON.stringify(caiDatBranchConfigs));
        }
    } else if (eventType === 'DELETE') {
        if (oldRecord && oldRecord.ma_chi_nhanh) {
            delete caiDatBranchConfigs[oldRecord.ma_chi_nhanh];
            localStorage.setItem('gaia_branch_branding_config', JSON.stringify(caiDatBranchConfigs));
        }
    }

    updateCaiDatRolePermissions();
    notifyAllModulesBranchUpdated();

    const loggedUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem("gaia_logged_user") || "null");
    const userBranch = loggedUser ? (loggedUser.branch || '') : '';
    const userBranchCode = parseBranchCode(userBranch);

    if (userBranchCode) {
        applyBranchBranding(userBranchCode);
    } else if (userBranch) {
        applyBranchBranding(userBranch);
    }

    const panelThongTin = document.getElementById('cai-dat-panel-thongtin');
    if (panelThongTin && panelThongTin.style.display !== 'none') {
        loadCaiDatBranchForm(currentCaiDatBranch);
    }
}

// Apply branding directly to Sidebar & Header live
function applyBranchBranding(branchNameOrCode) {
    if (!branchNameOrCode) return;
    const rawKey = String(branchNameOrCode).trim().toUpperCase();
    const branchCode = parseBranchCode(branchNameOrCode);
    
    let config = caiDatBranchConfigs[rawKey] || caiDatBranchConfigs[branchCode];
    if (!config && branchNameOrCode) {
        const foundKey = Object.keys(caiDatBranchConfigs).find(k => {
            const it = caiDatBranchConfigs[k];
            return it && it.ten_chi_nhanh && it.ten_chi_nhanh.trim().toLowerCase() === String(branchNameOrCode).trim().toLowerCase();
        });
        if (foundKey) config = caiDatBranchConfigs[foundKey];
    }

    if (!config) {
        const firstKey = Object.keys(caiDatBranchConfigs)[0];
        config = caiDatBranchConfigs[firstKey] || {
            logo_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQfZlyZoMKUpHV2xiHp5ye-OgqCT0_MYlHEIA&s',
            menu_title: 'GAIA Hospital',
            menu_subtitle: 'Hệ thống quản lý',
            header_title: 'GAIA Animal Hospital',
            dia_chi: 'No. 2D, 22 Road, Hiep Binh Ward, Ho Chi Minh City',
            maps_url: 'https://maps.google.com/?q=No.+2D,+22+Road,+Hiep+Binh+Ward,+Ho+Chi+Minh+City',
            sdt_zalo: '0934 395 168 (Zalo)',
            website: 'www.gaialifestyle.vn'
        };
    }

    // 1. Sidebar Logo
    const logoImg = document.querySelector('.brand-logo-img');
    if (logoImg && config.logo_url) {
        logoImg.src = config.logo_url;
    }

    // 2. Sidebar Title & Subtitle
    const brandTitle = document.querySelector('.brand-title');
    if (brandTitle && config.menu_title) {
        brandTitle.textContent = config.menu_title;
    }
    const brandTag = document.querySelector('.brand-tag');
    if (brandTag && config.menu_subtitle) {
        brandTag.textContent = config.menu_subtitle;
    }

    // 3. Header Hospital Title
    const headerTitle = document.querySelector('.header-hospital-title');
    if (headerTitle && config.header_title) {
        headerTitle.textContent = config.header_title;
    }

    // 4. Header Address / Branch Location
    const headerLocation = document.getElementById('header-user-branch-location');
    if (headerLocation) {
        headerLocation.textContent = config.dia_chi || config.ten_chi_nhanh || 'Chi Nhánh GAIA';
    }
    const headerMapLink = document.getElementById('header-map-link');
    if (headerMapLink) {
        if (config.maps_url) {
            headerMapLink.href = config.maps_url;
        } else if (config.dia_chi) {
            headerMapLink.href = `https://maps.google.com/?q=${encodeURIComponent(config.dia_chi)}`;
        }
    }

    // 5. Header Phone / Zalo
    const headerPhoneLink = document.querySelector('.branch-sub-row a[href*="zalo"]');
    if (headerPhoneLink && config.sdt_zalo) {
        const phoneTextSpan = headerPhoneLink.querySelector('span');
        if (phoneTextSpan) phoneTextSpan.textContent = config.sdt_zalo;
        const cleanPhone = config.sdt_zalo.replace(/\D/g, '');
        if (cleanPhone) headerPhoneLink.href = `https://zalo.me/${cleanPhone}`;
    }

    // 6. Header Website
    const headerWebLink = document.querySelector('.branch-sub-row a[title*="Website"], .branch-sub-row a[href*="http"]:last-child');
    if (headerWebLink && config.website) {
        const webTextSpan = headerWebLink.querySelector('span');
        if (webTextSpan) webTextSpan.textContent = config.website;
        const webUrl = config.website.startsWith('http') ? config.website : `https://${config.website}`;
        headerWebLink.href = webUrl;
    }

    // 7. Browser Tab Title & Favicon
    if (config.header_title) {
        document.title = config.header_title;
    }
    if (config.logo_url) {
        let favicon = document.querySelector("link[rel*='icon']");
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }
        favicon.href = config.logo_url;
    }

    // 8. Login Screen
    const loginLogoImg = document.querySelector('.login-logo');
    if (loginLogoImg && config.logo_url) {
        loginLogoImg.src = config.logo_url;
    }
    const loginH2 = document.querySelector('.login-header h2');
    if (loginH2 && config.header_title) {
        loginH2.textContent = config.header_title.toUpperCase();
    }
}

// Load branch config data into the Settings form
function loadCaiDatBranchForm(branchCode) {
    const { isManager, userBranch, myBranchCode } = getLoggedUserInfo();
    const branchKeys = Object.keys(caiDatBranchConfigs);

    const emptyCard = document.getElementById('cai-dat-empty-branch-card');
    const form = document.getElementById('cai-dat-branding-form');

    if (branchKeys.length === 0 && isManager) {
        if (emptyCard) emptyCard.style.display = 'block';
        if (form) form.style.display = 'none';
        return;
    }

    if (emptyCard) emptyCard.style.display = 'none';
    if (form) form.style.display = 'block';

    if (!isManager) {
        currentCaiDatBranch = myBranchCode || parseBranchCode(branchCode) || parseBranchCode(userBranch) || branchCode || (branchKeys[0] || 'CN1');
    } else {
        if (branchCode && caiDatBranchConfigs[branchCode]) {
            currentCaiDatBranch = branchCode;
        } else if (currentCaiDatBranch && caiDatBranchConfigs[currentCaiDatBranch]) {
            // Giữ nguyên branch đang chọn
        } else {
            currentCaiDatBranch = branchKeys[0] || '';
        }
    }
    pendingLogoUploadFile = null;

    const branchSelect = document.getElementById('cai-dat-branch-select');
    if (branchSelect && currentCaiDatBranch) branchSelect.value = currentCaiDatBranch;

    const cleanCN = parseBranchCode(currentCaiDatBranch);
    let config = caiDatBranchConfigs[currentCaiDatBranch] || (cleanCN ? caiDatBranchConfigs[cleanCN] : null);
    if (!config) {
        const foundKey = Object.keys(caiDatBranchConfigs).find(k => {
            const it = caiDatBranchConfigs[k];
            return it && (
                it.ma_chi_nhanh === currentCaiDatBranch ||
                (cleanCN && it.ma_chi_nhanh === cleanCN) ||
                (it.ten_chi_nhanh && currentCaiDatBranch && currentCaiDatBranch.toLowerCase().includes(it.ten_chi_nhanh.toLowerCase()))
            );
        });
        if (foundKey) config = caiDatBranchConfigs[foundKey];
    }

    if (!config && branchKeys.length > 0) {
        config = caiDatBranchConfigs[branchKeys[0]];
        currentCaiDatBranch = branchKeys[0];
        if (branchSelect) branchSelect.value = currentCaiDatBranch;
    }

    if (!config) {
        config = {
            ma_chi_nhanh: currentCaiDatBranch,
            ten_chi_nhanh: userBranch || '',
            logo_url: '',
            menu_title: '',
            menu_subtitle: '',
            header_title: '',
            dia_chi: '',
            maps_url: '',
            sdt_zalo: '',
            website: ''
        };
    }

    // Populate input fields
    const maChiNhanhInput = document.getElementById('cai-dat-ma-chi-nhanh');
    const tenChiNhanhInput = document.getElementById('cai-dat-ten-chi-nhanh');
    const logoPreview = document.getElementById('cai-dat-logo-preview-img');
    const logoUrlInput = document.getElementById('cai-dat-logo-url-input');
    const menuTitleInput = document.getElementById('cai-dat-menu-title');
    const menuSubTitleInput = document.getElementById('cai-dat-menu-subtitle');
    const headerTitleInput = document.getElementById('cai-dat-header-title');
    const diaChiInput = document.getElementById('cai-dat-dia-chi');
    const mapsUrlInput = document.getElementById('cai-dat-maps-url');
    const sdtZaloInput = document.getElementById('cai-dat-sdt-zalo');
    const websiteInput = document.getElementById('cai-dat-website');

    if (maChiNhanhInput) maChiNhanhInput.value = config.ma_chi_nhanh || currentCaiDatBranch || '';
    if (tenChiNhanhInput) tenChiNhanhInput.value = config.ten_chi_nhanh || '';

    if (logoPreview) {
        if (config.logo_url) {
            logoPreview.src = config.logo_url;
        } else {
            logoPreview.src = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQfZlyZoMKUpHV2xiHp5ye-OgqCT0_MYlHEIA&s';
        }
    }
    if (logoUrlInput) logoUrlInput.value = config.logo_url || '';
    if (menuTitleInput) menuTitleInput.value = config.menu_title || '';
    if (menuSubTitleInput) menuSubTitleInput.value = config.menu_subtitle || '';
    if (headerTitleInput) headerTitleInput.value = config.header_title || '';
    if (diaChiInput) diaChiInput.value = config.dia_chi || '';
    if (mapsUrlInput) mapsUrlInput.value = config.maps_url || '';
    if (sdtZaloInput) sdtZaloInput.value = config.sdt_zalo || '';
    if (websiteInput) websiteInput.value = config.website || '';

    // Cập nhật ngay tức thì giao diện Menu và Header xem trước cho Quản lý
    applyBranchBranding(currentCaiDatBranch);
}

// Handle Branch Select Change in Form
function handleCaiDatBranchChange(e) {
    const { isManager } = getLoggedUserInfo();
    if (!isManager) return;
    const selectedBranch = e.target.value;
    loadCaiDatBranchForm(selectedBranch);
    applyBranchBranding(selectedBranch);
}

// Tự động tìm mã chi nhánh CN tiếp theo chưa tồn tại và không trùng lặp
function getNextAvailableBranchCode() {
    const existing = new Set();
    Object.keys(caiDatBranchConfigs || {}).forEach(k => {
        if (k) existing.add(k.toUpperCase().trim());
    });
    if (typeof staffData !== 'undefined' && Array.isArray(staffData)) {
        staffData.forEach(s => {
            const cn = s.cn || (typeof extractCNCode === 'function' ? extractCNCode(s.branch) : '');
            if (cn) existing.add(cn.toUpperCase().trim());
        });
    }

    let nextNum = 1;
    while (existing.has(`CN${nextNum}`)) {
        nextNum++;
    }
    return `CN${nextNum}`;
}

// Open Modal: Thêm chi nhánh mới (Cho Quản lý)
function openAddBranchModal() {
    const modal = document.getElementById('cai-dat-add-branch-modal');
    if (!modal) {
        console.error("cai-dat-add-branch-modal not found!");
        return;
    }

    const nextCode = getNextAvailableBranchCode();

    const codeInput = document.getElementById('new-branch-code');
    const nameInput = document.getElementById('new-branch-name');
    const headerInput = document.getElementById('new-branch-header-title');
    const menuTitleInput = document.getElementById('new-branch-menu-title');
    const menuSubInput = document.getElementById('new-branch-menu-subtitle');
    const addrInput = document.getElementById('new-branch-address');
    const phoneInput = document.getElementById('new-branch-phone');
    const webInput = document.getElementById('new-branch-website');

    if (codeInput) {
        codeInput.value = nextCode;
        codeInput.readOnly = true;
    }
    if (nameInput) nameInput.value = '';
    if (headerInput) headerInput.value = '';
    if (menuTitleInput) menuTitleInput.value = '';
    if (menuSubInput) menuSubInput.value = '';
    if (addrInput) addrInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (webInput) webInput.value = '';

    modal.classList.add('show');
    modal.style.display = 'flex';
}

function handleNewBranchNameInput(e) {
    // Không tự động điền gợi ý vào Header hay các ô khác để người dùng tự do nhập
}

function closeAddBranchModal() {
    const modal = document.getElementById('cai-dat-add-branch-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
}

// Handle Create New Branch Form Submit
async function handleCreateNewBranchSubmit(e) {
    if (e) e.preventDefault();

    const codeInput = document.getElementById('new-branch-code');
    const nameInput = document.getElementById('new-branch-name');
    const headerInput = document.getElementById('new-branch-header-title');
    const menuTitleInput = document.getElementById('new-branch-menu-title');
    const menuSubInput = document.getElementById('new-branch-menu-subtitle');
    const addrInput = document.getElementById('new-branch-address');
    const phoneInput = document.getElementById('new-branch-phone');
    const webInput = document.getElementById('new-branch-website');

    let code = codeInput ? codeInput.value.trim().toUpperCase() : '';
    const name = nameInput ? nameInput.value.trim() : '';

    if (!code || !name) {
        if (typeof showToast === 'function') {
            showToast('error', 'Thiếu Thông Tin', 'Vui lòng điền đầy đủ Tên chi nhánh!');
        }
        return;
    }

    // Đảm bảo mã không trùng lặp
    if (caiDatBranchConfigs[code]) {
        code = getNextAvailableBranchCode();
    }

    const payload = {
        ma_chi_nhanh: code,
        ten_chi_nhanh: name,
        logo_url: '',
        menu_title: menuTitleInput ? menuTitleInput.value.trim() : '',
        menu_subtitle: menuSubInput ? menuSubInput.value.trim() : '',
        header_title: headerInput ? headerInput.value.trim() : '',
        dia_chi: addrInput ? addrInput.value.trim() : '',
        maps_url: '',
        sdt_zalo: phoneInput ? phoneInput.value.trim() : '',
        website: webInput ? webInput.value.trim() : '',
        updated_at: new Date().toISOString()
    };

    caiDatBranchConfigs[code] = payload;
    localStorage.setItem('gaia_branch_branding_config', JSON.stringify(caiDatBranchConfigs));
    currentCaiDatBranch = code;

    const client = getCaiDatSupabaseClient();
    let dbSuccess = false;
    if (client) {
        try {
            const { error } = await client
                .from('cai_dat_he_thong')
                .upsert(payload, { onConflict: 'ma_chi_nhanh' });

            if (error) {
                console.error("Error inserting new branch into Supabase:", error);
                if (typeof showToast === 'function') {
                    showToast('error', 'Lỗi Database', 'Lỗi Supabase: ' + (error.message || 'Không thể lưu'));
                }
            } else {
                dbSuccess = true;
            }
        } catch (err) {
            console.error("Supabase insert exception:", err);
        }
    }

    closeAddBranchModal();
    updateCaiDatRolePermissions();
    loadCaiDatBranchForm(code);
    notifyAllModulesBranchUpdated();

    if (typeof showToast === 'function') {
        showToast('success', 'Đã Thêm Chi Nhánh', `Đã tạo mới ${name} (${code}) ${dbSuccess ? 'và lưu vào Database' : ''} thành công!`);
    }
}

// Xóa chi nhánh đang chọn (Chỉ dành cho Quản lý)
async function handleDeleteCaiDatBranch() {
    const { isManager } = getLoggedUserInfo();
    if (!isManager || !currentCaiDatBranch) return;

    const currentBranchInfo = caiDatBranchConfigs[currentCaiDatBranch];
    const branchName = currentBranchInfo ? (currentBranchInfo.ten_chi_nhanh || currentCaiDatBranch) : currentCaiDatBranch;

    const confirmed = confirm(`Bạn có chắc chắn muốn xóa chi nhánh "${branchName}" (${currentCaiDatBranch}) khỏi hệ thống?`);
    if (!confirmed) return;

    const deletingCode = currentCaiDatBranch;

    delete caiDatBranchConfigs[deletingCode];
    localStorage.setItem('gaia_branch_branding_config', JSON.stringify(caiDatBranchConfigs));

    const client = getCaiDatSupabaseClient();
    if (client) {
        try {
            const { error } = await client.from('cai_dat_he_thong').delete().eq('ma_chi_nhanh', deletingCode);
            if (error) {
                console.error("Delete branch error:", error);
                if (typeof showToast === 'function') {
                    showToast('error', 'Lỗi Database', 'Lỗi xóa CSDL: ' + (error.message || ''));
                }
            }
        } catch (e) {
            console.error("Delete branch exception:", e);
        }
    }

    const remainingKeys = Object.keys(caiDatBranchConfigs);
    currentCaiDatBranch = remainingKeys.length > 0 ? remainingKeys[0] : '';

    updateCaiDatRolePermissions();
    loadCaiDatBranchForm(currentCaiDatBranch);
    notifyAllModulesBranchUpdated();

    if (typeof showToast === 'function') {
        showToast('info', 'Đã Xóa Chi Nhánh', `Đã xóa chi nhánh ${branchName} khỏi hệ thống!`);
    }
}

// Handle URL Input Change for Logo
function handleCaiDatLogoUrlChange(e) {
    const rawVal = e.target.value;
    const normalized = normalizeImagePublicUrl(rawVal);
    if (normalized !== rawVal) {
        e.target.value = normalized;
    }
    const logoPreview = document.getElementById('cai-dat-logo-preview-img');
    if (logoPreview && normalized) {
        logoPreview.src = normalized;
    }
}

// Handle File Select for Logo
function handleCaiDatLogoFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setPendingLogoFile(file);
    e.target.value = '';
}

// Set Pending Logo File and Preview
function setPendingLogoFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        if (typeof showToast === 'function') {
            showToast('error', 'Lỗi File', 'Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, SVG, WebP)!');
        }
        return;
    }

    pendingLogoUploadFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        const logoPreview = document.getElementById('cai-dat-logo-preview-img');
        if (logoPreview) {
            logoPreview.src = e.target.result;
        }
        const logoUrlInput = document.getElementById('cai-dat-logo-url-input');
        if (logoUrlInput) {
            logoUrlInput.value = `[File cục bộ: ${file.name}]`;
        }
    };
    reader.readAsDataURL(file);
}

// Handle Logo Drop
function handleCaiDatLogoDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
        setPendingLogoFile(files[0]);
    }
}

// Handle Logo Paste (Ctrl + V)
function handleCaiDatLogoPaste(e) {
    const items = (e.clipboardData || event.originalEvent?.clipboardData)?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
                setPendingLogoFile(file);
                if (typeof showToast === 'function') {
                    showToast('success', 'Đã Dán Ảnh', 'Đã nạp logo từ clipboard thành công!');
                }
                return;
            }
        }
    }
}

// Reset Logo to Default
function resetCaiDatLogoToDefault() {
    const defaultLogo = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQfZlyZoMKUpHV2xiHp5ye-OgqCT0_MYlHEIA&s';
    pendingLogoUploadFile = null;
    const logoPreview = document.getElementById('cai-dat-logo-preview-img');
    const logoUrlInput = document.getElementById('cai-dat-logo-url-input');
    if (logoPreview) logoPreview.src = defaultLogo;
    if (logoUrlInput) logoUrlInput.value = defaultLogo;
}

// Upload pending logo file to Supabase Storage
async function uploadLogoToStorage(file, branchCode) {
    const client = getCaiDatSupabaseClient();
    if (!client) return null;

    try {
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `logo_${(branchCode || 'branch').toLowerCase()}_${Date.now()}.${ext}`;

        const { data, error } = await client.storage
            .from('vattu_images')
            .upload(fileName, file, { cacheControl: '3600', upsert: true });

        if (error) {
            console.error("Upload logo error:", error);
            return null;
        }

        const { data: pubData } = client.storage.from('vattu_images').getPublicUrl(fileName);
        return pubData?.publicUrl || null;
    } catch (e) {
        console.error("Upload logo exception:", e);
        return null;
    }
}

// Save Settings Form
async function handleSaveCaiDatForm(e) {
    if (e) e.preventDefault();

    const { isManager, isEmployee, userBranch, myBranchCode } = getLoggedUserInfo();
    if (isEmployee) {
        if (typeof showToast === 'function') {
            showToast('error', 'Không Có Quyền', 'Tài khoản nhân viên không được phép lưu cài đặt!');
        }
        return;
    }

    let maChiNhanh = currentCaiDatBranch;
    let tenChiNhanh = userBranch;

    if (!isManager) {
        maChiNhanh = myBranchCode;
        tenChiNhanh = userBranch;
    } else {
        const branchSelect = document.getElementById('cai-dat-branch-select');
        maChiNhanh = branchSelect ? branchSelect.value : currentCaiDatBranch;
        const currentConf = caiDatBranchConfigs[maChiNhanh];
        tenChiNhanh = currentConf?.ten_chi_nhanh || (branchSelect ? branchSelect.options[branchSelect.selectedIndex]?.text.replace(/🏢|🌐/g, '').trim() : maChiNhanh);
    }

    const maChiNhanhInput = document.getElementById('cai-dat-ma-chi-nhanh');
    const tenChiNhanhInput = document.getElementById('cai-dat-ten-chi-nhanh');

    if (tenChiNhanhInput && tenChiNhanhInput.value.trim()) {
        tenChiNhanh = tenChiNhanhInput.value.trim();
    }

    if (!maChiNhanh) {
        if (typeof showToast === 'function') {
            showToast('error', 'Chưa Chọn Chi Nhánh', 'Vui lòng chọn hoặc thêm chi nhánh trước khi lưu!');
        }
        return;
    }

    const logoUrlInput = document.getElementById('cai-dat-logo-url-input');
    const menuTitleInput = document.getElementById('cai-dat-menu-title');
    const menuSubTitleInput = document.getElementById('cai-dat-menu-subtitle');
    const headerTitleInput = document.getElementById('cai-dat-header-title');
    const diaChiInput = document.getElementById('cai-dat-dia-chi');
    const mapsUrlInput = document.getElementById('cai-dat-maps-url');
    const sdtZaloInput = document.getElementById('cai-dat-sdt-zalo');
    const websiteInput = document.getElementById('cai-dat-website');

    let finalLogoUrl = logoUrlInput ? logoUrlInput.value.trim() : '';

    if (pendingLogoUploadFile) {
        if (typeof showToast === 'function') {
            showToast('info', 'Đang Tải Ảnh Logo', 'Đang tải file logo lên hệ thống...');
        }
        const uploadedUrl = await uploadLogoToStorage(pendingLogoUploadFile, maChiNhanh);
        if (uploadedUrl) {
            finalLogoUrl = uploadedUrl;
            if (logoUrlInput) logoUrlInput.value = uploadedUrl;
        } else {
            const prevConfig = caiDatBranchConfigs[maChiNhanh];
            finalLogoUrl = prevConfig?.logo_url || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQfZlyZoMKUpHV2xiHp5ye-OgqCT0_MYlHEIA&s';
        }
    } else {
        finalLogoUrl = normalizeImagePublicUrl(finalLogoUrl);
    }

    const payload = {
        ma_chi_nhanh: maChiNhanh,
        ten_chi_nhanh: tenChiNhanh,
        logo_url: finalLogoUrl || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQfZlyZoMKUpHV2xiHp5ye-OgqCT0_MYlHEIA&s',
        menu_title: menuTitleInput ? menuTitleInput.value.trim() : 'GAIA Hospital',
        menu_subtitle: menuSubTitleInput ? menuSubTitleInput.value.trim() : 'Hệ thống quản lý',
        header_title: headerTitleInput ? headerTitleInput.value.trim() : `GAIA Animal Hospital ${tenChiNhanh}`,
        dia_chi: diaChiInput ? diaChiInput.value.trim() : '',
        maps_url: mapsUrlInput ? mapsUrlInput.value.trim() : '',
        sdt_zalo: sdtZaloInput ? sdtZaloInput.value.trim() : '',
        website: websiteInput ? websiteInput.value.trim() : '',
        updated_at: new Date().toISOString()
    };

    caiDatBranchConfigs[maChiNhanh] = payload;
    localStorage.setItem('gaia_branch_branding_config', JSON.stringify(caiDatBranchConfigs));

    const client = getCaiDatSupabaseClient();
    let dbSuccess = false;
    if (client) {
        try {
            const { error } = await client
                .from('cai_dat_he_thong')
                .upsert(payload, { onConflict: 'ma_chi_nhanh' });

            if (error) {
                console.error("Supabase upsert error:", error);
                if (typeof showToast === 'function') {
                    showToast('error', 'Lỗi Lưu Database', 'Lỗi Supabase: ' + (error.message || ''));
                }
            } else {
                dbSuccess = true;
            }
        } catch (e) {
            console.error("Save settings error:", e);
        }
    }

    updateCaiDatRolePermissions();
    applyBranchBranding(maChiNhanh);
    notifyAllModulesBranchUpdated();

    if (typeof showToast === 'function') {
        showToast('success', 'Đã Lưu Cài Đặt', `Đã cập nhật thông tin thương hiệu cho ${payload.ten_chi_nhanh || maChiNhanh} ${dbSuccess ? 'và lưu vào Database' : ''} thành công!`, 3500);
    }
}

// Reset form values to default
function handleResetCaiDatForm() {
    const { isEmployee } = getLoggedUserInfo();
    if (isEmployee) return;

    const confirmed = confirm('Bạn có chắc chắn muốn làm trống các thông tin cài đặt cho chi nhánh này?');
    if (!confirmed) return;

    resetCaiDatLogoToDefault();
    const tenChiNhanhInput = document.getElementById('cai-dat-ten-chi-nhanh');
    if (tenChiNhanhInput) tenChiNhanhInput.value = '';
    document.getElementById('cai-dat-menu-title').value = '';
    document.getElementById('cai-dat-menu-subtitle').value = '';
    document.getElementById('cai-dat-header-title').value = '';
    document.getElementById('cai-dat-dia-chi').value = '';
    document.getElementById('cai-dat-maps-url').value = '';
    document.getElementById('cai-dat-sdt-zalo').value = '';
    document.getElementById('cai-dat-website').value = '';

    if (typeof showToast === 'function') {
        showToast('info', 'Đã Xóa Trống', 'Đã đặt lại các trường về trống. Nhấn "Lưu Cài Đặt" để áp dụng!');
    }
}

// Hệ thống hiệu ứng phát sáng trực quan (Live Glow Highlight) khi đang chỉnh sửa
function initLiveEditHighlightSystem() {
    const editMap = [
        {
            inputId: 'cai-dat-logo-url-input',
            targetSelectors: ['.brand-logo-wrap', '.cai-dat-logo-preview-box', '.cai-dat-logo-dropzone'],
            liveUpdate: (val) => {
                const img = document.querySelector('.brand-logo-img');
                const norm = normalizeImagePublicUrl(val);
                if (img && norm) img.src = norm;
                let favicon = document.querySelector("link[rel*='icon']");
                if (favicon && norm) favicon.href = norm;
            }
        },
        {
            inputId: 'cai-dat-menu-title',
            targetSelectors: ['.brand-title'],
            liveUpdate: (val) => {
                const el = document.querySelector('.brand-title');
                if (el) el.textContent = val || '';
            }
        },
        {
            inputId: 'cai-dat-menu-subtitle',
            targetSelectors: ['.brand-tag'],
            liveUpdate: (val) => {
                const el = document.querySelector('.brand-tag');
                if (el) el.textContent = val || '';
            }
        },
        {
            inputId: 'cai-dat-header-title',
            targetSelectors: ['.header-hospital-title'],
            liveUpdate: (val) => {
                const el = document.querySelector('.header-hospital-title');
                if (el) el.textContent = val || '';
                if (val) document.title = val;
            }
        },
        {
            inputId: 'cai-dat-dia-chi',
            targetSelectors: ['#header-map-link'],
            liveUpdate: (val) => {
                const loc = document.getElementById('header-user-branch-location');
                if (loc && val) loc.textContent = val;
            }
        },
        {
            inputId: 'cai-dat-maps-url',
            targetSelectors: ['#header-map-link'],
            liveUpdate: (val) => {
                const link = document.getElementById('header-map-link');
                if (link && val) link.href = val;
            }
        },
        {
            inputId: 'cai-dat-sdt-zalo',
            targetSelectors: ['.branch-sub-row a[href*="zalo"], .branch-sub-row a[href*="tel"]', '.branch-sub-row .branch-detail-item:nth-child(3)'],
            liveUpdate: (val) => {
                const el = document.querySelector('.branch-sub-row a[href*="zalo"], .branch-sub-row a[href*="tel"]') || document.querySelectorAll('.branch-sub-row .branch-detail-item')[1];
                if (el) {
                    const span = el.querySelector('span');
                    if (span) span.textContent = val || '';
                }
            }
        },
        {
            inputId: 'cai-dat-website',
            targetSelectors: ['.branch-sub-row a[title*="Website"], .branch-sub-row a[href*="http"]:last-child', '.branch-sub-row .branch-detail-item:last-child'],
            liveUpdate: (val) => {
                const el = document.querySelector('.branch-sub-row a[title*="Website"]') || document.querySelectorAll('.branch-sub-row .branch-detail-item')[2];
                if (el) {
                    const span = el.querySelector('span');
                    if (span) span.textContent = val || '';
                }
            }
        }
    ];

    editMap.forEach(item => {
        const input = document.getElementById(item.inputId);
        if (!input) return;

        const addHighlight = () => {
            const formGroup = input.closest('.cai-dat-form-group');
            if (formGroup) formGroup.classList.add('is-focused');

            item.targetSelectors.forEach(sel => {
                const elements = document.querySelectorAll(sel);
                elements.forEach(el => {
                    el.classList.add('gaia-live-edit-active');
                });
            });
        };

        const removeHighlight = () => {
            const formGroup = input.closest('.cai-dat-form-group');
            if (formGroup) formGroup.classList.remove('is-focused');

            item.targetSelectors.forEach(sel => {
                const elements = document.querySelectorAll(sel);
                elements.forEach(el => {
                    el.classList.remove('gaia-live-edit-active');
                });
            });
        };

        input.addEventListener('focus', addHighlight);
        input.addEventListener('blur', removeHighlight);
        input.addEventListener('input', (e) => {
            addHighlight();
            if (typeof item.liveUpdate === 'function') {
                item.liveUpdate(e.target.value);
            }
        });
    });

    // Dropzone hover highlight
    const dropzone = document.querySelector('.cai-dat-logo-dropzone');
    if (dropzone) {
        dropzone.addEventListener('mouseenter', () => {
            const logo = document.querySelector('.brand-logo-wrap');
            if (logo) logo.classList.add('gaia-live-edit-active');
        });
        dropzone.addEventListener('mouseleave', () => {
            const logo = document.querySelector('.brand-logo-wrap');
            if (logo) logo.classList.remove('gaia-live-edit-active');
        });
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    fetchAllCaiDatSettings();
    initCaiDatRealtime();
    initLiveEditHighlightSystem();
});

// Export functions to window
window.getSystemBranches = getSystemBranches;
window.getSystemBranchesDetailed = getSystemBranchesDetailed;
window.notifyAllModulesBranchUpdated = notifyAllModulesBranchUpdated;
window.switchCaiDatTab = switchCaiDatTab;
window.updateCaiDatRolePermissions = updateCaiDatRolePermissions;
window.openAddBranchModal = openAddBranchModal;
window.closeAddBranchModal = closeAddBranchModal;
window.handleNewBranchNameInput = handleNewBranchNameInput;
window.handleCreateNewBranchSubmit = handleCreateNewBranchSubmit;
window.handleDeleteCaiDatBranch = handleDeleteCaiDatBranch;
window.handleCaiDatBranchChange = handleCaiDatBranchChange;
window.handleCaiDatLogoUrlChange = handleCaiDatLogoUrlChange;
window.handleCaiDatLogoFileSelect = handleCaiDatLogoFileSelect;
window.handleCaiDatLogoDrop = handleCaiDatLogoDrop;
window.handleCaiDatLogoPaste = handleCaiDatLogoPaste;
window.resetCaiDatLogoToDefault = resetCaiDatLogoToDefault;
window.handleSaveCaiDatForm = handleSaveCaiDatForm;
window.handleResetCaiDatForm = handleResetCaiDatForm;
window.applyBranchBranding = applyBranchBranding;
window.fetchAllCaiDatSettings = fetchAllCaiDatSettings;
window.initCaiDatRealtime = initCaiDatRealtime;
window.initLiveEditHighlightSystem = initLiveEditHighlightSystem;
