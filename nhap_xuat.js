/* ==========================================================================
   GAIA Animal Hospital - Nhập Xuất (Stock Import/Export Module) (nhap_xuat.js)
   Features: Split 3-Part View (1 Part List | 2 Parts Form & Items),
   QR/Barcode Parsing (MãVạch;LOT;Date), Auto-increment Quantity,
   Supabase Database Persistence & Automatic Realtime Sync to Thẻ Kho (the_kho)
   ========================================================================== */

let nhapXuatData = [];
let filteredNhapXuatData = [];
let selectedNxOrderId = null;
let currentDraftNxItems = [];
let isEditingNxOrder = false;

let currentDraftOrder = {
    ma_don: 'ĐƠN-NHÁP',
    loai_don: '',
    muc_dich: '',
    user_name: '',
    items: []
};

// Supabase Client Initializer
function getNhapXuatSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabase !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        try {
            window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            return window.supabaseClient;
        } catch (e) {
            console.error("NhapXuat: Error initializing Supabase client:", e);
        }
    }
    return null;
}

// LocalStorage Draft Persistence Helpers
function saveNxDraftToStorage() {
    // Disabled by user request
}

function loadNxDraftFromStorage() {
    // Disabled by user request
    return false;
}

function clearNxDraftStorage() {
    try {
        localStorage.removeItem('gaia_nx_active_draft');
    } catch (e) {}
    currentDraftOrder = {
        ma_don: 'ĐƠN-NHÁP',
        loai_don: '',
        muc_dich: '',
        user_name: '',
        items: []
    };
    currentDraftNxItems = [];
}

// Module Initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNhapXuatModule);
} else {
    initNhapXuatModule();
}

function initNhapXuatModule() {
    console.log("GAIA NhapXuat: Initializing Stock Import/Export Module...");
    bindNhapXuatEvents();
    loadNxDraftFromStorage();
    fetchNhapXuatData();
    createNewNhapXuatOrderForm(true); // true = restore draft if available
    setupNhapXuatRealtimeSubscription();
}

function bindNhapXuatEvents() {
    const loaiSelect = document.getElementById('nx-input-loai');
    if (loaiSelect) {
        loaiSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            currentDraftOrder.loai_don = val;
            if (!isEditingNxOrder) {
                generateNextNxOrderCode(val);
            }
            saveNxDraftToStorage();
            renderNhapXuatOrderList(filteredNhapXuatData);
            checkNxOrderModified();
        });
    }

    const mucdichInput = document.getElementById('nx-input-mucdich');
    if (mucdichInput) {
        mucdichInput.addEventListener('input', (e) => {
            currentDraftOrder.muc_dich = e.target.value;
            saveNxDraftToStorage();
            renderNhapXuatOrderList(filteredNhapXuatData);
            checkNxOrderModified();
        });
    }

    let currentManagerSelectedBranch = localStorage.getItem('gaia_nx_selected_branch') || '';
    window.currentManagerSelectedBranch = currentManagerSelectedBranch;

    const managerBranchSelect = document.getElementById('nx-manager-branch-select');
    if (managerBranchSelect) {
        managerBranchSelect.addEventListener('change', async () => {
            currentManagerSelectedBranch = managerBranchSelect.value;
            window.currentManagerSelectedBranch = currentManagerSelectedBranch;
            localStorage.setItem('gaia_nx_selected_branch', currentManagerSelectedBranch);

            const userNameFormatted = updateNxUserFieldWithBranch();
            const newBranchCode = extractCNCodeFromBranchString(userNameFormatted);

            let updatedCode = '';
            const maDonInput = document.getElementById('nx-input-madon');
            if (maDonInput && maDonInput.value && maDonInput.value !== 'ĐƠN-NHÁP') {
                let currentCode = maDonInput.value;
                const parts = currentCode.split('-');
                if (parts.length >= 4 && newBranchCode) {
                    parts[2] = newBranchCode; // Dynamically sync order code branch tag (CN1 -> CN2)
                    updatedCode = parts.join('-');
                    maDonInput.value = updatedCode;
                    if (typeof currentDraftOrder !== 'undefined' && currentDraftOrder) {
                        currentDraftOrder.ma_don = updatedCode;
                    }
                } else {
                    updatedCode = currentCode;
                }
            } else {
                const currentLoai = document.getElementById('nx-input-loai')?.value || '';
                if (!isEditingNxOrder && currentLoai) {
                    generateNextNxOrderCode(currentLoai);
                    updatedCode = document.getElementById('nx-input-madon')?.value || '';
                }
            }

            // IMMEDIATE DATABASE UPDATE FOR EXISTING ORDERS
            if (selectedNxOrderId !== null) {
                const client = getNhapXuatSupabaseClient();
                if (client) {
                    try {
                        const updatePayload = {
                            user_name: userNameFormatted
                        };
                        if (updatedCode) {
                            updatePayload.ma_don = updatedCode;
                        }

                        const { error } = await client
                            .from('nhap_xuat')
                            .update(updatePayload)
                            .eq('id', selectedNxOrderId);

                        if (!error) {
                            if (typeof showToast === 'function') {
                                showToast('success', 'Đã Đổi Chi Nhánh', `Đã chuyển đơn hàng sang ${newBranchCode || 'Chi Nhánh mới'} thành công!`);
                            }
                            logNxOrderAction(
                                updatedCode || selectedNxOrderId,
                                currentDraftOrder?.loai_don || 'Xuất',
                                'ĐỔI_CN',
                                `Điều chuyển đơn hàng sang [${newBranchCode}]`
                            );
                            fetchNhapXuatData();
                        } else {
                            console.error("Lỗi cập nhật chi nhánh trên Supabase DB:", error);
                        }
                    } catch (e) {
                        console.error("Exception updating branch DB:", e);
                    }
                }
            }

            checkNxOrderModified();
            renderNxDraftItemsTable();
        });
    }
}

// Robust helper to extract CN code from any branch string
function extractCNCodeFromBranchString(branchStr) {
    if (!branchStr) return '';
    const str = String(branchStr).trim();
    if (str === 'Toàn hệ thống' || str === 'all') return '';

    const match = str.match(/CN\d+/i);
    if (match) return match[0].toUpperCase();

    const matchNum = str.match(/Chi\s*Nhánh\s*(\d+)/i) || str.match(/CN\s*(\d+)/i);
    if (matchNum) return `CN${matchNum[1]}`;

    if (str.toLowerCase().includes('huyện') || str.toLowerCase().includes('hiệp bình')) return 'CN3';
    if (str.toLowerCase().includes('hà nội')) return 'CN2';
    if (str.toLowerCase().includes('tp.hcm') || str.toLowerCase().includes('hcm')) return 'CN1';

    return '';
}

// Fetch distinct branch strings directly from Supabase table 'staff' (column 'branch')
async function fetchBranchesFromStaffTable() {
    let branches = [];
    const client = (typeof getNhapXuatSupabaseClient === 'function') ? getNhapXuatSupabaseClient() : null;
    try {
        if (client) {
            const { data, error } = await client.from('staff').select('branch');
            if (!error && data && Array.isArray(data)) {
                data.forEach(item => {
                    if (item && item.branch && item.branch.trim() && item.branch !== 'Toàn hệ thống') {
                        branches.push(item.branch.trim());
                    }
                });
            }
        }
    } catch (e) {
        console.warn("NhapXuat: Error fetching staff table branches:", e);
    }

    // Fallback to local staffData / localStorage gaia_staff_list if Supabase table query is empty/offline
    if (branches.length === 0) {
        let localList = [];
        if (typeof staffData !== 'undefined' && Array.isArray(staffData) && staffData.length > 0) {
            localList = staffData;
        } else {
            try {
                const saved = localStorage.getItem("gaia_staff_list");
                if (saved) localList = JSON.parse(saved);
            } catch (e) {}
        }
        if (!localList || localList.length === 0) {
            if (typeof defaultStaffData !== 'undefined') localList = defaultStaffData;
        }
        (localList || []).forEach(s => {
            if (s && s.branch && s.branch !== 'Toàn hệ thống') {
                branches.push(s.branch.trim());
            }
        });
    }

    // Deduplicate
    return Array.from(new Set(branches));
}

// Check if logged-in user is STRICTLY Quản Lý (Excludes Admin & Staff)
function isStrictManagerRole(user) {
    const u = user || (typeof window.getCurrentLoggedUser === 'function' ? window.getCurrentLoggedUser() : null);
    if (!u) return false;
    const roleLower = (u.role || '').toLowerCase().trim();
    return roleLower.includes('quản lý') || roleLower.includes('quan ly') || roleLower === 'manager';
}

// Populate Branch Options ONLY for Quản Lý - Directly from 'staff' table 'branch' column
async function populateNxManagerBranches() {
    const branchSelect = document.getElementById('nx-manager-branch-select');
    if (!branchSelect) return;

    const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
    const isStrictManager = isStrictManagerRole(loggedUser);

    if (!isStrictManager) {
        // Admin & Staff: Hide dropdown, auto-use their own branch from staff table
        branchSelect.style.display = 'none';
        return;
    }

    const rawBranches = await fetchBranchesFromStaffTable();

    branchSelect.innerHTML = `<option value="" disabled selected>-- Chọn Chi Nhánh --</option>`;
    
    rawBranches.forEach(bStr => {
        const code = extractCNCodeFromBranchString(bStr);
        const optionEl = document.createElement('option');
        optionEl.value = code || bStr;
        optionEl.dataset.fullBranch = bStr;

        let labelText = bStr;
        if (labelText.length > 28) {
            labelText = labelText.substring(0, 25) + '...';
        }
        optionEl.textContent = `📍 ${labelText}`;
        optionEl.title = bStr;
        branchSelect.appendChild(optionEl);
    });

    const activeBranch = window.currentManagerSelectedBranch || localStorage.getItem('gaia_nx_selected_branch') || "";
    branchSelect.value = activeBranch;
    branchSelect.style.display = 'inline-block';
}

// Formats `#nx-input-user` as [Tên Người Đăng Nhập] - [Chi Nhánh]
function updateNxUserFieldWithBranch() {
    const userInput = document.getElementById('nx-input-user');
    if (!userInput) return '';

    const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
    let rawName = loggedUser ? (loggedUser.full_name || loggedUser.email || 'Nhân viên') : 'Nhân viên';
    rawName = String(rawName).replace(/\s*\([^)]*\)/g, '').trim();

    const isStrictManager = isStrictManagerRole(loggedUser);
    const branchSelect = document.getElementById('nx-manager-branch-select');

    let selectedCN = '';

    if (isStrictManager) {
        if (branchSelect && branchSelect.style.display !== 'none' && branchSelect.value) {
            selectedCN = branchSelect.value;
            window.currentManagerSelectedBranch = selectedCN;
            localStorage.setItem('gaia_nx_selected_branch', selectedCN);
        } else if (window.currentManagerSelectedBranch) {
            selectedCN = window.currentManagerSelectedBranch;
            if (branchSelect && branchSelect.querySelector(`option[value="${selectedCN}"]`)) {
                branchSelect.value = selectedCN;
            }
        }
        // Requirement: Ban đầu khi chưa chọn CN thì chỉ xuất hiện tên NV thôi (selectedCN = '')
    } else {
        // Admin & Staff: Auto-add branch directly from their own 'branch' column in staff table!
        let userBranchStr = loggedUser ? (loggedUser.branch || '') : '';

        if (!userBranchStr && typeof window.getUserBranch === 'function' && loggedUser) {
            userBranchStr = window.getUserBranch(loggedUser.full_name || loggedUser.email) || '';
        }

        selectedCN = extractCNCodeFromBranchString(userBranchStr);
    }

    let formattedUser = rawName;
    if (selectedCN) {
        formattedUser = `${rawName} - ${selectedCN}`;
    }

    userInput.value = formattedUser;
    if (typeof currentDraftOrder !== 'undefined' && currentDraftOrder) {
        currentDraftOrder.user_name = formattedUser;
    }

    return formattedUser;
}




// Fetch Orders from Supabase table 'nhap_xuat'
async function fetchNhapXuatData() {
    const client = getNhapXuatSupabaseClient();
    try {
        if (client) {
            const { data, error } = await client
                .from('nhap_xuat')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.warn("NhapXuat: Supabase fetch error, using sample fallback:", error.message);
                nhapXuatData = getSampleNhapXuatData();
            } else if (data && data.length > 0) {
                nhapXuatData = data;
            } else {
                nhapXuatData = getSampleNhapXuatData();
            }
        } else {
            nhapXuatData = getSampleNhapXuatData();
        }
    } catch (err) {
        console.error("NhapXuat: Exception fetching orders:", err);
        nhapXuatData = getSampleNhapXuatData();
    } finally {
        await initNhapXuatBranchFilterForManager();
        applyNhapXuatFilters();
    }
}

// Sample Fallback Data (Cleaned - returns empty array by default)
function getSampleNhapXuatData() {
    return [];
}

// Supabase Realtime Channel
function setupNhapXuatRealtimeSubscription() {
    const client = getNhapXuatSupabaseClient();
    if (!client) return;

    try {
        client
            .channel('public:nhap_xuat')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'nhap_xuat' }, () => {
                fetchNhapXuatData();
            })
            .subscribe((status) => {
                console.log("GAIA NhapXuat: Realtime subscription status:", status);
            });
    } catch (e) {
        console.warn("NhapXuat: Realtime subscription warning:", e);
    }
}

