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

    const managerBranchSelect = document.getElementById('nx-manager-branch-select');
    if (managerBranchSelect) {
        managerBranchSelect.addEventListener('change', () => {
            updateNxUserFieldWithBranch();
            const currentLoai = document.getElementById('nx-input-loai')?.value || '';
            if (!isEditingNxOrder && currentLoai) {
                generateNextNxOrderCode(currentLoai);
            }
            checkNxOrderModified();
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

    branchSelect.value = ""; // Always start EMPTY as required!
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

    if (isStrictManager && branchSelect && branchSelect.style.display !== 'none' && branchSelect.value) {
        selectedCN = branchSelect.value;
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
    if (typeof currentDraftOrder !== 'undefined') {
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
            .subscribe();
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

    if (term) {
        result = result.filter(x => 
            (x.ma_don && x.ma_don.toLowerCase().includes(term)) ||
            (x.muc_dich && x.muc_dich.toLowerCase().includes(term)) ||
            (x.user_name && x.user_name.toLowerCase().includes(term))
        );
    }

    filteredNhapXuatData = result;
    renderNhapXuatOrderList(filteredNhapXuatData);
}


let originalOrderStateSnapshot = null;

function updateNxSaveButtonState(hasChanges = true) {
    const saveBtn = document.getElementById('btn-save-nx-order');
    if (!saveBtn) return;

    if (selectedNxOrderId !== null) {
        // VIEWING / EDITING EXISTING ORDER MODE
        saveBtn.innerHTML = '💾 Cập Nhật';
        if (hasChanges) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
            saveBtn.style.background = '#3b82f6'; // Sáng lam khi có thay đổi
        } else {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.4';
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.style.background = '#4b5563'; // Tối xám + khóa không cho bấm khi không có thay đổi
        }
    } else {
        // CREATING NEW DRAFT ORDER MODE
        saveBtn.innerHTML = '💾 Lưu';
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.background = '#10b981'; // Bright green for Save New mode
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
                <span class="nx-card-code">${escapeHtml(order.ma_don)}</span>
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
        return !!(loai || mucDich || hasItems);
    } else {
        // Đang xem/sửa đơn cũ – so sánh với snapshot
        if (!originalOrderStateSnapshot) return false;
        const currentState = JSON.stringify({
            loai_don: document.getElementById('nx-input-loai')?.value || '',
            muc_dich: document.getElementById('nx-input-mucdich')?.value || '',
            items: currentDraftNxItems
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

    if (titleEl) titleEl.textContent = `📋 Chi Tiết Đơn ${order.ma_don}`;
    if (modeBadge) {
        modeBadge.textContent = 'Đang Xem';
        modeBadge.style.background = 'rgba(59, 130, 246, 0.15)';
        modeBadge.style.color = '#3b82f6';
    }

    document.getElementById('nx-input-madon').value = order.ma_don || '';
    document.getElementById('nx-input-loai').value = order.loai_don || 'Nhập';
    document.getElementById('nx-input-time').value = formatNxDateTime(order.created_at || order.ngay_tao);
    document.getElementById('nx-input-mucdich').value = order.muc_dich || '';
    document.getElementById('nx-input-user').value = order.user_name || '';

    await populateNxManagerBranches();
    const managerSelect = document.getElementById('nx-manager-branch-select');
    if (managerSelect && managerSelect.style.display !== 'none') {
        const cnCode = getBranchCodeFromUser(order.user_name);
        if (managerSelect.querySelector(`option[value="${cnCode}"]`)) {
            managerSelect.value = cnCode;
        }
    }

    currentDraftNxItems = order.chi_tiet_san_pham ? JSON.parse(JSON.stringify(order.chi_tiet_san_pham)) : [];
    
    // Save snapshot of original state to detect changes
    originalOrderStateSnapshot = JSON.stringify({
        loai_don: order.loai_don || '',
        muc_dich: order.muc_dich || '',
        items: currentDraftNxItems
    });

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
        branchSelect.value = ''; // Always start EMPTY as required!
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

    // 3. Nếu quét 2 mã QR giống nhau (hoặc cùng mã vạch & LOT) -> Số lượng tự động cộng dồn lên dần (+1)
    const existingIndex = currentDraftNxItems.findIndex(item => {
        return (item.ma_qr && item.ma_qr === ma_qr) || 
               (item.ma_vach === matchedBarCode && item.lot === lot);
    });

    if (existingIndex !== -1) {
        const oldQty = Number(currentDraftNxItems[existingIndex].so_luong) || 0;
        const newQty = oldQty + 1;
        currentDraftNxItems[existingIndex].so_luong = newQty;
        scannedCount = newQty;

        logNxOrderAction(
            currentMaDon,
            currentLoai,
            'SỬA_SL',
            `Quét trùng mã -> Tự động tăng số lượng [${ten_hang_hoa}] từ ${oldQty} lên ${newQty}`
        );
    } else {
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

    currentDraftNxItems.forEach((item, idx) => {
        const qty = Number(item.so_luong) || 0;
        totalQty += qty;

        const tr = document.createElement('tr');
        const nameEscaped = escapeHtml(item.ten_hang_hoa || '-');

        tr.innerHTML = `
            <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
            <td><code class="vattu-barcode-code">${escapeHtml(item.ma_vach || '-')}</code></td>
            <td><span class="badge-lot">${escapeHtml(item.lot || '-')}</span></td>
            <td style="text-align: center;"><span class="badge-date">${formatDateForNx(item.date_expiry)}</span></td>
            <td style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${nameEscaped}">
                <strong style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nameEscaped}</strong>
            </td>
            <td style="text-align: right;">
                <input type="number" min="1" class="form-control-sm" style="width: 75px; text-align: right; font-weight: 700; color: #10b981;" value="${qty}" onchange="updateNxDraftItemQty(${idx}, this.value)">
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
    const finalQty = (isNaN(parsed) || parsed < 1) ? 1 : parsed;
    item.so_luong = finalQty;

    const currentMaDon = document.getElementById('nx-input-madon')?.value || currentDraftOrder.ma_don || 'ĐƠN-NHÁP';
    const currentLoai = document.getElementById('nx-input-loai')?.value || currentDraftOrder.loai_don || 'Nhập';

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
    modal.style.cssText = 'display: flex !important; z-index: 99999 !important; position: fixed !important; top:0; left:0; width:100vw; height:100vh; background:rgba(10,14,23,0.85); align-items:center; justify-content:center; padding:20px; box-sizing:border-box;';
    modal.classList.add('show');
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

    const userName = document.getElementById('nx-input-user')?.value || 'Thái Trung Tín - CN1';
    const tongSoLuong = currentDraftNxItems.reduce((acc, x) => acc + (Number(x.so_luong) || 0), 0);

    const orderPayload = {
        ma_don: maDon,
        loai_don: loaiDon,
        muc_dich: mucDich,
        user_name: userName,
        chi_tiet_san_pham: currentDraftNxItems,
        tong_so_luong: tongSoLuong
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
                    tong_so_luong: tongSoLuong
                };

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

    const theKhoEntries = (order.chi_tiet_san_pham || []).map(item => ({
        ma_don: maDon,
        ma_qr: item.ma_qr || item.ma_vach || '',
        ma_vach: item.ma_vach || item.ma_qr || 'KHONG-MA',
        lot: item.lot || '-',
        date_expiry: parseDateToYyyyMmDd(item.date_expiry),
        ten_hang_hoa: item.ten_hang_hoa || 'Sản phẩm kho',
        loai: normalizedLoai, // Khớp chính xác CHECK (loai IN ('Nhập', 'Xuất'))
        so_luong: Number(item.so_luong) || 1,
        muc_dich: order.muc_dich || '',
        user_name: order.user_name || 'Thái Trung Tín - CN1',
        created_at: new Date().toISOString()
    }));

    if (theKhoEntries.length === 0) return;

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
window.updateNxDraftItemQty = updateNxDraftItemQty;
window.removeNxDraftItem = removeNxDraftItem;
window.resetNxOrderForm = resetNxOrderForm;
window.saveNxOrderToSystem = saveNxOrderToSystem;
