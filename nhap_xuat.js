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

function saveNxDraftToStorage() {

}

function loadNxDraftFromStorage() {

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
    createNewNhapXuatOrderForm(true); 
    setupNhapXuatRealtimeSubscription();
    initNxFolderWatcher();
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
            renderNxDraftItemsTable();
            renderNhapXuatOrderList(filteredNhapXuatData);
            checkNxOrderModified();
            updateNxSaveButtonState();
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

        mucdichInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = mucdichInput.value.trim();
                currentDraftOrder.muc_dich = val;
                saveNxDraftToStorage();
                
                const scannerInput = document.getElementById('nx-qr-scanner-input');
                if (scannerInput) {
                    scannerInput.focus();
                    scannerInput.select();
                }
                if (typeof showToast === 'function') {
                    showToast('success', 'Đã Nhận Mục Đích', 'Mục đích đơn đã ghi nhận. Hãy quét mã sản phẩm!', 2000);
                }
            }
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
                    parts[2] = newBranchCode; 
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

    const scannerInput = document.getElementById('nx-qr-scanner-input');
    if (scannerInput) {
        scannerInput.addEventListener('input', handleNxScannerInputSearch);
        scannerInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideNxScannerDropdown();
            }
        });
    }

    document.addEventListener('click', (e) => {
        const wrap = document.querySelector('.nx-scanner-input-wrap');
        if (wrap && !wrap.contains(e.target)) {
            hideNxScannerDropdown();
        }
    });
}

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

async function fetchBranchesFromStaffTable() {
    let branches = [];
    // 1. Ưu tiên lấy từ bảng cài đặt hệ thống (cai_dat_he_thong)
    if (typeof window.getSystemBranches === 'function') {
        const sysBranches = window.getSystemBranches();
        if (Array.isArray(sysBranches) && sysBranches.length > 0) {
            sysBranches.forEach(b => {
                if (b && b.trim() && b !== 'Toàn hệ thống') branches.push(b.trim());
            });
            if (branches.length > 0) {
                return Array.from(new Set(branches));
            }
        }
    }

    // 2. Dự phòng lấy từ bảng staff
    const client = getNhapXuatSupabaseClient();
    if (client) {
        try {
            const { data, error } = await client.from('staff').select('branch');
            if (!error && data && Array.isArray(data)) {
                data.forEach(item => {
                    if (item && item.branch && item.branch.trim() && item.branch !== 'Toàn hệ thống') {
                        branches.push(item.branch.trim());
                    }
                });
            }
        } catch (e) {
            console.warn("NhapXuat: Error fetching staff table branches:", e);
        }
    }

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

    return Array.from(new Set(branches));
}

function isStrictManagerRole(user) {
    const u = user || (typeof window.getCurrentLoggedUser === 'function' ? window.getCurrentLoggedUser() : null);
    if (!u) return false;
    const roleLower = (u.role || '').toLowerCase().trim();
    return roleLower.includes('quản lý') || roleLower.includes('quan ly') || roleLower === 'manager';
}

async function populateNxManagerBranches() {
    const branchSelect = document.getElementById('nx-manager-branch-select');
    if (!branchSelect) return;

    const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
    const isStrictManager = isStrictManagerRole(loggedUser);

    if (!isStrictManager) {
        branchSelect.style.display = 'none';
        return;
    }

    // 1. Ưu tiên lấy chi tiết từ getSystemBranchesDetailed
    let branchItems = [];
    if (typeof window.getSystemBranchesDetailed === 'function') {
        branchItems = window.getSystemBranchesDetailed();
    }

    branchSelect.innerHTML = `<option value="" disabled selected>-- Chọn Chi Nhánh --</option>`;

    if (branchItems.length > 0) {
        branchItems.forEach(item => {
            const code = item.code;
            const name = item.name || code;
            const optionEl = document.createElement('option');
            optionEl.value = code;
            optionEl.dataset.fullBranch = name;
            let displayLabel = name;
            if (name && name !== code) {
                const prefixRegex = new RegExp(`^${code}\\s*-\\s*`, 'i');
                const cleanName = name.replace(prefixRegex, '').trim();
                displayLabel = `${code} - ${cleanName}`;
            } else {
                displayLabel = code;
            }
            optionEl.textContent = `📍 ${displayLabel}`;
            optionEl.title = displayLabel;
            branchSelect.appendChild(optionEl);
        });
    } else {
        const rawBranches = await fetchBranchesFromStaffTable();
        rawBranches.forEach(bStr => {
            const code = extractCNCodeFromBranchString(bStr);
            const optionEl = document.createElement('option');
            optionEl.value = code || bStr;
            optionEl.dataset.fullBranch = bStr;

            let labelText = bStr.trim();
            if (code) {
                const prefixRegex = new RegExp(`^${code}\\s*-\\s*`, 'i');
                const cleanName = labelText.replace(prefixRegex, '').trim();
                labelText = `${code} - ${cleanName}`;
            }
            optionEl.textContent = `📍 ${labelText}`;
            optionEl.title = bStr;
            branchSelect.appendChild(optionEl);
        });
    }

    // Khi hệ thống chỉ có 1 chi nhánh, quản lý không cần chọn tay nữa.
    // Khi đã có nhiều chi nhánh, vẫn giữ hành vi bắt buộc chọn.
    const branchOptions = Array.from(branchSelect.options).filter(opt => opt.value && opt.value !== '');
    if (isEditingNxOrder && window.currentManagerSelectedBranch && branchSelect.querySelector(`option[value="${window.currentManagerSelectedBranch}"]`)) {
        branchSelect.value = window.currentManagerSelectedBranch;
    } else if (branchOptions.length === 1) {
        branchSelect.value = branchOptions[0].value;
        window.currentManagerSelectedBranch = branchOptions[0].value;
        localStorage.setItem('gaia_nx_selected_branch', branchOptions[0].value);
    } else {
        branchSelect.value = "";
    }
    branchSelect.style.display = 'inline-block';
}

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
        if (branchSelect && branchSelect.style.display !== 'none') {
            // Nếu dropdown chỉ có 1 option, tự chọn giá trị đó để tránh rơi mặc định CN1 / "Chưa chọn CN".
            const branchOptions = Array.from(branchSelect.options || []).filter(opt => opt.value && opt.value !== '');
            if (!branchSelect.value && branchOptions.length === 1) {
                branchSelect.value = branchOptions[0].value;
            }

            if (branchSelect.value) {
                selectedCN = branchSelect.value;
                window.currentManagerSelectedBranch = selectedCN;
                localStorage.setItem('gaia_nx_selected_branch', selectedCN);
            } else {
                selectedCN = '';
            }
        } else {
            selectedCN = '';
        }
    } else {

        let userBranchStr = loggedUser ? (loggedUser.branch || '') : '';

        if (!userBranchStr && typeof window.getUserBranch === 'function' && loggedUser) {
            userBranchStr = window.getUserBranch(loggedUser.full_name || loggedUser.email) || '';
        }

        selectedCN = extractCNCodeFromBranchString(userBranchStr) || 'CN1';
    }

    let formattedUser = rawName;
    if (selectedCN) {
        formattedUser = `${rawName} - ${selectedCN}`;
    } else {
        formattedUser = `${rawName} (Chưa chọn CN)`;
    }

    userInput.value = formattedUser;
    if (typeof currentDraftOrder !== 'undefined' && currentDraftOrder) {
        currentDraftOrder.user_name = formattedUser;
    }

    return formattedUser;
}

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
        window.nhapXuatData = nhapXuatData;
        if (typeof nxWatchedDirHandle !== 'undefined' && nxWatchedDirHandle) {
            renderNxFolderWatcherUI(nxIsWatchingPaused ? 'paused' : 'active');
        }
    }
}


function getSampleNhapXuatData() {
    return [];
}

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

async function initNhapXuatBranchFilterForManager() {
    const filterBranchSelect = document.getElementById('nhapxuat-filter-branch');
    if (!filterBranchSelect) return;

    const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
    const isStrictManager = isStrictManagerRole(loggedUser);

    if (!isStrictManager) {
        filterBranchSelect.style.display = 'none';
        return;
    }

    let branchItems = [];
    if (typeof window.getSystemBranchesDetailed === 'function') {
        branchItems = window.getSystemBranchesDetailed();
    }

    filterBranchSelect.innerHTML = `<option value="all">🏢 Tất cả chi nhánh</option>`;

    if (branchItems.length > 0) {
        branchItems.forEach(item => {
            const code = item.code;
            const name = item.name || code;
            let displayLabel = name;
            if (name && name !== code) {
                const prefixRegex = new RegExp(`^${code}\\s*-\\s*`, 'i');
                const cleanName = name.replace(prefixRegex, '').trim();
                displayLabel = `${code} - ${cleanName}`;
            } else {
                displayLabel = code;
            }
            const optionEl = document.createElement('option');
            optionEl.value = code;
            optionEl.dataset.fullBranch = name;
            optionEl.textContent = `📍 ${displayLabel}`;
            optionEl.title = displayLabel;
            filterBranchSelect.appendChild(optionEl);
        });
    } else {
        const rawBranches = await fetchBranchesFromStaffTable();
        rawBranches.forEach(bStr => {
            const code = extractCNCodeFromBranchString(bStr);
            const optionEl = document.createElement('option');
            optionEl.value = code || bStr;
            optionEl.dataset.fullBranch = bStr;

            let labelText = bStr.trim();
            if (code) {
                const prefixRegex = new RegExp(`^${code}\\s*-\\s*`, 'i');
                const cleanName = labelText.replace(prefixRegex, '').trim();
                labelText = `${code} - ${cleanName}`;
            }
            optionEl.textContent = `📍 ${labelText}`;
            optionEl.title = bStr;
            filterBranchSelect.appendChild(optionEl);
        });
    }

    filterBranchSelect.style.display = 'inline-block';
}

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

    result = result.filter(item => {
        return (typeof window.canUserAccessRecord === 'function') ? window.canUserAccessRecord(item) : true;
    });

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
                return (x.trang_thai === 'Done' || (!x.trang_thai && x.trang_thai !== 'Đã hủy') || x.trang_thai === 'Đã hoàn tất' || x.trang_thai === 'Hoàn tất') && x.trang_thai !== 'Đã hủy';
            } else if (selectedStatus === 'Đã hủy') {
                return x.trang_thai === 'Đã hủy';
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

    updateNxFilterDropdownOptions();
}

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
            if (selectedStatus === 'Done') return (x.trang_thai === 'Done' || (!x.trang_thai && x.trang_thai !== 'Đã hủy') || x.trang_thai === 'Đã hoàn tất' || x.trang_thai === 'Hoàn tất') && x.trang_thai !== 'Đã hủy';
            if (selectedStatus === 'Đã hủy') return x.trang_thai === 'Đã hủy';
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
    const countStatusDone = recordsForStatus.filter(x => (x.trang_thai === 'Done' || (!x.trang_thai && x.trang_thai !== 'Đã hủy') || x.trang_thai === 'Đã hoàn tất' || x.trang_thai === 'Hoàn tất') && x.trang_thai !== 'Đã hủy').length;
    const countStatusHuy = recordsForStatus.filter(x => x.trang_thai === 'Đã hủy').length;

    if (filterStatusSelect) {
        const optAll = filterStatusSelect.querySelector('option[value="all"]');
        const optCho = filterStatusSelect.querySelector('option[value="Chờ"]');
        const optDone = filterStatusSelect.querySelector('option[value="Done"]');
        const optHuy = filterStatusSelect.querySelector('option[value="Đã hủy"]');

        if (optAll) optAll.textContent = `📋 Tất cả trạng thái (${countStatusAll})`;
        if (optCho) {
            optCho.textContent = `⏳ Đơn chờ (${countStatusCho})`;
            optCho.disabled = countStatusCho === 0 && selectedStatus !== 'Chờ';
        }
        if (optDone) {
            optDone.textContent = `✅ Hoàn tất (${countStatusDone})`;
            optDone.disabled = countStatusDone === 0 && selectedStatus !== 'Done';
        }
        if (optHuy) {
            optHuy.textContent = `❌ Đã hủy (${countStatusHuy})`;
            optHuy.disabled = countStatusHuy === 0 && selectedStatus !== 'Đã hủy';
        }
    }

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
    if (!ma_vach) return 0;

    const bCode = branchCode ? extractCNCodeFromBranchString(branchCode) : (extractCNCodeFromBranchString(document.getElementById('nx-input-user')?.value || '') || 'CN1');
    const rawBarcode = String(ma_vach).trim().toLowerCase();
    const cleanLot = (lot && lot !== 'null' && lot !== 'undefined' && String(lot).trim() !== '') ? String(lot).trim() : '-';
    const cleanDate = date_expiry ? (formatDateForNx(date_expiry) || null) : null;
    const cleanDateYmd = date_expiry ? parseDateToYyyyMmDd(date_expiry) : null;

    const allDetails = (typeof window.tonKhoDetailData !== 'undefined' && Array.isArray(window.tonKhoDetailData)) 
        ? window.tonKhoDetailData 
        : (typeof tonKhoDetailData !== 'undefined' && Array.isArray(tonKhoDetailData) ? tonKhoDetailData : []);

    const allVatTu = (typeof window.vatTuData !== 'undefined' && Array.isArray(window.vatTuData))
        ? window.vatTuData
        : (typeof vatTuData !== 'undefined' && Array.isArray(vatTuData) ? vatTuData : []);

    if (allDetails.length === 0 && allVatTu.length === 0) {
        return 999999;
    }

    let currentStock = null;

    // 1. Look up in ton_kho_detail for exact or branch matches
    if (allDetails.length > 0) {
        const branchDetails = allDetails.filter(d => {
            const dBarcode = (d.ma_vach || '').trim().toLowerCase();
            const dQr = (d.ma_qr || '').trim().toLowerCase();
            const isMatch = (dBarcode && dBarcode === rawBarcode) || (dQr && dQr === rawBarcode) || (dQr && dQr.startsWith(rawBarcode + ';'));
            if (!isMatch) return false;

            if (bCode && bCode !== 'all') {
                const dBranch = extractCNCodeFromBranchString(d.chi_nhanh);
                return dBranch === bCode;
            }
            return true;
        });

        if (branchDetails.length > 0) {
            // Check if specific LOT / Date matches
            if (cleanLot !== '-' || cleanDate) {
                const lotMatches = branchDetails.filter(d => {
                    const dLot = (d.lot || '-').trim();
                    const dDateStr = d.date_expiry ? formatDateForNx(d.date_expiry) : (d.date ? formatDateForNx(d.date) : null);
                    const dDateYmd = d.date_expiry ? parseDateToYyyyMmDd(d.date_expiry) : (d.date ? parseDateToYyyyMmDd(d.date) : null);

                    const lotOk = (cleanLot === '-' || dLot === cleanLot);
                    const dateOk = (!cleanDate || dDateStr === cleanDate || (cleanDateYmd && dDateYmd === cleanDateYmd));
                    return lotOk && dateOk;
                });

                if (lotMatches.length > 0) {
                    currentStock = lotMatches.reduce((sum, r) => sum + (Number(r.ton_kho ?? r.ton_cuoi ?? 0)), 0);
                }
            }

            if (currentStock === null) {
                if (cleanLot === '-') {
                    const defaultLotMatch = branchDetails.filter(d => (d.lot || '-').trim() === '-');
                    if (defaultLotMatch.length > 0) {
                        currentStock = defaultLotMatch.reduce((sum, r) => sum + (Number(r.ton_kho ?? r.ton_cuoi ?? 0)), 0);
                    } else {
                        currentStock = branchDetails.reduce((sum, r) => sum + (Number(r.ton_kho ?? r.ton_cuoi ?? 0)), 0);
                    }
                } else {
                    currentStock = 0;
                }
            }
        }
    }

    // 2. Fallback to vatTuData (san_pham)
    if (currentStock === null) {
        const matchedProduct = allVatTu.find(p => {
            const pBarcode = (p.ma_vach || '').trim().toLowerCase();
            return pBarcode === rawBarcode || String(p.id) === String(ma_vach);
        });

        if (matchedProduct) {
            const lowerBranch = (bCode || 'cn1').toLowerCase();
            if (matchedProduct[`so_luong_${lowerBranch}`] !== undefined && matchedProduct[`so_luong_${lowerBranch}`] !== null) {
                currentStock = Number(matchedProduct[`so_luong_${lowerBranch}`]) || 0;
            } else if (bCode === 'CN1') {
                currentStock = Number(matchedProduct.so_luong_cn1 ?? matchedProduct.ton_cuoi ?? matchedProduct.so_luong ?? 0);
            } else if (bCode === 'CN2') {
                currentStock = Number(matchedProduct.so_luong_cn2 ?? 0);
            } else if (bCode === 'all') {
                currentStock = Number(matchedProduct.ton_cuoi ?? matchedProduct.so_luong ?? 0);
            } else {
                currentStock = Number(matchedProduct.ton_cuoi ?? matchedProduct.so_luong ?? 0);
            }
        } else {
            currentStock = 0;
        }
    }

    return Number(currentStock) || 0;
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

function getNxOrderCurrentStateSnapshot() {
    const loai_don = document.getElementById('nx-input-loai')?.value || '';
    const muc_dich = (document.getElementById('nx-input-mucdich')?.value || '').trim();

    const items = (currentDraftNxItems || []).map(it => ({
        ma_vach: String(it.ma_vach || '').trim(),
        lot: (it.lot && it.lot !== 'null' && it.lot !== 'undefined') ? String(it.lot).trim() : '-',
        date_expiry: it.date_expiry ? (formatDateForNx(it.date_expiry) || String(it.date_expiry).trim()) : '',
        so_luong: Number(it.so_luong) || 0
    }));

    const attachments = (currentNxAttachments || []).map(att => ({
        name: String(att.name || '').trim(),
        url: String(att.url || '').trim()
    }));

    return JSON.stringify({
        loai_don,
        muc_dich,
        items,
        attachments
    });
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

    const currentState = getNxOrderCurrentStateSnapshot();
    const isModified = currentState !== originalOrderStateSnapshot;
    updateNxSaveButtonState(isModified);
}