// Init & Populate Manager Branch Filter for Nhập Xuất List
async function initNhapXuatBranchFilterForManager() {
    const filterBranchSelect = document.getElementById('nhapxuat-filter-branch');
    if (!filterBranchSelect) return;

    const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
    const isStrictManager = isStrictManagerRole(loggedUser);

    if (!isStrictManager) {
        filterBranchSelect.style.display = 'none';
        return;
    }

    const rawBranches = await fetchBranchesFromStaffTable();

    filterBranchSelect.innerHTML = `<option value="all">🏢 Tất cả chi nhánh</option>`;
    rawBranches.forEach(bStr => {
        const code = extractCNCodeFromBranchString(bStr);
        const optionEl = document.createElement('option');
        optionEl.value = code || bStr;
        optionEl.dataset.fullBranch = bStr;
        
        let labelText = bStr;
        if (labelText.length > 25) {
            labelText = labelText.substring(0, 22) + '...';
        }
        optionEl.textContent = `📍 ${labelText}`;
        optionEl.title = bStr;
        filterBranchSelect.appendChild(optionEl);
    });

    filterBranchSelect.style.display = 'inline-block';
}

// Filters & Order List Rendering
function applyNhapXuatFilters() {
    const searchInput = document.getElementById('nhapxuat-search-input');
    const term = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const filterLoaiSelect = document.getElementById('nhapxuat-filter-loai');
    const selectedLoai = filterLoaiSelect ? filterLoaiSelect.value : 'all';

    const filterStatusSelect = document.getElementById('nhapxuat-filter-status');
    const selectedStatus = filterStatusSelect ? filterStatusSelect.value : 'all';

    const filterBranchSelect = document.getElementById('nhapxuat-filter-branch');
    const selectedBranch = filterBranchSelect ? filterBranchSelect.value : 'all';

    let result = [...nhapXuatData];

    // Apply Role & Branch Permission Filter (Admin & Staff restricted to their own branch; Manager sees all)
    result = result.filter(item => {
        return (typeof window.canUserAccessRecord === 'function') ? window.canUserAccessRecord(item) : true;
    });

    // Apply Manager Branch Filter Dropdown
    if (selectedBranch && selectedBranch !== 'all') {
        result = result.filter(x => {
            const itemCN = extractCNCodeFromBranchString(x.user_name || x.branch || '');
            return itemCN.toUpperCase() === selectedBranch.toUpperCase();
        });
    }

    if (selectedLoai && selectedLoai !== 'all') {
        result = result.filter(x => x.loai_don === selectedLoai);
    }

    if (selectedStatus && selectedStatus !== 'all') {
        result = result.filter(x => {
            if (selectedStatus === 'Chờ') {
                return x.trang_thai === 'Chờ';
            } else if (selectedStatus === 'Done') {
                return x.trang_thai === 'Done' || !x.trang_thai || x.trang_thai === 'Đã hoàn tất' || x.trang_thai === 'Hoàn tất';
            }
            return true;
        });
    }

    if (term) {
        result = result.filter(x => 
            (x.ma_don && x.ma_don.toLowerCase().includes(term)) ||
            (x.muc_dich && x.muc_dich.toLowerCase().includes(term)) ||
            (x.user_name && x.user_name.toLowerCase().includes(term))
        );
    }

    // Update Funnel Reset Button highlight state (turns RED if any filter is active)
    const isFilteringActive = !!(term || (selectedLoai && selectedLoai !== 'all') || (selectedStatus && selectedStatus !== 'all') || (selectedBranch && selectedBranch !== 'all'));
    const funnelBtn = document.getElementById('nhapxuat-funnel-reset-btn');
    if (funnelBtn) {
        if (isFilteringActive) {
            funnelBtn.style.background = 'rgba(239, 68, 68, 0.15)';
            funnelBtn.style.color = '#ef4444';
            funnelBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            funnelBtn.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.3)';
            funnelBtn.title = 'Đang lọc dữ liệu - Click để Xóa Tất Cả Bộ Lọc (Reset)';
        } else {
            funnelBtn.style.background = 'rgba(255, 255, 255, 0.06)';
            funnelBtn.style.color = 'var(--text-muted, #94a3b8)';
            funnelBtn.style.borderColor = 'var(--border-glass, #334155)';
            funnelBtn.style.boxShadow = 'none';
            funnelBtn.title = 'Xóa tất cả bộ lọc (Reset Filter)';
        }
    }

    filteredNhapXuatData = result;
    renderNhapXuatOrderList(filteredNhapXuatData);

    // Update dynamic options and counts across all 3 filter dropdowns
    updateNxFilterDropdownOptions();
}

// Dynamic Cascading Options Updater: Calculates real-time available counts for each dropdown option based on other active filters
function updateNxFilterDropdownOptions() {
    const searchInput = document.getElementById('nhapxuat-search-input');
    const term = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const filterLoaiSelect = document.getElementById('nhapxuat-filter-loai');
    const selectedLoai = filterLoaiSelect ? filterLoaiSelect.value : 'all';

    const filterStatusSelect = document.getElementById('nhapxuat-filter-status');
    const selectedStatus = filterStatusSelect ? filterStatusSelect.value : 'all';

    const filterBranchSelect = document.getElementById('nhapxuat-filter-branch');
    const selectedBranch = filterBranchSelect ? filterBranchSelect.value : 'all';

    let baseRecords = [...nhapXuatData].filter(item => {
        return (typeof window.canUserAccessRecord === 'function') ? window.canUserAccessRecord(item) : true;
    });

    if (term) {
        baseRecords = baseRecords.filter(x => 
            (x.ma_don && x.ma_don.toLowerCase().includes(term)) ||
            (x.muc_dich && x.muc_dich.toLowerCase().includes(term)) ||
            (x.user_name && x.user_name.toLowerCase().includes(term))
        );
    }

    // 1. UPDATE 'LOẠI ĐƠN' OPTIONS (depends on Branch + Status)
    let recordsForLoai = baseRecords;
    if (selectedBranch && selectedBranch !== 'all') {
        recordsForLoai = recordsForLoai.filter(x => {
            const itemCN = extractCNCodeFromBranchString(x.user_name || x.branch || '');
            return itemCN.toUpperCase() === selectedBranch.toUpperCase();
        });
    }
    if (selectedStatus && selectedStatus !== 'all') {
        recordsForLoai = recordsForLoai.filter(x => {
            if (selectedStatus === 'Chờ') return x.trang_thai === 'Chờ';
            if (selectedStatus === 'Done') return x.trang_thai === 'Done' || !x.trang_thai || x.trang_thai === 'Đã hoàn tất' || x.trang_thai === 'Hoàn tất';
            return true;
        });
    }

    const countLoaiAll = recordsForLoai.length;
    const countLoaiNhap = recordsForLoai.filter(x => x.loai_don === 'Nhập').length;
    const countLoaiXuat = recordsForLoai.filter(x => x.loai_don === 'Xuất').length;

    if (filterLoaiSelect) {
        const optAll = filterLoaiSelect.querySelector('option[value="all"]');
        const optNhap = filterLoaiSelect.querySelector('option[value="Nhập"]');
        const optXuat = filterLoaiSelect.querySelector('option[value="Xuất"]');

        if (optAll) optAll.textContent = `Tất cả loại (${countLoaiAll})`;
        if (optNhap) {
            optNhap.textContent = `📥 Nhập kho (${countLoaiNhap})`;
            optNhap.disabled = countLoaiNhap === 0 && selectedLoai !== 'Nhập';
        }
        if (optXuat) {
            optXuat.textContent = `📤 Xuất kho (${countLoaiXuat})`;
            optXuat.disabled = countLoaiXuat === 0 && selectedLoai !== 'Xuất';
        }
    }

    // 2. UPDATE 'TRẠNG THÁI' OPTIONS (depends on Branch + Loai)
    let recordsForStatus = baseRecords;
    if (selectedBranch && selectedBranch !== 'all') {
        recordsForStatus = recordsForStatus.filter(x => {
            const itemCN = extractCNCodeFromBranchString(x.user_name || x.branch || '');
            return itemCN.toUpperCase() === selectedBranch.toUpperCase();
        });
    }
    if (selectedLoai && selectedLoai !== 'all') {
        recordsForStatus = recordsForStatus.filter(x => x.loai_don === selectedLoai);
    }

    const countStatusAll = recordsForStatus.length;
    const countStatusCho = recordsForStatus.filter(x => x.trang_thai === 'Chờ').length;
    const countStatusDone = recordsForStatus.filter(x => x.trang_thai === 'Done' || !x.trang_thai || x.trang_thai === 'Đã hoàn tất' || x.trang_thai === 'Hoàn tất').length;

    if (filterStatusSelect) {
        const optAll = filterStatusSelect.querySelector('option[value="all"]');
        const optCho = filterStatusSelect.querySelector('option[value="Chờ"]');
        const optDone = filterStatusSelect.querySelector('option[value="Done"]');

        if (optAll) optAll.textContent = `📋 Tất cả trạng thái (${countStatusAll})`;
        if (optCho) {
            optCho.textContent = `⏳ Đơn chờ (${countStatusCho})`;
            optCho.disabled = countStatusCho === 0 && selectedStatus !== 'Chờ';
        }
        if (optDone) {
            optDone.textContent = `✅ Hoàn tất (${countStatusDone})`;
            optDone.disabled = countStatusDone === 0 && selectedStatus !== 'Done';
        }
    }

    // 3. UPDATE 'CHI NHÁNH' OPTIONS (depends on Loai + Status)
    let recordsForBranch = baseRecords;
    if (selectedLoai && selectedLoai !== 'all') {
        recordsForBranch = recordsForBranch.filter(x => x.loai_don === selectedLoai);
    }
    if (selectedStatus && selectedStatus !== 'all') {
        recordsForBranch = recordsForBranch.filter(x => {
            if (selectedStatus === 'Chờ') return x.trang_thai === 'Chờ';
            if (selectedStatus === 'Done') return x.trang_thai === 'Done' || !x.trang_thai || x.trang_thai === 'Đã hoàn tất' || x.trang_thai === 'Hoàn tất';
            return true;
        });
    }

    if (filterBranchSelect) {
        const branchOptions = filterBranchSelect.querySelectorAll('option');
        branchOptions.forEach(opt => {
            const val = opt.value;
            if (val === 'all') {
                opt.textContent = `🏢 Tất cả chi nhánh (${recordsForBranch.length})`;
            } else {
                const fullBranch = opt.dataset.fullBranch || val;
                const count = recordsForBranch.filter(x => {
                    const itemCN = extractCNCodeFromBranchString(x.user_name || x.branch || '');
                    return itemCN.toUpperCase() === val.toUpperCase();
                }).length;
                let labelText = fullBranch;
                if (labelText.length > 20) labelText = labelText.substring(0, 18) + '...';
                opt.textContent = `📍 ${labelText} (${count})`;
                opt.disabled = count === 0 && selectedBranch !== val;
            }
        });
    }
}

function resetNxFilters() {
    const searchInput = document.getElementById('nhapxuat-search-input');
    const filterLoaiSelect = document.getElementById('nhapxuat-filter-loai');
    const filterStatusSelect = document.getElementById('nhapxuat-filter-status');
    const filterBranchSelect = document.getElementById('nhapxuat-filter-branch');

    if (searchInput) searchInput.value = '';
    if (filterLoaiSelect) filterLoaiSelect.value = 'all';
    if (filterStatusSelect) filterStatusSelect.value = 'all';
    if (filterBranchSelect) filterBranchSelect.value = 'all';

    applyNhapXuatFilters();
}
window.resetNxFilters = resetNxFilters;


let originalOrderStateSnapshot = null;

function getAvailableStockInNx(ma_vach, lot, date_expiry, branchCode, excludeMaDon) {
    if (typeof theKhoData === 'undefined') return 999999; 
    let currentStock = 0;
    const dateStr = date_expiry ? parseDateToYyyyMmDd(date_expiry) : null;
    const lotStr = lot || '-';
    for (const tk of theKhoData) {
        if (tk.ma_don === excludeMaDon) continue;
        if (extractCNCodeFromBranchString(tk.user_name) !== branchCode) continue;
        if (tk.ma_vach === ma_vach && (tk.lot || '-') === lotStr) {
            const tkDate = tk.date_expiry ? parseDateToYyyyMmDd(tk.date_expiry) : null;
            if (tkDate === dateStr) {
                if (tk.loai === 'Nhập') currentStock += Number(tk.so_luong);
                else if (tk.loai === 'Xuất') currentStock -= Number(tk.so_luong);
            }
        }
    }
    return currentStock;
}

function validateNxDraftStock() {
    const loaiDon = document.getElementById('nx-input-loai')?.value;
    if (loaiDon !== 'Xuất') return true;
    const userName = document.getElementById('nx-input-user')?.value || '';
    const branchCode = extractCNCodeFromBranchString(userName);
    const currentMaDon = document.getElementById('nx-input-madon')?.value || '';
    for (const item of currentDraftNxItems) {
        const scannedQty = Number(item.so_luong) || 0;
        if (scannedQty <= 0) continue;
        const stock = getAvailableStockInNx(item.ma_vach, item.lot, item.date_expiry, branchCode, currentMaDon);
        if (stock < scannedQty) return false;
    }
    return true;
}

function updateNxSaveButtonState(hasChanges = true) {
    const saveBtn = document.getElementById('btn-save-nx-order');
    if (!saveBtn) return;
    
    const isValidStock = validateNxDraftStock();
    const canSave = hasChanges && isValidStock;

    if (selectedNxOrderId !== null) {
        // VIEWING / EDITING EXISTING ORDER MODE
        saveBtn.innerHTML = '💾 Cập Nhật';
        if (canSave) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
            saveBtn.style.background = '#3b82f6';
        } else {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.4';
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.style.background = '#4b5563';
        }
    } else {
        // CREATING NEW DRAFT ORDER MODE
        saveBtn.innerHTML = '💾 Lưu';
        if (isValidStock) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
            saveBtn.style.background = '#10b981';
        } else {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.4';
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.style.background = '#4b5563';
        }
    }
}

function checkNxOrderModified() {
    if (selectedNxOrderId === null) {
        updateNxSaveButtonState(true);
        return;
    }

    if (!originalOrderStateSnapshot) {
        updateNxSaveButtonState(true);
        return;
    }

    const currentState = JSON.stringify({
        loai_don: document.getElementById('nx-input-loai')?.value || '',
        muc_dich: document.getElementById('nx-input-mucdich')?.value || '',
        items: currentDraftNxItems
    });

    const isModified = currentState !== originalOrderStateSnapshot;
    updateNxSaveButtonState(isModified);
}

function renderNhapXuatOrderList(orders) {
    const listEl = document.getElementById('nhapxuat-order-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    // Requirement: Show Draft Order Card ONLY when creating a new order (selectedNxOrderId === null)!
    const isEditingDraft = selectedNxOrderId === null;
    const hasDraftContent = (currentDraftNxItems && currentDraftNxItems.length > 0) || 
                           Boolean(currentDraftOrder.loai_don) || 
                           Boolean(currentDraftOrder.muc_dich);

    if (isEditingDraft && hasDraftContent) {
        const draftTitleTag = currentDraftOrder.loai_don ? `${currentDraftOrder.loai_don} - Nháp` : 'Nháp';
        const draftQtyCount = (currentDraftNxItems || []).length;
        
        const draftCard = document.createElement('div');
        draftCard.className = 'nx-order-card selected';
        draftCard.style.border = '1px dashed #f59e0b';
        draftCard.style.background = 'rgba(245, 158, 11, 0.08)';
        draftCard.onclick = () => createNewNhapXuatOrderForm(true);

        draftCard.innerHTML = `
            <div class="nx-card-top">
                <span class="nx-card-code" style="color: #f59e0b;">${escapeHtml(currentDraftOrder.ma_don || 'ĐƠN-NHÁP')}</span>
                <span class="nx-card-type" style="background: rgba(245, 158, 11, 0.25); color: #f59e0b; font-weight: 700;">✏️ ${escapeHtml(draftTitleTag)}</span>
            </div>
            <div class="nx-card-purpose" title="${escapeHtml(currentDraftOrder.muc_dich || '')}">
                ${escapeHtml(currentDraftOrder.muc_dich || 'Đang tạo đơn mới...')}
            </div>
            <div class="nx-card-footer">
                <span>👤 ${escapeHtml(currentDraftOrder.user_name || '-')}</span>
                <span style="color: #f59e0b; font-weight: 600;">Đang soạn (${draftQtyCount} SP)</span>
            </div>
        `;
        listEl.appendChild(draftCard);
    }

    if (!orders || orders.length === 0) {
        if (!isEditingDraft) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 30px 10px; color: var(--text-muted); font-size: 13px;">
                    Không tìm thấy đơn nhập/xuất nào
                </div>
            `;
        }
        return;
    }

    orders.forEach(order => {
        const isSelected = selectedNxOrderId === order.id;
        const isNhap = order.loai_don === 'Nhập';

        const card = document.createElement('div');
        card.className = `nx-order-card ${isSelected ? 'selected' : ''}`;
        card.onclick = () => selectNxOrderForView(order);

        card.innerHTML = `
            <div class="nx-card-top">
                <div style="display: flex; gap: 6px; align-items: center;">
                    <span class="nx-card-code">${escapeHtml(order.ma_don)}</span>
                    ${order.trang_thai === 'Chờ' ? '<span style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">⏳ Chờ</span>' : ''}
                </div>
                <span class="nx-card-type ${isNhap ? 'nhap' : 'xuat'}">${isNhap ? '📥 Nhập' : '📤 Xuất'}</span>
            </div>
            <div class="nx-card-purpose" title="${escapeHtml(order.muc_dich || '')}">
                ${escapeHtml(order.muc_dich || 'Không có ghi chú')}
            </div>
            <div class="nx-card-footer">
                <span>👤 ${escapeHtml(order.user_name || '-')}</span>
                <span>📅 ${formatNxDateTime(order.created_at || order.ngay_tao)}</span>
            </div>
        `;

        listEl.appendChild(card);
    });
}

let currentNxLogs = [];

// Modal Open/Close Helpers
function openNxHistoryLogModal() {
    const modal = document.getElementById('nx-history-log-modal');
    const codeEl = document.getElementById('nx-modal-log-code');
    const currentCode = document.getElementById('nx-input-madon')?.value || currentDraftOrder.ma_don || 'ĐƠN-NHÁP';

    if (codeEl) codeEl.textContent = currentCode;
    renderNxOrderLogs(currentNxLogs);

    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
    }
}

function closeNxHistoryLogModal() {
    const modal = document.getElementById('nx-history-log-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
}

// Close Modal when clicking on overlay backdrop
window.addEventListener('click', (e) => {
    const modal = document.getElementById('nx-history-log-modal');
    if (modal && e.target === modal) {
        closeNxHistoryLogModal();
    }
});

// Audit Log Creator Helper
async function logNxOrderAction(maDon, loaiDon, hanhDong, noiDung) {
    if (!maDon) return;
    const userName = (document.getElementById('nx-input-user')?.value) || 'Thái Trung Tín - CN1';
    
    const logPayload = {
        ma_don: maDon,
        loai_don: loaiDon || 'Nhập',
        hanh_dong: hanhDong, // 'TẠO_ĐƠN', 'THÊM_SP', 'XÓA_SP', 'SỬA_SL', 'CẬP_NHẬT_ĐƠN'
        noi_dung: noiDung,
        user_name: userName,
        created_at: new Date().toISOString()
    };

    currentNxLogs.unshift(logPayload);
    renderNxOrderLogs(currentNxLogs);

    const client = getNhapXuatSupabaseClient();
    try {
        if (client) {
            await client.from('nhap_xuat_log').insert([logPayload]);
        }
    } catch (e) {
        console.warn("NhapXuat: Error inserting audit log:", e);
    }
}

// REQUIREMENT: Merge Qty Increase Logs into a SINGLE Row per product item (e.g. 1 -> 4)
async function logOrUpdateItemQtyLog(maDon, loaiDon, tenHangHoa, startQty, newQty) {
    if (!maDon || !tenHangHoa) return;
    const userName = (document.getElementById('nx-input-user')?.value) || 'Thái Trung Tín - CN1';
    const newText = `Quét trùng mã -> Tự động tăng số lượng [${tenHangHoa}] từ ${startQty} lên ${newQty}`;

    // Search existing log entry for this exact product item in currentNxLogs
    const existingLog = currentNxLogs.find(l => 
        l.ma_don === maDon && 
        (l.hanh_dong === 'SỬA_SL' || l.hanh_dong === 'THÊM_SP') &&
        l.noi_dung && l.noi_dung.includes(tenHangHoa)
    );

    if (existingLog) {
        existingLog.hanh_dong = 'SỬA_SL';
        existingLog.noi_dung = newText;
        existingLog.created_at = new Date().toISOString();
        renderNxOrderLogs(currentNxLogs);

        const client = getNhapXuatSupabaseClient();
        if (client && existingLog.id) {
            try {
                await client.from('nhap_xuat_log').update({
                    hanh_dong: 'SỬA_SL',
                    noi_dung: newText,
                    created_at: existingLog.created_at
                }).eq('id', existingLog.id);
            } catch (e) {
                console.warn("NhapXuat: Error updating log row:", e);
            }
        }
    } else {
        await logNxOrderAction(maDon, loaiDon, 'SỬA_SL', newText);
    }
}

// Fetch Order Audit Logs from Supabase
async function fetchNxOrderLogs(maDon) {
    if (!maDon) {
        currentNxLogs = [];
        renderNxOrderLogs([]);
        return;
    }

    const client = getNhapXuatSupabaseClient();
    try {
        if (client) {
            const { data, error } = await client
                .from('nhap_xuat_log')
                .select('*')
                .eq('ma_don', maDon)
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                currentNxLogs = data;
            }
        }
    } catch (e) {
        console.warn("NhapXuat: Error fetching order logs:", e);
    } finally {
        renderNxOrderLogs(currentNxLogs);
    }
}

// Render Order Audit Log Table (Supports both inline and Modal)
function renderNxOrderLogs(logs) {
    const modalTbody = document.getElementById('nx-log-modal-table-body');
    const inlineTbody = document.getElementById('nx-log-table-body');
    const badgeCount = document.getElementById('nx-log-count-badge');

    const targets = [modalTbody, inlineTbody].filter(Boolean);

    if (badgeCount) {
        badgeCount.textContent = `${logs ? logs.length : 0} lịch sử`;
    }

    targets.forEach(tb => {
        tb.innerHTML = '';
        if (!logs || logs.length === 0) {
            tb.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 12.5px;">
                        Chưa có lịch sử thao tác nào cho đơn này
                    </td>
                </tr>
            `;
            return;
        }

        logs.forEach(log => {
            const tr = document.createElement('tr');

            let actionBadge = '';
            if (log.hanh_dong === 'TẠO_ĐƠN') {
                actionBadge = `<span class="badge-type badge-nhap" style="font-size: 11px;">✨ Tạo Đơn</span>`;
            } else if (log.hanh_dong === 'THÊM_SP') {
                actionBadge = `<span class="badge-lot" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-size: 11px;">➕ Thêm SP</span>`;
            } else if (log.hanh_dong === 'XÓA_SP') {
                actionBadge = `<span class="badge-lot" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; font-size: 11px;">❌ Xóa SP</span>`;
            } else if (log.hanh_dong === 'SỬA_SL') {
                actionBadge = `<span class="badge-lot" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-size: 11px;">✏️ Sửa SL</span>`;
            } else {
                actionBadge = `<span class="badge-lot" style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; font-size: 11px;">💾 Cập Nhật</span>`;
            }

            tr.innerHTML = `
                <td style="font-size: 11px; color: var(--text-muted); vertical-align: top; padding: 10px 8px; line-height: 1.35; white-space: normal; word-break: break-word;">
                    <div>${formatNxDateTime(log.created_at)}</div>
                    <div style="color: #60a5fa; font-weight: 500; font-size: 11px; margin-top: 3px;">👤 ${escapeHtml(log.user_name || '-')}</div>
                </td>
                <td style="vertical-align: top; padding-top: 10px; text-align: center;">${actionBadge}</td>
                <td style="font-size: 11.5px; color: var(--text-primary); font-weight: 500; white-space: normal !important; word-break: break-word !important; line-height: 1.5; padding: 10px 8px;">
                    ${escapeHtml(log.noi_dung)}
                </td>
            `;

            tb.appendChild(tr);
        });
    });
}

// Helper: Kiểm tra có thay đổi chưa lưu không
function hasUnsavedNxChanges() {
    if (selectedNxOrderId === null) {
        // Đang tạo đơn mới – check có dữ liệu gì không
        const loai = document.getElementById('nx-input-loai')?.value || '';
        const mucDich = document.getElementById('nx-input-mucdich')?.value?.trim() || '';
        const hasItems = currentDraftNxItems && currentDraftNxItems.length > 0;
        const hasAttachments = currentNxAttachments && currentNxAttachments.length > 0;
        return !!(loai || mucDich || hasItems || hasAttachments);
    } else {
        // Đang xem/sửa đơn cũ – so sánh với snapshot
        if (!originalOrderStateSnapshot) return false;
        const currentState = JSON.stringify({
            loai_don: document.getElementById('nx-input-loai')?.value || '',
            muc_dich: document.getElementById('nx-input-mucdich')?.value || '',
            items: currentDraftNxItems,
            attachments: currentNxAttachments
        });
        return currentState !== originalOrderStateSnapshot;
    }
}