function getNxOrderSourceInfo(order) {
    if (!order) return { type: 'thu_cong', label: '✍️ Thủ công', icon: '✍️', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.35)', desc: 'Đơn tự tạo hoặc quét mã trực tiếp' };

    let src = order.nguon_don;
    if (!src) {

        const mucDich = (order.muc_dich || '').toLowerCase();
        if (mucDich.includes('[auto folder]') || mucDich.includes('[tự động theo dõi]') || mucDich.includes('[tự động')) {
            src = 'auto_folder';
        } else {

            src = 'thu_cong';
        }
    }

    if (src === 'auto_folder') {
        return {
            type: 'auto_folder',
            label: '📁 Thư mục',
            icon: '📁',
            bg: 'rgba(6, 182, 212, 0.15)',
            color: '#06b6d4',
            border: 'rgba(6, 182, 212, 0.35)',
            desc: 'Đơn tự động nạp từ Thư mục theo dõi'
        };
    } else if (src === 'pdf_import') {
        return {
            type: 'pdf_import',
            label: '📄 File PDF',
            icon: '📄',
            bg: 'rgba(168, 85, 247, 0.15)',
            color: '#c084fc',
            border: 'rgba(168, 85, 247, 0.35)',
            desc: 'Đơn trích xuất từ File PDF hóa đơn tải lên'
        };
    } else {
        return {
            type: 'thu_cong',
            label: '✍️ Thủ công',
            icon: '✍️',
            bg: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            border: 'rgba(16, 185, 129, 0.35)',
            desc: 'Đơn tự tạo hoặc quét mã trực tiếp'
        };
    }
}

function renderNhapXuatOrderList(orders) {
    const listEl = document.getElementById('nhapxuat-order-list');
    if (!listEl) return;

    listEl.innerHTML = '';

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
        const isCancelled = order.trang_thai === 'Đã hủy';
        const orderItems = order.chi_tiet_san_pham || [];
        const isAllZeroQty = orderItems.length > 0 && orderItems.every(x => (Number(x.so_luong) || 0) === 0);
        const isPending = !isCancelled && (order.trang_thai === 'Chờ' || isAllZeroQty);
        const srcInfo = getNxOrderSourceInfo(order);

        let statusBadgeHtml = '';
        if (isCancelled) {
            statusBadgeHtml = '<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">❌ Đã Hủy</span>';
        } else if (isPending) {
            let ratioText = '';
            if (order.so_dong_hoa_don && order.so_dong_hoa_don > 0) {
                ratioText = ` (${orderItems.length}/${order.so_dong_hoa_don})`;
            }
            statusBadgeHtml = `<span style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">⏳ Chờ${ratioText}</span>`;
        }

        const card = document.createElement('div');
        card.className = `nx-order-card ${isSelected ? 'selected' : ''} ${isCancelled ? 'order-cancelled' : ''}`;
        if (isCancelled) {
            card.style.opacity = '0.75';
            card.style.borderColor = 'rgba(239, 68, 68, 0.25)';
        }
        card.onclick = () => selectNxOrderForView(order);

        card.innerHTML = `
            <div class="nx-card-top">
                <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                    <span class="nx-card-code" style="${isCancelled ? 'text-decoration: line-through; color: #ef4444;' : ''}">${escapeHtml(order.ma_don)}</span>
                    ${statusBadgeHtml}
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

window.addEventListener('click', (e) => {
    const modal = document.getElementById('nx-history-log-modal');
    if (modal && e.target === modal) {
        closeNxHistoryLogModal();
    }
});

async function logNxOrderAction(maDon, loaiDon, hanhDong, noiDung) {
    if (!maDon) return;

    const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
    const rawName = loggedUser ? (loggedUser.full_name || loggedUser.email || 'Nhân viên') : 'Nhân viên';
    const branchName = loggedUser ? (loggedUser.branch || '') : '';
    const branchCode = extractCNCodeFromBranchString(branchName) || 'CN1';
    const userName = `${rawName}${branchCode ? ` - ${branchCode}` : ''}`;

    const logPayload = {
        ma_don: maDon,
        loai_don: loaiDon || 'Nhập',
        hanh_dong: hanhDong,
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

async function logOrUpdateItemQtyLog(maDon, loaiDon, tenHangHoa, startQty, newQty) {
    if (!maDon || !tenHangHoa) return;
    const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
    const rawName = loggedUser ? (loggedUser.full_name || loggedUser.email || 'Nhân viên') : 'Nhân viên';
    const branchName = loggedUser ? (loggedUser.branch || '') : '';
    const branchCode = extractCNCodeFromBranchString(branchName) || 'CN1';
    const userName = `${rawName}${branchCode ? ` - ${branchCode}` : ''}`;
    const newText = `Quét trùng mã -> Tự động tăng số lượng [${tenHangHoa}] từ ${startQty} lên ${newQty}`;

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
            } else if (log.hanh_dong === 'HỦY_ĐƠN') {
                actionBadge = `<span class="badge-lot" style="background: rgba(239, 68, 68, 0.25); color: #ef4444; font-size: 11px; font-weight: 700;">🗑️ Hủy Đơn</span>`;
            } else if (log.hanh_dong === 'KHÔI_PHỤC_ĐƠN') {
                actionBadge = `<span class="badge-lot" style="background: rgba(16, 185, 129, 0.25); color: #10b981; font-size: 11px; font-weight: 700;">↩️ Khôi Phục</span>`;
            } else {
                actionBadge = `<span class="badge-lot" style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; font-size: 11px;">💾 Cập Nhật</span>`;
            }

            tr.innerHTML = `
                <td class="col-time" style="font-size: 11px; color: var(--text-muted); vertical-align: top; padding: 10px 8px; line-height: 1.35; width: 155px; max-width: 160px;">
                    <div>${formatNxDateTime(log.created_at)}</div>
                    <div style="color: #60a5fa; font-weight: 500; font-size: 11px; margin-top: 3px;">👤 ${escapeHtml(log.user_name || '-')}</div>
                </td>
                <td class="col-action" style="vertical-align: top; padding-top: 10px; text-align: center; width: 110px; max-width: 115px;">${actionBadge}</td>
                <td class="col-content" style="font-size: 12px; color: var(--text-primary); font-weight: 500; white-space: normal !important; word-break: break-word !important; line-height: 1.5; padding: 10px 14px;">
                    ${escapeHtml(log.noi_dung)}
                </td>
            `;

            tb.appendChild(tr);
        });
    });
}

function hasUnsavedNxChanges() {
    if (selectedNxOrderId === null) {
        const hasItems = currentDraftNxItems && currentDraftNxItems.length > 0;
        const mucDich = document.getElementById('nx-input-mucdich')?.value?.trim() || '';
        const hasAttachments = currentNxAttachments && currentNxAttachments.length > 0;
        return !!(hasItems || mucDich || hasAttachments);
    } else {
        if (!originalOrderStateSnapshot) return false;
        const currentState = getNxOrderCurrentStateSnapshot();
        return currentState !== originalOrderStateSnapshot;
    }
}