// Select Order from List to View Details
function selectNxOrderForView(order) {
    // Guard: Nếu đang có thay đổi chưa lưu → hỏi trước khi chuyển đơn
    if (hasUnsavedNxChanges()) {
        const warningTitle = selectedNxOrderId === null
            ? 'Bỏ Đơn Đang Tạo?'
            : 'Bỏ Thay Đổi Chưa Lưu?';
        const warningText = selectedNxOrderId === null
            ? `Bạn đang tạo đơn mới có dữ liệu chưa lưu. Chuyển sang xem đơn <strong>${order.ma_don}</strong> sẽ mất toàn bộ dữ liệu đang nhập.`
            : `Đơn kho đang có thay đổi chưa được cập nhật. Chuyển sang đơn <strong>${order.ma_don}</strong> sẽ mất các thay đổi này.`;

        showGenericConfirmModal(
            '⚠️ CẢNH BÁO',
            warningTitle,
            warningText,
            'Nhấn "Tiếp Tục" để bỏ thay đổi và chuyển đơn, hoặc "Hủy" để quay lại.',
            '#f59e0b',
            'Tiếp Tục',
            () => _doSelectNxOrderForView(order)
        );
        return;
    }

    _doSelectNxOrderForView(order);
}

// Internal: thực sự load đơn vào form (không guard)
async function _doSelectNxOrderForView(order) {
    selectedNxOrderId = order.id;
    isEditingNxOrder = true;

    const titleEl = document.getElementById('nhapxuat-form-title');
    const modeBadge = document.getElementById('nhapxuat-mode-badge');
    const statusBadge = document.getElementById('nhapxuat-status-badge');
    const fileLink = document.getElementById('nhapxuat-file-link');

    if (titleEl) titleEl.textContent = `📋 Chi Tiết Đơn ${order.ma_don}`;
    
    if (fileLink) {
        if (order.file_url) {
            fileLink.style.display = 'inline-block';
            fileLink.href = order.file_url;
        } else {
            fileLink.style.display = 'none';
        }
    }

    if (statusBadge) {
        if (order.trang_thai === 'Chờ') {
            statusBadge.style.display = 'none'; // Bỏ nút "⏳ Đang Chờ Quét (Nhấn để Hoàn Tất)" theo yêu cầu
        } else {
            statusBadge.style.display = 'inline-block';
            statusBadge.textContent = '✅ Đã Hoàn Tất';
            statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
            statusBadge.style.color = '#10b981';
            statusBadge.onclick = null;
        }
    }

    if (modeBadge) {
        modeBadge.textContent = 'Đang Xem';
        modeBadge.style.background = 'rgba(59, 130, 246, 0.15)';
        modeBadge.style.color = '#3b82f6';
    }

    const btnDelete = document.getElementById('btn-delete-nx-order');
    const btnDownload = document.getElementById('btn-download-nx-pdf');
    
    if (btnDelete) {
        if (order.trang_thai === 'Chờ') {
            btnDelete.style.display = 'flex';
        } else {
            btnDelete.style.display = 'none';
        }
    }
    
    if (btnDownload) {
        if (order.file_url) {
            btnDownload.href = order.file_url;
            btnDownload.style.display = 'flex';
        } else {
            btnDownload.style.display = 'none';
        }
    }

    document.getElementById('nx-input-madon').value = order.ma_don || '';
    document.getElementById('nx-input-loai').value = order.loai_don || 'Nhập';
    document.getElementById('nx-input-time').value = formatNxDateTime(order.created_at || order.ngay_tao);
    document.getElementById('nx-input-mucdich').value = order.muc_dich || '';
    document.getElementById('nx-input-user').value = order.user_name || '';

    await populateNxManagerBranches();
    const managerSelect = document.getElementById('nx-manager-branch-select');
    if (managerSelect && managerSelect.style.display !== 'none') {
        const cnCode = extractCNCodeFromBranchString(order.user_name);
        if (cnCode && managerSelect.querySelector(`option[value="${cnCode}"]`)) {
            managerSelect.value = cnCode;
        } else if (window.currentManagerSelectedBranch && managerSelect.querySelector(`option[value="${window.currentManagerSelectedBranch}"]`)) {
            managerSelect.value = window.currentManagerSelectedBranch;
        } else {
            managerSelect.value = "";
        }
    }

    currentDraftNxItems = order.chi_tiet_san_pham ? JSON.parse(JSON.stringify(order.chi_tiet_san_pham)) : [];
    
    // Parse Attached Files
    currentNxAttachments = [];
    if (order.file_url) {
        try {
            if (typeof order.file_url === 'string' && order.file_url.trim().startsWith('[') && order.file_url.trim().endsWith(']')) {
                currentNxAttachments = JSON.parse(order.file_url);
            } else if (typeof order.file_url === 'string' && order.file_url.startsWith('http')) {
                const urlParts = order.file_url.split('/');
                const rawFileName = urlParts[urlParts.length - 1] || 'File Hóa Đơn';
                const cleanName = decodeURIComponent(rawFileName).replace(/^HD-\d+-/, '').replace(/^attach-\d+-/, '');
                currentNxAttachments = [{ name: cleanName || 'File Hóa Đơn', url: order.file_url }];
            }
        } catch (e) {
            currentNxAttachments = [{ name: 'File Đính Kèm', url: order.file_url }];
        }
    }
    renderNxAttachmentsUI();

    // Save snapshot of original state to detect changes
    originalOrderStateSnapshot = JSON.stringify({
        loai_don: order.loai_don || '',
        muc_dich: order.muc_dich || '',
        items: currentDraftNxItems,
        attachments: currentNxAttachments
    });

    currentDraftOrder = JSON.parse(JSON.stringify(order));

    renderNxDraftItemsTable();
    fetchNxOrderLogs(order.ma_don);
    renderNhapXuatOrderList(filteredNhapXuatData);
    updateNxSaveButtonState(false); // Initially dimmed / disabled when just viewing!
}


// Create New Order Form Handler
function createNewNhapXuatOrderForm(restoreSavedDraft = false) {
    // Guard: Nếu đang SỬA đơn cũ và có thay đổi chưa lưu → hỏi trước
    if (selectedNxOrderId !== null && hasUnsavedNxChanges()) {
        const currentMaDon = document.getElementById('nx-input-madon')?.value || '';
        showGenericConfirmModal(
            '⚠️ CẢNH BÁO',
            'Bỏ Thay Đổi Chưa Lưu?',
            `Đơn kho <strong>${currentMaDon}</strong> đang có thay đổi chưa được cập nhật. Tạo đơn mới sẽ mất toàn bộ các thay đổi này.`,
            'Nhấn "Tiếp Tục" để tạo đơn mới, hoặc "Hủy" để quay lại và Cập Nhật đơn.',
            '#f59e0b',
            'Tiếp Tục',
            () => _doCreateNewNhapXuatOrderForm()
        );
        return;
    }
    _doCreateNewNhapXuatOrderForm();
}

// Internal: thực sự reset form tạo đơn mới (không guard)
async function _doCreateNewNhapXuatOrderForm() {
    selectedNxOrderId = null;
    isEditingNxOrder = false;
    originalOrderStateSnapshot = null;

    const titleEl = document.getElementById('nhapxuat-form-title');
    const modeBadge = document.getElementById('nhapxuat-mode-badge');
    const statusBadge = document.getElementById('nhapxuat-status-badge');
    const fileLink = document.getElementById('nhapxuat-file-link');

    if (statusBadge) statusBadge.style.display = 'none';
    if (fileLink) fileLink.style.display = 'none';
    
    const btnDelete = document.getElementById('btn-delete-nx-order');
    const btnDownload = document.getElementById('btn-download-nx-pdf');
    if (btnDelete) btnDelete.style.display = 'none';
    if (btnDownload) btnDownload.style.display = 'none';

    if (titleEl) titleEl.textContent = '📝 Tạo Đơn Nhập / Xuất Kho Mới';
    if (modeBadge) {
        modeBadge.textContent = '+ Đơn Mới';
        modeBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        modeBadge.style.color = '#10b981';
    }

    // Auto-fill logged-in user formatted as "Tên Nhân Viên - Chi Nhánh"
    const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
    await populateNxManagerBranches();

    const branchSelect = document.getElementById('nx-manager-branch-select');
    if (branchSelect && branchSelect.style.display !== 'none') {
        branchSelect.value = ''; // Ban đầu của Quản lý sẽ trống (-- Chọn Chi Nhánh --)
    }

    const userNameFormatted = updateNxUserFieldWithBranch();




    // Fresh Form Always (Draft disabled)
    currentDraftOrder = {
        ma_don: 'ĐƠN-NHÁP',
        loai_don: '', // Initial loại đơn is EMPTY
        muc_dich: '',
        user_name: userNameFormatted,
        items: []
    };
    currentDraftNxItems = [];
    currentNxAttachments = [];
    renderNxAttachmentsUI();
    document.getElementById('nx-input-loai').value = ''; // Ban đầu để trống!
    document.getElementById('nx-input-madon').value = 'ĐƠN-NHÁP';
    document.getElementById('nx-input-mucdich').value = '';
    document.getElementById('nx-input-user').value = userNameFormatted;

    document.getElementById('nx-input-time').value = formatNxDateTime(new Date());

    renderNxDraftItemsTable();
    fetchNxOrderLogs(currentDraftOrder.ma_don);
    renderNhapXuatOrderList(filteredNhapXuatData);
    updateNxSaveButtonState(true);

    const scannerInput = document.getElementById('nx-qr-scanner-input');
    if (scannerInput) scannerInput.focus();
}


function generateRandom3Chars() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = '';
    for (let i = 0; i < 3; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
}

function getBranchCodeFromUser(userStr) {
    if (!userStr) return 'CN1';
    const match = userStr.match(/CN\d+/i);
    return match ? match[0].toUpperCase() : 'CN1';
}

function generateNextNxOrderCode(loai) {
    if (!loai) {
        currentDraftOrder.ma_don = 'ĐƠN-NHÁP';
        const codeInput = document.getElementById('nx-input-madon');
        if (codeInput) codeInput.value = 'ĐƠN-NHÁP';
        return;
    }

    const prefix = loai === 'Xuất' ? 'XK' : 'NK';
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const userName = document.getElementById('nx-input-user')?.value || currentDraftOrder.user_name || 'CN1';
    const branch = getBranchCodeFromUser(userName);
    const randomSuffix = generateRandom3Chars();

    const code = `${prefix}-${dateStr}-${branch}-${randomSuffix}`;

    currentDraftOrder.ma_don = code;
    const codeInput = document.getElementById('nx-input-madon');
    if (codeInput) codeInput.value = code;
}

// Web Audio API Scanner Beep (Sound on Success OK, NO Sound on Error)
function playScanSuccessSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
        console.warn("Scan sound error:", e);
    }
}

// Web Audio API Error Beep (âm thanh cảnh báo khi quét sai mã)
function playScanErrorSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        // 2 tiếng bíp ngắn, tone thấp xuống để báo lỗi
        const playBeep = (startTime, freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, startTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.6, startTime + 0.12);

            gain.gain.setValueAtTime(0.12, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.12);
        };

        playBeep(ctx.currentTime, 400);
        playBeep(ctx.currentTime + 0.15, 280);
    } catch (e) {
        console.warn("Scan error sound error:", e);
    }
}

// Text-To-Speech (TTS) Voice Counting on Valid Scan (Hô đếm số lượng 1, 2, 3, 4...)
function speakScanCount(count) {
    if ('speechSynthesis' in window) {
        try {
            window.speechSynthesis.cancel(); // Dừng ngay câu đọc trước đó để không bị trễ khi quét nhanh
            const utterance = new SpeechSynthesisUtterance(String(count));
            utterance.lang = 'vi-VN';
            utterance.rate = 1.3; // Đọc nhanh, dứt khoát
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
            return;
        } catch (e) {
            console.warn("Speech synthesis error:", e);
        }
    }
    // Fallback tiếng bíp nếu không hỗ trợ giọng nói
    playScanSuccessSound();
}



// Requirement: QR / Barcode Scanner Add & Parsing Logic
async function handleNxQrScannerAdd() {
    const scannerInput = document.getElementById('nx-qr-scanner-input');
    if (!scannerInput) return;

    const rawVal = scannerInput.value.trim();
    if (!rawVal) return;

    // 1. Tách chuỗi Mã QR dạng: "MãVạch;LOT;Date" (Ví dụ: 300000000630 hoặc 8935001234567;LOT202601;31/12/2026)
    const parts = rawVal.split(';');
    const ma_vach = parts[0] ? parts[0].trim() : rawVal;
    const lot = parts[1] ? parts[1].trim() : '-';
    let date_expiry = parts[2] ? parts[2].trim() : '';

    if (date_expiry) {
        date_expiry = formatDateForNx(date_expiry);
    }

    // 2. Truy xuất vào bảng Vật Tư (vatTuData / Supabase table 'san_pham') để lấy chính xác Tên Hàng Hóa & Mã Vạch
    let ten_hang_hoa = '';
    let matchedBarCode = ma_vach;

    // First: Search in-memory array vatTuData
    let allVatTu = [];
    if (typeof vatTuData !== 'undefined' && Array.isArray(vatTuData) && vatTuData.length > 0) {
        allVatTu = vatTuData;
    } else if (typeof window.vatTuData !== 'undefined' && Array.isArray(window.vatTuData) && window.vatTuData.length > 0) {
        allVatTu = window.vatTuData;
    }

    const queryLower = ma_vach.toLowerCase();
    let matchedVatTu = allVatTu.find(v => {
        const vCode = v.ma_vach ? String(v.ma_vach).trim().toLowerCase() : '';
        const vQr = v.ma_qr ? String(v.ma_qr).trim().toLowerCase() : '';
        const vName1 = v.ten_mat_hang ? String(v.ten_mat_hang).trim().toLowerCase() : '';
        const vName2 = v.ten_hoa_don ? String(v.ten_hoa_don).trim().toLowerCase() : '';

        return (vCode && vCode === queryLower) ||
               (vQr && vQr === queryLower) ||
               (vName1 && vName1 === queryLower) ||
               (vName2 && vName2 === queryLower);
    });

    // Second: If not found in memory, query Supabase table 'san_pham' directly!
    if (!matchedVatTu) {
        const client = getNhapXuatSupabaseClient();
        if (client) {
            try {
                const { data } = await client
                    .from('san_pham')
                    .select('*')
                    .or(`ma_vach.eq.${ma_vach},ten_mat_hang.ilike.${ma_vach}`)
                    .limit(1);

                if (data && data.length > 0) {
                    matchedVatTu = data[0];
                }
            } catch (e) {
                console.warn("NhapXuat: Error querying Supabase table san_pham:", e);
            }
        }
    }

    // REQUIREMENT: Nếu không tìm thấy mã vạch -> Báo lỗi + âm thanh cảnh báo
    if (!matchedVatTu) {
        playScanErrorSound(); // Bíp 2 tiếng báo quét sai
        if (typeof showVatTuNoticeModal === 'function') {
            showVatTuNoticeModal(
                'danger',
                'Mã Vạch Không Tồn Tại',
                `Mã vạch <strong>${escapeHtml(ma_vach)}</strong> không có trong danh mục kho Vật Tư!`
            );
        } else {
            alert(`Mã vạch "${ma_vach}" không tồn tại trong danh mục kho Vật Tư!`);
        }

        scannerInput.value = '';
        scannerInput.focus();
        return;
    }


    ten_hang_hoa = matchedVatTu.ten_mat_hang || matchedVatTu.ten_hoa_don || 'Vật tư y tế';
    matchedBarCode = matchedVatTu.ma_vach || ma_vach;

    const ma_qr = rawVal;
    const currentMaDon = document.getElementById('nx-input-madon')?.value || currentDraftOrder.ma_don || 'ĐƠN-NHÁP';
    const currentLoai = document.getElementById('nx-input-loai')?.value || currentDraftOrder.loai_don || 'Nhập';

    let scannedCount = 1;

    const isPendingOrder = currentDraftOrder.trang_thai === 'Chờ';

    // 3. Nếu quét 2 mã QR giống nhau (hoặc cùng mã vạch & LOT) -> Số lượng tự động cộng dồn lên dần (+1)
    let existingIndex = -1;
    if (isPendingOrder) {
        // Find exact match first
        existingIndex = currentDraftNxItems.findIndex(item => {
            return (item.ma_qr && item.ma_qr === ma_qr) || 
                   (item.ma_vach === matchedBarCode && item.lot === lot);
        });
        // If not found, find a matching barcode that hasn't been assigned a LOT yet ('-')
        if (existingIndex === -1) {
            existingIndex = currentDraftNxItems.findIndex(item => item.ma_vach === matchedBarCode && item.lot === '-');
        }
    } else {
        existingIndex = currentDraftNxItems.findIndex(item => {
            return (item.ma_qr && item.ma_qr === ma_qr) || 
                   (item.ma_vach === matchedBarCode && item.lot === lot);
        });
    }

    if (existingIndex !== -1) {
        const item = currentDraftNxItems[existingIndex];
        const oldQty = Number(item.so_luong) || 0;
        const newQty = oldQty + 1;
        
        if (isPendingOrder && item.so_luong_yeu_cau && newQty > item.so_luong_yeu_cau) {
            playScanErrorSound();
            if (typeof showVatTuNoticeModal === 'function') {
                showVatTuNoticeModal('warning', 'Quét Dư Số Lượng', `Sản phẩm <strong>${ten_hang_hoa}</strong> đã quét đủ số lượng yêu cầu (${item.so_luong_yeu_cau}). Dư thừa!`);
            } else {
                alert(`Sản phẩm ${ten_hang_hoa} đã quét đủ số lượng yêu cầu (${item.so_luong_yeu_cau}).`);
            }
            scannerInput.value = '';
            scannerInput.focus();
            return;
        }

        item.so_luong = newQty;
        scannedCount = newQty;

        if (isPendingOrder) {
            if (lot && lot !== '-') item.lot = lot;
            if (date_expiry) item.date_expiry = date_expiry;
        }

        logNxOrderAction(
            currentMaDon,
            currentLoai,
            'SỬA_SL',
            `Quét trùng mã -> Tự động tăng số lượng [${ten_hang_hoa}] từ ${oldQty} lên ${newQty}`
        );
    } else {
        if (isPendingOrder) {
            playScanErrorSound();
            if (typeof showVatTuNoticeModal === 'function') {
                showVatTuNoticeModal('danger', 'Sai Sản Phẩm', `Sản phẩm <strong>${ten_hang_hoa}</strong> không nằm trong đơn hóa đơn này!`);
            } else {
                alert(`Sản phẩm ${ten_hang_hoa} không nằm trong hóa đơn!`);
            }
            scannerInput.value = '';
            scannerInput.focus();
            return;
        }

        scannedCount = 1;
        currentDraftNxItems.push({
            ma_qr: ma_qr,
            ma_vach: matchedBarCode,
            lot: lot || '-',
            date_expiry: date_expiry || null,
            ten_hang_hoa: ten_hang_hoa,
            so_luong: 1
        });

        logNxOrderAction(
            currentMaDon,
            currentLoai,
            'THÊM_SP',
            `Thêm sản phẩm [${ten_hang_hoa}] (Mã vạch: ${matchedBarCode}, LOT: ${lot || '-'}) với số lượng 1`
        );
    }

    if (currentLoai === 'Xuất') {
        const userName = document.getElementById('nx-input-user')?.value || '';
        const branchCode = extractCNCodeFromBranchString(userName);
        const availableStock = getAvailableStockInNx(matchedBarCode, lot, date_expiry, branchCode, currentMaDon);
        const maxAllowed = Math.max(0, availableStock);

        if (scannedCount > maxAllowed) {
            playScanErrorSound();
            scannedCount = maxAllowed;

            if (existingIndex !== -1) {
                currentDraftNxItems[existingIndex].so_luong = maxAllowed;
            } else if (currentDraftNxItems.length > 0) {
                const target = currentDraftNxItems.find(x => x.ma_vach === matchedBarCode && (x.lot || '-') === (lot || '-'));
                if (target) target.so_luong = maxAllowed;
            }

            if (typeof showToast === 'function') {
                if (maxAllowed === 0) {
                    showToast('error', 'Đã Hết Hàng', `Mã ${matchedBarCode} (LOT: ${lot || '-'}) đã HẾT HÀNG ở ${branchCode}! Tự động nhảy về 0.`);
                } else {
                    showToast('warning', 'Chạm Mức Tồn Kho', `Mã ${matchedBarCode} (LOT: ${lot || '-'}) chỉ còn tồn ${availableStock} ở ${branchCode}. Đã tự vặn về ${maxAllowed}!`);
                }
            }
        }
    }

    // SUCCESS: Giọng nói đếm số lượng hiện tại của mặt hàng này (1, 2, 3, 4...)
    speakScanCount(scannedCount);

    scannerInput.value = '';
    scannerInput.focus();
    currentDraftOrder.items = currentDraftNxItems;
    saveNxDraftToStorage();
    renderNxDraftItemsTable();
    renderNhapXuatOrderList(filteredNhapXuatData);
    checkNxOrderModified();

}