function selectNxOrderForView(order) {

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

async function _doSelectNxOrderForView(order) {
    selectedNxOrderId = order.id;
    isEditingNxOrder = true;

    const titleEl = document.getElementById('nhapxuat-form-title');
    const modeBadge = document.getElementById('nhapxuat-mode-badge');
    const statusBadge = document.getElementById('nhapxuat-status-badge');
    const sourceBadge = document.getElementById('nhapxuat-source-badge');
    const fileLink = document.getElementById('nhapxuat-file-link');

    if (titleEl) titleEl.textContent = `📋 Chi Tiết Đơn ${order.ma_don}`;

    if (sourceBadge) {
        sourceBadge.style.display = 'none'; 
    }

    if (fileLink) {
        if (order.file_url) {
            fileLink.style.display = 'inline-block';
            fileLink.href = order.file_url;
        } else {
            fileLink.style.display = 'none';
        }
    }

    currentDraftNxItems = order.chi_tiet_san_pham ? JSON.parse(JSON.stringify(order.chi_tiet_san_pham)) : [];

    const isCancelled = order.trang_thai === 'Đã hủy';
    const isAllZeroQty = currentDraftNxItems.length > 0 && currentDraftNxItems.every(x => (Number(x.so_luong) || 0) === 0);
    const hasNoProducts = currentDraftNxItems.length === 0;
    const isPending = !isCancelled && (order.trang_thai === 'Chờ' || isAllZeroQty);

    if (statusBadge) {
        if (isCancelled) {
            statusBadge.style.display = 'inline-block';
            statusBadge.textContent = '❌ Đã Hủy';
            statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
            statusBadge.style.color = '#ef4444';
            statusBadge.onclick = null;
        } else if (isPending) {
            let ratioText = '';
            if (order.so_dong_hoa_don && order.so_dong_hoa_don > 0) {
                ratioText = ` (${currentDraftNxItems.length}/${order.so_dong_hoa_don})`;
            }
            statusBadge.style.display = 'inline-block';
            statusBadge.textContent = `⏳ Đang Chờ Quét${ratioText}`;
            statusBadge.style.background = 'rgba(245, 158, 11, 0.2)';
            statusBadge.style.color = '#f59e0b';
            statusBadge.onclick = null;
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

    const btnCancel = document.getElementById('btn-cancel-nx-order');
    const btnRestore = document.getElementById('btn-restore-nx-order');
    const btnHardDelete = document.getElementById('btn-hard-delete-nx-order');
    const btnSave = document.getElementById('btn-save-nx-order');
    const scannerInput = document.getElementById('nx-qr-scanner-input');
    const scanTrigger = document.querySelector('.btn-scan-trigger') || document.getElementById('btn-nx-excel-import');
    const excelFileInput = document.getElementById('nx-excel-file-input');

    const srcInfo = getNxOrderSourceInfo(order);
    const isPdfOrder = srcInfo.type === 'pdf_import';
    const canHardDelete = isPdfOrder || isPending || hasNoProducts || isCancelled || isAllZeroQty;

    if (isCancelled) {
        if (btnCancel) btnCancel.style.display = 'none';
        if (btnRestore) btnRestore.style.display = 'flex';
        if (btnHardDelete) btnHardDelete.style.display = canHardDelete ? 'flex' : 'none';
        if (btnSave) btnSave.style.display = 'flex'; 
        if (scannerInput) {
            scannerInput.disabled = true;
            scannerInput.placeholder = 'Đơn đã bị hủy - Không thể quét hoặc chỉnh sửa';
        }
        if (scanTrigger) scanTrigger.disabled = true;
        if (excelFileInput) excelFileInput.disabled = true;
    } else {
        if (btnCancel) btnCancel.style.display = 'flex';
        if (btnRestore) btnRestore.style.display = 'none';
        if (btnHardDelete) btnHardDelete.style.display = canHardDelete ? 'flex' : 'none';
        if (btnSave) btnSave.style.display = 'flex';
        if (scannerInput) {
            scannerInput.disabled = false;
            scannerInput.placeholder = 'Quét QR / Mã vạch hoặc tìm tên vật tư...';
        }
        if (scanTrigger) scanTrigger.disabled = false;
        if (excelFileInput) excelFileInput.disabled = false;
    }

    const btnDownload = document.getElementById('btn-download-nx-pdf');
    if (btnDownload) {
        if (order.file_url) {
            btnDownload.href = order.file_url;
            btnDownload.style.display = 'flex';
        } else {
            btnDownload.style.display = 'none';
        }
    }

    const loaiInput = document.getElementById('nx-input-loai');
    const mucDichInput = document.getElementById('nx-input-mucdich');

    document.getElementById('nx-input-madon').value = order.ma_don || '';
    loaiInput.value = order.loai_don || 'Nhập';
    document.getElementById('nx-input-time').value = formatNxDateTime(order.created_at || order.ngay_tao);
    mucDichInput.value = order.muc_dich || '';
    document.getElementById('nx-input-user').value = order.user_name || '';

    loaiInput.disabled = isCancelled;
    mucDichInput.disabled = isCancelled;

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

    originalOrderStateSnapshot = getNxOrderCurrentStateSnapshot();

    currentDraftOrder = JSON.parse(JSON.stringify(order));

    renderNxDraftItemsTable();
    fetchNxOrderLogs(order.ma_don);
    renderNhapXuatOrderList(filteredNhapXuatData);
    updateNxSaveButtonState(false); 
}

function createNewNhapXuatOrderForm(restoreSavedDraft = false, onApproved = null, force = false) {
    if (!force && hasUnsavedNxChanges()) {
        const currentMaDon = document.getElementById('nx-input-madon')?.value || 'ĐƠN-NHÁP';
        showGenericConfirmModal(
            '⚠️ CẢNH BÁO',
            'Bỏ Thay Đổi Chưa Lưu?',
            `Đơn kho <strong>${currentMaDon}</strong> đang có thay đổi chưa được cập nhật. Tạo đơn mới sẽ mất toàn bộ các thay đổi này.`,
            'Nhấn "Tiếp Tục" để tạo đơn mới, hoặc "Hủy" để quay lại và Cập Nhật đơn.',
            '#f59e0b',
            'Tiếp Tục',
            async () => {
                await _doCreateNewNhapXuatOrderForm();
                if (typeof onApproved === 'function') onApproved();
            }
        );
        return false;
    }
    _doCreateNewNhapXuatOrderForm();
    if (typeof onApproved === 'function') onApproved();
    return true;
}

async function _doCreateNewNhapXuatOrderForm() {
    selectedNxOrderId = null;
    isEditingNxOrder = false;
    originalOrderStateSnapshot = null;

    const titleEl = document.getElementById('nhapxuat-form-title');
    const modeBadge = document.getElementById('nhapxuat-mode-badge');
    const statusBadge = document.getElementById('nhapxuat-status-badge');
    const sourceBadge = document.getElementById('nhapxuat-source-badge');
    const fileLink = document.getElementById('nhapxuat-file-link');

    if (statusBadge) statusBadge.style.display = 'none';
    if (sourceBadge) sourceBadge.style.display = 'none';
    if (fileLink) fileLink.style.display = 'none';

    const btnCancel = document.getElementById('btn-cancel-nx-order');
    const btnRestore = document.getElementById('btn-restore-nx-order');
    const btnHardDelete = document.getElementById('btn-hard-delete-nx-order');
    const btnSave = document.getElementById('btn-save-nx-order');
    const btnDownload = document.getElementById('btn-download-nx-pdf');
    const scannerInput = document.getElementById('nx-qr-scanner-input');
    const scanTrigger = document.querySelector('.btn-scan-trigger') || document.getElementById('btn-nx-excel-import');
    const excelFileInput = document.getElementById('nx-excel-file-input');

    if (btnCancel) btnCancel.style.display = 'none';
    if (btnRestore) btnRestore.style.display = 'none';
    if (btnHardDelete) btnHardDelete.style.display = 'none';
    if (btnSave) btnSave.style.display = 'flex';
    if (btnDownload) btnDownload.style.display = 'none';
    if (scannerInput) {
        scannerInput.disabled = false;
        scannerInput.placeholder = 'Quét QR / Mã vạch hoặc tìm tên vật tư...';
    }
    if (scanTrigger) scanTrigger.disabled = false;
    if (excelFileInput) excelFileInput.disabled = false;

    if (titleEl) titleEl.textContent = '📝 Tạo Đơn Nhập / Xuất Kho Mới';
    if (modeBadge) {
        modeBadge.textContent = '+ Đơn Mới';
        modeBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        modeBadge.style.color = '#10b981';
    }

    const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
    await populateNxManagerBranches();

    const userNameFormatted = updateNxUserFieldWithBranch();

    currentDraftOrder = {
        ma_don: 'ĐƠN-NHÁP',
        loai_don: '', 
        muc_dich: '',
        nguon_don: 'thu_cong',
        user_name: userNameFormatted,
        items: []
    };
    currentDraftNxItems = [];
    currentNxAttachments = [];
    renderNxAttachmentsUI();
    document.getElementById('nx-input-loai').value = ''; 
    document.getElementById('nx-input-madon').value = 'ĐƠN-NHÁP';
    document.getElementById('nx-input-mucdich').value = '';
    document.getElementById('nx-input-user').value = userNameFormatted;

    document.getElementById('nx-input-time').value = formatNxDateTime(new Date());

    renderNxDraftItemsTable();
    fetchNxOrderLogs(currentDraftOrder.ma_don);
    renderNhapXuatOrderList(filteredNhapXuatData);
    updateNxSaveButtonState(true);

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

function playScanErrorSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

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

function speakScanCount(count) {
    if ('speechSynthesis' in window) {
        try {
            window.speechSynthesis.cancel(); 
            const utterance = new SpeechSynthesisUtterance(String(count));
            utterance.lang = 'vi-VN';
            utterance.rate = 1.3; 
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
            return;
        } catch (e) {
            console.warn("Speech synthesis error:", e);
        }
    }

    playScanSuccessSound();
}

function hideNxScannerDropdown() {
    const dropdown = document.getElementById('nx-scanner-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
    }
}

function handleNxScannerInputSearch(event) {
    const query = (event.target.value || '').trim();
    const dropdown = document.getElementById('nx-scanner-dropdown');
    if (!dropdown) return;

    if (!query) {
        hideNxScannerDropdown();
        return;
    }

    if (query.includes(';')) {
        hideNxScannerDropdown();
        return;
    }

    let allVatTu = (typeof window.vatTuData !== 'undefined' && Array.isArray(window.vatTuData) && window.vatTuData.length > 0) ? window.vatTuData : (typeof vatTuData !== 'undefined' ? vatTuData : []);
    if (!allVatTu || allVatTu.length === 0) {
        hideNxScannerDropdown();
        return;
    }

    const userName = document.getElementById('nx-input-user')?.value || currentDraftOrder?.user_name || '';
    const branchCode = extractCNCodeFromBranchString(userName) || 'CN1';

    const qLower = query.toLowerCase();
    const matchedList = allVatTu.filter(item => {
        const name1 = (item.ten_mat_hang || '').toLowerCase();
        const name2 = (item.ten_hoa_don || '').toLowerCase();
        const barcode = (item.ma_vach || '').toLowerCase();
        return name1.includes(qLower) || name2.includes(qLower) || barcode.includes(qLower);
    }).slice(0, 15);

    if (matchedList.length === 0) {
        dropdown.innerHTML = `
            <div style="padding: 10px 12px; font-size: 12px; color: var(--text-muted); text-align: center;">
                Không tìm thấy vật tư khớp với "<strong>${escapeHtml(query)}</strong>"
            </div>
        `;
        dropdown.style.display = 'flex';
        return;
    }

    let html = '';
    const allDetails = (typeof window.tonKhoDetailData !== 'undefined' && Array.isArray(window.tonKhoDetailData)) ? window.tonKhoDetailData : (typeof tonKhoDetailData !== 'undefined' ? tonKhoDetailData : []);

    matchedList.forEach(p => {
        const rawBarcode = (p.ma_vach || '').trim().toLowerCase();

        const subDetails = allDetails.filter(d => {
            const dBarcode = (d.ma_vach || '').trim().toLowerCase();
            const dQr = (d.ma_qr || '').trim().toLowerCase();
            if (dBarcode !== rawBarcode && dQr !== rawBarcode) return false;

            if (branchCode && branchCode !== 'all') {
                const dBranch = extractCNCodeFromBranchString(d.chi_nhanh);
                return dBranch === branchCode;
            }
            return true;
        });

        const pName = p.ten_mat_hang || p.ten_hoa_don || 'Vật tư';
        const pBarcode = p.ma_vach || '-';
        const pImg = p.anh || '';

        const imgHtml = pImg ? `
            <div class="nx-search-item-img-wrap" onclick="event.stopPropagation(); if(typeof openVatTuImageLightbox==='function') openVatTuImageLightbox('${escapeHtml(pImg)}', '${escapeHtml(pName)}', '${escapeHtml(pBarcode)}', '${p.id}');" title="Click để xem ảnh lớn">
                <img src="${escapeHtml(pImg)}" alt="" class="nx-search-item-img" loading="lazy" />
            </div>
        ` : `
            <div class="nx-search-item-img-wrap" style="cursor: default;" title="Chưa có ảnh">
                <div class="nx-search-item-no-img">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                </div>
            </div>
        `;

        if (subDetails.length > 0) {
            html += `
                <div class="nx-search-item">
                    <div class="nx-search-item-header" onclick="addNxItemFromSearch('${p.id}', '-', null)" title="Thêm mặt hàng này (LOT mặc định)">
                        <div class="nx-search-item-header-left">
                            ${imgHtml}
                            <code class="vattu-barcode-code" style="margin: 0;">${escapeHtml(pBarcode)}</code>
                            <strong style="font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(pName)}</strong>
                        </div>
                        <span style="font-size: 11px; color: #60a5fa; font-weight: 600; flex-shrink: 0;">${subDetails.length} nhánh LOT (${branchCode})</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 5px;">
                        ${subDetails.map(d => {
                            const lotStr = d.lot || '-';
                            const dateStr = d.date ? formatDateForNx(d.date) : (d.date_expiry ? formatDateForNx(d.date_expiry) : '-');
                            const stockNum = Number(d.ton_kho || d.ton_cuoi || 0);
                            const stockColor = stockNum > 0 ? '#10b981' : '#ef4444';
                            const safeLot = String(lotStr).replace(/'/g, "\\'");
                            const safeDate = dateStr !== '-' ? String(dateStr).replace(/'/g, "\\'") : '';
                            return `
                                <div class="nx-search-subitem" onclick="event.stopPropagation(); addNxItemFromSearch('${p.id}', '${safeLot}', '${safeDate}')" title="Chọn nhánh LOT: ${escapeHtml(lotStr)} (Tồn: ${(typeof formatQuantity === 'function' ? formatQuantity(stockNum) : stockNum)})">
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <span style="color: #3b82f6; font-weight: bold;">↳</span>
                                        <span class="badge-lot">LOT: ${escapeHtml(lotStr)}</span>
                                        <span class="badge-date">HSD: ${escapeHtml(dateStr)}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <span class="stock-tag" style="color: ${stockColor}; font-size: 11.5px;">Tồn: ${(typeof formatQuantity === 'function' ? formatQuantity(stockNum) : stockNum.toLocaleString('vi-VN'))}</span>
                                        <span class="branch-tag">${escapeHtml(d.chi_nhanh || branchCode)}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="nx-search-item" onclick="addNxItemFromSearch('${p.id}', '-', null)" title="Thêm mặt hàng này vào đơn">
                    <div class="nx-search-item-header">
                        <div class="nx-search-item-header-left">
                            ${imgHtml}
                            <code class="vattu-barcode-code" style="margin: 0;">${escapeHtml(pBarcode)}</code>
                            <strong style="font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(pName)}</strong>
                        </div>
                        <span style="font-size: 11px; color: var(--text-muted); flex-shrink: 0;">${escapeHtml(p.don_vi || 'Sản phẩm')}</span>
                    </div>
                </div>
            `;
        }
    });

    dropdown.innerHTML = html;
    dropdown.style.display = 'flex';
}

function formatDateForNx(rawDate) {
    if (!rawDate || rawDate === '-' || rawDate === 'null' || rawDate === 'undefined') return '';
    const str = String(rawDate).trim();
    if (!str) return '';

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
        const parts = str.split('/');
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const parts = str.substring(0, 10).split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch (e) {}
    return str;
}

function buildMaQr(ma_vach, lot, date_expiry) {
    const vach = (ma_vach || '').trim();
    const cleanLot = (lot && lot !== 'null' && lot !== 'undefined' && lot !== '-') ? String(lot).trim() : '';
    const cleanDate = (date_expiry && date_expiry !== 'null' && date_expiry !== 'undefined' && date_expiry !== '-') ? (formatDateForNx(date_expiry) || String(date_expiry).trim()) : '';

    if (!cleanLot && !cleanDate) {
        return vach;
    }
    if (cleanLot && cleanDate) {
        return `${vach};${cleanLot};${cleanDate}`;
    }
    if (cleanLot && !cleanDate) {
        return `${vach};${cleanLot}`;
    }
    return `${vach};-;${cleanDate}`;
}

function addNxItemFromSearch(productId, lot = '-', date_expiry = null) {
    const allVatTu = (typeof window.vatTuData !== 'undefined' && Array.isArray(window.vatTuData)) ? window.vatTuData : (typeof vatTuData !== 'undefined' ? vatTuData : []);
    const product = allVatTu.find(x => String(x.id) === String(productId));
    if (!product) return;

    const ma_vach = product.ma_vach || '';
    const ten_hang_hoa = product.ten_mat_hang || product.ten_hoa_don || 'Vật tư y tế';
    const cleanLot = (lot && lot !== 'null' && lot !== 'undefined') ? lot : '-';
    let cleanDate = date_expiry ? formatDateForNx(date_expiry) : null;
    const ma_qr = buildMaQr(ma_vach, cleanLot, cleanDate);

    const currentMaDon = document.getElementById('nx-input-madon')?.value || currentDraftOrder.ma_don || 'ĐƠN-NHÁP';
    const currentLoai = document.getElementById('nx-input-loai')?.value || currentDraftOrder.loai_don || 'Nhập';
    const isPendingOrder = currentDraftOrder.trang_thai === 'Chờ';

    let existingIndex = currentDraftNxItems.findIndex(item => {
        return (item.ma_vach === ma_vach && (item.lot || '-') === cleanLot);
    });

    let scannedCount = 1;

    if (existingIndex !== -1) {
        const item = currentDraftNxItems[existingIndex];
        const oldQty = Number(item.so_luong) || 0;
        const newQty = oldQty + 1;

        if (isPendingOrder && item.so_luong_yeu_cau && newQty > item.so_luong_yeu_cau) {
            playScanErrorSound();
            if (typeof showToast === 'function') {
                showToast('warning', 'Quá Số Lượng', `Sản phẩm đã đủ số lượng yêu cầu (${item.so_luong_yeu_cau})!`);
            }
            hideNxScannerDropdown();
            return;
        }

        item.so_luong = newQty;
        scannedCount = newQty;
        if (cleanDate && (!item.date_expiry || item.date_expiry === '-')) item.date_expiry = cleanDate;

        logNxOrderAction(
            currentMaDon,
            currentLoai,
            'SỬA_SL',
            `Chọn từ tìm kiếm -> Tăng số lượng [${ten_hang_hoa}] từ ${oldQty} lên ${newQty}`
        );
    } else {
        if (isPendingOrder) {
            playScanErrorSound();
            if (typeof showToast === 'function') {
                showToast('error', 'Sai Sản Phẩm', `Sản phẩm "${ten_hang_hoa}" không nằm trong đơn hóa đơn này!`);
            }
            hideNxScannerDropdown();
            return;
        }

        currentDraftNxItems.push({
            ma_qr: ma_qr,
            ma_vach: ma_vach,
            lot: cleanLot,
            date_expiry: cleanDate,
            ten_hang_hoa: ten_hang_hoa,
            so_luong: 1
        });

        logNxOrderAction(
            currentMaDon,
            currentLoai,
            'THÊM_SP',
            `Thêm sản phẩm [${ten_hang_hoa}] (Mã vạch: ${ma_vach}, LOT: ${cleanLot}) với số lượng 1`
        );
    }

    if (currentLoai === 'Xuất') {
        const userName = document.getElementById('nx-input-user')?.value || '';
        const branchCode = extractCNCodeFromBranchString(userName);
        const availableStock = getAvailableStockInNx(ma_vach, cleanLot, cleanDate, branchCode, currentMaDon);
        const maxAllowed = Math.max(0, availableStock);

        if (scannedCount > maxAllowed) {
            playScanErrorSound();
            scannedCount = maxAllowed;
            if (existingIndex !== -1) {
                currentDraftNxItems[existingIndex].so_luong = maxAllowed;
            } else if (currentDraftNxItems.length > 0) {
                const target = currentDraftNxItems.find(x => x.ma_vach === ma_vach && (x.lot || '-') === cleanLot);
                if (target) target.so_luong = maxAllowed;
            }

            if (typeof showToast === 'function') {
                if (maxAllowed === 0) {
                    showToast('error', 'Đã Hết Hàng', `Mã ${ma_vach} (LOT: ${cleanLot}) đã HẾT HÀNG ở ${branchCode}!`);
                } else {
                    showToast('warning', 'Chạm Mức Tồn', `Mã ${ma_vach} (LOT: ${cleanLot}) chỉ còn tồn ${availableStock} ở ${branchCode}.`);
                }
            }
        }
    }

    speakScanCount(scannedCount);

    const scannerInput = document.getElementById('nx-qr-scanner-input');
    if (scannerInput) {
        scannerInput.value = '';
        scannerInput.focus();
    }
    hideNxScannerDropdown();

    currentDraftOrder.items = currentDraftNxItems;
    saveNxDraftToStorage();
    renderNxDraftItemsTable();
    renderNhapXuatOrderList(filteredNhapXuatData);
    checkNxOrderModified();
}

window.addNxItemFromSearch = addNxItemFromSearch;
window.hideNxScannerDropdown = hideNxScannerDropdown;

async function startNewNxOrderWithShortcut(loai = 'Xuất') {
    if (hasUnsavedNxChanges()) {
        const currentMaDon = document.getElementById('nx-input-madon')?.value || 'ĐƠN-NHÁP';
        if (typeof playScanErrorSound === 'function') {
            playScanErrorSound();
        }
        showGenericConfirmModal(
            '⚠️ CẢNH BÁO',
            'Bỏ Thay Đổi Chưa Lưu?',
            `Đơn kho <strong>${currentMaDon}</strong> đang có thay đổi chưa được cập nhật. Tạo đơn mới sẽ mất toàn bộ các thay đổi này.`,
            'Nhấn "Tiếp Tục" để tạo đơn mới, hoặc "Hủy" để quay lại và Cập Nhật đơn.',
            '#f59e0b',
            'Tiếp Tục',
            async () => {
                await _doApplyNewOrderShortcut(loai);
            }
        );
        return;
    }

    await _doApplyNewOrderShortcut(loai);
}

async function _doApplyNewOrderShortcut(loai) {
    await _doCreateNewNhapXuatOrderForm();
    const loaiSelect = document.getElementById('nx-input-loai');
    if (loaiSelect) {
        loaiSelect.value = loai;
        currentDraftOrder.loai_don = loai;
        generateNextNxOrderCode(loai);
        saveNxDraftToStorage();
        renderNxDraftItemsTable();
        renderNhapXuatOrderList(filteredNhapXuatData);
        checkNxOrderModified();
        updateNxSaveButtonState();
    }
    
    const mucdichInput = document.getElementById('nx-input-mucdich');
    if (mucdichInput) {
        setTimeout(() => {
            mucdichInput.focus();
            mucdichInput.select();
        }, 80);
    }

    if (typeof playScanSuccessSound === 'function') {
        playScanSuccessSound();
    }
    if (typeof showToast === 'function') {
        showToast('info', 'Tạo Đơn ' + loai, `Đã mở form tạo đơn ${loai} kho. Quét/nhập Mã hoặc Mục đích rồi ấn Enter!`, 3000);
    }
}
window.startNewNxOrderWithShortcut = startNewNxOrderWithShortcut;

async function handleNxQrScannerAdd() {
    const scannerInput = document.getElementById('nx-qr-scanner-input');
    if (!scannerInput) return;

    const rawVal = scannerInput.value.trim();
    if (!rawVal) return;

    const trimmedUpper = rawVal.toUpperCase();

    // 1. Quét lệnh XUAT / XUẤT KHO
    if (['XUAT', 'XUẤT', 'XUAT KHO', 'XUẤT KHO', 'XK'].includes(trimmedUpper)) {
        scannerInput.value = '';
        hideNxScannerDropdown();
        await startNewNxOrderWithShortcut('Xuất');
        return;
    }

    // 2. Quét lệnh NHAP / NHẬP KHO
    if (['NHAP', 'NHẬP', 'NHAP KHO', 'NHẬP KHO', 'NK'].includes(trimmedUpper)) {
        scannerInput.value = '';
        hideNxScannerDropdown();
        await startNewNxOrderWithShortcut('Nhập');
        return;
    }

    // 3. Quét lệnh LƯU ĐƠN / HOÀN TẤT (OK, LUU, SAVE)
    if (['OK', 'LUU', 'LƯU', 'DONE', 'SAVE', 'HOANTAT', 'HOAN TAT'].includes(trimmedUpper)) {
        scannerInput.value = '';
        hideNxScannerDropdown();
        if (!currentDraftNxItems || currentDraftNxItems.length === 0) {
            playScanErrorSound();
            if (typeof showToast === 'function') {
                showToast('warning', 'Chưa Có Sản Phẩm', 'Đơn hàng chưa có sản phẩm nào để lưu!');
            }
            return;
        }
        if (typeof saveNxOrderToSystem === 'function') {
            await saveNxOrderToSystem();
        }
        return;
    }

    const parts = rawVal.split(';');
    const ma_vach = parts[0] ? parts[0].trim() : rawVal;
    const lot = parts[1] ? parts[1].trim() : '-';
    let date_expiry = parts[2] ? parts[2].trim() : '';

    if (date_expiry) {
        date_expiry = formatDateForNx(date_expiry);
    }

    let ten_hang_hoa = '';
    let matchedBarCode = ma_vach;

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

    if (!matchedVatTu) {
        playScanErrorSound(); 
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

    let existingIndex = -1;
    if (isPendingOrder) {

        existingIndex = currentDraftNxItems.findIndex(item => {
            return (item.ma_qr && item.ma_qr === ma_qr) || 
                   (item.ma_vach === matchedBarCode && item.lot === lot);
        });

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

    speakScanCount(scannedCount);

    scannerInput.value = '';
    scannerInput.focus();
    currentDraftOrder.items = currentDraftNxItems;
    saveNxDraftToStorage();
    renderNxDraftItemsTable();
    renderNhapXuatOrderList(filteredNhapXuatData);
    checkNxOrderModified();

}

function downloadNhapXuatExcelTemplate() {
    if (typeof XLSX === 'undefined') {
        if (typeof showVatTuNoticeModal === 'function') {
            showVatTuNoticeModal('warning', 'Chưa Sẵn Sàng', 'Thư viện SheetJS chưa sẵn sàng. Vui lòng kiểm tra lại kết nối mạng!');
        } else {
            alert('Thư viện SheetJS chưa sẵn sàng!');
        }
        return;
    }

    const templateRows = [
        [
            "STT",
            "Mã VT",
            "Tên Hàng Hóa",
            "LOT",
            "Date",
            "Số Lượng"
        ],
        [
            1,
            "300000000197",
            "Povidine 10% 500ml",
            "LOT202601",
            "31/12/2026",
            10
        ],
        [
            2,
            "8935110200625",
            "Vinco-Forte 100ml",
            "LOT202602",
            "15/08/2027",
            5
        ],
        [
            3,
            "8936001234567",
            "Nước cất tiêm 5ml",
            "-",
            "-",
            20
        ]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateRows);

    worksheet['!cols'] = [
        { wch: 6 },   
        { wch: 18 },  
        { wch: 35 },  
        { wch: 16 },  
        { wch: 16 },  
        { wch: 12 }   
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mau_Nhap_Xuat");

    const fileName = `File_Mau_Nhap_Xuat_GAIA.xlsx`;

    try {
        const b64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${b64}`;
        const link = document.createElement('a');
        link.href = dataUrl;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.warn("downloadNhapXuatExcelTemplate: Fallback to XLSX.writeFile due to:", e);
        XLSX.writeFile(workbook, fileName);
    }

    if (typeof showToast === 'function') {
        showToast('success', 'Tải Template Mẫu', 'Đã tải xuống file Excel mẫu nhập xuất thành công.');
    }
}

async function handleNxExcelFileImport(event) {
    const fileInput = event.target;
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        if (typeof showVatTuNoticeModal === 'function') {
            showVatTuNoticeModal('warning', 'Chưa Sẵn Sàng', 'Thư viện SheetJS (XLSX) chưa sẵn sàng. Vui lòng kiểm tra lại kết nối!');
        } else {
            alert('Thư viện SheetJS chưa sẵn sàng!');
        }
        fileInput.value = '';
        return;
    }

    if (currentDraftOrder && currentDraftOrder.trang_thai === 'Đã hủy') {
        if (typeof showVatTuNoticeModal === 'function') {
            showVatTuNoticeModal('warning', 'Đơn Đã Bị Hủy', 'Không thể nạp thêm sản phẩm vào đơn hàng đã bị hủy!');
        } else {
            alert('Không thể nạp thêm sản phẩm vào đơn hàng đã bị hủy!');
        }
        fileInput.value = '';
        return;
    }

    try {
        const dataBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(dataBuffer, { type: 'array', cellDates: false });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            throw new Error('File Excel không có sheet dữ liệu nào!');
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true });

        const isRowEmpty = (row) => Object.values(row).every(v => v === null || v === undefined || String(v).trim() === '');
        const validRawRows = (rawJson || []).filter(row => !isRowEmpty(row));

        if (!validRawRows || validRawRows.length === 0) {
            if (typeof showVatTuNoticeModal === 'function') {
                showVatTuNoticeModal('warning', 'File Excel Trống', 'File Excel được chọn không chứa dữ liệu!');
            } else {
                alert('File Excel được chọn không chứa dữ liệu!');
            }
            fileInput.value = '';
            return;
        }

        const getRowVal = (row, ...keys) => {
            const rowKeys = Object.keys(row);
            for (const k of keys) {
                const targetNorm = k.trim().toLowerCase().replace(/[\s_\-\.\:\/]/g, '');
                const foundKey = rowKeys.find(rk => {
                    const rkNorm = rk.trim().toLowerCase().replace(/[\s_\-\.\:\/]/g, '');
                    return rkNorm === targetNorm;
                });
                if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
                    return row[foundKey];
                }
            }
            return '';
        };

        const parseExcelDate = (val) => {
            if (!val || val === '-' || val === 'null' || val === 'undefined') return null;

            if (typeof val === 'number' && val > 1000) {
                try {
                    if (typeof XLSX !== 'undefined' && XLSX.SSF && typeof XLSX.SSF.parse_date_code === 'function') {
                        const p = XLSX.SSF.parse_date_code(val);
                        if (p && p.y && p.m && p.d) {
                            const d = String(p.d).padStart(2, '0');
                            const m = String(p.m).padStart(2, '0');
                            const y = String(p.y);
                            return `${d}/${m}/${y}`;
                        }
                    }
                } catch (e) {}

                const dt = new Date(Math.round((val - 25569) * 86400 * 1000));
                if (!isNaN(dt.getTime())) {
                    const d = String(dt.getUTCDate()).padStart(2, '0');
                    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
                    const y = dt.getUTCFullYear();
                    return `${d}/${m}/${y}`;
                }
            }

            const str = String(val).trim();
            if (!str || str === '-') return null;

            const ddMmMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
            if (ddMmMatch) {
                const d = ddMmMatch[1].padStart(2, '0');
                const m = ddMmMatch[2].padStart(2, '0');
                const y = ddMmMatch[3].length === 2 ? '20' + ddMmMatch[3] : ddMmMatch[3];
                return `${d}/${m}/${y}`;
            }

            const yyyyMmMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
            if (yyyyMmMatch) {
                const y = yyyyMmMatch[1];
                const m = yyyyMmMatch[2].padStart(2, '0');
                const d = yyyyMmMatch[3].padStart(2, '0');
                return `${d}/${m}/${y}`;
            }

            if (typeof formatDateForNx === 'function') {
                const res = formatDateForNx(str);
                return (res && res !== '-') ? res : null;
            }

            return str;
        };

        const rawImportList = [];
        for (let i = 0; i < validRawRows.length; i++) {
            const row = validRawRows[i];

            const rawCode = getRowVal(
                row,
                'mã vt', 'mãvt', 'mã vật tư', 'ma vt', 'mavt', 'ma vat tu',
                'mã vạch', 'mãvạch', 'ma vach', 'mavach',
                'mã hàng', 'ma hang', 'mã hàng hóa', 'ma hang hoa',
                'mã sp', 'ma sp', 'mã sản phẩm', 'ma san pham',
                'barcode', 'item code', 'itemcode', 'item_code', 'code', 'sku',
                'ma_vach', 'ma_vt'
            );
            const ma_vach = String(rawCode).trim();
            if (!ma_vach) continue; 

            const rawTenHangHoa = getRowVal(
                row,
                'tên hàng hóa', 'ten hang hoa', 'tên hàng', 'ten hang',
                'tên mặt hàng', 'ten mat hang', 'tên sản phẩm', 'ten san pham',
                'tên vật tư', 'ten vat tu',
                'product name', 'item name', 'name', 'description',
                'ten_hang_hoa', 'ten_mat_hang', 'ten_san_pham'
            );

            const rawLot = getRowVal(
                row,
                'lot', 'lô', 'số lô', 'so lo', 'solo', 'lô sx', 'lo sx',
                'batch', 'batch no', 'batch_no', 'lot no', 'lot_no', 'so_lo'
            );
            const lot = String(rawLot).trim() || '-';

            const rawDate = getRowVal(
                row,
                'date', 'date expiry', 'date_expiry', 'expiry', 'exp date', 'exp_date',
                'hạn dùng', 'han dung', 'hsd', 'hạn sử dụng', 'han su dung',
                'ngày hết hạn', 'ngay het han', 'date_hsd', 'hạn'
            );
            const date_expiry = parseExcelDate(rawDate);

            const rawQty = getRowVal(
                row,
                'số lượng', 'so luong', 'soluong', 'sl', 'số lượng thực tế',
                'quantity', 'qty', 'count', 'so_luong', 'sl_nhap', 'sl_xuat'
            );
            let parsedQty = 1;
            if (rawQty !== '') {
                const p = parseFloat(String(rawQty).replace(/,/g, ''));
                parsedQty = isNaN(p) ? 0 : Math.max(0, p);
            }

            rawImportList.push({
                ma_vach: ma_vach,
                excel_ten_hang_hoa: String(rawTenHangHoa).trim(),
                lot: lot,
                date_expiry: date_expiry,
                so_luong: parsedQty
            });
        }

        if (rawImportList.length === 0) {
            if (typeof showVatTuNoticeModal === 'function') {
                showVatTuNoticeModal(
                    'warning',
                    'Không Tìm Thấy Dữ Liệu Hợp Lệ',
                    'File Excel không có dòng nào chứa cột <strong>Mã VT / Mã Vạch</strong> hợp lệ!<br><br>' +
                    '<i>Gợi ý các cột hỗ trợ: Mã VT, Tên hàng hóa, LOT, Date (dd/mm/yyyy), Số lượng.</i>'
                );
            } else {
                alert('File Excel không có dòng nào chứa cột Mã VT / Mã Vạch hợp lệ!');
            }
            fileInput.value = '';
            return;
        }

        let allVatTu = [];
        if (typeof vatTuData !== 'undefined' && Array.isArray(vatTuData) && vatTuData.length > 0) {
            allVatTu = vatTuData;
        } else if (typeof window.vatTuData !== 'undefined' && Array.isArray(window.vatTuData) && window.vatTuData.length > 0) {
            allVatTu = window.vatTuData;
        }

        const vatTuLookupMap = new Map();
        const missingBarcodes = [];

        allVatTu.forEach(v => {
            const vCode = v.ma_vach ? String(v.ma_vach).trim().toLowerCase() : '';
            const vQr = v.ma_qr ? String(v.ma_qr).trim().toLowerCase() : '';
            if (vCode && !vatTuLookupMap.has(vCode)) vatTuLookupMap.set(vCode, v);
            if (vQr && !vatTuLookupMap.has(vQr)) vatTuLookupMap.set(vQr, v);
        });

        rawImportList.forEach(item => {
            const qLower = item.ma_vach.toLowerCase();
            if (!vatTuLookupMap.has(qLower)) {
                if (!missingBarcodes.includes(item.ma_vach)) {
                    missingBarcodes.push(item.ma_vach);
                }
            }
        });

        if (missingBarcodes.length > 0) {
            const client = getNhapXuatSupabaseClient();
            if (client) {
                try {
                    const { data } = await client
                        .from('san_pham')
                        .select('*')
                        .in('ma_vach', missingBarcodes);

                    if (data && data.length > 0) {
                        data.forEach(v => {
                            const vCode = v.ma_vach ? String(v.ma_vach).trim().toLowerCase() : '';
                            if (vCode) vatTuLookupMap.set(vCode, v);
                        });
                    }
                } catch (e) {
                    console.warn("handleNxExcelFileImport: Error querying Supabase table san_pham:", e);
                }
            }
        }

        const currentMaDon = document.getElementById('nx-input-madon')?.value || currentDraftOrder.ma_don || 'ĐƠN-NHÁP';
        const currentLoai = document.getElementById('nx-input-loai')?.value || currentDraftOrder.loai_don || 'Nhập';

        const validRows = [];
        const notFoundCodes = [];

        rawImportList.forEach(row => {
            const qLower = row.ma_vach.toLowerCase();
            const matchedVatTu = vatTuLookupMap.get(qLower);

            if (matchedVatTu) {

                const officialName = matchedVatTu.ten_mat_hang || matchedVatTu.ten_hoa_don || matchedVatTu.ten_san_pham || row.excel_ten_hang_hoa || 'Vật tư y tế';
                const officialBarcode = matchedVatTu.ma_vach || row.ma_vach;
                validRows.push({
                    ma_vach: officialBarcode,
                    ten_hang_hoa: officialName,
                    lot: row.lot || '-',
                    date_expiry: row.date_expiry || null,
                    so_luong: row.so_luong
                });
            } else {
                if (!notFoundCodes.includes(row.ma_vach)) {
                    notFoundCodes.push(row.ma_vach);
                }
            }
        });

        const applyValidRowsToDraft = (rowsToApply) => {
            if (!rowsToApply || rowsToApply.length === 0) {
                if (typeof showToast === 'function') {
                    showToast('warning', 'Không Có Dữ Liệu', 'Không có sản phẩm hợp lệ nào để thêm vào đơn.');
                }
                return;
            }

            let importedCount = 0;
            let totalImportedQty = 0;

            rowsToApply.forEach(row => {
                const cleanLot = row.lot || '-';
                const cleanDate = row.date_expiry || null;
                const qty = row.so_luong;

                const existingIndex = currentDraftNxItems.findIndex(item => {
                    const sameBarcode = item.ma_vach === row.ma_vach;
                    const sameLot = (item.lot || '-') === cleanLot;
                    const itemDate = item.date_expiry ? (formatDateForNx(item.date_expiry) || item.date_expiry) : '-';
                    const rowDate = cleanDate ? (formatDateForNx(cleanDate) || cleanDate) : '-';
                    return sameBarcode && sameLot && itemDate === rowDate;
                });

                if (existingIndex !== -1) {
                    currentDraftNxItems[existingIndex].so_luong = (Number(currentDraftNxItems[existingIndex].so_luong) || 0) + qty;
                    currentDraftNxItems[existingIndex].ten_hang_hoa = row.ten_hang_hoa;
                } else {
                    currentDraftNxItems.push({
                        ma_qr: buildMaQr(row.ma_vach, cleanLot, cleanDate),
                        ma_vach: row.ma_vach,
                        lot: cleanLot,
                        date_expiry: cleanDate,
                        ten_hang_hoa: row.ten_hang_hoa,
                        so_luong: qty
                    });
                }

                importedCount++;
                totalImportedQty += qty;
            });

            logNxOrderAction(
                currentMaDon,
                currentLoai,
                'NHAP_EXCEL',
                `Nạp file Excel [${file.name}] thêm ${importedCount} dòng (Tổng SL: ${totalImportedQty})`
            );

            currentDraftOrder.items = currentDraftNxItems;
            saveNxDraftToStorage();
            renderNxDraftItemsTable();
            renderNhapXuatOrderList(filteredNhapXuatData);
            checkNxOrderModified();

            if (typeof playScanSuccessSound === 'function') {
                playScanSuccessSound();
            }

            if (typeof showVatTuNoticeModal === 'function') {
                showVatTuNoticeModal('success', 'Nhập Excel Thành Công', `Đã thêm <strong>${importedCount}</strong> sản phẩm : Tổng số lượng: <strong style="color: #10b981;">${totalImportedQty.toLocaleString('vi-VN')}</strong>`);
            } else if (typeof showToast === 'function') {
                showToast('success', 'Nhập Excel Thành Công', `Đã thêm ${importedCount} sản phẩm : Tổng số lượng: ${totalImportedQty.toLocaleString('vi-VN')}`);
            }
        };

        if (notFoundCodes.length > 0) {
            if (typeof playScanErrorSound === 'function') {
                playScanErrorSound();
            }

            const errorListHtml = notFoundCodes.map(c => `• ${escapeHtml(c)}`).join('<br>');

            if (validRows.length === 0) {
                if (typeof showVatTuNoticeModal === 'function') {
                    showVatTuNoticeModal(
                        'error',
                        'Mã Vạch Không Tồn Tại',
                        `Tất cả <strong>${notFoundCodes.length} mã vạch</strong> trong file Excel không tồn tại trong kho Vật Tư:<br><br>` +
                        `<div style="max-height: 130px; overflow-y: auto; background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);">${errorListHtml}</div>`
                    );
                } else {
                    alert(`Không tìm thấy mã vạch trong kho: ${notFoundCodes.join(', ')}`);
                }
                return;
            }

            const confirmMsg = `Phát hiện <strong>${notFoundCodes.length} mã vạch</strong> không tìm thấy trong kho Vật Tư:<br><br>` +
                `<div style="max-height: 120px; overflow-y: auto; background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 12px;">${errorListHtml}</div>` +
                `Bạn có muốn <strong>bỏ qua các mã lỗi này</strong> và tiếp tục thêm <strong>${validRows.length} sản phẩm hợp lệ</strong> vào đơn không?`;

            showGenericConfirmModal(
                'LỖI MÃ VẠCH',
                'Phát Hiện Mã Vạch Không Tồn Tại',
                confirmMsg,
                'Nhấn "Đồng ý" để nạp các mã hợp lệ và bỏ qua mã lỗi, hoặc "Hủy bỏ" để dừng lại.',
                '#ef4444',
                'Đồng ý (Bỏ qua mã lỗi)',
                () => {
                    applyValidRowsToDraft(validRows);
                }
            );
        } else {

            applyValidRowsToDraft(validRows);
        }

    } catch (err) {
        console.error("handleNxExcelFileImport error:", err);
        if (typeof showVatTuNoticeModal === 'function') {
            showVatTuNoticeModal('error', 'Lỗi Đọc File Excel', `Có lỗi xảy ra khi đọc file Excel: ${err.message || err}`);
        } else {
            alert(`Có lỗi khi đọc file Excel: ${err.message || err}`);
        }
    } finally {
        fileInput.value = '';
    }
}

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

        const availableStock = getAvailableStockInNx(item.ma_vach, item.lot, item.date_expiry, branchCode, currentMaDon);

        if (currentLoai === 'Xuất') {
            if (availableStock <= 0 || qty > availableStock) {
                barcodeStyle = 'background: #ef4444 !important; color: #ffffff !important; font-weight: bold; border: 1px solid #dc2626; box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);';
            }
        }

        let stockColor = '#10b981';
        if (availableStock <= 0) {
            stockColor = '#ef4444';
        } else if (currentLoai === 'Xuất' && qty >= availableStock) {
            stockColor = '#f59e0b';
        }

        const fmtAvailable = typeof formatQuantity === 'function' ? formatQuantity(availableStock) : availableStock;
        const stockLabel = `<span style="font-size: 11px; font-weight: 600; color: ${stockColor}; line-height: 1.2; text-align: center; display: block; white-space: nowrap;">Tồn: ${fmtAvailable}</span>`;

        let qtyDisplay = `<input type="number" min="0" step="any" class="form-control-sm" style="width: 75px; text-align: right; font-weight: 700; color: #10b981;" value="${qty}" onchange="updateNxDraftItemQty(${idx}, this.value)">`;
        if (currentDraftOrder.trang_thai === 'Đã hủy') {
            const prevQty = item.so_luong_truoc_khi_huy != null ? item.so_luong_truoc_khi_huy : item.so_luong;
            const fmtPrev = typeof formatQuantity === 'function' ? formatQuantity(prevQty) : prevQty;
            qtyDisplay = `<div style="display: flex; align-items: center; justify-content: flex-end;">
                            <span style="text-decoration: line-through; color: #ef4444; font-size: 13.5px; font-weight: 700; padding-right: 8px;">${fmtPrev}</span>
                          </div>`;
        } else if (currentDraftOrder.trang_thai === 'Chờ' && item.so_luong_yeu_cau) {
            const fmtReq = typeof formatQuantity === 'function' ? formatQuantity(item.so_luong_yeu_cau) : item.so_luong_yeu_cau;
            qtyDisplay = `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                            <span style="font-size: 11px; color: var(--text-muted);">Cần quét: <strong style="color: var(--text-primary);">${fmtReq}</strong></span>
                            <input type="number" min="0" step="any" max="${item.so_luong_yeu_cau}" class="form-control-sm" style="width: 75px; text-align: right; font-weight: 700; color: ${qty >= item.so_luong_yeu_cau ? '#10b981' : '#ef4444'};" value="${qty}" onchange="updateNxDraftItemQty(${idx}, this.value)">
                          </div>`;
        }

        const deleteActionHtml = currentDraftOrder.trang_thai === 'Đã hủy'
            ? `<span style="color: var(--text-muted); font-size: 12px;">-</span>`
            : `<button type="button" class="btn-action-icon btn-delete-vattu" onclick="removeNxDraftItem(${idx})" title="Xóa khỏi đơn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
               </button>`;

        const allVatTu = (typeof window.vatTuData !== 'undefined' && Array.isArray(window.vatTuData)) ? window.vatTuData : (typeof vatTuData !== 'undefined' ? vatTuData : []);
        const matchedProduct = allVatTu.find(x => x.ma_vach === item.ma_vach);
        const itemImg = item.anh || (matchedProduct ? matchedProduct.anh : '');
        const imgCellHtml = itemImg ? `
            <div class="vattu-img-cell-wrap" style="justify-content: center;">
                <div class="vattu-img-thumb-wrap" style="width: 44px; height: 44px;" onclick="event.stopPropagation(); if(typeof openVatTuImageLightbox==='function') openVatTuImageLightbox('${escapeHtml(itemImg)}', '${nameEscaped}', '${escapeHtml(item.ma_vach || '')}', '${matchedProduct ? matchedProduct.id : ''}')" title="Click để xem ảnh lớn">
                    <img src="${escapeHtml(itemImg)}" alt="" class="vattu-img-thumb" loading="lazy" />
                </div>
            </div>
        ` : `<span style="color: var(--text-muted); font-size: 11px;">-</span>`;

        tr.innerHTML = `
            <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
            <td style="text-align: center; vertical-align: middle; padding: 2px;">
                ${imgCellHtml}
            </td>
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
                ${deleteActionHtml}
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (totalQtyEl) {
        const fmtTotal = typeof formatQuantity === 'function' ? formatQuantity(totalQty) : totalQty.toLocaleString('vi-VN');
        totalQtyEl.innerHTML = `Tổng <strong style="color: #10b981; font-size: 15px;">${totalRows}</strong> sản phẩm - Số Lượng: <strong style="color: #10b981; font-size: 15px;">${fmtTotal}</strong>`;
    }
}

function updateNxDraftItemQty(idx, newQty) {
    if (currentDraftOrder && currentDraftOrder.trang_thai === 'Đã hủy') return;
    const item = currentDraftNxItems[idx];
    if (!item) return;

    const oldQty = item.so_luong;
    const parsed = parseFloat(newQty);
    let finalQty = (isNaN(parsed) || parsed < 0) ? 0 : Math.round(parsed * 10000) / 10000;

    const isPendingOrder = currentDraftOrder && currentDraftOrder.trang_thai === 'Chờ';
    if (isPendingOrder && item.so_luong_yeu_cau && finalQty > item.so_luong_yeu_cau) {
        const fmtReq = typeof formatQuantity === 'function' ? formatQuantity(item.so_luong_yeu_cau) : item.so_luong_yeu_cau;
        if (typeof showVatTuNoticeModal === 'function') {
            showVatTuNoticeModal('warning', 'Vượt Quá Yêu Cầu', `Sản phẩm đã vượt quá số lượng yêu cầu (${fmtReq}). Đã tự động điều chỉnh lại mức tối đa!`);
        } else {
            alert(`Sản phẩm đã vượt quá số lượng yêu cầu (${fmtReq}).`);
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
    _doCreateNewNhapXuatOrderForm();
}

function showGenericConfirmModal(badgeText, title, textHtml, subtextHtml, badgeColor, okBtnText, onConfirmCallback) {
    const modal = document.getElementById('generic-confirm-modal');
    if (!modal) {

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

    modal.style.setProperty('display', 'flex', 'important');

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
    const isManager = isStrictManagerRole(loggedUser) || (typeof window.isManagerRole === 'function' ? window.isManagerRole(loggedUser) : false);

    if (selectedNxOrderId === null && isManager && managerBranchSelect && managerBranchSelect.style.display !== 'none' && !managerBranchSelect.value) {
        if (typeof showVatTuNoticeModal === 'function') {
            showVatTuNoticeModal('warning', 'Bắt Buộc Chọn Chi Nhánh', 'Bạn đang đăng nhập quyền <strong>Quản Lý</strong>.<br>Vui lòng <strong>chọn Chi Nhánh</strong> thực hiện đơn kho trước khi lưu!');
        } else if (typeof showToast === 'function') {
            showToast('warning', 'Bắt Buộc Chọn Chi Nhánh', 'Vui lòng chọn Chi Nhánh thực hiện đơn kho trước khi lưu!');
        } else {
            alert('Vui lòng chọn Chi Nhánh thực hiện đơn kho trước khi lưu!');
        }
        managerBranchSelect.focus();
        managerBranchSelect.style.borderColor = '#ef4444';
        managerBranchSelect.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.5)';
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

    if (loaiDon === 'Xuất' && currentDraftNxItems.length > 0) {
        const branchCode = extractCNCodeFromBranchString(userName);
        for (const item of currentDraftNxItems) {
            const scannedQty = Number(item.so_luong) || 0;
            if (scannedQty <= 0) continue;

            const currentStock = getAvailableStockInNx(item.ma_vach, item.lot, item.date_expiry, branchCode, maDon);
            if (currentStock < scannedQty) {
                if (typeof showVatTuNoticeModal === 'function') {
                    showVatTuNoticeModal('error', 'Lỗi Xuất Âm', `Mã <strong>${item.ma_vach}</strong> (LOT: ${item.lot || '-'}) chỉ còn tồn <strong>${currentStock}</strong> ở ${branchCode}, không thể xuất <strong>${scannedQty}</strong>!`);
                } else {
                    alert(`Mã ${item.ma_vach} (LOT: ${item.lot || '-'}) chỉ còn tồn ${currentStock} ở ${branchCode}, không thể xuất ${scannedQty}!`);
                }
                return;
            }
        }
    }
    const tongSoLuong = Math.round(currentDraftNxItems.reduce((acc, x) => acc + (Number(x.so_luong) || 0), 0) * 10000) / 10000;

    let finalFileUrl = null;
    if (currentNxAttachments && currentNxAttachments.length > 0) {
        if (currentNxAttachments.length === 1) {
            finalFileUrl = currentNxAttachments[0].url;
        } else {
            finalFileUrl = JSON.stringify(currentNxAttachments);
        }
    }

    const isAllZeroQty = currentDraftNxItems.length > 0 && currentDraftNxItems.every(x => (Number(x.so_luong) || 0) === 0);

    const orderPayload = {
        ma_don: maDon,
        loai_don: loaiDon,
        muc_dich: mucDich,
        user_name: userName,
        chi_tiet_san_pham: currentDraftNxItems,
        tong_so_luong: tongSoLuong,
        file_url: finalFileUrl,
        trang_thai: isAllZeroQty ? 'Chờ' : 'Done'
    };

    const client = getNhapXuatSupabaseClient();
    let saveSuccess = false;

    if (selectedNxOrderId !== null) {
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

                const selectedOrder = nhapXuatData.find(x => String(x.id) === String(selectedNxOrderId) || x.ma_don === maDon);
                if (selectedOrder && selectedOrder.trang_thai === 'Đã hủy') {
                    updatePayload.trang_thai = 'Đã hủy';
                } else if (isAllZeroQty) {
                    updatePayload.trang_thai = 'Chờ';
                } else if (isPendingOrder) {
                    updatePayload.trang_thai = 'Done';
                }

                try {
                    if (client) {

                        const { error: err1 } = await client
                            .from('nhap_xuat')
                            .update(updatePayload)
                            .eq('id', selectedNxOrderId);

                        if (err1) {
                            console.warn("NhapXuat: Error updating by ID, trying by ma_don:", err1.message);
                            await client
                                .from('nhap_xuat')
                                .update(updatePayload)
                                .eq('ma_don', maDon);
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

                    originalOrderStateSnapshot = getNxOrderCurrentStateSnapshot();

                    renderNxDraftItemsTable();
                    applyNhapXuatFilters();
                    renderNhapXuatOrderList(filteredNhapXuatData);
                    updateNxSaveButtonState(false); 
                }
            }
        );
    } else {
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
            _doCreateNewNhapXuatOrderForm();
        }
    }
}

async function cancelNxOrder() {
    if (!selectedNxOrderId || !currentDraftOrder) {
        if (typeof showToast === 'function') {
            showToast('warning', 'Chưa Chọn Đơn', 'Vui lòng chọn một đơn kho để thực hiện xóa/hủy.');
        }
        return;
    }

    const maDon = document.getElementById('nx-input-madon')?.value || currentDraftOrder.ma_don || '';
    const loaiDon = document.getElementById('nx-input-loai')?.value || currentDraftOrder.loai_don || 'Nhập';

    showGenericConfirmModal(
        'XÁC NHẬN HỦY ĐƠN',
        `Xóa / Hủy Đơn Kho ${maDon}`,
        `Bạn có chắc chắn muốn xóa/hủy đơn [<strong>${escapeHtml(maDon)}</strong>] không?<br><br>` +
        `• Toàn bộ số lượng đã quét sẽ được <strong>đưa về 0</strong>.<br>` +
        `• Tự động thu hồi và hoàn trả số lượng trong Thẻ Kho.<br>` +
        `• Khóa chức năng quét và không cho phép thay đổi dữ liệu.<br>` +
        `<em>(Bạn có thể nhấn nút "Hủy Xóa / Khôi Phục" bất cứ lúc nào để tiếp tục thực hiện).</em>`,
        'Thao tác này sẽ được ghi lại đầy đủ vào Nhật ký Lịch sử.',
        '#ef4444',
        'Xác Nhận Hủy Đơn',
        async () => {
            try {
                const client = getNhapXuatSupabaseClient();

                currentDraftNxItems = (currentDraftNxItems || []).map(item => ({
                    ...item,
                    so_luong_truoc_khi_huy: item.so_luong || 0,
                    so_luong: 0
                }));
                const tongSoLuong = 0;

                if (client && maDon) {
                    try {
                        await client.from('the_kho').delete().eq('ma_don', maDon);
                    } catch (tkErr) {
                        console.warn("NhapXuat: Error clearing the_kho for cancelled order:", tkErr);
                    }
                }

                const updatePayload = {
                    trang_thai: 'Đã hủy',
                    chi_tiet_san_pham: currentDraftNxItems,
                    tong_so_luong: tongSoLuong
                };

                if (client) {
                    const { error: err1 } = await client
                        .from('nhap_xuat')
                        .update(updatePayload)
                        .eq('id', selectedNxOrderId);

                    if (err1) {
                        await client
                            .from('nhap_xuat')
                            .update(updatePayload)
                            .eq('ma_don', maDon);
                    }
                }

                const idx = nhapXuatData.findIndex(x => String(x.id) === String(selectedNxOrderId) || x.ma_don === maDon);
                if (idx !== -1) {
                    nhapXuatData[idx] = { ...nhapXuatData[idx], ...updatePayload };
                }
                currentDraftOrder.trang_thai = 'Đã hủy';
                currentDraftOrder.chi_tiet_san_pham = currentDraftNxItems;
                currentDraftOrder.tong_so_luong = 0;

                await logNxOrderAction(
                    maDon,
                    loaiDon,
                    'HỦY_ĐƠN',
                    `Đã hủy đơn kho ${maDon}. Toàn bộ số lượng đã quét đưa về 0, khóa quét và chỉnh sửa.`
                );

                if (typeof showToast === 'function') {
                    showToast('success', 'Đã Hủy Đơn', `Đã hủy đơn ${maDon} thành công. Đã đưa số lượng quét về 0 và lưu vào lịch sử.`);
                }

                _doSelectNxOrderForView(currentDraftOrder);
                applyNhapXuatFilters();

                if (typeof fetchTheKhoData === 'function') fetchTheKhoData();
                if (typeof fetchVatTuData === 'function') fetchVatTuData();

            } catch (err) {
                console.error("Lỗi khi hủy đơn kho:", err);
                if (typeof showToast === 'function') {
                    showToast('error', 'Lỗi', 'Có lỗi xảy ra khi hủy đơn kho!');
                }
            }
        }
    );
}

async function restoreCancelledNxOrder() {
    if (!selectedNxOrderId || !currentDraftOrder || currentDraftOrder.trang_thai !== 'Đã hủy') {
        if (typeof showToast === 'function') {
            showToast('warning', 'Không Hợp Lệ', 'Chỉ có thể khôi phục đơn đang ở trạng thái "Đã hủy".');
        }
        return;
    }

    const maDon = document.getElementById('nx-input-madon')?.value || currentDraftOrder.ma_don || '';
    const loaiDon = document.getElementById('nx-input-loai')?.value || currentDraftOrder.loai_don || 'Nhập';

    const modalHtml = `
    <div id="custom-restore-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 99999;">
        <div style="background: var(--app-bg, white); padding: 24px; border-radius: 12px; width: 450px; max-width: 90vw; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 1px solid var(--sidebar-border, #e5e7eb);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                <span style="background: rgba(16,185,129,0.2); color: #10b981; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;">XÁC NHẬN KHÔI PHỤC</span>
            </div>
            <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary, #1f2937);">Khôi Phục Đơn Kho ${maDon}</h3>
            <p style="margin: 0 0 20px 0; color: var(--text-muted, #4b5563); font-size: 14px; line-height: 1.5;">
                Bạn muốn khôi phục đơn này như thế nào?<br><br>
                <strong style="color: var(--text-primary, #1f2937);">1. Khôi phục tất cả:</strong> Khôi phục cả sản phẩm và <strong>số lượng đã quét trước đó</strong>.<br>
                <strong style="color: var(--text-primary, #1f2937);">2. Chỉ khôi phục SP:</strong> Giữ lại danh sách sản phẩm, nhưng số lượng = 0 (quét lại từ đầu).
            </p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button id="btn-restore-all" style="padding: 10px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">Khôi phục Tất cả (Cả Số lượng)</button>
                <button id="btn-restore-sp" style="padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">Chỉ khôi phục Sản phẩm (SL = 0)</button>
                <button id="btn-restore-cancel" style="padding: 10px; background: var(--input-bg, #f3f4f6); color: var(--text-primary, #4b5563); border: 1px solid var(--input-border, #d1d5db); border-radius: 6px; font-weight: 600; cursor: pointer; margin-top: 8px;">Đóng / Hủy bỏ</button>
            </div>
        </div>
    </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div);

    const closeModal = () => {
        if (document.body.contains(div)) {
            document.body.removeChild(div);
        }
    };

    document.getElementById('btn-restore-cancel').addEventListener('click', closeModal);

    const executeRestore = async (restoreQuantity) => {
        closeModal();
        try {
            const client = getNhapXuatSupabaseClient();

            currentDraftNxItems = (currentDraftNxItems || []).map(item => ({
                ...item,
                so_luong: restoreQuantity ? (item.so_luong_truoc_khi_huy || 0) : 0
            }));
            const tongSoLuong = Math.round(currentDraftNxItems.reduce((sum, item) => sum + (Number(item.so_luong) || 0), 0) * 10000) / 10000;

            const newStatus = tongSoLuong > 0 ? 'Done' : 'Chờ';

            const updatePayload = {
                trang_thai: newStatus,
                chi_tiet_san_pham: currentDraftNxItems,
                tong_so_luong: tongSoLuong
            };

            if (client) {
                const { error: err1 } = await client
                    .from('nhap_xuat')
                    .update(updatePayload)
                    .eq('id', selectedNxOrderId);

                if (err1) {
                    await client
                        .from('nhap_xuat')
                        .update(updatePayload)
                        .eq('ma_don', maDon);
                }
            }

            if (newStatus === 'Done') {
                const fullOrderPayload = { ...currentDraftOrder, ...updatePayload };
                await syncNxOrderToTheKhoEntries(fullOrderPayload, true);
            }

            const idx = nhapXuatData.findIndex(x => String(x.id) === String(selectedNxOrderId) || x.ma_don === maDon);
            if (idx !== -1) {
                nhapXuatData[idx] = { ...nhapXuatData[idx], ...updatePayload };
            }
            currentDraftOrder.trang_thai = newStatus;
            currentDraftOrder.chi_tiet_san_pham = currentDraftNxItems;
            currentDraftOrder.tong_so_luong = tongSoLuong;

            const modeText = restoreQuantity ? 'toàn bộ (bao gồm số lượng cũ)' : 'chỉ danh sách sản phẩm (số lượng = 0)';
            await logNxOrderAction(
                maDon,
                loaiDon,
                'KHÔI_PHỤC_ĐƠN',
                `Đã khôi phục lại đơn kho ${maDon} - ${modeText}. Mở khóa quét.`
            );

            if (typeof showToast === 'function') {
                showToast('success', 'Đã Khôi Phục', `Đã khôi phục đơn ${maDon} (${modeText}).`);
            }

            _doSelectNxOrderForView(currentDraftOrder);
            applyNhapXuatFilters();

        } catch (err) {
            console.error("Lỗi khi khôi phục đơn kho:", err);
            if (typeof showToast === 'function') {
                showToast('error', 'Lỗi', 'Có lỗi xảy ra khi khôi phục đơn kho!');
            }
        }
    };

    document.getElementById('btn-restore-all').addEventListener('click', () => executeRestore(true));
    document.getElementById('btn-restore-sp').addEventListener('click', () => executeRestore(false));
}