// Render Draft Order Items Table
function renderNxDraftItemsTable() {
    const tbody = document.getElementById('nx-items-table-body');
    const emptyNotice = document.getElementById('nx-empty-items-notice');
    const totalQtyEl = document.getElementById('nx-summary-total-qty');

    if (!tbody) return;
    tbody.innerHTML = '';

    const totalRows = currentDraftNxItems ? currentDraftNxItems.length : 0;
    let totalQty = 0;

    if (!currentDraftNxItems || currentDraftNxItems.length === 0) {
        if (emptyNotice) emptyNotice.style.display = 'flex';
        if (totalQtyEl) totalQtyEl.innerHTML = 'Tổng 0 sản phẩm - Số Lượng: 0';
        return;
    }

    if (emptyNotice) emptyNotice.style.display = 'none';

    const currentLoai = document.getElementById('nx-input-loai')?.value || currentDraftOrder?.loai_don || 'Nhập';
    const userName = document.getElementById('nx-input-user')?.value || '';
    const branchCode = extractCNCodeFromBranchString(userName);
    const currentMaDon = document.getElementById('nx-input-madon')?.value || currentDraftOrder?.ma_don || 'ĐƠN-NHÁP';

    currentDraftNxItems.forEach((item, idx) => {
        const qty = Number(item.so_luong) || 0;
        totalQty += qty;

        const tr = document.createElement('tr');
        const nameEscaped = escapeHtml(item.ten_hang_hoa || '-');

        let barcodeStyle = '';
        let stockLabel = '';

        if (currentLoai === 'Xuất') {
            const availableStock = getAvailableStockInNx(item.ma_vach, item.lot, item.date_expiry, branchCode, currentMaDon);
            if (availableStock <= 0 || qty >= availableStock) {
                barcodeStyle = 'background: #ef4444 !important; color: #ffffff !important; font-weight: bold; border: 1px solid #dc2626; box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);';
            }
            stockLabel = `<span style="font-size: 11px; font-weight: 600; color: ${availableStock <= 0 ? '#ef4444' : '#f59e0b'}; line-height: 1.2; text-align: center; display: block; white-space: nowrap;">Tồn: ${availableStock}</span>`;
        }

        let qtyDisplay = `<input type="number" min="0" class="form-control-sm" style="width: 75px; text-align: right; font-weight: 700; color: #10b981;" value="${qty}" onchange="updateNxDraftItemQty(${idx}, this.value)">`;
        if (currentDraftOrder.trang_thai === 'Chờ' && item.so_luong_yeu_cau) {
            qtyDisplay = `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                            <span style="font-size: 11px; color: var(--text-muted);">Cần quét: <strong style="color: var(--text-primary);">${item.so_luong_yeu_cau}</strong></span>
                            <input type="number" min="0" max="${item.so_luong_yeu_cau}" class="form-control-sm" style="width: 75px; text-align: right; font-weight: 700; color: ${qty >= item.so_luong_yeu_cau ? '#10b981' : '#ef4444'};" value="${qty}" onchange="updateNxDraftItemQty(${idx}, this.value)">
                          </div>`;
        }

        tr.innerHTML = `
            <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
            <td style="text-align: center; vertical-align: middle;">
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 3px 0;">
                    <code class="vattu-barcode-code" style="margin: 0; text-align: center; ${barcodeStyle}">${escapeHtml(item.ma_vach || '-')}</code>
                    ${stockLabel}
                </div>
            </td>
            <td><span class="badge-lot">${escapeHtml(item.lot || '-')}</span></td>
            <td style="text-align: center;"><span class="badge-date">${formatDateForNx(item.date_expiry)}</span></td>
            <td style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${nameEscaped}">
                <strong style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nameEscaped}</strong>
            </td>
            <td style="text-align: right; vertical-align: middle;">
                ${qtyDisplay}
            </td>
            <td style="text-align: center;">
                <button type="button" class="btn-action-icon btn-delete-vattu" onclick="removeNxDraftItem(${idx})" title="Xóa khỏi đơn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (totalQtyEl) {
        totalQtyEl.innerHTML = `Tổng <strong style="color: #10b981; font-size: 15px;">${totalRows}</strong> sản phẩm - Số Lượng: <strong style="color: #10b981; font-size: 15px;">${totalQty.toLocaleString('vi-VN')}</strong>`;
    }
}

function updateNxDraftItemQty(idx, newQty) {
    const item = currentDraftNxItems[idx];
    if (!item) return;

    const oldQty = item.so_luong;
    const parsed = parseInt(newQty, 10);
    let finalQty = (isNaN(parsed) || parsed < 0) ? 0 : parsed;

    const isPendingOrder = currentDraftOrder && currentDraftOrder.trang_thai === 'Chờ';
    if (isPendingOrder && item.so_luong_yeu_cau && finalQty > item.so_luong_yeu_cau) {
        if (typeof showVatTuNoticeModal === 'function') {
            showVatTuNoticeModal('warning', 'Vượt Quá Yêu Cầu', `Sản phẩm đã vượt quá số lượng yêu cầu (${item.so_luong_yeu_cau}). Đã tự động điều chỉnh lại mức tối đa!`);
        } else {
            alert(`Sản phẩm đã vượt quá số lượng yêu cầu (${item.so_luong_yeu_cau}).`);
        }
        finalQty = item.so_luong_yeu_cau;
    }

    item.so_luong = finalQty;

    const currentMaDon = document.getElementById('nx-input-madon')?.value || currentDraftOrder?.ma_don || 'ĐƠN-NHÁP';
    const currentLoai = document.getElementById('nx-input-loai')?.value || currentDraftOrder?.loai_don || 'Nhập';
    const userName = document.getElementById('nx-input-user')?.value || '';
    const branchCode = extractCNCodeFromBranchString(userName);

    if (currentLoai === 'Xuất') {
        const availableStock = getAvailableStockInNx(item.ma_vach, item.lot, item.date_expiry, branchCode, currentMaDon);
        const maxAllowed = Math.max(0, availableStock);
        if (finalQty > maxAllowed) {
            playScanErrorSound();
            if (typeof showToast === 'function') {
                if (maxAllowed === 0) {
                    showToast('error', 'Đã Hết Hàng', `Mã ${item.ma_vach} (LOT: ${item.lot || '-'}) đã HẾT HÀNG ở ${branchCode}! Tự động nhảy về 0.`);
                } else {
                    showToast('warning', 'Tồn Kho Giới Hạn', `Mã ${item.ma_vach} (LOT: ${item.lot || '-'}) chỉ còn tồn ${availableStock} ở ${branchCode}. Đã tự vặn về ${maxAllowed}!`);
                }
            }
            finalQty = maxAllowed;
            item.so_luong = maxAllowed;
        }
    }

    logNxOrderAction(
        currentMaDon,
        currentLoai,
        'SỬA_SL',
        `Thay đổi số lượng [${item.ten_hang_hoa || 'Sản phẩm'}] từ ${oldQty} thành ${finalQty}`
    );

    currentDraftOrder.items = currentDraftNxItems;
    saveNxDraftToStorage();
    renderNxDraftItemsTable();
    renderNhapXuatOrderList(filteredNhapXuatData);
    checkNxOrderModified();
}

function removeNxDraftItem(idx) {
    const item = currentDraftNxItems[idx];
    if (!item) return;

    currentDraftNxItems.splice(idx, 1);

    const currentMaDon = document.getElementById('nx-input-madon')?.value || currentDraftOrder.ma_don || 'ĐƠN-NHÁP';
    const currentLoai = document.getElementById('nx-input-loai')?.value || currentDraftOrder.loai_don || 'Nhập';

    logNxOrderAction(
        currentMaDon,
        currentLoai,
        'XÓA_SP',
        `Đã xóa sản phẩm [${item.ten_hang_hoa || 'Hàng hóa'}] khỏi đơn`
    );

    currentDraftOrder.items = currentDraftNxItems;
    saveNxDraftToStorage();
    renderNxDraftItemsTable();
    renderNhapXuatOrderList(filteredNhapXuatData);
    checkNxOrderModified();
}

function resetNxOrderForm() {
    clearNxDraftStorage();
    createNewNhapXuatOrderForm();
}

// Generic Confirm Modal Helper
function showGenericConfirmModal(badgeText, title, textHtml, subtextHtml, badgeColor, okBtnText, onConfirmCallback) {
    const modal = document.getElementById('generic-confirm-modal');
    if (!modal) {
        // Fallback to native confirm if modal doesn't exist
        const isConfirmed = confirm(`${title}\n\n${textHtml.replace(/<[^>]*>?/gm, '')}`);
        if (isConfirmed && typeof onConfirmCallback === 'function') onConfirmCallback();
        return;
    }

    const badge = document.getElementById('generic-confirm-badge');
    if (badge) {
        badge.textContent = badgeText;
        badge.style.color = badgeColor;
        badge.style.background = `${badgeColor}26`;
        badge.style.borderColor = `${badgeColor}33`;
    }

    const titleEl = document.getElementById('generic-confirm-title');
    if (titleEl) titleEl.textContent = title;

    const textEl = document.getElementById('generic-confirm-text');
    if (textEl) textEl.innerHTML = textHtml;

    const subtextEl = document.getElementById('generic-confirm-subtext');
    if (subtextEl) subtextEl.innerHTML = subtextHtml;

    const okBtn = document.getElementById('btn-generic-confirm-ok');
    if (okBtn) {
        okBtn.textContent = okBtnText;
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        newOkBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            modal.classList.remove('show');
            if (typeof onConfirmCallback === 'function') onConfirmCallback();
        });
    }

    const cancelBtn = document.getElementById('btn-generic-confirm-cancel');
    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            modal.classList.remove('show');
        });
    }

    // Force show - override any inline display:none
    modal.style.setProperty('display', 'flex', 'important');
    
    // Add show class slightly after display:flex to trigger transition
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

function closeGenericConfirmModal() {
    const modal = document.getElementById('generic-confirm-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}

// Requirement: Save / Update Order & AUTOMATICALLY SYNC TO THẺ KHO (the_kho)
async function saveNxOrderToSystem() {
    const loaiSelect = document.getElementById('nx-input-loai');
    const loaiDon = loaiSelect ? loaiSelect.value : '';

    if (!loaiDon) {
        if (typeof showVatTuNoticeModal === 'function') {
            showVatTuNoticeModal('warning', 'Chưa Chọn Loại Đơn', 'Vui lòng chọn Loại đơn (Nhập kho hoặc Xuất kho) trước khi lưu!');
        } else {
            alert('Vui lòng chọn Loại đơn (Nhập kho hoặc Xuất kho) trước khi lưu!');
        }
        if (loaiSelect) loaiSelect.focus();
        return;
    }

    const managerBranchSelect = document.getElementById('nx-manager-branch-select');
    const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
    const isManager = (typeof window.isManagerRole === 'function') ? window.isManagerRole(loggedUser) : false;

    if (selectedNxOrderId === null && isManager && managerBranchSelect && managerBranchSelect.style.display !== 'none' && !managerBranchSelect.value) {
        if (typeof showVatTuNoticeModal === 'function') {
            showVatTuNoticeModal('warning', 'Chưa Chọn Chi Nhánh', 'Vui lòng chọn Chi Nhánh thực hiện đơn kho trước khi lưu!');
        } else if (typeof showToast === 'function') {
            showToast('warning', 'Chưa Chọn Chi Nhánh', 'Vui lòng chọn Chi Nhánh thực hiện đơn kho trước khi lưu!');
        } else {
            alert('Vui lòng chọn Chi Nhánh thực hiện đơn kho trước khi lưu!');
        }
        managerBranchSelect.focus();
        return;
    }


    if (!currentDraftNxItems || currentDraftNxItems.length === 0) {
        if (typeof showVatTuNoticeModal === 'function') {
            showVatTuNoticeModal('warning', 'Chưa Có Sản Phẩm', 'Vui lòng quét QR hoặc nhập sản phẩm vào đơn trước khi lưu!');
        } else {
            alert('Vui lòng quét QR hoặc nhập sản phẩm vào đơn trước khi lưu!');
        }
        return;
    }

    const maDon = document.getElementById('nx-input-madon')?.value || '';
    const mucDichInput = document.getElementById('nx-input-mucdich');
    const mucDich = mucDichInput ? mucDichInput.value.trim() : '';

    if (!mucDich) {
        if (typeof showVatTuNoticeModal === 'function') {
            showVatTuNoticeModal('warning', 'Thiếu Mục Đích', 'Vui lòng nhập Mục đích / Ghi chú cho đơn kho!');
        } else {
            alert('Vui lòng nhập Mục đích / Ghi chú cho đơn kho!');
        }
        if (mucDichInput) mucDichInput.focus();
        return;
    }

    // NEW: For pending orders ('Chờ'), ALL items must be fully scanned before saving!
    const isPendingOrder = currentDraftOrder && currentDraftOrder.trang_thai === 'Chờ';
    if (isPendingOrder) {
        let isFullyScanned = true;
        for (const item of currentDraftNxItems) {
            const req = item.so_luong_yeu_cau || 0;
            const scanned = item.so_luong || 0;
            if (req > 0 && scanned < req) {
                isFullyScanned = false;
                break;
            }
        }
        
        if (!isFullyScanned) {
            if (typeof showVatTuNoticeModal === 'function') {
                showVatTuNoticeModal('warning', 'Chưa Quét Đủ', 'Đơn hàng yêu cầu quét ĐỦ SỐ LƯỢNG tất cả sản phẩm mới được phép Cập Nhật!');
            } else {
                alert('Đơn hàng yêu cầu quét ĐỦ SỐ LƯỢNG tất cả sản phẩm mới được phép Cập Nhật!');
            }
            return;
        }
    }

    const userName = document.getElementById('nx-input-user')?.value || 'Thái Trung Tín - CN1';
    
    // NEW: Prevent negative stock for 'Xuất' orders
    if (loaiDon === 'Xuất' && currentDraftNxItems.length > 0) {
        const branchCode = extractCNCodeFromBranchString(userName);
        const client = getNhapXuatSupabaseClient();
        if (client) {
            const maVachList = currentDraftNxItems.map(x => x.ma_vach).filter(Boolean);
            if (maVachList.length > 0) {
                const { data: theKhoDataDb, error: tkError } = await client
                    .from('the_kho')
                    .select('ma_don, ma_vach, lot, date_expiry, loai, so_luong, user_name')
                    .in('ma_vach', maVachList);
                    
                if (!tkError && theKhoDataDb) {
                    const branchData = theKhoDataDb.filter(x => extractCNCodeFromBranchString(x.user_name) === branchCode && x.ma_don !== maDon);
                    
                    for (const item of currentDraftNxItems) {
                        const scannedQty = Number(item.so_luong) || 0;
                        if (scannedQty <= 0) continue;
                        
                        const lot = item.lot || '-';
                        const date_expiry = item.date_expiry ? parseDateToYyyyMmDd(item.date_expiry) : null;
                        
                        let currentStock = 0;
                        for (const tk of branchData) {
                            if (tk.ma_vach === item.ma_vach && (tk.lot || '-') === lot) {
                                const tkDate = tk.date_expiry ? parseDateToYyyyMmDd(tk.date_expiry) : null;
                                if (tkDate === date_expiry) {
                                    if (tk.loai === 'Nhập') currentStock += Number(tk.so_luong);
                                    else if (tk.loai === 'Xuất') currentStock -= Number(tk.so_luong);
                                }
                            }
                        }
                        
                        if (currentStock < scannedQty) {
                            if (typeof showVatTuNoticeModal === 'function') {
                                showVatTuNoticeModal('error', 'Lỗi Xuất Âm', `Mã <strong>${item.ma_vach}</strong> (LOT: ${lot}) chỉ còn tồn <strong>${currentStock}</strong> ở ${branchCode}, không thể xuất <strong>${scannedQty}</strong>!`);
                            } else {
                                alert(`Mã ${item.ma_vach} (LOT: ${lot}) chỉ còn tồn ${currentStock} ở ${branchCode}, không thể xuất ${scannedQty}!`);
                            }
                            return;
                        }
                    }
                }
            }
        }
    }

    const tongSoLuong = currentDraftNxItems.reduce((acc, x) => acc + (Number(x.so_luong) || 0), 0);

    let finalFileUrl = null;
    if (currentNxAttachments && currentNxAttachments.length > 0) {
        if (currentNxAttachments.length === 1) {
            finalFileUrl = currentNxAttachments[0].url;
        } else {
            finalFileUrl = JSON.stringify(currentNxAttachments);
        }
    }

    const orderPayload = {
        ma_don: maDon,
        loai_don: loaiDon,
        muc_dich: mucDich,
        user_name: userName,
        chi_tiet_san_pham: currentDraftNxItems,
        tong_so_luong: tongSoLuong,
        file_url: finalFileUrl
    };

    const client = getNhapXuatSupabaseClient();
    let saveSuccess = false;

    if (selectedNxOrderId !== null) {
        // ==========================================
        // UPDATE EXISTING SAVED ORDER (selectedNxOrderId)
        // ==========================================
        if (typeof hasUnsavedNxChanges === 'function' && !hasUnsavedNxChanges()) {
            if (typeof showToast === 'function') {
                showToast('warning', 'Chưa Có Thay Đổi', 'Đơn kho này chưa có bất kỳ sự thay đổi nào để cập nhật!');
            }
            return;
        }

        showGenericConfirmModal(
            'XÁC NHẬN',
            'Cập Nhật Đơn Kho',
            `Bạn có chắc chắn muốn CẬP NHẬT thông tin đơn kho [<strong>${maDon}</strong>] không?`,
            'Hành động này sẽ thay thế dữ liệu cũ trong Thẻ Kho.',
            '#f59e0b',
            'Cập Nhật',
            async () => {
                const updatePayload = {
                    loai_don: loaiDon,
                    muc_dich: mucDich,
                    user_name: userName,
                    chi_tiet_san_pham: currentDraftNxItems,
                    tong_so_luong: tongSoLuong,
                    file_url: finalFileUrl
                };

                if (isPendingOrder) {
                    updatePayload.trang_thai = 'Done';
                }

                try {
                    if (client) {
                        // Update Supabase row matching ma_don or ID
                        const { error: err1 } = await client
                            .from('nhap_xuat')
                            .update(updatePayload)
                            .eq('ma_don', maDon);

                        if (err1) {
                            console.warn("NhapXuat: Error updating by ma_don, trying by ID:", err1.message);
                            await client
                                .from('nhap_xuat')
                                .update(updatePayload)
                                .eq('id', selectedNxOrderId);
                        }
                    }

                    const idx = nhapXuatData.findIndex(x => String(x.id) === String(selectedNxOrderId) || x.ma_don === maDon);
                    if (idx !== -1) {
                        nhapXuatData[idx] = { ...nhapXuatData[idx], ...updatePayload, ma_don: maDon };
                    }
                    saveSuccess = true;
                } catch (err) {
                    console.error("NhapXuat: Error updating order:", err);
                    const idx = nhapXuatData.findIndex(x => String(x.id) === String(selectedNxOrderId) || x.ma_don === maDon);
                    if (idx !== -1) {
                        nhapXuatData[idx] = { ...nhapXuatData[idx], ...updatePayload, ma_don: maDon };
                    }
                    saveSuccess = true;
                }

                // Re-sync to Thẻ Kho (pass isUpdate = true to clean up old entries and re-insert)
                await syncNxOrderToTheKhoEntries({ ...updatePayload, ma_don: maDon, created_at: new Date().toISOString() }, true);

                if (saveSuccess) {
                    logNxOrderAction(
                        maDon,
                        loaiDon,
                        'CẬP_NHẬT_ĐƠN',
                        `Cập nhật đơn kho ${maDon} (${loaiDon} kho) thành công với ${currentDraftNxItems.length} mặt hàng (Tổng SL: ${tongSoLuong})`
                    );

                    if (typeof showVatTuNoticeModal === 'function') {
                        showVatTuNoticeModal(
                            'success',
                            'Cập Nhật Thành Công',
                            `Đã cập nhật đơn kho <strong>${escapeHtml(maDon)}</strong> thành công và đồng bộ vào Nhật ký Thẻ Kho!`
                        );
                    }

                    originalOrderStateSnapshot = JSON.stringify({
                        loai_don: loaiDon,
                        muc_dich: mucDich,
                        items: currentDraftNxItems
                    });

                    renderNxDraftItemsTable();
                    applyNhapXuatFilters();
                    renderNhapXuatOrderList(filteredNhapXuatData);
                    updateNxSaveButtonState(false); // Dim button after successful update!
                }
            }
        );
    } else {
        // ==========================================
        // CREATE NEW ORDER (selectedNxOrderId === null)
        // ==========================================
        orderPayload.ngay_tao = new Date().toISOString();
        orderPayload.created_at = new Date().toISOString();

        try {
            if (client) {
                const { data, error } = await client
                    .from('nhap_xuat')
                    .insert([orderPayload])
                    .select();

                if (error) {
                    console.warn("NhapXuat: Supabase save error, storing locally:", error.message);
                    nhapXuatData.unshift({ ...orderPayload, id: Date.now() });
                } else if (data && data[0]) {
                    nhapXuatData.unshift(data[0]);
                }
                saveSuccess = true;
            } else {
                nhapXuatData.unshift({ ...orderPayload, id: Date.now() });
                saveSuccess = true;
            }
        } catch (err) {
            console.error("NhapXuat: Error saving order:", err);
            nhapXuatData.unshift({ ...orderPayload, id: Date.now() });
            saveSuccess = true;
        }

        // AUTOMATICALLY CREATE THẺ KHO (the_kho) ENTRIES FOR ALL ITEMS IN ORDER
        await syncNxOrderToTheKhoEntries(orderPayload, false);

        if (saveSuccess) {
            logNxOrderAction(
                maDon,
                loaiDon,
                'TẠO_ĐƠN',
                `Lưu phiếu ${maDon} (${loaiDon} kho) thành công với ${currentDraftNxItems.length} mặt hàng (tổng số lượng: ${tongSoLuong})`
            );

            if (typeof showVatTuNoticeModal === 'function') {
                showVatTuNoticeModal(
                    'success',
                    'Lưu Đơn Thành Công',
                    `Đã lưu phiếu <strong>${escapeHtml(maDon)}</strong> (${loaiDon} kho) và tự động đồng bộ <strong>${currentDraftNxItems.length} sản phẩm</strong> vào Nhật ký Thẻ Kho!`
                );
            }

            clearNxDraftStorage();
            applyNhapXuatFilters();
            createNewNhapXuatOrderForm();
        }
    }
}

// Helper: Chuẩn hóa ngày thành YYYY-MM-DD để khớp với kiểu DATE của PostgreSQL table 'the_kho'
async function deletePendingNxOrder() {
    if (!selectedNxOrderId || !currentDraftOrder || currentDraftOrder.trang_thai !== 'Chờ') return;
    
    showGenericConfirmModal(
        'XÁC NHẬN XÓA',
        'Xóa Đơn Chờ',
        `Bạn có chắc chắn muốn xóa đơn <strong>${currentDraftOrder.ma_don}</strong> không?`,
        'Đơn này chưa được quét hoàn tất, bạn có thể xóa nó. Hành động này không thể hoàn tác.',
        '#ef4444',
        'Xóa Đơn',
        async () => {
            try {
                const client = getNhapXuatSupabaseClient();
                if (!client) throw new Error("Supabase client not initialized");
                
                const { error } = await client.from('nhap_xuat').delete().eq('id', selectedNxOrderId);
                if (error) throw error;
                
                if (typeof showToast === 'function') {
                    showToast('success', 'Đã Xóa', `Đã xóa đơn ${currentDraftOrder.ma_don} thành công!`);
                }
                
                await fetchNhapXuatData();
                createNewNhapXuatOrderForm(false);
            } catch (err) {
                console.error("Lỗi xóa đơn:", err);
                if (typeof showToast === 'function') {
                    showToast('error', 'Lỗi', 'Có lỗi xảy ra khi xóa đơn!');
                }
            }
        }
    );
}
window.deletePendingNxOrder = deletePendingNxOrder;

function parseDateToYyyyMmDd(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr === 'null' || dateStr === 'undefined') return null;
    let str = String(dateStr).trim();
    if (!str) return null;

    // Định dạng DD/MM/YYYY (ví dụ: 31/12/2026)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
        const parts = str.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }

    // Định dạng YYYY-MM-DD (ví dụ: 2026-12-31)
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.substring(0, 10);
    }

    try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    } catch (e) {}

    return null;
}

// Sync Nx Order Items to Thẻ Kho (the_kho) Table in Supabase
async function syncNxOrderToTheKhoEntries(order, isUpdate = false) {
    const maDon = order.ma_don || '';
    const normalizedLoai = (order.loai_don && String(order.loai_don).includes('Xuất')) ? 'Xuất' : 'Nhập';

    const theKhoEntries = (order.chi_tiet_san_pham || [])
        .filter(item => Number(item.so_luong) > 0)
        .map(item => ({
            ma_don: maDon,
            ma_qr: item.ma_qr || item.ma_vach || '',
            ma_vach: item.ma_vach || item.ma_qr || 'KHONG-MA',
            lot: item.lot || '-',
            date_expiry: parseDateToYyyyMmDd(item.date_expiry),
            ten_hang_hoa: item.ten_hang_hoa || 'Sản phẩm kho',
            loai: normalizedLoai, // Khớp chính xác CHECK (loai IN ('Nhập', 'Xuất'))
            so_luong: Number(item.so_luong),
            muc_dich: order.muc_dich || '',
            user_name: order.user_name || 'Thái Trung Tín - CN1',
            created_at: new Date().toISOString()
        }));

    const client = getNhapXuatSupabaseClient();
    try {
        if (client) {
            // If updating an existing order, clean up previous Thẻ Kho entries for this order first
            if (isUpdate && maDon) {
                const { error: delErr } = await client
                    .from('the_kho')
                    .delete()
                    .eq('ma_don', maDon);

                if (delErr) {
                    console.warn("NhapXuat: Error deleting old the_kho entries by ma_don:", delErr.message);
                    await client.from('the_kho').delete().ilike('muc_dich', `%${maDon}%`);
                }
            }

            if (theKhoEntries.length === 0) return;

            const { error: insErr } = await client.from('the_kho').insert(theKhoEntries);
            if (insErr) {
                console.error("NhapXuat: Error inserting the_kho entries:", insErr.message, insErr.details);
            } else {
                console.log(`NhapXuat: Synced ${theKhoEntries.length} items to Thẻ Kho (ma_don: ${maDon}) successfully.`);
            }
        }
    } catch (e) {
        console.error("NhapXuat: Exception syncing to the_kho:", e);
    }

    // Trigger realtime refresh on Thẻ Kho and Vật Tư / Kiểm Kho modules
    if (typeof fetchTheKhoData === 'function') {
        fetchTheKhoData();
    }
    if (typeof fetchVatTuData === 'function') {
        fetchVatTuData();
    }
}


// Helpers
function formatNxDateTime(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}`;
    } catch (e) {
        return dateStr;
    }
}

function formatDateForNx(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateStr;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Global Window Exports
window.fetchNhapXuatData = fetchNhapXuatData;
window.createNewNhapXuatOrderForm = createNewNhapXuatOrderForm;
window.applyNhapXuatFilters = applyNhapXuatFilters;
window.handleNxQrScannerAdd = handleNxQrScannerAdd;

// =========================================================================
// PDF Invoice Import Feature
// =========================================================================
async function handleNhapXuatPdfUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (typeof window.pdfjsLib === 'undefined') {
        alert("Thư viện PDF chưa tải xong hoặc bị chặn, vui lòng tải lại trang.");
        return;
    }

    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    let successCount = 0;
    let duplicateCount = 0;
    
    // Show loading
    showGenericConfirmModal('⏳ ĐANG XỬ LÝ', 'Đang đọc File PDF', `Vui lòng đợi, đang bóc tách dữ liệu từ ${files.length} hóa đơn...`, '', '#3b82f6', null, null);
    const modalBtn = document.getElementById('generic-confirm-btn');
    if (modalBtn) modalBtn.style.display = 'none'; // hide confirm button while loading
    const cancelBtn = document.getElementById('generic-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';

    try {
        let userNameFormatted = updateNxUserFieldWithBranch();
        let branchCode = extractCNCodeFromBranchString(userNameFormatted);
        if (!branchCode) {
            const bSelect = document.getElementById('nx-manager-branch-select');
            if (bSelect && bSelect.value) {
                branchCode = extractCNCodeFromBranchString(bSelect.value);
            }
        }
        if (!branchCode) branchCode = 'CN1';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            // Re-extract using the raw strings directly to keep line structure
            let rawLines = [];
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                let lastY = -1;
                let currentLine = '';
                textContent.items.forEach(item => {
                    if (lastY !== item.transform[5] && lastY !== -1) {
                        rawLines.push(currentLine.trim());
                        currentLine = '';
                    }
                    currentLine += item.str + ' ';
                    lastY = item.transform[5];
                });
                if (currentLine) rawLines.push(currentLine.trim());
            }

            const fullTextFromLines = rawLines.join('\n');

            // 1. Extract Invoice Number (Số hóa đơn | Mã HĐ : SPXXXXX)
            const maHoaDonMatch = fullTextFromLines.match(/(?:Số hóa đơn|Mã HĐ)\s*:\s*(SP\d+)/i);
            const maHoaDon = maHoaDonMatch ? maHoaDonMatch[1] : `HD-${Date.now()}`;

            // Check Duplicate by Invoice Number
            const isDuplicate = typeof nhapXuatData !== 'undefined' && nhapXuatData.some(order => order.muc_dich && order.muc_dich.includes(maHoaDon));
            if (isDuplicate) {
                duplicateCount++;
                console.log(`Bỏ qua hóa đơn ${maHoaDon} vì đã tồn tại.`);
                if (typeof showToast === 'function') {
                    showToast('error', 'Đơn đã xuất', `Hóa đơn ${maHoaDon} đã tồn tại trong hệ thống!`);
                }
                continue;
            }

            // 2. Extract Pet Name (Tên thú cưng | Thú cưng : Quýt)
            const petNameMatch = fullTextFromLines.match(/(?:Tên thú cưng|Thú cưng)\s*:\s*([^\n]+)/i);
            const petName = petNameMatch ? petNameMatch[1].trim() : 'Không Tên';

            // 3. Extract items
            const items = [];
            
            for (let j = 0; j < rawLines.length; j++) {
                let line = rawLines[j].trim();
                if (!line) continue;
                
                // Loại bỏ số thứ tự đứng đầu nếu có (VD: "1. Tên SP" -> "Tên SP")
                line = line.replace(/^\d+[\.\-]\s+/, '');
                
                let currentItemName = line;
                
                // Kiểm tra xem dòng tiếp theo CÓ PHẢI LÀ DÒNG CHỨA SỐ KHÔNG (Giá, SL, Thành tiền)
                if (j + 1 < rawLines.length) {
                    const nextLine = rawLines[j+1].trim();
                    // Nếu dòng tiếp theo chứa chủ yếu là số, dấu phẩy, dấu chấm và khoảng trắng
                    if (/^[\d,\.\s]+$/.test(nextLine)) {
                        const numbers = nextLine.replace(/,/g, '').match(/\d+/g);
                        if (numbers && numbers.length >= 2) {
                            let qty = 1;
                            if (numbers.length >= 3) {
                                qty = parseInt(numbers[1]); // Giá [Số Lượng] ThànhTien
                            } else {
                                qty = parseInt(numbers[0]); // Fallback
                            }
                            
                            // Try to match currentItemName with vatTuData
                            let matchedVatTu = null;
                            if (typeof window.vatTuData !== 'undefined') {
                                matchedVatTu = window.vatTuData.find(vt => {
                                    const t = (vt.ten_mat_hang || vt.ten_hoa_don || '').toLowerCase();
                                    const query = currentItemName.toLowerCase();
                                    // So sánh 2 chiều, hoặc loại bỏ các hậu tố "- Túi", "- Lon"
                                    const cleanQuery = query.replace(/\s*-\s*(túi|lon|chai|gói|hộp|tuýp|viên)$/i, '');
                                    return t.includes(cleanQuery) || cleanQuery.includes(t) || t.includes(query) || query.includes(t);
                                });
                            }
                            
                            if (matchedVatTu) {
                                items.push({
                                    ma_qr: matchedVatTu.ma_vach || '',
                                    ma_vach: matchedVatTu.ma_vach || '',
                                    lot: '-',
                                    ten_hang_hoa: matchedVatTu.ten_mat_hang || matchedVatTu.ten_hoa_don,
                                    so_luong_yeu_cau: qty,
                                    so_luong: 0 // Đã quét = 0
                                });
                            }
                        }
                    }
                }
            }

            if (items.length > 0) {
                // Upload file to Supabase Storage bucket 'invoice_pdfs'
                let file_url = null;
                const fileName = `HD-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
                const { data: uploadData, error: uploadError } = await supabaseClient.storage
                    .from('invoice_pdfs')
                    .upload(fileName, file, { cacheControl: '3600', upsert: false });

                if (!uploadError && uploadData) {
                    const { data: publicUrlData } = supabaseClient.storage
                        .from('invoice_pdfs')
                        .getPublicUrl(fileName);
                    if (publicUrlData) {
                        file_url = publicUrlData.publicUrl;
                    }
                }

                // Generate standard Order ID (e.g. XK-20260902-CN1-XYZ)
                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}${mm}${dd}`;
                const randomSuffix = generateRandom3Chars();
                const maDon = `XK-${dateStr}-${branchCode}-${randomSuffix}`;
                
                const payload = {
                    ma_don: maDon,
                    loai_don: 'Xuất',
                    muc_dich: `${maHoaDon} - ${petName}`,
                    trang_thai: 'Chờ',
                    file_url: file_url,
                    user_name: userNameFormatted,
                    chi_tiet_san_pham: items,
                    tong_so_luong: items.reduce((acc, curr) => acc + curr.so_luong_yeu_cau, 0)
                };

                const { data, error } = await supabaseClient.from('nhap_xuat').insert([payload]);
                if (error) {
                    console.error("Error creating order from PDF:", error);
                } else {
                    // Create Log
                    await supabaseClient.from('nhap_xuat_log').insert([{
                        ma_don: maDon,
                        loai_don: 'Xuất',
                        hanh_dong: 'TẠO_ĐƠN',
                        noi_dung: `Tạo đơn tự động từ Hóa Đơn PDF (${maHoaDon} - ${petName}) gồm ${items.length} mã sản phẩm.`,
                        user_name: userNameFormatted
                    }]);
                    successCount++;
                }
            }
        }
        
        closeGenericConfirmModal();
        if (successCount > 0) {
            setTimeout(() => {
                if (typeof showToast === 'function') {
                    showToast('success', 'Tạo Đơn Thành Công', `Đã tạo thành công ${successCount} đơn xuất kho (Trạng thái: Chờ) từ File PDF.`);
                } else {
                    alert(`Đã tạo thành công ${successCount} đơn xuất kho (Trạng thái: Chờ) từ File PDF.`);
                }
                fetchNhapXuatData();
            }, 300);
        } else if (duplicateCount === 0) {
            setTimeout(() => {
                if (typeof showToast === 'function') {
                    showToast('error', 'Lỗi Dữ Liệu', 'Không tìm thấy sản phẩm hợp lệ nào trong File PDF (Có thể là Dịch vụ hoặc Tên SP không khớp kho).');
                } else {
                    alert(`Không tìm thấy sản phẩm hợp lệ nào trong File PDF (Có thể là Dịch vụ hoặc Tên SP không khớp kho).`);
                }
            }, 300);
        }

    } catch (error) {
        console.error("PDF Parse error", error);
        closeGenericConfirmModal();
        if (typeof showToast === 'function') {
            showToast('error', 'Lỗi', 'Có lỗi xảy ra khi đọc file PDF.');
        } else {
            alert("Có lỗi xảy ra khi đọc file PDF.");
        }
    }

    event.target.value = ''; // reset input
}

async function markNxOrderAsDone() {
    if (!selectedNxOrderId) return;
    
    // Check if fully scanned
    let isFullyScanned = true;
    for (const item of currentDraftNxItems) {
        const req = item.so_luong_yeu_cau || 0;
        const scanned = item.so_luong || 0;
        if (req > 0 && scanned < req) {
            isFullyScanned = false;
            break;
        }
    }

    if (!isFullyScanned) {
        const cf = confirm("Đơn này chưa quét đủ số lượng yêu cầu. Bạn có chắc chắn muốn hoàn tất Đơn?");
        if (!cf) return;
    }

    try {
        const { error } = await supabaseClient
            .from('nhap_xuat')
            .update({ trang_thai: 'Done', chi_tiet_san_pham: currentDraftNxItems })
            .eq('id', selectedNxOrderId);

        if (error) throw error;

        // Log action
        const currentUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
        let userNameFormatted = currentUser ? currentUser.ho_ten || currentUser.email : 'Hệ Thống';
        await supabaseClient.from('nhap_xuat_log').insert([{
            ma_don: document.getElementById('nx-input-madon').value,
            loai_don: document.getElementById('nx-input-loai').value,
            hanh_dong: 'CẬP_NHẬT_ĐƠN',
            noi_dung: `Đánh dấu Đơn đã hoàn tất (Done).`,
            user_name: userNameFormatted
        }]);

        alert("Đã hoàn tất đơn hàng!");
        
    } catch (e) {
        console.error("Error marking done:", e);
        alert("Lỗi khi cập nhật trạng thái đơn.");
    }
}