async function hardDeleteNxOrder() {
    if (!selectedNxOrderId || !currentDraftOrder) return;

    const maDon = document.getElementById('nx-input-madon')?.value || currentDraftOrder.ma_don || '';

    showGenericConfirmModal(
        '⚠️ XÓA VĨNH VIỄN',
        `Xóa Vĩnh Viễn Đơn Kho ${maDon}`,
        `Bạn đang thao tác <strong>Xóa Vĩnh Viễn</strong> đơn [<strong>${escapeHtml(maDon)}</strong>].<br><br>` +
        `<span style="color:#ef4444;font-weight:bold;">CẢNH BÁO:</span> Thao tác này sẽ xóa sạch dữ liệu của đơn này khỏi hệ thống vĩnh viễn và không thể khôi phục.<br>` +
        `Bạn có chắc chắn muốn xóa không?`,
        'Nhấn "Xóa Vĩnh Viễn" để đồng ý xóa bỏ đơn lỗi này.',
        '#dc2626',
        'Xóa Vĩnh Viễn',
        async () => {
            try {
                const client = getNhapXuatSupabaseClient();
                if (client) {
                    const { error } = await client
                        .from('nhap_xuat')
                        .delete()
                        .eq('id', selectedNxOrderId);

                    if (error) throw error;
                }

                nhapXuatData = nhapXuatData.filter(x => String(x.id) !== String(selectedNxOrderId) && x.ma_don !== maDon);

                if (typeof showToast === 'function') {
                    showToast('success', 'Đã Xóa', `Đã xóa vĩnh viễn đơn ${maDon}.`);
                }

                _doCreateNewNhapXuatOrderForm();

            } catch (err) {
                console.error("Lỗi khi xóa vĩnh viễn đơn:", err);
                if (typeof showToast === 'function') {
                    showToast('error', 'Lỗi', 'Có lỗi xảy ra khi xóa vĩnh viễn đơn kho!');
                }
            }
        }
    );
}

window.cancelNxOrder = cancelNxOrder;
window.restoreCancelledNxOrder = restoreCancelledNxOrder;
window.hardDeleteNxOrder = hardDeleteNxOrder;
window.deletePendingNxOrder = cancelNxOrder;

function parseDateToYyyyMmDd(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr === 'null' || dateStr === 'undefined') return null;
    let str = String(dateStr).trim();
    if (!str) return null;

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
        const parts = str.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }

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

async function syncNxOrderToTheKhoEntries(order, isUpdate = false) {
    const maDon = order.ma_don || '';
    const normalizedLoai = (order.loai_don && String(order.loai_don).includes('Xuất')) ? 'Xuất' : 'Nhập';

    const theKhoEntries = (order.chi_tiet_san_pham || [])
        .filter(item => Number(item.so_luong) > 0)
        .map(item => {
            let itemMaQr = (item.ma_qr || '').trim();

            itemMaQr = itemMaQr.replace(/;-;?$/g, '').replace(/;-$/g, '');
            if (!itemMaQr) {
                itemMaQr = buildMaQr(item.ma_vach || '', item.lot, item.date_expiry);
            }
            return {
                ma_don: maDon,
                ma_qr: itemMaQr || item.ma_vach || '',
                ma_vach: item.ma_vach || item.ma_qr || 'KHONG-MA',
                lot: (item.lot && item.lot !== 'null' && item.lot !== 'undefined') ? item.lot : '-',
                date_expiry: parseDateToYyyyMmDd(item.date_expiry),
                ten_hang_hoa: item.ten_hang_hoa || 'Sản phẩm kho',
                loai: normalizedLoai, 
                so_luong: Number(item.so_luong),
                muc_dich: order.muc_dich || '',
                user_name: order.user_name || 'Thái Trung Tín - CN1',
                created_at: new Date().toISOString()
            };
        });

    const client = getNhapXuatSupabaseClient();
    try {
        if (client) {

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

    if (typeof fetchTheKhoData === 'function') {
        fetchTheKhoData();
    }
    if (typeof fetchVatTuData === 'function') {
        fetchVatTuData();
    }
}

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
    if (!dateStr || dateStr === '-' || dateStr === 'null' || dateStr === 'undefined') return '-';
    const str = String(dateStr).trim();
    if (!str || str === '-') return '-';

    const ddMmYyyyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (ddMmYyyyMatch) {
        const d = ddMmYyyyMatch[1].padStart(2, '0');
        const m = ddMmYyyyMatch[2].padStart(2, '0');
        const y = ddMmYyyyMatch[3].length === 2 ? '20' + ddMmYyyyMatch[3] : ddMmYyyyMatch[3];
        return `${d}/${m}/${y}`;
    }

    const yyyyMmDdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (yyyyMmDdMatch) {
        const y = yyyyMmDdMatch[1];
        const m = yyyyMmDdMatch[2].padStart(2, '0');
        const d = yyyyMmDdMatch[3].padStart(2, '0');
        return `${d}/${m}/${y}`;
    }

    const ddMmYyyyDashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if (ddMmYyyyDashMatch) {
        const d = ddMmYyyyDashMatch[1].padStart(2, '0');
        const m = ddMmYyyyDashMatch[2].padStart(2, '0');
        const y = ddMmYyyyDashMatch[3].length === 2 ? '20' + ddMmYyyyDashMatch[3] : ddMmYyyyDashMatch[3];
        return `${d}/${m}/${y}`;
    }

    try {
        const dt = new Date(str);
        if (!isNaN(dt.getTime())) {
            const d = String(dt.getDate()).padStart(2, '0');
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const y = dt.getFullYear();
            return `${d}/${m}/${y}`;
        }
    } catch (e) {}

    return str;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.fetchNhapXuatData = fetchNhapXuatData;
window.createNewNhapXuatOrderForm = createNewNhapXuatOrderForm;
window.applyNhapXuatFilters = applyNhapXuatFilters;
window.handleNxQrScannerAdd = handleNxQrScannerAdd;
window.handleNxExcelFileImport = handleNxExcelFileImport;
window.downloadNhapXuatExcelTemplate = downloadNhapXuatExcelTemplate;

async function processPdfFilesBatch(files, isAuto = false) {
    if (!files || files.length === 0) return { successCount: 0, duplicateCount: 0 };

    if (typeof window.pdfjsLib === 'undefined') {
        if (!isAuto) alert("Thư viện PDF chưa tải xong hoặc bị chặn, vui lòng tải lại trang.");
        return { successCount: 0, duplicateCount: 0 };
    }

    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    let successCount = 0;
    let duplicateCount = 0;

    if (!isAuto) {
        showGenericConfirmModal('⏳ ĐANG XỬ LÝ', 'Đang đọc File PDF', `Vui lòng đợi, đang bóc tách dữ liệu từ ${files.length} hóa đơn...`, '', '#3b82f6', null, null);
        const modalBtn = document.getElementById('generic-confirm-btn');
        if (modalBtn) modalBtn.style.display = 'none';
        const cancelBtn = document.getElementById('generic-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    try {
        let userNameFormatted = updateNxUserFieldWithBranch();
        let branchCode = extractCNCodeFromBranchString(userNameFormatted);

        const bSelect = document.getElementById('nx-manager-branch-select');
        if (!branchCode && bSelect && bSelect.value) {
            branchCode = extractCNCodeFromBranchString(bSelect.value);
        }

        const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
        const isStrictManager = isStrictManagerRole(loggedUser);
        const managerBranchOptions = (bSelect && bSelect.options)
            ? Array.from(bSelect.options).filter(opt => opt && opt.value && opt.value !== '')
            : [];
        const managerHasMultipleBranches = Boolean(
            bSelect &&
            bSelect.style.display !== 'none' &&
            managerBranchOptions.length > 1
        );

        // Policy mới: quản lý với nhiều chi nhánh không được tự gán CN1 trong lúc quét PDF/Thư mục.
        // Để dropdown ở dạng "-- Chọn Chi Nhánh --" và để người dùng chọn đúng chi nhánh khi lưu.
        // Chỉ fallback CN1 khi không phải strict manager và không phải trường hợp nhiều chi nhánh.
        if (!branchCode && !(isStrictManager && managerHasMultipleBranches)) {
            branchCode = 'CN1';
        }

        let allProducts = (typeof window.vatTuData !== 'undefined' && Array.isArray(window.vatTuData) && window.vatTuData.length > 0) ? window.vatTuData : [];
        if (allProducts.length === 0) {
            const client = getNhapXuatSupabaseClient();
            if (client) {
                try {
                    const resView = await client.from('view_vattu_tong_hop').select('*');
                    if (resView.data && resView.data.length > 0) {
                        allProducts = resView.data;
                    } else {
                        const resSp = await client.from('san_pham').select('*');
                        if (resSp.data && resSp.data.length > 0) {
                            allProducts = resSp.data;
                        }
                    }
                    if (allProducts.length > 0) {
                        window.vatTuData = allProducts;
                    }
                } catch (e) {
                    console.warn("Could not preload products for PDF parsing:", e);
                }
            }
        }

        const processedInvoiceCodesInBatch = new Set();
        const fileListArray = Array.from(files);
        const failedFiles = [];

        for (let i = 0; i < fileListArray.length; i++) {
            const file = fileListArray[i];
            let rawLines = [];
            let maHoaDon = null;
            let finalMucDich = '';

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    const pageItems = textContent.items || [];
                    if (pageItems.length === 0) continue;

                    const lineGroups = [];
                    pageItems.forEach(item => {
                        if (!item.str || !item.str.trim()) return;
                        const x = item.transform[4];
                        const y = item.transform[5];

                        let group = lineGroups.find(g => Math.abs(g.y - y) <= 4.0);
                        if (!group) {
                            group = { y: y, items: [] };
                            lineGroups.push(group);
                        }
                        group.items.push({ x: x, str: item.str });
                    });

                    lineGroups.sort((a, b) => b.y - a.y);

                    lineGroups.forEach(g => {
                        g.items.sort((a, b) => a.x - b.x);
                        const lineText = g.items.map(it => it.str).join(' ').trim();
                        if (lineText) {
                            rawLines.push(lineText);
                        }
                    });
                }
            } catch (pdfErr) {
                console.warn("Lỗi phân tích cấu trúc PDF file:", file.name, pdfErr);
                failedFiles.push({
                    fileName: file.name,
                    maHoaDon: 'Không rõ',
                    reason: 'File PDF lỗi hoặc không thể phân tích văn bản (' + (pdfErr.message || '') + ')',
                    time: new Date().toLocaleTimeString('vi-VN')
                });
                continue;
            }

            const fullTextFromLines = rawLines.join('\n');

            const maHoaDonMatch = fullTextFromLines.match(/Mã\s*HĐ\s*[:：]?\s*([^\r\n]+)/i) 
                || fullTextFromLines.match(/(?:Số hóa đơn|Mã hóa đơn|Số HĐ|Mã đơn)\s*[:：]?\s*([^\r\n]+)/i);
            if (maHoaDonMatch) {
                let rawMa = maHoaDonMatch[1].trim();
                const splitParts = rawMa.split(/\s+(?:Ngày|Khách hàng|Thú cưng|SĐT)\s*[:：]/i);
                maHoaDon = splitParts[0].trim();
            } else {
                for (let k = 0; k < rawLines.length; k++) {
                    const l = rawLines[k].trim();
                    if (/^Mã\s*HĐ\s*[:：]?$/i.test(l) && k + 1 < rawLines.length) {
                        maHoaDon = rawLines[k + 1].trim();
                        break;
                    }
                }
            }
            if (!maHoaDon) {
                maHoaDon = `HD-${Date.now()}`;
            }

            const isDuplicateInDb = typeof nhapXuatData !== 'undefined' && nhapXuatData.some(order => order.muc_dich && (order.muc_dich === maHoaDon || order.muc_dich.startsWith(maHoaDon + ' ') || order.muc_dich.includes(maHoaDon)));
            const isDuplicateInBatch = processedInvoiceCodesInBatch.has(maHoaDon);

            if (isDuplicateInDb || isDuplicateInBatch) {
                duplicateCount++;
                console.log(`Bỏ qua hóa đơn ${maHoaDon} vì đã tồn tại hoặc bị trùng trong danh sách tải.`);
                if (!isAuto && typeof showToast === 'function') {
                    showToast('error', 'Đơn Đã Tồn Tại', `Hóa đơn ${maHoaDon} đã tồn tại trong hệ thống hoặc bị trùng trong đợt tải!`);
                }
                continue;
            }

            let petName = '';
            const petNameMatch = fullTextFromLines.match(/(?:Tên thú cưng|Thú cưng)\s*[:：]?\s*([^\r\n]+)/i);
            if (petNameMatch) {
                let rawPet = petNameMatch[1].trim();
                const splitParts = rawPet.split(/\s+(?:Cân nặng|Cân|Loài|Giống|SĐT|Khách hàng|Tuổi|Giới tính)\s*[:：]/i);
                petName = splitParts[0].trim();
            }

            const invalidKeywords = ['không tên', 'khong ten', 'gaia', 'bệnh viện', 'phòng khám', 'tp.hcm', 'tphcm', 'hospital'];
            finalMucDich = maHoaDon;
            if (petName && !invalidKeywords.some(kw => petName.toLowerCase().includes(kw))) {
                finalMucDich = `${maHoaDon} - ${petName}`;
            }

            const items = [];

            // Detect typical medical services / non-inventory procedures to prevent false matching
            function isClinicServiceOrFee(str) {
                if (!str) return false;
                const s = str.toLowerCase().trim();
                const servicePatterns = [
                    /^(công|dịch vụ|dich vu|phí|tiền công|tien cong|khám|kham|siêu âm|sieu am|x-?quang|xquang|x quang|xét nghiệm|xet nghiem|nội soi|noi soi|chụp|chup|phẫu thuật|phau thuat|mổ|mo|tiêm truyền|truyền dịch|truyen dich|lưu chuồng|luu chuong|nội trú|noi tru|chăm sóc|cham soc|tắm|spa|cắt tỉa|cat tia|vệ sinh|ve sinh|cấp cứu|cap cuu|tẩy giun|tay giun|tiêm phòng|tiem phong|chích|chich|gửi thú|gui thu|lưu bệnh|luu benh)\b/i,
                    /(khám bệnh|kham benh|tái khám|tai kham|tiêm thuốc|tiem thuoc|truyền tĩnh mạch|tiêm bắp|tiêm dưới da|cắt chỉ|thay băng|bó bột|rửa vết thương|nặn tuyến hôi|lấy cao răng|triệt sản|đỡ đẻ|cắt đuôi|cắt tai|đốt mụn|cạo lông|khám tổng quát|khám da|khám mắt|khám tai)/i
                ];
                return servicePatterns.some(p => p.test(s));
            }

            // Robust extractor for quantity (integers and decimals like 0.01, 0.5, 1.25)
            function extractQuantityFromInvoiceLine(text) {
                if (!text) return 1;
                const trimmed = text.trim();
                const rawTokens = trimmed.split(/\s+/).filter(Boolean);
                const parsedList = [];

                for (const tok of rawTokens) {
                    const clean = tok
                        .replace(/^(stt|đvt|vnd|đ|k|\%)+/i, '')
                        .replace(/(ml|l|gam|g|kg|viên|vien|chai|lo|lọ|ống|ong|túi|tui|vỉ|vi|liều|lieu|lần|lan|hộp|hop|cái|cai|bộ|bo|\%|vnd|đ|k)$/i, '')
                        .trim();
                    if (!clean || !/\d/.test(clean)) continue;

                    let num = 0;
                    if (clean.includes(',') && clean.includes('.')) {
                        if (clean.lastIndexOf('.') > clean.lastIndexOf(',')) {
                            num = parseFloat(clean.replace(/,/g, '')) || 0;
                        } else {
                            num = parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
                        }
                    } else if (clean.includes(',')) {
                        const parts = clean.split(',');
                        if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1 && parseInt(parts[0]) >= 1) {
                            num = parseFloat(clean.replace(/,/g, '')) || 0;
                        } else {
                            num = parseFloat(clean.replace(',', '.')) || 0;
                        }
                    } else if (clean.includes('.')) {
                        const parts = clean.split('.');
                        if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parseInt(parts[0]) >= 1)) {
                            num = parseFloat(clean.replace(/\./g, '')) || 0;
                        } else {
                            num = parseFloat(clean) || 0;
                        }
                    } else {
                        num = parseFloat(clean) || 0;
                    }

                    if (num > 0) {
                        parsedList.push(num);
                    }
                }

                if (parsedList.length === 0) return 1;

                // If 3 columns [Giá bán, Số lượng, Thành tiền], quantity is ALWAYS the middle column (index 1)
                if (parsedList.length === 3) {
                    const q = parsedList[1];
                    return q > 0 ? (Math.round(q * 10000) / 10000) : 1;
                }

                // If 2 columns [Giá bán, Số lượng] or [Số lượng, Đơn giá]
                if (parsedList.length === 2) {
                    const [n0, n1] = parsedList;
                    if (n0 > 0 && n0 < 1) return Math.round(n0 * 10000) / 10000;
                    if (n1 > 0 && n1 < 1) return Math.round(n1 * 10000) / 10000;
                    if (n1 >= 500 && n0 > 0 && n0 < 500) return Math.round(n0 * 10000) / 10000;
                    if (n0 >= 500 && n1 > 0 && n1 < 500) return Math.round(n1 * 10000) / 10000;
                    return n0 > 0 ? (Math.round(n0 * 10000) / 10000) : (Math.round(n1 * 10000) / 10000);
                }

                // If > 3 columns
                if (parsedList.length > 3) {
                    for (let idx = 1; idx < parsedList.length - 1; idx++) {
                        const v = parsedList[idx];
                        if (v > 0 && v < 500) {
                            return Math.round(v * 10000) / 10000;
                        }
                    }
                }

                return parsedList[0] > 0 ? (Math.round(parsedList[0] * 10000) / 10000) : 1;
            }

            function findVatTuInStore(queryName) {
                if (!queryName || !allProducts || allProducts.length === 0) return null;

                const cleanUnits = (s) => {
                    if (!s) return '';
                    let prev = '';
                    let curr = s.trim();
                    while (prev !== curr) {
                        prev = curr;
                        curr = curr.replace(/\s*[\-\–\—\−\/\.\,\_]+\s*(ml|l|gam|g|kg|viên|vien|chai|lo|lọ|ống|ong|túi|tui|vỉ|vi|liều|lieu|lần|lan|hộp|hop|cái|cai|bộ|bo)\s*$/i, '').trim();
                    }
                    return curr;
                };

                const norm = (str) => {
                    if (!str) return '';
                    let s = str.trim();
                    s = s.replace(/[\u2010-\u2015\u2212\uFF0D]/g, ' ');
                    s = cleanUnits(s);
                    return s.toLowerCase()
                        .replace(/(\d+)\s*(ml|l|g|kg|mg)/gi, '$1$2')
                        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                };

                const normQuery = norm(queryName);
                if (!normQuery || normQuery.length < 2) return null;

                // If query is identified as clinic service / medical procedure, do not match goods
                if (isClinicServiceOrFee(queryName)) {
                    for (const vt of allProducts) {
                        const t1 = norm(vt.ten_mat_hang);
                        const t2 = norm(vt.ten_hoa_don);
                        if ((t1 && t1 === normQuery) || (t2 && t2 === normQuery)) return vt;
                    }
                    return null;
                }

                // 1. Exact Match (Highest Confidence)
                for (const vt of allProducts) {
                    const t1 = norm(vt.ten_mat_hang);
                    const t2 = norm(vt.ten_hoa_don);
                    if (t1 && t1 === normQuery) return vt;
                    if (t2 && t2 === normQuery) return vt;
                }

                // 2. High-confidence Substring / Prefix / Suffix Match (>= 75% coverage)
                for (const vt of allProducts) {
                    for (const name of [vt.ten_mat_hang, vt.ten_hoa_don]) {
                        if (!name) continue;
                        const normName = norm(name);
                        if (normName.length < 3) continue;

                        if (normQuery === normName) return vt;
                        if (normQuery.startsWith(normName) || normName.startsWith(normQuery) || normQuery.includes(normName) || normName.includes(normQuery)) {
                            const minLen = Math.min(normQuery.length, normName.length);
                            const maxLen = Math.max(normQuery.length, normName.length);
                            if (minLen / maxLen >= 0.75) {
                                return vt;
                            }
                        }
                    }
                }

                // 3. Strict Keyword / Token Inclusion (Exact word matching, >= 80% coverage)
                const stopWords = new Set(['cho', 'danh', 'dành', 'meo', 'mèo', 'cho', 'chó', 'thuoc', 'thuốc', 'loai', 'loại', 'va', 'và', 'la', 'là']);
                const queryTokens = normQuery.split(' ').filter(w => w.length > 1 && !stopWords.has(w));
                if (queryTokens.length === 0) return null;

                let bestMatch = null;
                let bestScore = 0;

                for (const vt of allProducts) {
                    for (const name of [vt.ten_mat_hang, vt.ten_hoa_don]) {
                        if (!name) continue;
                        const normName = norm(name);
                        const vtTokens = normName.split(' ').filter(w => w.length > 1 && !stopWords.has(w));
                        if (vtTokens.length === 0) continue;

                        let matchCount = 0;
                        for (const tok of vtTokens) {
                            if (queryTokens.includes(tok)) {
                                matchCount++;
                            }
                        }

                        const coverage = matchCount / vtTokens.length;
                        const queryCoverage = matchCount / queryTokens.length;
                        const isValidMatch = (coverage >= 0.80 && queryCoverage >= 0.50 && matchCount >= 2) || 
                                             (coverage === 1.0 && vtTokens.length === 1 && vtTokens[0].length >= 5 && queryTokens.includes(vtTokens[0]));

                        if (isValidMatch && coverage > bestScore) {
                            bestScore = coverage;
                            bestMatch = vt;
                        }
                    }
                }

                return bestMatch;
            }

            function parseLineNumbersTail(line) {
                if (!line) return { hasNumbersTail: false, namePart: '', numbersText: '' };
                const trimmed = line.trim();
                if (/^[\-\=\_\.\s]{3,}$/.test(trimmed)) {
                    return { hasNumbersTail: false, namePart: '', numbersText: '' };
                }

                const tokens = trimmed.split(/\s+/).filter(Boolean);
                if (tokens.length === 0) {
                    return { hasNumbersTail: false, namePart: '', numbersText: '' };
                }

                function isNumToken(tok) {
                    if (!tok) return false;
                    const clean = tok
                        .replace(/^(stt|đvt|vnd|đ|k|\%)+/i, '')
                        .replace(/(ml|l|gam|g|kg|viên|vien|chai|lo|lọ|ống|ong|túi|tui|vỉ|vi|liều|lieu|lần|lan|hộp|hop|cái|cai|bộ|bo|\%|vnd|đ|k)$/i, '')
                        .trim();
                    return /^\d+(?:[.,]\d+)*$/.test(clean) || /^(?:đ|vnd|k|\%|đvt)$/i.test(tok);
                }

                let tailIdx = tokens.length - 1;
                const numTokensReversed = [];

                while (tailIdx >= 0) {
                    const tok = tokens[tailIdx];
                    if (isNumToken(tok)) {
                        numTokensReversed.push(tok);
                        tailIdx--;
                        if (numTokensReversed.length >= 5) break;
                    } else {
                        break;
                    }
                }

                const hasActualDigits = numTokensReversed.some(tok => /\d/.test(tok));

                if (numTokensReversed.length >= 1 && hasActualDigits) {
                    const numbersTokens = numTokensReversed.reverse();
                    const numbersText = numbersTokens.join(' ');
                    const nameTokens = tokens.slice(0, tailIdx + 1);
                    const namePart = nameTokens.join(' ').trim();

                    return {
                        hasNumbersTail: true,
                        namePart: namePart,
                        numbersText: numbersText
                    };
                }

                return {
                    hasNumbersTail: false,
                    namePart: trimmed,
                    numbersText: ''
                };
            }

            let totalInvoiceLinesOnPdf = 0;
            let pendingItemName = '';

            for (let j = 0; j < rawLines.length; j++) {
                let line = rawLines[j].trim();
                if (!line) continue;

                // Stop at invoice totals / footer
                if (/(?:Tổng tiền|Tổng thanh toán|Khách trả|Tiền thừa|Điểm tích lũy|5% VAT|8% VAT|Hình thức thanh toán|Chữ ký|Người lập|Cảm ơn quý khách)/i.test(line)) {
                    break;
                }

                // Skip horizontal separators
                if (/^[\-\=\_\.\s]{3,}$/.test(line)) {
                    continue;
                }

                // Skip header lines
                if (/(?:Mã HĐ|Ngày|Người tạo|Khách hàng|SĐT|Thú cưng|Cân nặng|Loài|Giống|Tổng điểm|Giá bán\s+Số lượng)/i.test(line)) {
                    continue;
                }

                line = line.replace(/^\d+[\.\-]\s+/, '');
                const tailResult = parseLineNumbersTail(line);

                if (tailResult.hasNumbersTail) {
                    const fullItemName = (pendingItemName ? (pendingItemName + ' ' + tailResult.namePart) : tailResult.namePart).trim();
                    const parsedQty = extractQuantityFromInvoiceLine(tailResult.numbersText);

                    if (fullItemName && fullItemName.length >= 2) {
                        totalInvoiceLinesOnPdf++;

                        if (parsedQty !== null && parsedQty > 0) {
                            const matchedVatTu = findVatTuInStore(fullItemName);

                            if (matchedVatTu) {
                                items.push({
                                    ma_qr: matchedVatTu.ma_vach || '',
                                    ma_vach: matchedVatTu.ma_vach || '',
                                    lot: '-',
                                    ten_hang_hoa: matchedVatTu.ten_mat_hang || matchedVatTu.ten_hoa_don,
                                    so_luong_yeu_cau: parsedQty,
                                    so_luong: 0
                                });
                            } else {
                                console.log(`[PDF Import] Bỏ qua mục không có trong kho hoặc dịch vụ: "${fullItemName}" (SL: ${parsedQty})`);
                            }
                        }
                    }

                    pendingItemName = '';
                } else {
                    // Line does not have numbers tail -> it is product name or wrapped continuation
                    pendingItemName = (pendingItemName ? (pendingItemName + ' ' + line) : line).trim();
                }
            }

            if (items.length > 0) {
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

                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}${mm}${dd}`;
                const randomSuffix = generateRandom3Chars();
                const maDon = branchCode ? `XK-${dateStr}-${branchCode}-${randomSuffix}` : `XK-${dateStr}-${randomSuffix}`;

                const payload = {
                    ma_don: maDon,
                    loai_don: 'Xuất',
                    muc_dich: finalMucDich,
                    trang_thai: 'Chờ',
                    nguon_don: isAuto ? 'auto_folder' : 'pdf_import',
                    file_url: file_url,
                    user_name: userNameFormatted,
                    chi_tiet_san_pham: items,
                    tong_so_luong: Math.round(items.reduce((acc, curr) => acc + (Number(curr.so_luong_yeu_cau) || 0), 0) * 10000) / 10000,
                    so_dong_hoa_don: totalInvoiceLinesOnPdf || items.length
                };

                let { data, error } = await supabaseClient.from('nhap_xuat').insert([payload]);
                if (error && error.message && (error.message.includes('so_dong_hoa_don') || error.message.includes('column'))) {
                    console.warn("Supabase bảng nhap_xuat chưa có cột so_dong_hoa_don, đang thử lại bỏ cột này...", error.message);
                    delete payload.so_dong_hoa_don;
                    const retryRes = await supabaseClient.from('nhap_xuat').insert([payload]);
                    data = retryRes.data;
                    error = retryRes.error;
                }

                if (error) {
                    console.error("Error creating order from PDF:", error);
                    failedFiles.push({
                        fileName: file.name,
                        maHoaDon: maHoaDon,
                        reason: 'Lỗi Database: ' + error.message,
                        time: new Date().toLocaleTimeString('vi-VN')
                    });
                } else {
                    processedInvoiceCodesInBatch.add(maHoaDon);
                    if (typeof nhapXuatData !== 'undefined') {
                        nhapXuatData.unshift(payload);
                    }
                    await supabaseClient.from('nhap_xuat_log').insert([{
                        ma_don: maDon,
                        loai_don: 'Xuất',
                        hanh_dong: 'TẠO_ĐƠN',
                        noi_dung: `${isAuto ? '[Tự Động Theo Dõi] ' : ''}Tạo đơn từ Hóa Đơn PDF (${finalMucDich}) gồm ${items.length} mã sản phẩm.`,
                        user_name: userNameFormatted
                    }]);
                    successCount++;
                }
            } else {
                // No valid goods found
                failedFiles.push({
                    fileName: file.name,
                    maHoaDon: maHoaDon || 'Không rõ',
                    reason: 'Không tìm thấy vật tư nào trong kho (chỉ chứa dịch vụ khám/chữa bệnh hoặc tên hàng chưa có trong kho)',
                    time: new Date().toLocaleTimeString('vi-VN')
                });
            }
        }

        if (!isAuto) {
            closeGenericConfirmModal();
            if (successCount > 0) {
                setTimeout(() => {
                    if (typeof showToast === 'function') {
                        showToast('success', 'Tạo Đơn Thành Công', `Đã tạo thành công ${successCount} đơn xuất kho (Trạng thái: Chờ) từ File PDF.`);
                    } else {
                        alert(`Đã tạo thành công ${successCount} đơn xuất kho (Trạng thái: Chờ) từ File PDF.`);
                    }
                    if (duplicateCount > 0) {
                        setTimeout(() => {
                            if (typeof showToast === 'function') {
                                showToast('warning', 'Bỏ Qua Đơn Trùng', `Bỏ qua ${duplicateCount} file do mã hóa đơn đã tồn tại hoặc trùng nhau trong đợt tải.`);
                            }
                        }, 800);
                    }
                    if (failedFiles.length > 0) {
                        setTimeout(() => {
                            if (typeof showToast === 'function') {
                                showToast('warning', 'Đơn Lỗi / Bỏ Qua', `Có ${failedFiles.length} file không thể tạo đơn kho do không có sản phẩm trong kho.`);
                            }
                        }, 1600);
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
        } else {
            if (successCount > 0) {
                playNxAutoImportSound();
                if (typeof showToast === 'function') {
                    showToast('success', '🔔 Tự Động Nạp Đơn', `Đã tự động tạo ${successCount} đơn xuất kho mới từ thư mục theo dõi!`);
                }
                fetchNhapXuatData();
            }
        }

        return { successCount, duplicateCount, failedFiles };

    } catch (error) {
        console.error("PDF Parse error", error);
        if (!isAuto) {
            closeGenericConfirmModal();
            if (typeof showToast === 'function') {
                showToast('error', 'Lỗi', 'Có lỗi xảy ra khi đọc file PDF.');
            } else {
                alert("Có lỗi xảy ra khi đọc file PDF.");
            }
        }
        return { successCount: 0, duplicateCount: 0, failedFiles: [] };
    }
}

async function handleNhapXuatPdfUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await processPdfFilesBatch(files, false);
    event.target.value = ''; 
}

let nxWatchedDirHandle = null;
let nxWatchedFolderName = '';
let nxWatchIntervalId = null;
let nxIsWatchingPaused = false;
let nxIsScanningFolder = false;
let nxWatchedAutoCount = 0;

function openGaiaIdb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('GaiaAppDB', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('FolderHandles')) {
                db.createObjectStore('FolderHandles', { keyPath: 'accountKey' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveFolderHandleToIdb(accountKey, handle, folderName) {
    try {
        const db = await openGaiaIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('FolderHandles', 'readwrite');
            const store = tx.objectStore('FolderHandles');
            store.put({ accountKey, handle, folderName, updatedAt: Date.now() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn("Could not save directory handle to IndexedDB:", e);
    }
}

async function getFolderHandleFromIdb(accountKey) {
    try {
        const db = await openGaiaIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('FolderHandles', 'readonly');
            const store = tx.objectStore('FolderHandles');
            const req = store.get(accountKey);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn("Could not get directory handle from IndexedDB:", e);
        return null;
    }
}

async function removeFolderHandleFromIdb(accountKey) {
    try {
        const db = await openGaiaIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('FolderHandles', 'readwrite');
            const store = tx.objectStore('FolderHandles');
            store.delete(accountKey);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn("Could not delete directory handle from IndexedDB:", e);
    }
}

function getNxWatcherAccountKey() {
    let userObj = null;
    if (typeof currentUser !== 'undefined' && currentUser) {
        userObj = currentUser;
    } else {
        try {
            userObj = JSON.parse(localStorage.getItem("gaia_logged_user") || "null");
        } catch (e) {}
    }
    if (userObj && (userObj.id || userObj.email)) {
        return 'user_' + String(userObj.id || userObj.email).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    }
    return 'user_default';
}

function getNxWatchedSignatures(accountKey) {
    try {
        const raw = localStorage.getItem('gaia_watched_sigs_' + accountKey);
        if (raw) return new Set(JSON.parse(raw));
    } catch (e) {}
    return new Set();
}

function saveNxWatchedSignatures(accountKey, setObj) {
    try {
        const arr = Array.from(setObj);
        const trimmed = arr.length > 1000 ? arr.slice(arr.length - 1000) : arr;
        localStorage.setItem('gaia_watched_sigs_' + accountKey, JSON.stringify(trimmed));
    } catch (e) {}
}

function playNxAutoImportSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.2);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(830.61, now + 0.1);
        gain2.gain.setValueAtTime(0.15, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.35);

        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(987.77, now + 0.2);
        gain3.gain.setValueAtTime(0.18, now + 0.2);
        gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.start(now + 0.2);
        osc3.stop(now + 0.5);
    } catch (e) {}
}

let nxFailedOrdersList = [];

function loadNxFailedOrders() {
    try {
        const stored = sessionStorage.getItem('gaia_nx_failed_orders');
        if (stored) {
            nxFailedOrdersList = JSON.parse(stored);
        }
    } catch (e) {}
}

function saveNxFailedOrders() {
    try {
        sessionStorage.setItem('gaia_nx_failed_orders', JSON.stringify(nxFailedOrdersList.slice(0, 100)));
    } catch (e) {}
}

loadNxFailedOrders();

async function moveFileToErrorFolder(fileName, dirHandle) {
    if (!dirHandle || !fileName) return false;
    try {
        let perm = 'denied';
        try {
            perm = await dirHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') {
                perm = await dirHandle.requestPermission({ mode: 'readwrite' });
            }
        } catch (pe) {}

        if (perm !== 'granted') {
            console.warn("Chưa có quyền ghi (readwrite) để chuyển file vào thư mục _DON_LOI");
            return false;
        }

        // 1. Get or create _DON_LOI subfolder
        const errDirHandle = await dirHandle.getDirectoryHandle('_DON_LOI', { create: true });

        // 2. Read source file
        const srcFileHandle = await dirHandle.getFileHandle(fileName);
        const srcFile = await srcFileHandle.getFile();

        // 3. Write into _DON_LOI
        const destFileHandle = await errDirHandle.getFileHandle(fileName, { create: true });
        const writable = await destFileHandle.createWritable();
        await writable.write(await srcFile.arrayBuffer());
        await writable.close();

        // 4. Remove original file from parent folder
        await dirHandle.removeEntry(fileName);
        console.log(`GAIA Folder Watcher: Đã chuyển file lỗi "${fileName}" vào thư mục _DON_LOI`);
        return true;
    } catch (err) {
        console.warn(`Lỗi khi chuyển file "${fileName}" vào thư mục _DON_LOI:`, err);
        return false;
    }
}

function showNxFailedOrdersModal() {
    let existingModal = document.getElementById('modal-nx-failed-orders');
    if (existingModal) existingModal.remove();

    if (!nxFailedOrdersList || nxFailedOrdersList.length === 0) {
        if (typeof showToast === 'function') {
            showToast('info', 'Thông Báo', 'Hiện không có đơn lỗi nào.');
        }
        return;
    }

    const rowsHtml = nxFailedOrdersList.map((item, idx) => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
            <td style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 12px;">${idx + 1}</td>
            <td style="padding: 10px; font-weight: 600; color: #f8fafc; font-size: 12.5px; word-break: break-all;">
                📄 ${escapeHtml(item.fileName || '-')}
            </td>
            <td style="padding: 10px; color: #60a5fa; font-weight: 500; font-size: 12px;">
                ${escapeHtml(item.maHoaDon || '-')}
            </td>
            <td style="padding: 10px; color: #fca5a5; font-size: 12px; line-height: 1.4;">
                ${escapeHtml(item.reason || 'Lỗi không xác định')}
            </td>
            <td style="padding: 10px; color: var(--text-muted); font-size: 11.5px; white-space: nowrap; text-align: center;">
                ${escapeHtml(item.time || '-')}
            </td>
        </tr>
    `).join('');

    const modalHtml = `
        <div id="modal-nx-failed-orders" class="modal-backdrop" style="display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); z-index: 99999; align-items: center; justify-content: center;">
            <div class="modal-box" style="background: #0f172a; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; width: 95%; max-width: 820px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.6); animation: modalFadeIn 0.2s ease;">
                <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 20px;">⚠️</span>
                        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #f87171;">Danh Sách Đơn Lỗi / Không Thể Nạp (${nxFailedOrdersList.length})</h3>
                    </div>
                    <button type="button" onclick="closeNxFailedOrdersModal()" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; line-height: 1;">✕</button>
                </div>
                
                <div style="padding: 16px 20px; overflow-y: auto; flex: 1;">
                    <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 10px 14px; border-radius: 6px; margin-bottom: 14px; font-size: 12.5px; color: #fca5a5; line-height: 1.5;">
                        📁 <strong>Cơ chế tự động:</strong> Các file lỗi trong thư mục tự động đã được chuyển vào thư mục con <code>_DON_LOI/</code> để tránh quét lặp và giúp bạn dễ dàng kiểm tra lại file gốc trên máy tính.
                    </div>

                    <div style="border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.2);">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead>
                                <tr style="background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.08);">
                                    <th style="padding: 10px; width: 45px; text-align: center; color: var(--text-muted); font-size: 11.5px;">STT</th>
                                    <th style="padding: 10px; color: var(--text-muted); font-size: 11.5px; width: 220px;">Tên File</th>
                                    <th style="padding: 10px; color: var(--text-muted); font-size: 11.5px; width: 140px;">Mã HĐ</th>
                                    <th style="padding: 10px; color: var(--text-muted); font-size: 11.5px;">Lý Do Không Nạp Được</th>
                                    <th style="padding: 10px; color: var(--text-muted); font-size: 11.5px; width: 85px; text-align: center;">Thời Gian</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style="padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2);">
                    <button type="button" class="btn-nx-icon danger" onclick="clearNxFailedOrdersList()" style="padding: 6px 12px; font-size: 12px; border-radius: 6px; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">
                        🗑️ Xóa Danh Sách Lỗi
                    </button>
                    <button type="button" onclick="closeNxFailedOrdersModal()" style="padding: 6px 16px; font-size: 12px; font-weight: 600; border-radius: 6px; background: #334155; color: #fff; border: none; cursor: pointer;">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeNxFailedOrdersModal() {
    const m = document.getElementById('modal-nx-failed-orders');
    if (m) m.remove();
}

function clearNxFailedOrdersList() {
    nxFailedOrdersList = [];
    saveNxFailedOrders();
    closeNxFailedOrdersModal();
    if (nxWatchedDirHandle) {
        renderNxFolderWatcherUI(nxIsWatchingPaused ? 'paused' : 'active');
    }
    if (typeof showToast === 'function') {
        showToast('info', 'Đã Xóa', 'Đã xóa toàn bộ danh sách đơn lỗi.');
    }
}

async function initNxFolderWatcher() {
    const bar = document.getElementById('nx-folder-watcher-bar');
    if (!bar) return;

    if (!window.showDirectoryPicker) {
        bar.innerHTML = `
            <div class="nx-folder-watcher-content" style="background: rgba(255,255,255,0.02); opacity: 0.7;">
                <span style="font-size: 11px; color: var(--text-muted);">Trình duyệt không hỗ trợ quét thư mục tự động (Dùng Chrome/Edge để bật).</span>
            </div>
        `;
        return;
    }

    const accountKey = getNxWatcherAccountKey();
    const countVal = localStorage.getItem('gaia_watched_count_' + accountKey);
    nxWatchedAutoCount = countVal ? parseInt(countVal, 10) : 0;

    const record = await getFolderHandleFromIdb(accountKey);
    if (!record || !record.handle) {
        nxWatchedDirHandle = null;
        nxWatchedFolderName = '';
        renderNxFolderWatcherUI('none');
        return;
    }

    nxWatchedDirHandle = record.handle;
    nxWatchedFolderName = record.folderName || record.handle.name || 'Thư mục đã gán';

    try {
        const perm = await nxWatchedDirHandle.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
            nxIsWatchingPaused = false;
            renderNxFolderWatcherUI('active');
            startNxWatchInterval();
        } else {
            renderNxFolderWatcherUI('prompt');
        }
    } catch (e) {
        renderNxFolderWatcherUI('prompt');
    }
}

function getNxSuccessOrdersCount() {
    let count = 0;
    if (typeof nhapXuatData !== 'undefined' && Array.isArray(nhapXuatData)) {
        count = nhapXuatData.filter(o => o.nguon_don === 'auto_folder' || o.nguon_don === 'pdf_import' || (o.file_url && o.loai_don === 'Xuất')).length;
    }
    return Math.max(nxWatchedAutoCount || 0, count);
}

function renderNxFolderWatcherUI(state) {
    const bar = document.getElementById('nx-folder-watcher-bar');
    if (!bar) return;

    const failedBadgeHtml = nxFailedOrdersList.length > 0 
        ? `<button type="button" class="btn-nx-icon nx-failed-badge" onclick="showNxFailedOrdersModal()" title="Có ${nxFailedOrdersList.length} đơn lỗi không thể nạp (Nhấn xem chi tiết)">⚠️ ${nxFailedOrdersList.length}</button>` 
        : '';

    const successCount = getNxSuccessOrdersCount();

    if (state === 'none' || !nxWatchedDirHandle) {
        bar.innerHTML = `
            <button type="button" class="btn-nx-watch-folder" onclick="setupNxWatchFolder()" title="Gán thư mục (ví dụ Downloads) để tự động nạp đơn khi có file PDF mới">
                📁 Gán Thư Mục
            </button>
            ${failedBadgeHtml}
        `;
    } else if (state === 'prompt') {
        bar.innerHTML = `
            <button type="button" class="btn-nx-watch-folder warning" onclick="resumeNxWatchFolder()" title="Nhấn để kích hoạt lại quyền đọc thư mục: ${escapeHtml(nxWatchedFolderName)}">
                ⚡ Tiếp tục (${escapeHtml(nxWatchedFolderName)})
            </button>
            ${failedBadgeHtml}
        `;
    } else if (state === 'paused') {
        bar.innerHTML = `
            <div class="nx-folder-watcher-badge paused" title="Đã tạm dừng theo dõi thư mục: ${escapeHtml(nxWatchedFolderName)}">
                <span class="nx-watcher-indicator inactive"></span>
                <span class="nx-folder-name-tag">${escapeHtml(nxWatchedFolderName)}</span>
                <button type="button" class="btn-nx-icon" onclick="toggleNxWatchFolder()" title="Tiếp tục quét">▶</button>
                <button type="button" class="btn-nx-icon danger" onclick="removeNxWatchFolder()" title="Hủy gán thư mục">✕</button>
            </div>
            ${failedBadgeHtml}
        `;
    } else {
        bar.innerHTML = `
            <div class="nx-folder-watcher-badge active" title="Đang tự động theo dõi thư mục: ${escapeHtml(nxWatchedFolderName)} (Đã nạp tự động thành công: ${successCount} đơn)">
                <span class="nx-watcher-indicator active"></span>
                <span class="nx-folder-name-tag">📁 ${escapeHtml(nxWatchedFolderName)}</span>
                <span class="nx-folder-count-pill" title="Số đơn đã nạp thành công">✓ ${successCount}</span>
                <button type="button" class="btn-nx-icon" onclick="forceSyncNxWatchFolder()" title="Đồng bộ lại (tìm và nạp các file PDF chưa có trên hệ thống hoặc đã bị xóa vĩnh viễn)">🔄</button>
                <button type="button" class="btn-nx-icon" onclick="setupNxWatchFolder()" title="Đổi thư mục khác">✏️</button>
                <button type="button" class="btn-nx-icon danger" onclick="removeNxWatchFolder()" title="Hủy gán thư mục">✕</button>
            </div>
            ${failedBadgeHtml}
        `;
    }
}


function startNxWatchInterval() {
    if (nxWatchIntervalId) clearInterval(nxWatchIntervalId);
    nxWatchIntervalId = setInterval(() => {
        scanNxWatchedFolder();
    }, 4000);
}

function stopNxWatchInterval() {
    if (nxWatchIntervalId) {
        clearInterval(nxWatchIntervalId);
        nxWatchIntervalId = null;
    }
}

async function setupNxWatchFolder() {
    if (!window.showDirectoryPicker) {
        alert("Trình duyệt của bạn không hỗ trợ File System Access API. Vui lòng sử dụng Google Chrome, Edge hoặc Cốc Cốc trên máy tính.");
        return;
    }

    try {
        const handle = await window.showDirectoryPicker({
            id: 'gaia_invoice_folder',
            mode: 'readwrite'
        });

        if (!handle) return;

        const folderName = handle.name || 'Thư mục đã chọn';
        const accountKey = getNxWatcherAccountKey();

        await saveFolderHandleToIdb(accountKey, handle, folderName);

        nxWatchedDirHandle = handle;
        nxWatchedFolderName = folderName;
        nxIsWatchingPaused = false;

        const processedSigs = getNxWatchedSignatures(accountKey);
        const existingPdfFiles = [];
        for await (const entry of handle.values()) {
            if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
                try {
                    const f = await entry.getFile();
                    const sig = `${entry.name}_${f.size}_${f.lastModified}`;
                    if (!processedSigs.has(sig)) {
                        existingPdfFiles.push(f);
                    }
                } catch (fe) {}
            }
        }

        renderNxFolderWatcherUI('active');
        startNxWatchInterval();

        if (existingPdfFiles.length > 0) {
            if (typeof showToast === 'function') {
                showToast('info', 'Thư Mục Đã Gán', `Đã gán thư mục "${folderName}". Phát hiện ${existingPdfFiles.length} file PDF sẵn có, đang tự động nạp...`);
            }
            await scanNxWatchedFolder();
        } else {
            if (typeof showToast === 'function') {
                showToast('success', 'Thư Mục Đã Gán', `Đang tự động theo dõi thư mục "${folderName}" cho tài khoản hiện tại.`);
            }
        }

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Error setting up watched folder:", err);
            alert("Không thể gán thư mục: " + err.message);
        }
    }
}

async function resumeNxWatchFolder() {
    if (!nxWatchedDirHandle) return;
    try {
        let perm = 'denied';
        try {
            perm = await nxWatchedDirHandle.requestPermission({ mode: 'readwrite' });
        } catch (pe) {
            perm = await nxWatchedDirHandle.requestPermission({ mode: 'read' });
        }

        if (perm === 'granted') {
            nxIsWatchingPaused = false;
            renderNxFolderWatcherUI('active');
            startNxWatchInterval();
            await scanNxWatchedFolder();
            if (typeof showToast === 'function') {
                showToast('success', 'Đã Kích Hoạt', `Đang tiếp tục theo dõi thư mục "${nxWatchedFolderName}".`);
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('warning', 'Chưa Cấp Quyền', 'Bạn chưa cấp quyền truy cập thư mục.');
            }
        }
    } catch (e) {
        console.error("Error requesting directory permission:", e);
        setupNxWatchFolder();
    }
}

function toggleNxWatchFolder() {
    if (nxIsWatchingPaused) {
        nxIsWatchingPaused = false;
        renderNxFolderWatcherUI('active');
        startNxWatchInterval();
        scanNxWatchedFolder();
        if (typeof showToast === 'function') {
            showToast('info', 'Đã Tiếp Tục', 'Đang tiếp tục quét thư mục tự động.');
        }
    } else {
        nxIsWatchingPaused = true;
        renderNxFolderWatcherUI('paused');
        stopNxWatchInterval();
        if (typeof showToast === 'function') {
            showToast('info', 'Đã Tạm Dừng', 'Đã tạm dừng tự động quét thư mục.');
        }
    }
}

async function removeNxWatchFolder() {
    const cf = confirm(`Bạn có chắc chắn muốn hủy gán thư mục theo dõi "${nxWatchedFolderName}" cho tài khoản này?`);
    if (!cf) return;

    const accountKey = getNxWatcherAccountKey();
    await removeFolderHandleFromIdb(accountKey);
    stopNxWatchInterval();
    nxWatchedDirHandle = null;
    nxWatchedFolderName = '';
    nxIsWatchingPaused = false;
    renderNxFolderWatcherUI('none');

    if (typeof showToast === 'function') {
        showToast('info', 'Đã Hủy Gán Thư Mục', 'Đã hủy theo dõi thư mục.');
    }
}

async function forceSyncNxWatchFolder() {
    if (!nxWatchedDirHandle || nxIsWatchingPaused || nxIsScanningFolder) return;

    const accountKey = getNxWatcherAccountKey();
    saveNxWatchedSignatures(accountKey, new Set());

    nxWatchedAutoCount = 0;
    localStorage.setItem('gaia_watched_count_' + accountKey, '0');
    renderNxFolderWatcherUI('active');

    if (typeof showToast === 'function') {
        showToast('info', 'Đồng Bộ', 'Đang quét lại toàn bộ thư mục...');
    }

    await scanNxWatchedFolder();
}

async function scanNxWatchedFolder() {
    if (!nxWatchedDirHandle || nxIsWatchingPaused || nxIsScanningFolder) return;

    try {
        const perm = await nxWatchedDirHandle.queryPermission({ mode: 'read' });
        if (perm !== 'granted') {
            renderNxFolderWatcherUI('prompt');
            return;
        }
    } catch (e) {
        return;
    }

    nxIsScanningFolder = true;
    const accountKey = getNxWatcherAccountKey();
    const processedSigs = getNxWatchedSignatures(accountKey);
    const newFilesToProcess = [];
    const newSigsToAdd = [];

    try {
        for await (const entry of nxWatchedDirHandle.values()) {
            if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
                try {
                    const file = await entry.getFile();
                    const sig = `${entry.name}_${file.size}_${file.lastModified}`;
                    if (!processedSigs.has(sig)) {
                        newFilesToProcess.push(file);
                        newSigsToAdd.push(sig);
                    }
                } catch (fileErr) {
                    console.warn("Could not read file in watched directory:", entry.name, fileErr);
                }
            }
        }

        if (newFilesToProcess.length > 0) {
            console.log(`GAIA Folder Watcher: Phát hiện ${newFilesToProcess.length} file PDF mới trong [${nxWatchedFolderName}]. Đang xử lý...`);
            const res = await processPdfFilesBatch(newFilesToProcess, true);

            newSigsToAdd.forEach(s => processedSigs.add(s));
            saveNxWatchedSignatures(accountKey, processedSigs);

            if (res.successCount > 0) {
                nxWatchedAutoCount += res.successCount;
                localStorage.setItem('gaia_watched_count_' + accountKey, String(nxWatchedAutoCount));
            }

            if (res.failedFiles && res.failedFiles.length > 0) {
                for (const failedItem of res.failedFiles) {
                    const exists = nxFailedOrdersList.some(x => x.fileName === failedItem.fileName);
                    if (!exists) {
                        nxFailedOrdersList.unshift(failedItem);
                    }
                    // Attempt to move the file into _DON_LOI folder
                    await moveFileToErrorFolder(failedItem.fileName, nxWatchedDirHandle);
                }
                saveNxFailedOrders();

                if (typeof showToast === 'function') {
                    showToast('warning', 'Phát Hiện Đơn Lỗi', `Có ${res.failedFiles.length} file không thể nạp (Đã chuyển vào thư mục _DON_LOI). Nhấn vào huy hiệu lỗi để xem chi tiết.`);
                }
            }

            renderNxFolderWatcherUI('active');
        }
    } catch (scanErr) {
        console.warn("GAIA Folder Watcher scan error:", scanErr);
    } finally {
        nxIsScanningFolder = false;
    }
}

async function markNxOrderAsDone() {
    if (!selectedNxOrderId) return;

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

let currentNxAttachments = [];

function getNxFileIcon(fileNameOrUrl) {
    if (!fileNameOrUrl) return '📄';
    const str = String(fileNameOrUrl).toLowerCase();

    if (str.endsWith('.xlsx') || str.endsWith('.xls') || str.endsWith('.csv') || str.includes('excel')) {
        return '🟢'; 
    }
    if (str.endsWith('.docx') || str.endsWith('.doc') || str.includes('word')) {
        return '📘'; 
    }
    if (str.endsWith('.pdf')) {
        return '📕'; 
    }
    if (str.endsWith('.png') || str.endsWith('.jpg') || str.endsWith('.jpeg') || str.endsWith('.webp') || str.endsWith('.gif') || str.endsWith('.svg')) {
        return '🖼️'; 
    }
    if (str.endsWith('.zip') || str.endsWith('.rar') || str.endsWith('.7z')) {
        return '📦'; 
    }
    if (str.endsWith('.txt') || str.endsWith('.sql') || str.endsWith('.json')) {
        return '📑'; 
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
window.processPdfFilesBatch = processPdfFilesBatch;
window.markNxOrderAsDone = markNxOrderAsDone;
window.selectNxOrderForView = selectNxOrderForView;

window.initNxFolderWatcher = initNxFolderWatcher;
window.setupNxWatchFolder = setupNxWatchFolder;
window.resumeNxWatchFolder = resumeNxWatchFolder;
window.toggleNxWatchFolder = toggleNxWatchFolder;
window.removeNxWatchFolder = removeNxWatchFolder;

// ==========================================
// GLOBAL BARCODE SCANNER COMMAND LISTENER FOR NHẬP/XUẤT
// ==========================================
let globalNxBarcodeBuffer = '';
let globalNxBarcodeLastTime = 0;

document.addEventListener('keydown', (e) => {
    const viewNx = document.getElementById('view-nhap-xuat');
    if (!viewNx || (!viewNx.classList.contains('active') && window.getComputedStyle(viewNx).display === 'none')) {
        return;
    }

    const activeEl = document.activeElement;
    const isInsideScannerInput = activeEl && activeEl.id === 'nx-qr-scanner-input';
    const isInsideMucDichInput = activeEl && activeEl.id === 'nx-input-mucdich';
    const isInsideOtherInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT') && !isInsideScannerInput && !isInsideMucDichInput;

    const now = Date.now();
    if (now - globalNxBarcodeLastTime > 250) {
        globalNxBarcodeBuffer = '';
    }
    globalNxBarcodeLastTime = now;

    if (e.key === 'Enter') {
        const scannedCode = globalNxBarcodeBuffer.trim();
        globalNxBarcodeBuffer = '';

        if (!scannedCode) return;

        const codeUpper = scannedCode.toUpperCase();

        // 1. Quét lệnh XUAT từ bất kỳ đâu trong màn hình Nhập Xuất
        if (['XUAT', 'XUẤT', 'XUAT KHO', 'XUẤT KHO', 'XK'].includes(codeUpper)) {
            e.preventDefault();
            if (isInsideScannerInput) activeEl.value = '';
            startNewNxOrderWithShortcut('Xuất');
            return;
        }

        // 2. Quét lệnh NHAP từ bất kỳ đâu trong màn hình Nhập Xuất
        if (['NHAP', 'NHẬP', 'NHAP KHO', 'NHẬP KHO', 'NK'].includes(codeUpper)) {
            e.preventDefault();
            if (isInsideScannerInput) activeEl.value = '';
            startNewNxOrderWithShortcut('Nhập');
            return;
        }

        // 3. Quét lệnh OK / LUU / SAVE từ bất kỳ đâu trong màn hình Nhập Xuất
        if (['OK', 'LUU', 'LƯU', 'DONE', 'SAVE', 'HOANTAT', 'HOAN TAT'].includes(codeUpper)) {
            e.preventDefault();
            if (isInsideScannerInput) activeEl.value = '';
            if (typeof saveNxOrderToSystem === 'function') {
                saveNxOrderToSystem();
            }
            return;
        }

        // 4. Nếu không ở trong ô nhập liệu nào, tự động chuyển mã quét vào ô quét sản phẩm
        if (!isInsideOtherInput && !isInsideScannerInput && !isInsideMucDichInput) {
            const scannerInput = document.getElementById('nx-qr-scanner-input');
            if (scannerInput && !scannerInput.disabled) {
                e.preventDefault();
                scannerInput.value = scannedCode;
                handleNxQrScannerAdd();
            }
        }
    } else if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        globalNxBarcodeBuffer += e.key;
    }
});