// =========================================================================
// MULTI-FILE ATTACHMENT SYSTEM FOR NHAP XUAT ORDERS
// =========================================================================
let currentNxAttachments = [];

function getNxFileIcon(fileNameOrUrl) {
    if (!fileNameOrUrl) return '📄';
    const str = String(fileNameOrUrl).toLowerCase();
    
    if (str.endsWith('.xlsx') || str.endsWith('.xls') || str.endsWith('.csv') || str.includes('excel')) {
        return '🟢'; // Excel icon
    }
    if (str.endsWith('.docx') || str.endsWith('.doc') || str.includes('word')) {
        return '📘'; // Word icon
    }
    if (str.endsWith('.pdf')) {
        return '📕'; // PDF icon
    }
    if (str.endsWith('.png') || str.endsWith('.jpg') || str.endsWith('.jpeg') || str.endsWith('.webp') || str.endsWith('.gif') || str.endsWith('.svg')) {
        return '🖼️'; // Image icon
    }
    if (str.endsWith('.zip') || str.endsWith('.rar') || str.endsWith('.7z')) {
        return '📦'; // Archive icon
    }
    if (str.endsWith('.txt') || str.endsWith('.sql') || str.endsWith('.json')) {
        return '📑'; // Document text icon
    }
    return '📄';
}

function renderNxAttachmentsUI() {
    const dropzone = document.getElementById('nx-attach-dropzone');
    const label = document.getElementById('nx-attach-count-label');
    const menu = document.getElementById('nx-attach-file-menu');
    const fileListEl = document.getElementById('nx-attach-file-list');

    if (!dropzone || !label) return;

    const count = currentNxAttachments.length;

    if (count === 0) {
        label.innerHTML = `📎 Đính kèm File`;
        dropzone.title = `Click để chọn file, Kéo thả hoặc Dán (Ctrl+V) để đính kèm`;
        dropzone.style.background = 'rgba(59, 130, 246, 0.08)';
        dropzone.style.color = '#3b82f6';
        dropzone.style.borderColor = 'rgba(59, 130, 246, 0.4)';
        if (menu) menu.style.display = 'none';
    } else if (count === 1) {
        const fileObj = currentNxAttachments[0];
        const rawName = fileObj.name || 'File Hóa Đơn';
        const fileIcon = getNxFileIcon(rawName);
        const truncateName = rawName.length > 14 ? rawName.substring(0, 12) + '...' : rawName;
        label.innerHTML = `${fileIcon} ${escapeHtml(truncateName)} <span onclick="event.stopPropagation(); removeNxAttachment(0);" style="color:#ef4444; margin-left:4px; font-weight:700; cursor:pointer;" title="Xóa file này">✕</span>`;
        dropzone.title = `Click để mở/tải file: ${rawName}`;
        dropzone.style.background = 'rgba(16, 185, 129, 0.12)';
        dropzone.style.color = '#10b981';
        dropzone.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        if (menu) menu.style.display = 'none';
    } else {
        label.innerHTML = `📎 File đính kèm (${count}) ▾`;
        dropzone.title = `Click để xem danh sách ${count} file đính kèm`;
        dropzone.style.background = 'rgba(59, 130, 246, 0.15)';
        dropzone.style.color = '#3b82f6';
        dropzone.style.borderColor = '#3b82f6';
    }

    if (fileListEl) {
        fileListEl.innerHTML = '';
        currentNxAttachments.forEach((f, idx) => {
            const icon = getNxFileIcon(f.name || f.url);
            const itemEl = document.createElement('div');
            itemEl.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; background: rgba(255,255,255,0.05); border-radius: 6px;';
            itemEl.innerHTML = `
                <a href="${escapeHtml(f.url)}" target="_blank" style="color: #3b82f6; text-decoration: none; font-size: 11.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;" title="${escapeHtml(f.name)}">${icon} ${escapeHtml(f.name)}</a>
                <button type="button" onclick="removeNxAttachment(${idx})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 13px; font-weight: bold; padding: 0 4px;" title="Xóa file này">✕</button>
            `;
            fileListEl.appendChild(itemEl);
        });
    }
}

function handleNxAttachmentBtnClick(event) {
    const count = currentNxAttachments.length;
    const menu = document.getElementById('nx-attach-file-menu');

    if (count === 0) {
        document.getElementById('nx-attach-file-input')?.click();
    } else if (count === 1) {
        if (currentNxAttachments[0]?.url) {
            window.open(currentNxAttachments[0].url, '_blank');
        }
    } else {
        if (menu) {
            menu.style.display = (menu.style.display === 'none' || !menu.style.display) ? 'block' : 'none';
        }
    }
}

document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('nx-attachment-wrapper');
    const menu = document.getElementById('nx-attach-file-menu');
    if (wrapper && menu && !wrapper.contains(e.target)) {
        menu.style.display = 'none';
    }
});

function removeNxAttachment(idx) {
    if (idx >= 0 && idx < currentNxAttachments.length) {
        const removed = currentNxAttachments.splice(idx, 1);
        renderNxAttachmentsUI();
        if (typeof showToast === 'function') {
            showToast('info', 'Đã Xóa File', `Đã bỏ file ${removed[0]?.name || ''}`);
        }
        checkNxOrderModified();
    }
}

async function handleNxAttachmentSelect(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        await processAndUploadNxFiles(files);
        event.target.value = '';
    }
}

async function handleNxAttachmentDrop(event) {
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
        await processAndUploadNxFiles(files);
    }
}

async function handleNxAttachmentPaste(event) {
    const items = (event.clipboardData || event.originalEvent?.clipboardData)?.items;
    if (!items) return;
    const files = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
            const file = items[i].getAsFile();
            if (file) files.push(file);
        }
    }
    if (files.length > 0) {
        await processAndUploadNxFiles(files);
    }
}

async function processAndUploadNxFiles(files) {
    const client = getNhapXuatSupabaseClient();
    if (!client) return;

    if (typeof showToast === 'function') {
        showToast('info', 'Đang Upload', `Đang tải lên ${files.length} file đính kèm...`);
    }

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = file.name.replace(/\s+/g, '_');
        const fileName = `attach-${Date.now()}-${safeName}`;

        try {
            const { data, error } = await client.storage
                .from('invoice_pdfs')
                .upload(fileName, file, { cacheControl: '3600', upsert: true });

            if (!error && data) {
                const { data: pubData } = client.storage.from('invoice_pdfs').getPublicUrl(fileName);
                const fileUrl = pubData?.publicUrl || '';
                if (fileUrl) {
                    currentNxAttachments.push({
                        name: file.name,
                        url: fileUrl,
                        size: file.size
                    });
                }
            } else {
                console.error("Upload error:", error);
            }
        } catch (e) {
            console.error("Upload exception:", e);
        }
    }

    renderNxAttachmentsUI();
    if (typeof showToast === 'function') {
        showToast('success', 'Tải Lên Thành Công', `Đã đính kèm thành công ${files.length} file.`);
    }
    checkNxOrderModified();
}

window.handleNxAttachmentBtnClick = handleNxAttachmentBtnClick;
window.handleNxAttachmentSelect = handleNxAttachmentSelect;
window.handleNxAttachmentDrop = handleNxAttachmentDrop;
window.handleNxAttachmentPaste = handleNxAttachmentPaste;
window.removeNxAttachment = removeNxAttachment;

window.updateNxDraftItemQty = updateNxDraftItemQty;
window.removeNxDraftItem = removeNxDraftItem;
window.resetNxOrderForm = resetNxOrderForm;
window.saveNxOrderToSystem = saveNxOrderToSystem;
window.handleNhapXuatPdfUpload = handleNhapXuatPdfUpload;
window.markNxOrderAsDone = markNxOrderAsDone;
