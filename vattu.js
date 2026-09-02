/* ==========================================================================
   GAIA Animal Hospital - Supplies & Inventory Management Module (vattu.js)
   NO FAKE DATA: Starts completely empty until user adds or imports items.
   Full CRUD + Excel Import (.xlsx, .csv) & Excel Export (.xlsx)
   Features:
   - Resizable Columns (AppSheet Style Drag Handles)
   - Sticky Actions Column (Pinned on Right Side)
   - Fallback '-' for Lot & Date when empty
   - Text Truncation with '...' + Hover Scroll for long text
   - Full Pagination (10, 25, 50, 100 per page)
   ========================================================================== */

let vatTuData = [];
let tonKhoDetailData = [];
let filteredVatTuData = [];
let editingVatTuId = null;
let deletingVatTuId = null;
let expandedVatTuRows = new Set();

// Pagination State
let vattuCurrentPage = 1;
let vattuPageSize = 25;

// 3-State Sorting State ('asc' | 'desc' | 'none')
let vattuSortColumn = null;
let vattuSortDirection = 'none';

// Per-Column Interdependent Filter State
let vattuColumnFilters = {}; // { colKey: Set([...selectedValues]) }
let activePopoverColKey = null;
let popoverTempSelectedValues = new Set();

const vattuColTitles = {
    ma_vach: 'Mã Vạch',
    lot: 'LOT',
    date: 'DATE',
    ten_mat_hang: 'Tên Mặt Hàng',
    ten_hoa_don: 'Tên Hóa Đơn',
    nha_san_xuat: 'Nhà Sản Xuất',
    danh_muc: 'Danh Mục',
    nhom_hang: 'Nhóm Hàng',
    phan_loai: 'Phân Loại',
    don_vi: 'Đơn Vị',
    cach_dung: 'Cách Dùng',
    ton_dau: 'Đầu',
    nhap: 'Nhập',
    xuat: 'Xuất',
    ton_cuoi: 'Cuối',
    gia_von_ton_kho_trung_binh: 'Giá Vốn TB'
};

// Dynamic Column Configuration State
const defaultVatTuCols = [
    { key: 'ma_vach', title: 'Mã Vạch', visible: true, width: '165px', align: 'left', minWidth: '135px' },
    { key: 'ten_mat_hang', title: 'Tên Mặt Hàng', visible: true, width: '210px', align: 'left', minWidth: '130px' },
    { key: 'ten_hoa_don', title: 'Tên Hóa Đơn', visible: true, width: '190px', align: 'left', minWidth: '110px' },
    { key: 'ton_dau', title: 'Đầu', visible: true, width: '110px', align: 'right', minWidth: '80px' },
    { key: 'nhap', title: 'Nhập', visible: true, width: '110px', align: 'right', minWidth: '80px' },
    { key: 'xuat', title: 'Xuất', visible: true, width: '110px', align: 'right', minWidth: '80px' },
    { key: 'ton_cuoi', title: 'Cuối', visible: true, width: '110px', align: 'right', minWidth: '80px' },
    { key: 'nha_san_xuat', title: 'Nhà Sản Xuất', visible: true, width: '170px', align: 'left', minWidth: '100px' },
    { key: 'danh_muc', title: 'Danh Mục', visible: true, width: '140px', align: 'left', minWidth: '100px' },
    { key: 'nhom_hang', title: 'Nhóm Hàng', visible: true, width: '140px', align: 'left', minWidth: '100px' },
    { key: 'phan_loai', title: 'Phân Loại', visible: true, width: '140px', align: 'left', minWidth: '100px' },
    { key: 'don_vi', title: 'Đơn Vị', visible: true, width: '100px', align: 'left', minWidth: '80px' },
    { key: 'cach_dung', title: 'Cách Dùng', visible: true, width: '160px', align: 'left', minWidth: '100px' },
    { key: 'gia_von_ton_kho_trung_binh', title: 'Giá Vốn TB (đ)', visible: true, width: '160px', align: 'right', minWidth: '100px' }
];

let currentVatTuCols = [];
let pendingVatTuColsConfig = [];
let vattuFixedColsCount = 2; // Default 2 pinned columns (Mã Vạch & Tên Mặt Hàng)

function initVatTuFixedColsConfig() {
    try {
        const saved = localStorage.getItem('gaia_vattu_fixed_cols');
        if (saved !== null) {
            vattuFixedColsCount = parseInt(saved, 10);
            if (isNaN(vattuFixedColsCount) || vattuFixedColsCount < 0) vattuFixedColsCount = 2;
        }
    } catch(e) {
        vattuFixedColsCount = 2;
    }
}
initVatTuFixedColsConfig();

function getStickyColMeta(visIdx, visibleCols, isHeader = false) {
    if (visIdx >= vattuFixedColsCount) {
        return { style: '', className: '' };
    }

    let left = 0;
    for (let i = 0; i < visIdx; i++) {
        const colWidth = parseInt(visibleCols[i].width, 10) || 120;
        left += colWidth;
    }

    const isLastSticky = (visIdx === vattuFixedColsCount - 1) || (visIdx === visibleCols.length - 1);
    const className = `is-sticky-col ${isLastSticky ? 'is-sticky-col-last' : ''}`;
    const zIndex = isHeader ? 30 : 15;
    const style = `position: sticky; left: ${left}px; z-index: ${zIndex};`;

    return { style, className };
}

function initVatTuColumnsConfig() {
    try {
        const saved = localStorage.getItem('gaia_vattu_columns_v7');
        if (saved) {
            currentVatTuCols = JSON.parse(saved);
            // Handle newly added columns (if any) missing from saved config
            defaultVatTuCols.forEach(defCol => {
                if (!currentVatTuCols.find(c => c.key === defCol.key)) {
                    currentVatTuCols.push(defCol);
                }
            });
        } else {
            currentVatTuCols = JSON.parse(JSON.stringify(defaultVatTuCols));
        }
    } catch (e) {
        console.warn('Could not load column config', e);
        currentVatTuCols = JSON.parse(JSON.stringify(defaultVatTuCols));
    }
}
initVatTuColumnsConfig();

// Get or Initialize Supabase Client
function getVatTuSupabaseClient() {
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
            console.error("GAIA VatTu: Error initializing Supabase:", e);
        }
    }
    return null;
}

// DOM Loaded / Immediate Script Initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVatTuModule);
} else {
    initVatTuModule();
}

function initVatTuModule() {
    console.log("GAIA VatTu: Initializing Supplies Management Module...");

    // Bind Action Buttons
    const btnAdd = document.getElementById('btn-add-vattu');
    console.log("GAIA VatTu DEBUG: btn-add-vattu found =", btnAdd);
    if (btnAdd) {
        btnAdd.addEventListener('click', openAddVatTuModal);
        console.log("GAIA VatTu DEBUG: click listener attached to btn-add-vattu");
    }

    const btnRefresh = document.getElementById('btn-refresh-vattu');
    if (btnRefresh) btnRefresh.addEventListener('click', fetchVatTuData);

    const btnExport = document.getElementById('btn-export-excel-vattu');
    if (btnExport) btnExport.addEventListener('click', exportVatTuToExcel);

    const btnImport = document.getElementById('btn-import-excel-vattu');
    const inputExcel = document.getElementById('input-excel-file');
    if (btnImport && inputExcel) {
        btnImport.addEventListener('click', () => inputExcel.click());
        inputExcel.addEventListener('change', handleExcelImportFile);
    }

    // Filter & Search Listeners
    const searchInput = document.getElementById('vattu-search-input');
    if (searchInput) searchInput.addEventListener('input', () => {
        vattuCurrentPage = 1;
        applyVatTuFilters();
    });

    const catFilter = document.getElementById('vattu-category-filter');
    if (catFilter) catFilter.addEventListener('change', () => {
        vattuCurrentPage = 1;
        applyVatTuFilters();
    });

    const statusFilter = document.getElementById('vattu-status-filter');
    if (statusFilter) statusFilter.addEventListener('change', () => {
        vattuCurrentPage = 1;
        applyVatTuFilters();
    });

    // Page Size Selector Listener
    const pageSizeSelect = document.getElementById('vattu-page-size-select');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            vattuPageSize = parseInt(e.target.value, 10) || 25;
            vattuCurrentPage = 1;
            renderCurrentPageData();
        });
    }

    // Header Column Sorting Listeners (3-State: A-Z -> Z-A -> Original)
    const sortHeaders = document.querySelectorAll('.vattu-table th[data-sort-col]');
    sortHeaders.forEach(th => {
        th.addEventListener('click', (e) => {
            if (e.target.classList.contains('col-resizer') || 
                (e.target.parentElement && e.target.parentElement.classList.contains('col-resizer')) ||
                e.target.closest('.col-filter-btn')) {
                return;
            }
            const colKey = th.getAttribute('data-sort-col');
            if (colKey) handleHeaderSortClick(colKey);
        });
    });

    // Close Column Filter Popover when clicking outside
    document.addEventListener('click', (e) => {
        const popover = document.getElementById('vattu-col-filter-popover');
        if (!popover || popover.style.display === 'none') return;
        if (popover.contains(e.target) || e.target.closest('.col-filter-btn')) return;
        closeColumnFilterDropdown();
    });

    // Form Submission Listener
    const vattuForm = document.getElementById('vattu-form');
    if (vattuForm) vattuForm.addEventListener('submit', handleSaveVatTuForm);

    const btnConfirmDelete = document.getElementById('btn-confirm-delete-vattu');
    if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', executeDeleteVatTu);

    // Auto-calculate Total Value in Modal Form
    const inputQtyTon = document.getElementById('input-vattu-so-luong-ton');
    const inputGiaVon = document.getElementById('input-vattu-gia-von');
    if (inputQtyTon && inputGiaVon) {
        const updateAutoTotal = () => {
            const qty = parseFloat(inputQtyTon.value) || 0;
            const price = parseFloat(inputGiaVon.value) || 0;
            const inputTotal = document.getElementById('input-vattu-tong-ton-kho');
            if (inputTotal) inputTotal.value = Math.round(qty * price);
        };
        inputQtyTon.addEventListener('input', updateAutoTotal);
        inputGiaVon.addEventListener('input', updateAutoTotal);
    }

    // Realtime Barcode Duplicate Validation
    const inputMaVach = document.getElementById('input-vattu-ma-vach');
    if (inputMaVach) {
        inputMaVach.addEventListener('input', () => {
            const val = inputMaVach.value.trim();
            if (!val) {
                showVatTuFieldError('err-vattu-ma-vach', '');
                return;
            }
            const isDup = vatTuData.some(item => 
                item.ma_vach && String(item.ma_vach).trim().toLowerCase() === val.toLowerCase() && 
                String(item.id) !== String(editingVatTuId)
            );
            if (isDup) {
                showVatTuFieldError('err-vattu-ma-vach', 'Mã vạch này trùng, vui lòng kiểm tra lại!');
            } else {
                showVatTuFieldError('err-vattu-ma-vach', '');
            }
        });
    }

    // Initialize Column Resizing Event Dragging
    initColumnResizing();

    // Bind Column Config Button
    const btnConfigCols = document.getElementById('btn-config-columns');
    if (btnConfigCols) {
        btnConfigCols.addEventListener('click', function() {
            openColumnConfigModal();
        });
    }

    // Initial Fetch & Supabase Realtime Subscription
    fetchVatTuData();
    setupVatTuRealtimeSubscription();
}

// Populate Manager Branch Filter Select Dropdown
async function initVatTuBranchFilterForManager() {
    const filterBranchSelect = document.getElementById('vattu-filter-branch');
    if (!filterBranchSelect) return;

    const loggedUser = window.getCurrentLoggedUser ? window.getCurrentLoggedUser() : null;
    const isManager = window.isManagerRole ? window.isManagerRole(loggedUser) : false;

    if (!isManager) {
        filterBranchSelect.style.display = 'none';
        return;
    }

    let branches = [];
    const client = getVatTuSupabaseClient();
    if (client) {
        try {
            const { data } = await client.from('staff').select('branch');
            if (data && data.length > 0) {
                data.forEach(s => {
                    if (s.branch && s.branch !== 'Toàn hệ thống') branches.push(s.branch.trim());
                });
            }
        } catch (e) {
            console.warn('Could not fetch staff branches for VatTu filter', e);
        }
    }

    if (branches.length === 0) {
        branches = ['Chi Nhánh TP.HCM', 'Chi Nhánh Hà Nội'];
    }

    const uniqueBranches = Array.from(new Set(branches));
    filterBranchSelect.innerHTML = `<option value="all">🏢 Tất cả chi nhánh</option>`;
    uniqueBranches.forEach(bStr => {
        let code = bStr;
        if (typeof window.extractCNCodeFromBranchString === 'function') {
            code = window.extractCNCodeFromBranchString(bStr);
        } else if (typeof window.extractCNCode === 'function') {
            code = window.extractCNCode(bStr);
        }

        let labelText = bStr.trim();
        if (code) {
            const doublePrefixRegex = new RegExp(`^(${code}\\s*-\\s*)+`, 'i');
            labelText = labelText.replace(doublePrefixRegex, `${code} - `);
            if (!labelText.toUpperCase().startsWith(code.toUpperCase())) {
                labelText = `${code} - ${labelText}`;
            }
        }

        const optionEl = document.createElement('option');
        optionEl.value = code;
        optionEl.textContent = `📍 ${labelText}`;
        optionEl.title = bStr;
        filterBranchSelect.appendChild(optionEl);
    });

    filterBranchSelect.style.display = 'inline-block';
    filterBranchSelect.removeEventListener('change', handleVatTuBranchFilterChange);
    filterBranchSelect.addEventListener('change', handleVatTuBranchFilterChange);
}

function handleVatTuBranchFilterChange() {
    vattuCurrentPage = 1;
    applyVatTuFilters();
}

function getActiveVatTuBranchFilter() {
    const loggedUser = window.getCurrentLoggedUser ? window.getCurrentLoggedUser() : null;
    const isManager = window.isManagerRole ? window.isManagerRole(loggedUser) : false;

    if (!isManager && loggedUser && loggedUser.branch) {
        let userCN = '';
        if (typeof window.extractCNCodeFromBranchString === 'function') {
            userCN = window.extractCNCodeFromBranchString(loggedUser.branch);
        } else if (typeof window.extractCNCode === 'function') {
            userCN = window.extractCNCode(loggedUser.branch);
        }
        if (userCN && userCN !== 'ALL' && userCN !== 'TOÀN HỆ THỐNG') {
            return userCN.toUpperCase();
        }
    }

    const filterSelect = document.getElementById('vattu-filter-branch');
    return filterSelect ? filterSelect.value : 'all';
}

function computeProductBranchStats(item) {
    const activeBranch = getActiveVatTuBranchFilter();
    const rawBarcode = (item.ma_vach || '').trim().toLowerCase();

    const matchingDetails = (tonKhoDetailData || []).filter(d => {
        const detailBarcode = (d.ma_vach || '').trim().toLowerCase();
        const detailQr = (d.ma_qr || '').trim().toLowerCase();
        const isMatch = (detailBarcode && detailBarcode === rawBarcode) || (detailQr && detailQr === rawBarcode);
        if (!isMatch) return false;

        if (activeBranch && activeBranch !== 'all') {
            const dBranch = (d.chi_nhanh || '').trim().toUpperCase();
            return dBranch === activeBranch;
        }
        return true;
    });

    if (matchingDetails.length > 0) {
        const sumNhap = matchingDetails.reduce((acc, r) => acc + (Number(r.tong_nhap) || 0), 0);
        const sumXuat = matchingDetails.reduce((acc, r) => acc + (Number(r.tong_xuat) || 0), 0);
        const sumTonCuoi = matchingDetails.reduce((acc, r) => acc + (Number(r.ton_kho) || 0), 0);
        const sumTonDau = sumTonCuoi - sumNhap + sumXuat;

        return {
            ton_dau: Math.max(0, sumTonDau),
            nhap: sumNhap,
            xuat: sumXuat,
            ton_cuoi: sumTonCuoi,
            details: matchingDetails
        };
    }

    if (activeBranch && activeBranch !== 'all') {
        return {
            ton_dau: 0,
            nhap: 0,
            xuat: 0,
            ton_cuoi: 0,
            details: []
        };
    }

    const tonDau = Number(item.ton_dau) || 0;
    const nhap = Number(item.nhap) || 0;
    const xuat = Number(item.xuat) || 0;
    const tonCuoi = Number(item.ton_cuoi) ?? (tonDau + nhap - xuat);
    return {
        ton_dau: tonDau,
        nhap: nhap,
        xuat: xuat,
        ton_cuoi: tonCuoi,
        details: []
    };
}

function toggleVatTuSubRow(itemId, event) {
    if (event) event.stopPropagation();
    const strId = String(itemId);
    if (expandedVatTuRows.has(strId)) {
        expandedVatTuRows.delete(strId);
    } else {
        expandedVatTuRows.add(strId);
    }
    renderCurrentPageData();
}

// Fetch Data from Supabase table 'san_pham' & view 'ton_kho_detail'
// Helper to deduplicate master product records by ID or barcode
function deduplicateVatTuData(rawList) {
    if (!Array.isArray(rawList) || rawList.length === 0) return [];
    const map = new Map();
    rawList.forEach(item => {
        const key = item.id ? `id_${item.id}` : (item.ma_vach ? `barcode_${String(item.ma_vach).trim().toLowerCase()}` : null);
        if (!key) {
            map.set(Symbol(), item);
        } else if (!map.has(key)) {
            map.set(key, item);
        }
    });
    return Array.from(map.values());
}

async function fetchVatTuData() {
    showVatTuLoading(true);
    const client = getVatTuSupabaseClient();

    if (!client) {
        console.warn("GAIA VatTu: Supabase client not available.");
        vatTuData = [];
        tonKhoDetailData = [];
        showVatTuLoading(false);
        renderVatTuView(vatTuData);
        return;
    }

    try {
        // Query view_vattu_tong_hop (with fallback to san_pham) and ton_kho_detail concurrently
        const [resView, resDetail] = await Promise.all([
            client.from('view_vattu_tong_hop').select('*'),
            client.from('ton_kho_detail').select('*')
        ]);

        if (resView.error) {
            console.warn("GAIA VatTu: Could not fetch from view_vattu_tong_hop, falling back to san_pham:", resView.error.message);
            const resSp = await client.from('san_pham').select('*').order('id', { ascending: false });
            vatTuData = deduplicateVatTuData(resSp.data || []);
        } else {
            vatTuData = deduplicateVatTuData(resView.data || []);
        }

        if (resDetail.error) {
            console.warn("GAIA VatTu: Could not fetch from ton_kho_detail:", resDetail.error.message);
            tonKhoDetailData = [];
        } else {
            tonKhoDetailData = resDetail.data || [];
        }

        window.vatTuData = vatTuData;
        window.tonKhoDetailData = tonKhoDetailData;

        await initVatTuBranchFilterForManager();
    } catch (err) {
        console.error("GAIA VatTu: Unexpected error fetching data:", err);
        vatTuData = [];
        tonKhoDetailData = [];
    } finally {
        showVatTuLoading(false);
        renderVatTuView(vatTuData);
    }
}

// Supabase Realtime Subscription for 100% Realtime Updates on tables 'san_pham' & 'nhap_xuat'
let vattuRealtimeChannel = null;

function setupVatTuRealtimeSubscription() {
    const client = getVatTuSupabaseClient();
    if (!client || vattuRealtimeChannel) return;

    try {
        vattuRealtimeChannel = client
            .channel('realtime-vattu-all')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'san_pham' },
                (payload) => {
                    console.log("GAIA VatTu: Realtime san_pham database change received!", payload);
                    fetchVatTuDataSilently();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'nhap_xuat' },
                (payload) => {
                    console.log("GAIA VatTu: Realtime nhap_xuat database change received!", payload);
                    fetchVatTuDataSilently();
                }
            )
            .subscribe((status) => {
                console.log("GAIA VatTu: Realtime channel subscription status:", status);
            });
    } catch (err) {
        console.warn("GAIA VatTu: Could not establish Realtime connection:", err);
    }
}

async function fetchVatTuDataSilently() {
    const client = getVatTuSupabaseClient();
    if (!client) return;
    try {
        const [resView, resDetail] = await Promise.all([
            client.from('view_vattu_tong_hop').select('*'),
            client.from('ton_kho_detail').select('*')
        ]);

        if (!resView.error && resView.data) {
            vatTuData = deduplicateVatTuData(resView.data);
            window.vatTuData = vatTuData;
        } else {
            const resSp = await client.from('san_pham').select('*').order('id', { ascending: false });
            if (!resSp.error && resSp.data) {
                vatTuData = deduplicateVatTuData(resSp.data);
                window.vatTuData = vatTuData;
            }
        }

        if (!resDetail.error && resDetail.data) {
            tonKhoDetailData = resDetail.data;
            window.tonKhoDetailData = tonKhoDetailData;
        }

        renderVatTuView(vatTuData);
    } catch (err) {
        console.error("GAIA VatTu: Error in silent realtime fetch:", err);
    }
}

// Render Table and Stats
function renderVatTuView(dataList) {
    renderVatTuStats(dataList);
    applyVatTuFilters();
}

function renderVatTuStats(allData) {
    const totalItemsEl = document.getElementById('vattu-stat-total-items');
    const totalQtyEl = document.getElementById('vattu-stat-total-qty');
    const totalValEl = document.getElementById('vattu-stat-total-val');
    const warningCountEl = document.getElementById('vattu-stat-warning-count');

    const totalItems = allData.length;
    let totalQty = 0;
    let totalVal = 0;
    let warningCount = 0;

    const today = new Date().toISOString().split('T')[0];

    allData.forEach(item => {
        const stats = computeProductBranchStats(item);
        const tonCuoi = stats.ton_cuoi;
        const price = Number(item.gia_von_ton_kho_trung_binh) || 0;
        const val = tonCuoi * price;

        totalQty += tonCuoi;
        totalVal += val;

        const expDate = item.date ? String(item.date) : '';
        let isExpiringSoon = false;
        if (expDate) {
            const diffDays = Math.ceil((new Date(expDate) - new Date(today)) / (1000 * 60 * 60 * 24));
            if (diffDays <= 30) isExpiringSoon = true;
        }

        if (tonCuoi <= 10 || isExpiringSoon) {
            warningCount++;
        }
    });

    if (totalItemsEl) totalItemsEl.textContent = totalItems.toLocaleString('vi-VN');
    if (totalQtyEl) totalQtyEl.textContent = totalQty.toLocaleString('vi-VN');
    if (totalValEl) totalValEl.textContent = formatVND(totalVal);
    if (warningCountEl) warningCountEl.textContent = warningCount.toLocaleString('vi-VN');
}

// Clear All Filters & Search Input
function clearAllVatTuFilters() {
    const searchInput = document.getElementById('vattu-search-input');
    if (searchInput) searchInput.value = '';

    const catFilter = document.getElementById('vattu-category-filter');
    if (catFilter) catFilter.value = 'all';

    const statusFilter = document.getElementById('vattu-status-filter');
    if (statusFilter) statusFilter.value = 'all';

    vattuColumnFilters = {};
    vattuSortColumn = null;
    vattuSortDirection = 'none';

    closeColumnFilterDropdown();
    updateColumnFilterBadgesUI();
    updateSortHeaderUI();

    vattuCurrentPage = 1;
    applyVatTuFilters();
}

// Filter & Sort Function
function applyVatTuFilters() {
    const searchVal = (document.getElementById('vattu-search-input')?.value || '').toLowerCase().trim();
    const catVal = document.getElementById('vattu-category-filter')?.value || 'all';
    const statusVal = document.getElementById('vattu-status-filter')?.value || 'all';

    filteredVatTuData = vatTuData.filter(item => {
        const matchSearch = !searchVal || 
            (item.ma_vach && item.ma_vach.toLowerCase().includes(searchVal)) ||
            (item.lot && item.lot.toLowerCase().includes(searchVal)) ||
            (item.ten_mat_hang && item.ten_mat_hang.toLowerCase().includes(searchVal)) ||
            (item.ten_hoa_don && item.ten_hoa_don.toLowerCase().includes(searchVal)) ||
            (item.nha_san_xuat && item.nha_san_xuat.toLowerCase().includes(searchVal)) ||
            (item.nhom_hang && item.nhom_hang.toLowerCase().includes(searchVal)) ||
            (item.danh_muc && item.danh_muc.toLowerCase().includes(searchVal));

        const matchCat = (catVal === 'all') || (item.danh_muc === catVal);

        const stats = computeProductBranchStats(item);
        const qty = stats.ton_cuoi;
        let matchStatus = true;
        if (statusVal === 'in_stock') matchStatus = qty > 10;
        else if (statusVal === 'low_stock') matchStatus = qty > 0 && qty <= 10;
        else if (statusVal === 'out_of_stock') matchStatus = qty <= 0;

        if (!matchSearch || !matchCat || !matchStatus) return false;

        // Apply Interdependent Column Filters
        for (const [colKey, selectedSet] of Object.entries(vattuColumnFilters)) {
            if (!selectedSet || selectedSet.size === 0) continue;
            let rawVal = item[colKey];
            if (['ton_dau', 'nhap', 'xuat', 'ton_cuoi'].includes(colKey)) {
                rawVal = stats[colKey];
            }
            let valStr = (rawVal === null || rawVal === undefined || String(rawVal).trim() === '' || String(rawVal).trim() === '-') ? '(Trống)' : String(rawVal).trim();
            if (!selectedSet.has(valStr)) {
                return false;
            }
        }

        return true;
    });

    // Apply 3-State Sorting if active
    if (vattuSortColumn && vattuSortDirection !== 'none') {
        const dir = vattuSortDirection === 'asc' ? 1 : -1;
        filteredVatTuData.sort((a, b) => {
            if (['ton_dau', 'nhap', 'xuat', 'ton_cuoi'].includes(vattuSortColumn)) {
                const statA = computeProductBranchStats(a)[vattuSortColumn];
                const statB = computeProductBranchStats(b)[vattuSortColumn];
                return (statA - statB) * dir;
            }

            const valA = a[vattuSortColumn];
            const valB = b[vattuSortColumn];

            const emptyA = (valA === null || valA === undefined || String(valA).trim() === '' || String(valA).trim() === '-');
            const emptyB = (valB === null || valB === undefined || String(valB).trim() === '' || String(valB).trim() === '-');

            if (emptyA && emptyB) return 0;
            if (emptyA) return 1;
            if (emptyB) return -1;

            if (['gia_von_ton_kho_trung_binh'].includes(vattuSortColumn)) {
                return ((Number(valA) || 0) - (Number(valB) || 0)) * dir;
            }

            if (vattuSortColumn === 'date') {
                return (new Date(valA).getTime() - new Date(valB).getTime()) * dir;
            }

            return String(valA).localeCompare(String(valB), 'vi', { numeric: true, sensitivity: 'base' }) * dir;
        });
    }

    updateColumnFilterBadgesUI();
    renderCurrentPageData();
}

let isResizingColumn = false;

// 3-State Column Header Sort Click Handler (A-Z -> Z-A -> Ban đầu)
function handleHeaderSortClick(colKey, event) {
    if (isResizingColumn) return;
    if (event) {
        const target = event.target;
        if (target && (target.classList.contains('col-resizer') || target.closest('.col-resizer') || target.closest('.col-filter-btn'))) {
            return;
        }
    }

    if (vattuSortColumn === colKey) {
        if (vattuSortDirection === 'none') {
            vattuSortDirection = 'asc';
        } else if (vattuSortDirection === 'asc') {
            vattuSortDirection = 'desc';
        } else {
            vattuSortDirection = 'none';
            vattuSortColumn = null;
        }
    } else {
        vattuSortColumn = colKey;
        vattuSortDirection = 'asc';
    }

    updateSortHeaderUI();
    vattuCurrentPage = 1;
    applyVatTuFilters();
}

function updateSortHeaderUI() {
    const allHeaders = document.querySelectorAll('.vattu-table th[data-sort-col]');
    allHeaders.forEach(th => {
        const col = th.getAttribute('data-sort-col');
        th.classList.remove('sort-active-asc', 'sort-active-desc');
        if (col === vattuSortColumn && vattuSortDirection !== 'none') {
            if (vattuSortDirection === 'asc') {
                th.classList.add('sort-active-asc');
            } else if (vattuSortDirection === 'desc') {
                th.classList.add('sort-active-desc');
            }
        }
    });
}

// ==========================================================================
// Per-Column Funnel Filter Handlers (Interdependent / Phụ thuộc lẫn nhau)
// ==========================================================================

function toggleColumnFilterDropdown(event, colKey) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const popover = document.getElementById('vattu-col-filter-popover');
    if (!popover) return;

    if (popover.style.display === 'flex' && activePopoverColKey === colKey) {
        closeColumnFilterDropdown();
        return;
    }

    activePopoverColKey = colKey;

    const btn = (event && event.currentTarget) ? event.currentTarget : document.querySelector(`.col-filter-btn[data-col="${colKey}"]`);
    if (btn) {
        const rect = btn.getBoundingClientRect();
        let left = rect.left;
        let top = rect.bottom + 6;

        if (left + 250 > window.innerWidth) {
            left = window.innerWidth - 260;
        }
        if (left < 10) left = 10;
        if (top + 380 > window.innerHeight) {
            top = rect.top - 380;
        }

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
    }

    const titleEl = document.getElementById('filter-popover-title');
    if (titleEl) titleEl.textContent = `Lọc Cột: ${vattuColTitles[colKey] || colKey}`;

    const searchInput = document.getElementById('filter-popover-search-input');
    if (searchInput) searchInput.value = '';

    const existing = vattuColumnFilters[colKey];
    const availableOptions = getAvailableOptionsForColumn(colKey);

    if (existing && existing.size > 0) {
        popoverTempSelectedValues = new Set(existing);
    } else {
        popoverTempSelectedValues = new Set(availableOptions.map(x => x.valStr));
    }

    popover.style.display = 'flex';
    renderFilterPopoverListOptions();
}

function closeColumnFilterDropdown() {
    const popover = document.getElementById('vattu-col-filter-popover');
    if (popover) popover.style.display = 'none';
    activePopoverColKey = null;
}

// Calculate available options & counts for colKey (Interdependent across all other column filters)
function getAvailableOptionsForColumn(colKey) {
    const searchVal = (document.getElementById('vattu-search-input')?.value || '').toLowerCase().trim();
    const catVal = document.getElementById('vattu-category-filter')?.value || 'all';
    const statusVal = document.getElementById('vattu-status-filter')?.value || 'all';

    const subset = vatTuData.filter(item => {
        const matchSearch = !searchVal || 
            (item.ma_vach && item.ma_vach.toLowerCase().includes(searchVal)) ||
            (item.lot && item.lot.toLowerCase().includes(searchVal)) ||
            (item.ten_mat_hang && item.ten_mat_hang.toLowerCase().includes(searchVal)) ||
            (item.ten_hoa_don && item.ten_hoa_don.toLowerCase().includes(searchVal)) ||
            (item.nha_san_xuat && item.nha_san_xuat.toLowerCase().includes(searchVal)) ||
            (item.nhom_hang && item.nhom_hang.toLowerCase().includes(searchVal)) ||
            (item.danh_muc && item.danh_muc.toLowerCase().includes(searchVal));

        const matchCat = (catVal === 'all') || (item.danh_muc === catVal);

        const stats = computeProductBranchStats(item);
        const qty = stats.ton_cuoi;
        let matchStatus = true;
        if (statusVal === 'in_stock') matchStatus = qty > 10;
        else if (statusVal === 'low_stock') matchStatus = qty > 0 && qty <= 10;
        else if (statusVal === 'out_of_stock') matchStatus = qty <= 0;

        if (!matchSearch || !matchCat || !matchStatus) return false;

        // Check other active column filters (except current colKey)
        for (const [otherCol, selectedSet] of Object.entries(vattuColumnFilters)) {
            if (otherCol === colKey) continue;
            if (!selectedSet || selectedSet.size === 0) continue;
            let rawVal = item[otherCol];
            if (['ton_dau', 'nhap', 'xuat', 'ton_cuoi'].includes(otherCol)) {
                rawVal = stats[otherCol];
            }
            let valStr = (rawVal === null || rawVal === undefined || String(rawVal).trim() === '' || String(rawVal).trim() === '-') ? '(Trống)' : String(rawVal).trim();
            if (!selectedSet.has(valStr)) return false;
        }

        return true;
    });

    const countsMap = new Map();
    subset.forEach(item => {
        let rawVal = item[colKey];
        if (['ton_dau', 'nhap', 'xuat', 'ton_cuoi'].includes(colKey)) {
            rawVal = computeProductBranchStats(item)[colKey];
        }
        let valStr = (rawVal === null || rawVal === undefined || String(rawVal).trim() === '' || String(rawVal).trim() === '-') ? '(Trống)' : String(rawVal).trim();
        countsMap.set(valStr, (countsMap.get(valStr) || 0) + 1);
    });

    const results = [];
    countsMap.forEach((count, valStr) => {
        results.push({ valStr, count });
    });

    results.sort((a, b) => {
        if (a.valStr === '(Trống)') return 1;
        if (b.valStr === '(Trống)') return -1;
        return a.valStr.localeCompare(b.valStr, 'vi', { numeric: true, sensitivity: 'base' });
    });

    return results;
}

function renderFilterPopoverListOptions() {
    if (!activePopoverColKey) return;

    const listContainer = document.getElementById('filter-popover-list');
    const searchVal = (document.getElementById('filter-popover-search-input')?.value || '').toLowerCase().trim();
    if (!listContainer) return;

    const options = getAvailableOptionsForColumn(activePopoverColKey);
    const filteredOptions = options.filter(opt => !searchVal || opt.valStr.toLowerCase().includes(searchVal));

    listContainer.innerHTML = '';

    if (filteredOptions.length === 0) {
        listContainer.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 12px;">Không có giá trị trùng khớp</div>`;
    } else {
        filteredOptions.forEach(opt => {
            const isChecked = popoverTempSelectedValues.has(opt.valStr);
            const label = document.createElement('label');
            label.className = 'popover-checkbox-label';
            
            const escValue = opt.valStr.replace(/"/g, '&quot;');
            const escText = opt.valStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            label.innerHTML = `
                <input type="checkbox" value="${escValue}" ${isChecked ? 'checked' : ''}>
                <span>${escText}</span>
                <span class="popover-item-count">${opt.count}</span>
            `;

            const cb = label.querySelector('input');
            cb.onchange = (e) => {
                if (e.target.checked) {
                    popoverTempSelectedValues.add(opt.valStr);
                } else {
                    popoverTempSelectedValues.delete(opt.valStr);
                }
                updateSelectAllCheckboxState(filteredOptions);
            };

            listContainer.appendChild(label);
        });
    }

    updateSelectAllCheckboxState(filteredOptions);
}

function updateSelectAllCheckboxState(filteredOptions) {
    const selectAllCb = document.getElementById('popover-select-all');
    if (!selectAllCb || !filteredOptions || filteredOptions.length === 0) return;
    const allChecked = filteredOptions.every(opt => popoverTempSelectedValues.has(opt.valStr));
    selectAllCb.checked = allChecked;
}

function toggleSelectAllPopoverOptions(checked) {
    if (!activePopoverColKey) return;
    const options = getAvailableOptionsForColumn(activePopoverColKey);
    options.forEach(opt => {
        if (checked) {
            popoverTempSelectedValues.add(opt.valStr);
        } else {
            popoverTempSelectedValues.delete(opt.valStr);
        }
    });
    renderFilterPopoverListOptions();
}

function applyCurrentColumnFilter() {
    if (!activePopoverColKey) return;
    const colKey = activePopoverColKey;
    const availableOptions = getAvailableOptionsForColumn(colKey);

    if (popoverTempSelectedValues.size >= availableOptions.length) {
        delete vattuColumnFilters[colKey];
    } else {
        vattuColumnFilters[colKey] = new Set(popoverTempSelectedValues);
    }

    updateColumnFilterBadgesUI();
    closeColumnFilterDropdown();
    vattuCurrentPage = 1;
    applyVatTuFilters();
}

function clearCurrentColumnFilter() {
    if (!activePopoverColKey) return;
    delete vattuColumnFilters[activePopoverColKey];
    updateColumnFilterBadgesUI();
    closeColumnFilterDropdown();
    vattuCurrentPage = 1;
    applyVatTuFilters();
}

function updateColumnFilterBadgesUI() {
    let hasActiveFilters = false;

    const allBtns = document.querySelectorAll('.col-filter-btn[data-col]');
    allBtns.forEach(btn => {
        const colKey = btn.getAttribute('data-col');
        const badge = document.getElementById(`filter-badge-${colKey}`);
        const selectedSet = vattuColumnFilters[colKey];

        if (selectedSet && selectedSet.size > 0) {
            btn.classList.add('filter-active');
            hasActiveFilters = true;
            if (badge) {
                badge.textContent = selectedSet.size;
                badge.style.display = 'inline-flex';
            }
        } else {
            btn.classList.remove('filter-active');
            if (badge) {
                badge.style.display = 'none';
            }
        }
    });

    const searchInput = document.getElementById('vattu-search-input');
    if (searchInput && searchInput.value.trim() !== '') {
        hasActiveFilters = true;
    }

    const btnClearFilter = document.getElementById('btn-clear-all-filters-vattu');
    if (btnClearFilter) {
        if (hasActiveFilters) {
            btnClearFilter.classList.add('btn-clear-active');
        } else {
            btnClearFilter.classList.remove('btn-clear-active');
        }
    }
}

// Render Current Page Data (Pagination)
function renderCurrentPageData() {
    const totalItems = filteredVatTuData.length;
    const totalPages = Math.ceil(totalItems / vattuPageSize) || 1;

    if (vattuCurrentPage > totalPages) vattuCurrentPage = totalPages;
    if (vattuCurrentPage < 1) vattuCurrentPage = 1;

    const startIdx = (vattuCurrentPage - 1) * vattuPageSize;
    const endIdx = Math.min(startIdx + vattuPageSize, totalItems);
    const pageItems = filteredVatTuData.slice(startIdx, endIdx);

    renderVatTuTableHeader();
    renderVatTuTable(pageItems);
    renderVatTuPaginationControls(totalItems, totalPages, startIdx, endIdx);
}

// Render Table Header dynamically
function renderVatTuTableHeader() {
    const thead = document.getElementById('vattu-table-head');
    if (!thead) return;

    const visibleCols = currentVatTuCols.filter(c => c.visible);

    let trHtml = '<tr>';
    visibleCols.forEach((col, visIdx) => {
        const { style: stickyStyle, className: stickyClass } = getStickyColMeta(visIdx, visibleCols, true);

        const sortActiveAsc = vattuSortColumn === col.key && vattuSortDirection === 'asc' ? 'sort-active-asc' : '';
        const sortActiveDesc = vattuSortColumn === col.key && vattuSortDirection === 'desc' ? 'sort-active-desc' : '';
        
        let filterBadgeHtml = `<span class="filter-badge" id="filter-badge-${col.key}" style="display:none;">0</span>`;

        trHtml += `
            <th data-sort-col="${col.key}" class="sortable-th ${sortActiveAsc} ${sortActiveDesc} ${stickyClass}" style="width: ${col.width}; min-width: ${col.minWidth}; text-align: ${col.align}; ${stickyStyle}" onclick="handleHeaderSortClick('${col.key}', event)">
                <div class="th-content" style="justify-content: ${col.align === 'right' ? 'flex-end' : 'flex-start'}; pointer-events: none;">
                    <span class="th-title-text">${escapeHtml(col.title)}</span>
                    <div class="th-actions" style="pointer-events: auto;">
                        <span class="sort-icon-wrap" title="Sắp xếp">
                            <svg class="sort-icon icon-neutral" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"></path></svg>
                            <svg class="sort-icon icon-asc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"></path></svg>
                            <svg class="sort-icon icon-desc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7 7 7-7"></path></svg>
                        </span>
                        <button type="button" class="col-filter-btn" data-col="${col.key}" title="Lọc ${escapeHtml(col.title)}" onclick="event.stopPropagation(); toggleColumnFilterDropdown(event, '${col.key}')">
                            <svg class="funnel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                            ${filterBadgeHtml}
                        </button>
                    </div>
                </div>
                <div class="col-resizer"></div>
            </th>
        `;
    });
    
    // Always append Actions column
    trHtml += `<th style="width: 110px; min-width: 90px; text-align: center;" class="sticky-action-th">Thao Tác</th>`;
    trHtml += '</tr>';
    
    thead.innerHTML = trHtml;
    updateColumnFilterBadgesUI();
    initColumnResizing(); // Re-bind resizers for dynamic headers
}

// Render Table Rows
function renderVatTuTable(items) {
    const tbody = document.getElementById('vattu-table-body');
    const emptyState = document.getElementById('vattu-empty-state');
    const tableWrapper = document.getElementById('vattu-table-wrapper');
    const paginationBar = document.getElementById('vattu-pagination-bar');

    if (!tbody) return;
    tbody.innerHTML = '';

    if (!items || items.length === 0) {
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (paginationBar) paginationBar.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (tableWrapper) tableWrapper.style.display = 'block';
    if (paginationBar) paginationBar.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';

    items.forEach(item => {
        const tr = document.createElement('tr');
        const stats = computeProductBranchStats(item);
        const isExpanded = expandedVatTuRows.has(String(item.id));
        const hasDetails = stats.details && stats.details.length > 0;
        const giaVon = Number(item.gia_von_ton_kho_trung_binh) || 0;

        if (isExpanded) tr.classList.add('is-expanded');

        let trHtml = '';

        const visibleCols = currentVatTuCols.filter(c => c.visible);

        visibleCols.forEach((col, visIdx) => {
            const { style: stickyStyle, className: stickyClass } = getStickyColMeta(visIdx, visibleCols);

            let cellContent = '';

            if (col.key === 'ma_vach') {
                let toggleBtn = '';
                if (hasDetails) {
                    toggleBtn = `
                        <button type="button" class="btn-subrow-toggle ${isExpanded ? 'active' : ''}" title="${isExpanded ? 'Thu gọn' : 'Xem chi tiết nhánh con'}" onclick="toggleVatTuSubRow('${item.id}', event)">
                            <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>`;
                } else {
                    toggleBtn = `<span style="display: inline-block; width: 22px;"></span>`;
                }

                cellContent = `<div style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">${toggleBtn}<code class="vattu-barcode-code" style="flex-shrink: 0;">${escapeHtml(item.ma_vach || '-')}</code></div>`;
            } else if (col.key === 'ten_mat_hang') {
                cellContent = `<strong>${formatTruncateCell(item.ten_mat_hang, '-')}</strong>`;
            } else if (col.key === 'danh_muc') {
                cellContent = `<span class="vattu-cat-tag">${escapeHtml(item.danh_muc || 'Khác')}</span>`;
            } else if (col.key === 'don_vi') {
                cellContent = `<span class="vattu-unit-pill">${escapeHtml(item.don_vi || '-')}</span>`;
            } else if (col.key === 'ton_dau') {
                cellContent = stats.ton_dau.toLocaleString('vi-VN');
            } else if (col.key === 'nhap' || col.key === 'so_luong_nhap') {
                cellContent = stats.nhap.toLocaleString('vi-VN');
            } else if (col.key === 'xuat') {
                cellContent = stats.xuat.toLocaleString('vi-VN');
            } else if (col.key === 'ton_cuoi' || col.key === 'so_luong_ton') {
                const qtyTon = stats.ton_cuoi;
                if (qtyTon < 0) cellContent = `<span class="badge-stock badge-stock-empty">Âm kho (${qtyTon})</span>`;
                else if (qtyTon === 0) cellContent = `<span class="badge-stock badge-stock-empty">Hết hàng (0)</span>`;
                else if (qtyTon <= 10) cellContent = `<span class="badge-stock badge-stock-low">${qtyTon} (Sắp hết)</span>`;
                else cellContent = `<span class="vattu-stock-val">${qtyTon.toLocaleString('vi-VN')}</span>`;
            } else if (col.key === 'gia_von_ton_kho_trung_binh') {
                cellContent = `<span style="font-weight: 600;">${formatVND(giaVon)}</span>`;
            } else {
                cellContent = formatTruncateCell(item[col.key], '-');
            }

            trHtml += `<td style="text-align: ${col.align}; ${stickyStyle}" class="${stickyClass}">${cellContent}</td>`;
        });

        const hasTransaction = (
            Number(stats.nhap || 0) !== 0 ||
            Number(stats.xuat || 0) !== 0 ||
            Number(stats.ton_cuoi || 0) !== 0 ||
            Number(stats.ton_dau || 0) !== 0 ||
            (stats.details && stats.details.some(d => (Number(d.tong_nhap)||0) !== 0 || (Number(d.tong_xuat)||0) !== 0 || (Number(d.ton_kho)||0) !== 0))
        );

        const deleteBtnHtml = hasTransaction ? `
            <button type="button" class="btn-action-icon btn-delete-vattu" disabled title="Mặt hàng đã phát sinh Nhập/Xuất/Tồn kho (khác 0) - Không thể xóa!" style="opacity: 0.25; cursor: not-allowed; pointer-events: none;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        ` : `
            <button type="button" class="btn-action-icon btn-delete-vattu" title="Xóa mặt hàng này (Chưa phát sinh Nhập/Xuất/Tồn)" onclick="confirmDeleteVatTu('${item.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;

        // Add sticky actions
        trHtml += `
            <td style="text-align: center;" class="sticky-action-td">
                <div class="vattu-action-btns">
                    <button type="button" class="btn-action-icon btn-edit-vattu" title="Chỉnh sửa" onclick="openEditVatTuModal('${item.id}')">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    ${deleteBtnHtml}
                </div>
            </td>
        `;

        tr.innerHTML = trHtml;
        tbody.appendChild(tr);

        // Render Expanded Child Rows directly aligned with main table columns if active & details exist
        if (isExpanded && hasDetails) {
            stats.details.forEach((d, idx) => {
                const isLast = idx === stats.details.length - 1;
                const branchTreeIcon = isLast ? '└──' : '├──';
                const dTonDau = Math.max(0, (Number(d.ton_kho)||0) - (Number(d.tong_nhap)||0) + (Number(d.tong_xuat)||0));
                const childTr = document.createElement('tr');
                childTr.className = 'vattu-child-detail-row';

                let childTrHtml = '';

                visibleCols.forEach((col, visIdx) => {
                    const { style: stickyStyle, className: stickyClass } = getStickyColMeta(visIdx, visibleCols);

                    let cellContent = '';

                    if (col.key === 'ma_vach') {
                        cellContent = `<div style="padding-left: 20px; display: inline-flex; align-items: center; gap: 6px;"><span style="color: #3b82f6; font-weight: bold; font-family: monospace; font-size: 14px;">${branchTreeIcon}</span> <span class="subrow-branch-badge">📍 ${escapeHtml(d.chi_nhanh || '-')}</span></div>`;
                    } else if (col.key === 'ten_mat_hang') {
                        cellContent = `<span class="subrow-label">LOT: <strong class="subrow-value">${escapeHtml(d.lot || '-')}</strong></span>`;
                    } else if (col.key === 'ten_hoa_don') {
                        cellContent = `<span class="subrow-label">Hạn SD: <strong class="subrow-value">${escapeHtml(formatDate(d.date_expiry))}</strong></span>`;
                    } else if (col.key === 'ton_dau') {
                        cellContent = `<span class="subrow-value">${dTonDau.toLocaleString('vi-VN')}</span>`;
                    } else if (col.key === 'nhap' || col.key === 'so_luong_nhap') {
                        cellContent = `<span style="color: #10b981; font-weight: 700;">${(Number(d.tong_nhap)||0).toLocaleString('vi-VN')}</span>`;
                    } else if (col.key === 'xuat') {
                        cellContent = `<span style="color: #ef4444; font-weight: 700;">${(Number(d.tong_xuat)||0).toLocaleString('vi-VN')}</span>`;
                    } else if (col.key === 'ton_cuoi' || col.key === 'so_luong_ton') {
                        cellContent = `<span style="font-weight: 800; color: #3b82f6;">${(Number(d.ton_kho)||0).toLocaleString('vi-VN')}</span>`;
                    } else {
                        cellContent = `<span class="subrow-empty">-</span>`;
                    }

                    childTrHtml += `<td style="text-align: ${col.align}; ${stickyStyle}" class="${stickyClass}">${cellContent}</td>`;
                });

                // Empty sticky actions td for child row
                childTrHtml += `<td style="text-align: center;" class="sticky-action-td"></td>`;

                childTr.innerHTML = childTrHtml;
                tbody.appendChild(childTr);
            });
        }
    });
}

// Requirement 1: Render Pagination Buttons & Range Info
function renderVatTuPaginationControls(totalItems, totalPages, startIdx, endIdx) {
    const rangeTextEl = document.getElementById('vattu-page-range-text');
    const totalTextEl = document.getElementById('vattu-page-total-text');
    const btnsContainer = document.getElementById('vattu-page-btns-container');

    if (totalItems === 0) {
        if (rangeTextEl) rangeTextEl.textContent = '0 - 0';
        if (totalTextEl) totalTextEl.textContent = '0';
        if (btnsContainer) btnsContainer.innerHTML = '';
        return;
    }

    if (rangeTextEl) rangeTextEl.textContent = `${startIdx + 1} - ${endIdx}`;
    if (totalTextEl) totalTextEl.textContent = totalItems.toLocaleString('vi-VN');

    if (!btnsContainer) return;
    btnsContainer.innerHTML = '';

    // Prev Button
    const btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.className = `vattu-page-btn ${vattuCurrentPage <= 1 ? 'disabled' : ''}`;
    btnPrev.innerHTML = `&laquo; Trước`;
    btnPrev.disabled = vattuCurrentPage <= 1;
    btnPrev.onclick = () => {
        if (vattuCurrentPage > 1) {
            vattuCurrentPage--;
            renderCurrentPageData();
        }
    };
    btnsContainer.appendChild(btnPrev);

    // Page Number Buttons (Limit to max 5 page numbers around current)
    let startPage = Math.max(1, vattuCurrentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let p = startPage; p <= endPage; p++) {
        const pageBtn = document.createElement('button');
        pageBtn.type = 'button';
        pageBtn.className = `vattu-page-btn ${p === vattuCurrentPage ? 'active' : ''}`;
        pageBtn.textContent = p;
        pageBtn.onclick = () => {
            vattuCurrentPage = p;
            renderCurrentPageData();
        };
        btnsContainer.appendChild(pageBtn);
    }

    // Next Button
    const btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = `vattu-page-btn ${vattuCurrentPage >= totalPages ? 'disabled' : ''}`;
    btnNext.innerHTML = `Sau &raquo;`;
    btnNext.disabled = vattuCurrentPage >= totalPages;
    btnNext.onclick = () => {
        if (vattuCurrentPage < totalPages) {
            vattuCurrentPage++;
            renderCurrentPageData();
        }
    };
    btnsContainer.appendChild(btnNext);
}

// Requirement 5: Resizable Columns Dragging Handler (AppSheet Style - Fixed persistence)
function initColumnResizing() {
    const resizers = document.querySelectorAll('.vattu-table .col-resizer, #vattu-table .col-resizer, .col-resizer');
    resizers.forEach(resizer => {
        const th = resizer.parentElement;
        if (!th) return;
        let startX, startWidth;

        const onMouseMove = (e) => {
            if (!startX) return;
            isResizingColumn = true;
            const diffX = e.pageX - startX;
            const newWidth = Math.max(50, startWidth + diffX);
            th.style.width = `${newWidth}px`;
            th.style.minWidth = `${newWidth}px`;

            const colKey = th.getAttribute('data-sort-col');
            if (colKey && typeof currentVatTuCols !== 'undefined' && Array.isArray(currentVatTuCols)) {
                const colObj = currentVatTuCols.find(c => c.key === colKey);
                if (colObj) {
                    colObj.width = `${newWidth}px`;
                    colObj.minWidth = `${newWidth}px`;
                }
            }
        };

        const onMouseUp = (e) => {
            if (!startX) return;
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            startX = null;
            resizer.classList.remove('resizing');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (typeof currentVatTuCols !== 'undefined' && Array.isArray(currentVatTuCols)) {
                try {
                    localStorage.setItem('gaia_vattu_columns_v7', JSON.stringify(currentVatTuCols));
                } catch (err) {}
            }

            // Keep flag active briefly so mouseup click event does not trigger A-Z sorting
            setTimeout(() => {
                isResizingColumn = false;
            }, 250);
        };

        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isResizingColumn = true;
            startX = e.pageX;
            startWidth = th.offsetWidth;
            resizer.classList.add('resizing');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        resizer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });
}

function initVatTuComboboxes() {
    const fields = [
        { id: 'input-vattu-nha-san-xuat', key: 'nha_san_xuat' },
        { id: 'input-vattu-danh-muc', key: 'danh_muc' },
        { id: 'input-vattu-nhom-hang', key: 'nhom_hang' },
        { id: 'input-vattu-phan-loai', key: 'phan_loai' },
        { id: 'input-vattu-don-vi', key: 'don_vi' }
    ];

    fields.forEach(field => {
        const input = document.getElementById(field.id);
        if (input && !input.parentElement.classList.contains('custom-combobox-wrap')) {
            const wrap = document.createElement('div');
            wrap.className = 'custom-combobox-wrap';
            input.parentNode.insertBefore(wrap, input);
            wrap.appendChild(input);

            const arrow = document.createElement('div');
            arrow.innerHTML = `<svg class="custom-combobox-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg>`;
            wrap.appendChild(arrow.firstChild);

            const dropdown = document.createElement('div');
            dropdown.className = 'custom-combobox-dropdown';
            wrap.appendChild(dropdown);

            const toggleDropdown = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.custom-combobox-dropdown').forEach(el => {
                    if (el !== dropdown) el.classList.remove('show');
                });
                if (!dropdown.classList.contains('show')) {
                    renderComboboxOptions(field, input, dropdown);
                    dropdown.classList.add('show');
                } else {
                    dropdown.classList.remove('show');
                }
            };

            input.addEventListener('click', toggleDropdown);
            input.addEventListener('input', () => {
                dropdown.classList.add('show');
                renderComboboxOptions(field, input, dropdown, input.value);
            });

            document.addEventListener('click', (e) => {
                if (!wrap.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });
            
            // Also toggle on arrow click
            wrap.querySelector('.custom-combobox-arrow').parentElement.addEventListener('click', toggleDropdown);
        }
    });
}

function renderComboboxOptions(field, input, dropdown, filterText = '') {
    let uniqueVals = [...new Set(vatTuData.map(item => item[field.key]).filter(val => val))].sort();
    if (field.key === 'danh_muc' && uniqueVals.length === 0) {
        uniqueVals = ['Thuốc', 'Vắc-xin', 'Vật tư phẫu thuật', 'Vật tư tiêu hao', 'Khác'];
    }
    
    if (filterText) {
        uniqueVals = uniqueVals.filter(val => val.toLowerCase().includes(filterText.toLowerCase()));
    }

    if (uniqueVals.length === 0) {
        dropdown.innerHTML = `<div class="custom-combobox-option" style="color:#94a3b8; font-style:italic; pointer-events:none;">Không có gợi ý</div>`;
        return;
    }

    dropdown.innerHTML = uniqueVals.map(val => `<div class="custom-combobox-option">${val}</div>`).join('');
    
    dropdown.querySelectorAll('.custom-combobox-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            input.value = opt.textContent;
            dropdown.classList.remove('show');
        });
    });
}

// Modal Handlers (Add / Edit)
function openAddVatTuModal() {
    editingVatTuId = null;
    const modal = document.getElementById('vattu-modal');
    const titleEl = document.getElementById('vattu-modal-title');
    const form = document.getElementById('vattu-form');

    if (form) form.reset();
    clearVatTuFormErrors();
    initVatTuComboboxes();

    if (titleEl) titleEl.textContent = "Thêm Mới Vật Tư / Thuốc Y Tế";

    if (modal) modal.classList.add('show');
}

function openEditVatTuModal(id) {
    const item = vatTuData.find(x => String(x.id) === String(id));
    if (!item) return;

    editingVatTuId = item.id;
    const modal = document.getElementById('vattu-modal');
    const titleEl = document.getElementById('vattu-modal-title');

    clearVatTuFormErrors();
    initVatTuComboboxes();

    if (titleEl) titleEl.textContent = `Chỉnh Sửa Vật Tư: ${item.ten_mat_hang || ''}`;

    document.getElementById('input-vattu-ma-vach').value = item.ma_vach || '';
    document.getElementById('input-vattu-ten-mat-hang').value = item.ten_mat_hang || '';
    document.getElementById('input-vattu-ten-hoa-don').value = item.ten_hoa_don || '';
    document.getElementById('input-vattu-nha-san-xuat').value = item.nha_san_xuat || '';
    document.getElementById('input-vattu-danh-muc').value = item.danh_muc || 'Thuốc';
    document.getElementById('input-vattu-nhom-hang').value = item.nhom_hang || '';
    document.getElementById('input-vattu-phan-loai').value = item.phan_loai || '';
    document.getElementById('input-vattu-don-vi').value = item.don_vi || '';
    document.getElementById('input-vattu-cach-dung').value = item.cach_dung || '';
    if (document.getElementById('input-vattu-ton-dau')) document.getElementById('input-vattu-ton-dau').value = item.ton_dau ?? 0;
    if (document.getElementById('input-vattu-nhap')) document.getElementById('input-vattu-nhap').value = item.nhap ?? item.so_luong_nhap ?? 0;
    if (document.getElementById('input-vattu-xuat')) document.getElementById('input-vattu-xuat').value = item.xuat ?? 0;
    if (document.getElementById('input-vattu-ton-cuoi')) document.getElementById('input-vattu-ton-cuoi').value = item.ton_cuoi ?? item.so_luong_ton ?? 0;
    if (document.getElementById('input-vattu-gia-von')) document.getElementById('input-vattu-gia-von').value = item.gia_von_ton_kho_trung_binh ?? 0;

    if (modal) modal.classList.add('show');
}

function closeVatTuModal() {
    const modal = document.getElementById('vattu-modal');
    if (modal) modal.classList.remove('show');
    editingVatTuId = null;
}

// Form Submission Save Logic
async function handleSaveVatTuForm(e) {
    e.preventDefault();
    clearVatTuFormErrors();

    const maVach = document.getElementById('input-vattu-ma-vach').value.trim();
    const tenMatHang = document.getElementById('input-vattu-ten-mat-hang').value.trim();
    const tenHoaDon = document.getElementById('input-vattu-ten-hoa-don').value.trim();
    const nhaSanXuat = document.getElementById('input-vattu-nha-san-xuat').value.trim();
    const danhMuc = document.getElementById('input-vattu-danh-muc').value;
    const nhomHang = document.getElementById('input-vattu-nhom-hang').value.trim();
    const phanLoai = document.getElementById('input-vattu-phan-loai').value.trim();
    const donVi = document.getElementById('input-vattu-don-vi').value.trim();
    const cachDung = document.getElementById('input-vattu-cach-dung').value.trim();
    
    const tonDau = parseFloat(document.getElementById('input-vattu-ton-dau')?.value) || 0;
    const nhapVal = parseFloat(document.getElementById('input-vattu-nhap')?.value) || 0;
    const xuatVal = parseFloat(document.getElementById('input-vattu-xuat')?.value) || 0;
    const tonCuoi = parseFloat(document.getElementById('input-vattu-ton-cuoi')?.value) || (tonDau + nhapVal - xuatVal);
    const giaVon = parseFloat(document.getElementById('input-vattu-gia-von')?.value) || 0;

    let isValid = true;

    if (!maVach) {
        showVatTuFieldError('err-vattu-ma-vach', 'Vui lòng nhập mã vạch!');
        isValid = false;
    } else {
        const isDuplicate = vatTuData.some(item => 
            item.ma_vach && String(item.ma_vach).toLowerCase() === maVach.toLowerCase() && 
            String(item.id) !== String(editingVatTuId)
        );
        if (isDuplicate) {
            showVatTuFieldError('err-vattu-ma-vach', 'Mã vạch này trùng, vui lòng kiểm tra lại!');
            showVatTuNoticeModal('error', 'Trùng Mã Vạch', `Mã vạch "${maVach}" đã tồn tại trong hệ thống. Vui lòng kiểm tra lại!`);
            isValid = false;
        }
    }
    if (!tenMatHang) {
        showVatTuFieldError('err-vattu-ten-mat-hang', 'Vui lòng nhập tên mặt hàng!');
        isValid = false;
    }
    if (!donVi) {
        showVatTuFieldError('err-vattu-don-vi', 'Vui lòng nhập đơn vị tính!');
        isValid = false;
    }

    if (!isValid) return;

    const payload = {
        ma_vach: maVach || null,
        ten_mat_hang: tenMatHang || null,
        ten_hoa_don: tenHoaDon || tenMatHang || null,
        nha_san_xuat: nhaSanXuat || null,
        danh_muc: danhMuc || 'Thuốc',
        nhom_hang: nhomHang || null,
        phan_loai: phanLoai || null,
        don_vi: donVi || null,
        cach_dung: cachDung || null,
        ton_dau: tonDau,
        nhap: nhapVal,
        xuat: xuatVal,
        ton_cuoi: tonCuoi,
        gia_von_ton_kho_trung_binh: giaVon
    };

    const client = getVatTuSupabaseClient();
    const btnSubmit = document.getElementById('btn-submit-vattu');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Đang lưu...";
    }

    try {
        if (client) {
            if (editingVatTuId) {
                const { error } = await client
                    .from('san_pham')
                    .update(payload)
                    .eq('id', editingVatTuId);
                if (error) throw error;
            } else {
                const { error } = await client
                    .from('san_pham')
                    .insert([payload]);
                if (error) throw error;
            }
            console.log("GAIA VatTu: Saved successfully to Supabase!");
            closeVatTuModal();
            showVatTuNoticeModal('success', 'Lưu Thành Công', editingVatTuId ? 'Đã cập nhật thông tin mặt hàng thành công!' : 'Đã thêm mới mặt hàng vào kho thành công!');
            fetchVatTuData();
        } else {
            if (editingVatTuId) {
                const idx = vatTuData.findIndex(x => String(x.id) === String(editingVatTuId));
                if (idx !== -1) vatTuData[idx] = { ...vatTuData[idx], ...payload };
            } else {
                vatTuData.unshift({ id: Date.now(), ...payload });
            }
            closeVatTuModal();
            showVatTuNoticeModal('success', 'Lưu Thành Công', editingVatTuId ? 'Đã cập nhật thông tin mặt hàng!' : 'Đã thêm mới mặt hàng vào kho!');
            renderVatTuView(vatTuData);
        }
    } catch (err) {
        console.error("GAIA VatTu: Error saving item:", err);
        if (err.message && err.message.toLowerCase().includes('row-level security')) {
            showVatTuNoticeModal(
                'error',
                'Lỗi Phân Quyền Supabase (RLS)',
                'Bảng "san_pham" trên Supabase đang bật chế độ bảo mật RLS làm chặn quyền Thêm/Sửa.',
                'ALTER TABLE public.san_pham DISABLE ROW LEVEL SECURITY;'
            );
        } else {
            showVatTuNoticeModal('error', 'Không Thể Lưu Dữ Liệu', `Lỗi khi lưu thông tin: ${err.message || 'Không thể kết nối Supabase'}`);
        }
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Lưu Dữ Liệu";
        }
    }
}

// Delete Handlers
function confirmDeleteVatTu(id) {
    const item = vatTuData.find(x => String(x.id) === String(id));
    if (!item) return;

    const stats = computeProductBranchStats(item);
    const hasTransaction = (
        Number(stats.nhap || 0) !== 0 ||
        Number(stats.xuat || 0) !== 0 ||
        Number(stats.ton_cuoi || 0) !== 0 ||
        Number(stats.ton_dau || 0) !== 0 ||
        (stats.details && stats.details.some(d => (Number(d.tong_nhap)||0) !== 0 || (Number(d.tong_xuat)||0) !== 0 || (Number(d.ton_kho)||0) !== 0))
    );

    if (hasTransaction) {
        showVatTuNoticeModal('warning', 'Không Thể Xóa Vật Tư', `Vật tư <strong>${escapeHtml(item.ten_mat_hang || item.ma_vach)}</strong> đã phát sinh Nhập/Xuất hoặc số lượng tồn kho khác 0. Không thể xóa!`);
        return;
    }

    deletingVatTuId = item.id;
    const textEl = document.getElementById('delete-vattu-name-text');
    if (textEl) textEl.textContent = `"${item.ten_mat_hang || item.ma_vach}"`;

    const modal = document.getElementById('vattu-delete-modal');
    if (modal) modal.classList.add('show');
}

function closeDeleteVatTuModal() {
    const modal = document.getElementById('vattu-delete-modal');
    if (modal) modal.classList.remove('show');
    deletingVatTuId = null;
}

async function executeDeleteVatTu() {
    if (!deletingVatTuId) return;

    const client = getVatTuSupabaseClient();
    const btnConfirm = document.getElementById('btn-confirm-delete-vattu');
    if (btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.textContent = "Đang xóa...";
    }

    try {
        if (client) {
            const { error } = await client
                .from('san_pham')
                .delete()
                .eq('id', deletingVatTuId);
            if (error) console.warn("Supabase delete warning:", error.message);
        }

        vatTuData = vatTuData.filter(x => String(x.id) !== String(deletingVatTuId));
        closeDeleteVatTuModal();
        showVatTuNoticeModal('success', 'Đã Xóa Mặt Hàng', 'Đã xóa mặt hàng khỏi kho dữ liệu thành công!');
        renderVatTuView(vatTuData);
    } catch (err) {
        console.error("GAIA VatTu: Error deleting item:", err);
        vatTuData = vatTuData.filter(x => String(x.id) !== String(deletingVatTuId));
        closeDeleteVatTuModal();
        renderVatTuView(vatTuData);
    } finally {
        if (btnConfirm) {
            btnConfirm.disabled = false;
            btnConfirm.textContent = "Xóa Vật Tư";
        }
    }
}

// ==========================================================================
// EXCEL EXPORT & IMPORT FUNCTIONALITY
// ==========================================================================

// Helper to download Excel workbook with explicit .xlsx MIME type & filename
function downloadExcelWorkbook(workbook, fileName) {
    try {
        const b64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
        const dataUrl = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (a.parentNode) document.body.removeChild(a);
        }, 300);
    } catch (e) {
        console.warn("GAIA VatTu: Fallback to XLSX.writeFile due to:", e);
        XLSX.writeFile(workbook, fileName);
    }
}

// Download Excel Sample Template (.xlsx) - Form mới nhất kèm các cột tiêu đề & 2 dòng mẫu
function downloadVatTuExcelTemplate() {
    if (typeof XLSX === 'undefined') {
        showVatTuNoticeModal('warning', 'Chưa Sẵn Sàng', 'Thư viện SheetJS chưa sẵn sàng. Vui lòng kiểm tra kết nối mạng!');
        return;
    }

    const templateRows = [
        [
            "STT",
            "Mã Vạch",
            "Tên Mặt Hàng",
            "Tên Hóa Đơn",
            "Nhà Sản Xuất",
            "Danh Mục",
            "Nhóm Hàng",
            "Phân Loại",
            "Đơn Vị",
            "Cách Dùng",
            "Đầu",
            "Nhập",
            "Xuất",
            "Cuối",
            "Giá Vốn TB"
        ],
        [
            1,
            "300000000197",
            "Povidine 10% 500ml",
            "Povidine 10% 500ml",
            "Pharmedic",
            "Thuốc",
            "Vật tư y tế",
            "Khác",
            "Chai",
            "Sát trùng vết thương ngoài da",
            10,
            50,
            5,
            55,
            45000
        ],
        [
            2,
            "8935110200625",
            "Vinco-Forte 100ml",
            "Vinco-Forte 100ml",
            "Vinco",
            "Thuốc",
            "Thuốc thú y",
            "Khác",
            "Chai",
            "Tiêm bắp hoặc pha nước uống",
            5,
            20,
            2,
            23,
            120000
        ]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateRows);

    const colWidths = [
        { wch: 6 },  // STT
        { wch: 18 }, // Mã Vạch
        { wch: 38 }, // Tên Mặt Hàng
        { wch: 28 }, // Tên Hóa Đơn
        { wch: 20 }, // Nhà Sản Xuất
        { wch: 16 }, // Danh Mục
        { wch: 18 }, // Nhóm Hàng
        { wch: 16 }, // Phân Loại
        { wch: 10 }, // Đơn Vị
        { wch: 34 }, // Cách Dùng
        { wch: 10 }, // Đầu
        { wch: 10 }, // Nhập
        { wch: 10 }, // Xuất
        { wch: 10 }, // Cuối
        { wch: 18 }  // Giá Vốn TB
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "File Mau Nhap Kho");

    const fileName = `File_Mau_Nhap_Kho_Vat_Tu_GAIA.xlsx`;
    downloadExcelWorkbook(workbook, fileName);

    showVatTuNoticeModal(
        'success', 
        'Đã Tải File Mẫu Excel', 
        `🎉 Đã tải file mẫu <b>${fileName}</b> thành công.<br>Vui lòng điền dữ liệu theo đúng định dạng các cột trong file mẫu này!`
    );
}

// Open Export Choice Modal
function exportVatTuToExcel() {
    console.log("GAIA VatTu: exportVatTuToExcel triggered!");
    if (!vatTuData || vatTuData.length === 0) {
        showVatTuNoticeModal('warning', 'Bảng Dữ Liệu Trống', 'Bảng hiện tại đang trống, chưa có mặt hàng nào để xuất file Excel!');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showVatTuNoticeModal('warning', 'Chưa Sẵn Sàng', 'Thư viện SheetJS chưa sẵn sàng. Vui lòng kiểm tra kết nối mạng!');
        return;
    }

    const modal = document.getElementById('vattu-excel-export-modal');
    if (!modal) {
        console.warn("GAIA VatTu: modal vattu-excel-export-modal not found, falling back");
        executeVatTuExcelExport('filtered');
        return;
    }

    // Update count badges inside modal
    const filteredCountEl = document.getElementById('export-filtered-count-badge');
    if (filteredCountEl) filteredCountEl.textContent = `${filteredVatTuData ? filteredVatTuData.length : 0} dòng`;

    const allCountEl = document.getElementById('export-all-count-badge');
    if (allCountEl) allCountEl.textContent = `${vatTuData ? vatTuData.length : 0} dòng`;

    modal.classList.add('show');
}

function closeVatTuExcelExportModal() {
    const modal = document.getElementById('vattu-excel-export-modal');
    if (modal) modal.classList.remove('show');
}

// Execute Export based on selected mode ('filtered' or 'all')
function executeVatTuExcelExport(type) {
    closeVatTuExcelExportModal();

    const targetData = (type === 'filtered') ? filteredVatTuData : vatTuData;

    if (!targetData || targetData.length === 0) {
        showVatTuNoticeModal('warning', 'Bảng Dữ Liệu Trống', 'Không có dòng dữ liệu nào phù hợp với tùy chọn này để xuất Excel!');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showVatTuNoticeModal('warning', 'Chưa Sẵn Sàng', 'Thư viện SheetJS chưa sẵn sàng. Vui lòng kiểm tra kết nối mạng!');
        return;
    }

    const activeBranchCode = getActiveVatTuBranchFilter();
    const activeBranchName = (activeBranchCode && activeBranchCode !== 'all') ? activeBranchCode : 'Tất cả chi nhánh';

    const exportRows = targetData.map((item, index) => {
        const stats = computeProductBranchStats(item);
        const tonDauVal = stats.ton_dau;

        return {
            "STT": index + 1,
            "Chi Nhánh": activeBranchName,
            "Mã Vạch": item.ma_vach || '',
            "Tên Mặt Hàng": item.ten_mat_hang || '',
            "Tên Hóa Đơn": item.ten_hoa_don || '',
            "Đầu": tonDauVal,
            "Nhập": Number(stats.nhap) || 0,
            "Xuất": Number(stats.xuat) || 0,
            "Cuối": Number(stats.ton_cuoi) || 0,
            "Nhà Sản Xuất": item.nha_san_xuat || '',
            "Danh Mục": item.danh_muc || '',
            "Nhóm Hàng": item.nhom_hang || '',
            "Phân Loại": item.phan_loai || '',
            "Đơn Vị": item.don_vi || '',
            "Cách Dùng": item.cach_dung || '',
            "Giá Vốn TB (đ)": Number(item.gia_von_ton_kho_trung_binh) || 0
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);

    const colWidths = [
        { wch: 6 },  // STT
        { wch: 18 }, // Chi Nhánh
        { wch: 16 }, // Mã Vạch
        { wch: 32 }, // Tên Mặt Hàng
        { wch: 24 }, // Tên Hóa Đơn
        { wch: 12 }, // Đầu
        { wch: 12 }, // Nhập
        { wch: 12 }, // Xuất
        { wch: 12 }, // Cuối
        { wch: 22 }, // Nhà Sản Xuất
        { wch: 16 }, // Danh Mục
        { wch: 18 }, // Nhóm Hàng
        { wch: 15 }, // Phân Loại
        { wch: 10 }, // Đơn Vị
        { wch: 26 }, // Cách Dùng
        { wch: 18 }  // Giá Vốn TB
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kho Vat Tu");

    const modeStr = type === 'filtered' ? 'Bo_Loc' : 'Toan_Bo';
    const todayStr = new Date().toISOString().split('T')[0];
    const fileName = `Danh_Muc_Kho_Vat_Tu_${modeStr}_${todayStr}.xlsx`;

    downloadExcelWorkbook(workbook, fileName);
    console.log(`GAIA VatTu: Exported ${exportRows.length} items (${type}) to ${fileName}`);
}

// Import Excel / CSV File
function handleExcelImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        showVatTuNoticeModal('warning', 'Chưa Sẵn Sàng', 'Thư viện SheetJS chưa sẵn sàng. Vui lòng thử lại!');
        return;
    }

    showVatTuLoading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            const dataBuffer = new Uint8Array(event.target.result);
            const workbook = XLSX.read(dataBuffer, { type: 'array' });

            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            const isRowEmpty = (row) => Object.values(row).every(v => v === null || v === undefined || String(v).trim() === '');
            const validRawRows = (rawJson || []).filter(row => !isRowEmpty(row));

            if (!validRawRows || validRawRows.length === 0) {
                showVatTuNoticeModal('warning', 'File Excel Trống', 'File Excel được chọn không chứa dữ liệu!');
                showVatTuLoading(false);
                return;
            }

            // --- 1. Structure Validation (Cấu trúc file khác với dữ liệu trên app) ---
            const sampleRowKeys = Object.keys(validRawRows[0]).map(k => k.trim().toLowerCase());
            const hasMaVachHeader = sampleRowKeys.some(k => ['mã vạch', 'mã vach', 'ma vach', 'ma_vach', 'barcode', 'sku'].includes(k));
            const hasTenHeader = sampleRowKeys.some(k => ['tên mặt hàng', 'tên sản phẩm', 'ten mat hang', 'ten_mat_hang', 'name'].includes(k));

            if (!hasMaVachHeader || !hasTenHeader) {
                let missingCols = [];
                if (!hasMaVachHeader) missingCols.push('Mã Vạch');
                if (!hasTenHeader) missingCols.push('Tên Mặt Hàng');

                showVatTuNoticeModal(
                    'error',
                    'Cấu Trúc File Không Hợp Lệ',
                    `File Excel không đúng cấu trúc dữ liệu của phần mềm!<br><br>` +
                    `<b>Thiếu các cột bắt buộc:</b> <span style="color: #ef4444;">${missingCols.join(', ')}</span><br><br>` +
                    `<i>Vui lòng tải file mẫu bên dưới để đảm bảo đúng định dạng các cột tiêu đề.</i>`,
                    '',
                    { show: true, text: '📥 Tải Template Mẫu', fn: downloadVatTuExcelTemplate }
                );
                showVatTuLoading(false);
                return;
            }

            const newItemsWithRow = validRawRows.map((row, idx) => {
                const getVal = (...keys) => {
                    for (const k of keys) {
                        const foundKey = Object.keys(row).find(x => x.trim().toLowerCase() === k.toLowerCase());
                        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
                            return String(row[foundKey]).trim();
                        }
                    }
                    return '';
                };

                const getNum = (...keys) => {
                    const val = getVal(...keys);
                    const parsed = parseFloat(val.replace(/,/g, ''));
                    return isNaN(parsed) ? 0 : parsed;
                };

                const ma_vach = getVal('Mã vạch', 'Mã Vạch', 'Ma vach', 'ma_vach', 'Barcode', 'SKU');
                const ten_mat_hang = getVal('Tên mặt hàng', 'Tên Mặt Hàng', 'Tên sản phẩm', 'Ten mat hang', 'ten_mat_hang', 'Name');
                const ten_hoa_don = getVal('Tên hóa đơn', 'Tên Hóa Đơn', 'Ten hoa don', 'ten_hoa_don') || ten_mat_hang;
                const nha_san_xuat = getVal('Nhà sản xuất', 'Nhà Sản Xuất', 'Nha san xuat', 'nha_san_xuat', 'Manufacturer');
                const danh_muc = getVal('Danh mục', 'Danh Mục', 'Danh muc', 'danh_muc', 'Category') || 'Thuốc';
                const nhom_hang = getVal('Nhóm hàng', 'Nhóm Hàng', 'Nhom hang', 'nhom_hang', 'Group');
                const phan_loai = getVal('Phân loại', 'Phân Loại', 'Phan loai', 'phan_loai', 'Classification');
                const don_vi = getVal('Đơn vị', 'Đơn Vị', 'Don vi', 'don_vi', 'Unit') || 'Cái';
                const cach_dung = getVal('Cách dùng', 'Cách Dùng', 'Cach dung', 'cach_dung', 'Usage');

                const ton_dau = getNum('Tồn đầu', 'Tồn Đầu', 'Ton dau', 'ton_dau');
                const nhap = getNum('Nhập', 'NHẬP', 'Số lượng nhập', 'Số Lượng Nhập', 'So luong nhap', 'so_luong_nhap', 'nhap');
                const xuat = getNum('Xuất', 'XUẤT', 'Số lượng xuất', 'Số Lượng Xuất', 'So luong xuat', 'so_luong_xuat', 'xuat');
                const ton_cuoi = getNum('Tồn cuối', 'Tồn Cuối', 'Ton cuoi', 'Số lượng tồn', 'Số Lượng Tồn', 'So luong ton', 'so_luong_ton', 'ton_cuoi') || (ton_dau + nhap - xuat);
                const gia_von_ton_kho_trung_binh = getNum('Giá vốn trung bình (đ)', 'Giá vốn trung bình', 'Giá vốn TB', 'Gia von', 'gia_von_ton_kho_trung_binh');

                return {
                    _excelRowNumber: idx + 2, // 1-indexed Excel row (row 1 is header)
                    item: {
                        ma_vach: ma_vach || null,
                        ten_mat_hang: ten_mat_hang || null,
                        ten_hoa_don: ten_hoa_don || ten_mat_hang || null,
                        nha_san_xuat: nha_san_xuat || null,
                        danh_muc: danh_muc || 'Thuốc',
                        nhom_hang: nhom_hang || null,
                        phan_loai: phan_loai || null,
                        don_vi: don_vi || null,
                        cach_dung: cach_dung || null,
                        ton_dau,
                        nhap,
                        xuat,
                        ton_cuoi,
                        gia_von_ton_kho_trung_binh
                    }
                };
            });

            // --- 2. Required Fields Row Check (Ngăn thêm nếu dòng có dữ liệu nhưng thiếu Mã Vạch hoặc Tên Mặt Hàng) ---
            const invalidRowsInfo = [];
            newItemsWithRow.forEach(({ _excelRowNumber, item }) => {
                const hasMaVach = item.ma_vach && item.ma_vach.trim() !== '';
                const hasTen = item.ten_mat_hang && item.ten_mat_hang.trim() !== '';

                if (!hasMaVach || !hasTen) {
                    let missingDetails = [];
                    if (!hasMaVach) missingDetails.push('Thiếu Mã Vạch');
                    if (!hasTen) missingDetails.push('Thiếu Tên Mặt Hàng');
                    invalidRowsInfo.push(`<b>Dòng ${_excelRowNumber}:</b> ${missingDetails.join(' & ')}`);
                }
            });

            if (invalidRowsInfo.length > 0) {
                const maxDisplay = 8;
                const displayList = invalidRowsInfo.slice(0, maxDisplay).join('<br>');
                const moreCount = invalidRowsInfo.length - maxDisplay;
                const moreText = moreCount > 0 ? `<br><i style="color:#9ca3af;">...và còn ${moreCount} dòng khác bị lỗi.</i>` : '';

                showVatTuNoticeModal(
                    'error',
                    'Dữ Liệu Dòng Không Hợp Lệ',
                    `Không thể nạp file Excel do có ${invalidRowsInfo.length} dòng chứa dữ liệu nhưng bị thiếu thông tin bắt buộc:<br><br>` +
                    `<div style="max-height: 180px; overflow-y: auto; text-align: left; background: rgba(0,0,0,0.25); border: 1px solid rgba(239, 68, 68, 0.3); padding: 10px 14px; border-radius: 8px; font-size: 13px; color: #fca5a5;">` +
                    `${displayList}${moreText}</div><br>` +
                    `<i>Mã Vạch và Tên Mặt Hàng là 2 trường dữ liệu bắt buộc không được để trống.</i>`,
                    '',
                    { show: true, text: '📥 Tải Template Mẫu', fn: downloadVatTuExcelTemplate }
                );
                showVatTuLoading(false);
                return;
            }

            const newItems = newItemsWithRow.map(x => x.item);

            // --- 3. Duplicate Validation (Trùng Mã Vạch) ---
            const excelBarcodes = new Set();
            const excelDuplicates = new Set();
            const appDuplicates = new Set();

            for (const item of newItems) {
                if (!item.ma_vach) continue;
                
                const barcode = String(item.ma_vach).trim().toLowerCase();

                // Check duplicate inside the Excel file
                if (excelBarcodes.has(barcode)) {
                    excelDuplicates.add(item.ma_vach);
                } else {
                    excelBarcodes.add(barcode);
                }

                // Check duplicate compared to app data (vatTuData)
                const isDupInApp = vatTuData.some(existing => 
                    existing.ma_vach && String(existing.ma_vach).trim().toLowerCase() === barcode
                );
                if (isDupInApp) {
                    appDuplicates.add(item.ma_vach);
                }
            }

            if (excelDuplicates.size > 0 || appDuplicates.size > 0) {
                let errorMsg = '';
                if (excelDuplicates.size > 0) {
                    errorMsg += `<b style="color: #ef4444;">Trùng lặp bên trong file Excel:</b><br>${Array.from(excelDuplicates).join(', ')}<br><br>`;
                }
                if (appDuplicates.size > 0) {
                    errorMsg += `<b style="color: #ef4444;">Đã tồn tại trên phần mềm:</b><br>${Array.from(appDuplicates).join(', ')}`;
                }
                
                showVatTuNoticeModal('error', 'Phát Hiện Mã Vạch Trùng Lặp', `Không thể nạp file do có mã vạch bị trùng:<br><br>${errorMsg}`);
                showVatTuLoading(false);
                return;
            }
            // --- End Validation ---

            const client = getVatTuSupabaseClient();
            if (client && newItems.length > 0) {
                const { error } = await client
                    .from('san_pham')
                    .insert(newItems);

                if (error) {
                    console.error("GAIA VatTu: Supabase import error:", error);
                    if (error.message && error.message.toLowerCase().includes('row-level security')) {
                        showVatTuNoticeModal(
                            'error',
                            'Lỗi Phân Quyền Supabase (RLS)',
                            'Bảng "san_pham" trên Supabase đang bật bảo mật RLS chặn quyền Thêm dữ liệu từ Excel.',
                            'ALTER TABLE public.san_pham DISABLE ROW LEVEL SECURITY;'
                        );
                    } else {
                        showVatTuNoticeModal('error', 'Không Thể Đẩy Dữ Liệu', `Không thể đẩy dữ liệu lên Supabase: ${error.message}`);
                    }
                } else {
                    showVatTuNoticeModal('success', 'Nhập Excel Thành Công', `🎉 Đã nhập thành công ${newItems.length} mặt hàng từ file Excel vào cơ sở dữ liệu!`);
                }
                fetchVatTuData();
            } else {
                newItems.forEach((item, i) => {
                    vatTuData.unshift({ id: Date.now() + i, ...item });
                });
                showVatTuNoticeModal('success', 'Nhập Excel Thành Công', `🎉 Đã nhập thành công ${newItems.length} mặt hàng từ file Excel!`);
                renderVatTuView(vatTuData);
            }
        } catch (err) {
            console.error("GAIA VatTu: Error reading Excel file:", err);
            showVatTuNoticeModal('error', 'Lỗi Đọc File Excel', `Lỗi khi đọc file Excel: ${err.message}`);
        } finally {
            showVatTuLoading(false);
            e.target.value = '';
        }
    };

    reader.readAsArrayBuffer(file);
}

// Helper Utilities
function formatTruncateCell(text, fallback = '-') {
    const cleanText = (text !== null && text !== undefined && String(text).trim() !== '' && String(text).trim() !== '-') 
        ? String(text).trim() 
        : fallback;
    if (cleanText === '-') return `<span class="vattu-dash">-</span>`;

    return `<div class="cell-truncate-wrap" title="${escapeHtml(cleanText)}">
        <span class="cell-truncate-text">${escapeHtml(cleanText)}</span>
    </div>`;
}

function showVatTuLoading(show) {
    const spinner = document.getElementById('vattu-loading-spinner');
    if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

function clearVatTuFormErrors() {
    const errors = document.querySelectorAll('#vattu-modal .form-error-msg');
    errors.forEach(el => {
        el.textContent = '';
        el.classList.remove('active');
    });
}

function showVatTuFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = msg;
        if (msg) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    }
}

function formatVND(amount) {
    const num = Number(amount) || 0;
    return num.toLocaleString('vi-VN') + ' đ';
}

function formatDate(dateStr) {
    if (!dateStr || dateStr === '-' || dateStr === 'null' || dateStr === 'undefined') return '-';
    const str = String(dateStr).trim();
    if (!str || str === '-') return '-';

    // 1. Already in DD/MM/YYYY or DD/MM/YY format
    const ddMmYyyyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (ddMmYyyyMatch) {
        const d = ddMmYyyyMatch[1].padStart(2, '0');
        const m = ddMmYyyyMatch[2].padStart(2, '0');
        const y = ddMmYyyyMatch[3].length === 2 ? '20' + ddMmYyyyMatch[3] : ddMmYyyyMatch[3];
        return `${d}/${m}/${y}`;
    }

    // 2. In YYYY-MM-DD or YYYY/MM/DD format (ISO date)
    const yyyyMmDdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (yyyyMmDdMatch) {
        const y = yyyyMmDdMatch[1];
        const m = yyyyMmDdMatch[2].padStart(2, '0');
        const d = yyyyMmDdMatch[3].padStart(2, '0');
        return `${d}/${m}/${y}`;
    }

    // 3. In DD-MM-YYYY format
    const ddMmYyyyDashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if (ddMmYyyyDashMatch) {
        const d = ddMmYyyyDashMatch[1].padStart(2, '0');
        const m = ddMmYyyyDashMatch[2].padStart(2, '0');
        const y = ddMmYyyyDashMatch[3].length === 2 ? '20' + ddMmYyyyDashMatch[3] : ddMmYyyyDashMatch[3];
        return `${d}/${m}/${y}`;
    }

    // 4. Standard JS Date parsing for ISO timestamps
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

function formatQrStringWithStandardDate(qrStr, dateExpiry) {
    if (!qrStr) return '';
    const str = String(qrStr).trim();
    if (!str.includes(';')) return str;
    const parts = str.split(';');
    if (parts.length >= 3) {
        if (dateExpiry && dateExpiry !== '-' && dateExpiry !== 'null') {
            parts[2] = formatDate(dateExpiry);
        } else if (parts[2]) {
            parts[2] = formatDate(parts[2]);
        }
        return parts.join(';');
    }
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

// Custom App Notification Router
function showVatTuNoticeModal(type, title, message, codeSnippet = '', secondaryAction = null) {
    // ONLY show Modal Window Pop-up Overlay if secondaryAction is explicitly requested (e.g. Invalid Excel Structure error with "Tải Template Mẫu" button)
    if (secondaryAction && secondaryAction.show) {
        showVatTuNoticeModalWindow(type, title, message, codeSnippet, secondaryAction);
    } else {
        // ALL OTHER notifications slide in as sleek Toast Notifications!
        showToast(type, title, message);
    }
}

// Custom App Dialog Modal Window (Displays real confirmation modal overlay for Excel template downloads)
function showVatTuNoticeModalWindow(type, title, message, codeSnippet = '', secondaryAction = null) {
    let dialogOverlay = document.getElementById('vattu-notice-dialog-overlay');
    if (!dialogOverlay) {
        dialogOverlay = document.createElement('div');
        dialogOverlay.id = 'vattu-notice-dialog-overlay';
        dialogOverlay.className = 'modal-overlay';
        dialogOverlay.style.cssText = 'display: none; z-index: 999999;';
        document.body.appendChild(dialogOverlay);
    }

    const typeColors = {
        error: { bg: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '#ef4444', icon: '❌', btn: '#ef4444' },
        warning: { bg: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '#f59e0b', icon: '⚠️', btn: '#f59e0b' },
        success: { bg: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '#10b981', icon: '✅', btn: '#10b981' },
        info: { bg: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '#3b82f6', icon: 'ℹ️', btn: '#3b82f6' }
    };

    const config = typeColors[type] || typeColors.info;

    let secondaryBtnHtml = '';
    if (secondaryAction && secondaryAction.show) {
        secondaryBtnHtml = `<button type="button" id="vattu-notice-sec-btn" class="btn-toolbar-excel" style="padding: 10px 18px; font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 8px;">${escapeHtml(secondaryAction.text || 'Tải File Mẫu')}</button>`;
    }

    dialogOverlay.innerHTML = `
        <div class="modal-content" style="max-width: 500px; border-radius: 14px; overflow: hidden; padding: 0; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); border-left: 5px solid ${config.border}; border-top: 1px solid var(--card-border);">
            <div style="background: ${config.bg}; padding: 18px 22px; color: #fff; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--card-border);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 24px;">${config.icon}</span>
                    <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #fff;">${escapeHtml(title || 'Thông Báo')}</h3>
                </div>
                <button type="button" onclick="closeVatTuNoticeDialogModal()" style="background: none; border: none; color: #94a3b8; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div style="padding: 22px 24px; color: var(--text-color); font-size: 14px; line-height: 1.6;">
                <div>${message}</div>
                ${codeSnippet ? `<pre style="margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.15); border-radius: 8px; font-size: 12px; overflow-x: auto;"><code>${escapeHtml(codeSnippet)}</code></pre>` : ''}
            </div>
            <div style="padding: 14px 24px; border-top: 1px solid var(--card-border); display: flex; justify-content: flex-end; gap: 10px; background: rgba(0,0,0,0.03);">
                ${secondaryBtnHtml}
                <button type="button" onclick="closeVatTuNoticeDialogModal()" class="btn-toolbar-primary" style="padding: 10px 22px; font-weight: 700; font-size: 13px; cursor: pointer; border-radius: 8px;">Đóng</button>
            </div>
        </div>
    `;

    dialogOverlay.style.display = 'flex';
    dialogOverlay.classList.add('show');

    if (secondaryAction && secondaryAction.show && typeof secondaryAction.fn === 'function') {
        const secBtn = document.getElementById('vattu-notice-sec-btn');
        if (secBtn) {
            secBtn.onclick = () => {
                secondaryAction.fn();
            };
        }
    }
}

function closeVatTuNoticeDialogModal() {
    const dialogOverlay = document.getElementById('vattu-notice-dialog-overlay');
    if (dialogOverlay) {
        dialogOverlay.classList.remove('show');
        dialogOverlay.style.display = 'none';
    }
}
window.closeVatTuNoticeDialogModal = closeVatTuNoticeDialogModal;

function showToast(type, title, message, duration = 4500) {
    // Ensure container exists
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
        document.body.appendChild(container);
    }

    const icons = {
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
        info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    const toastType = ['success','error','warning','info'].includes(type) ? type : 'info';
    const icon = icons[toastType] || icons.info;

    // Strip HTML tags from message for plain display
    const plainMsg = typeof message === 'string' ? message.replace(/<[^>]*>/g, '') : '';

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${toastType}`;
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-body">
            <div class="toast-title">${title || 'Thông Báo'}</div>
            <div class="toast-msg">${plainMsg}</div>
        </div>
        <button class="toast-close" title="Đóng">&#x2715;</button>
        <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    container.appendChild(toast);

    // Slide in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
        });
    });

    // Close button
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => dismissToast(toast));
    }

    // Auto dismiss
    const timer = setTimeout(() => dismissToast(toast), duration);
    toast._dismissTimer = timer;
}

function dismissToast(toast) {
    if (!toast || toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._dismissTimer);
    toast.classList.add('toast-hide');
    toast.classList.remove('toast-show');
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 400);
}

window.showToast = showToast;

function closeVatTuNoticeModal() {
    // No-op: old modal replaced by toast
}


function copyVatTuCodeSnippet() {
    const codeText = document.getElementById('vattu-notice-code-text');
    if (codeText && codeText.textContent) {
        navigator.clipboard.writeText(codeText.textContent);
        const btn = document.querySelector('.btn-copy-code');
        if (btn) {
            const oldText = btn.textContent;
            btn.textContent = 'Đã chép! ✓';
            setTimeout(() => btn.textContent = oldText, 2000);
        }
    }
}

// Expose All Global Functions to Window
window.openAddVatTuModal = openAddVatTuModal;
window.openEditVatTuModal = openEditVatTuModal;
window.closeVatTuModal = closeVatTuModal;
window.confirmDeleteVatTu = confirmDeleteVatTu;
window.closeDeleteVatTuModal = closeDeleteVatTuModal;
window.executeDeleteVatTu = executeDeleteVatTu;
window.showVatTuNoticeModal = showVatTuNoticeModal;
window.showVatTuNoticeModalWindow = showVatTuNoticeModalWindow;
window.closeVatTuNoticeModal = closeVatTuNoticeModal;
window.copyVatTuCodeSnippet = copyVatTuCodeSnippet;
window.clearAllVatTuFilters = clearAllVatTuFilters;
window.toggleColumnFilterDropdown = toggleColumnFilterDropdown;
window.closeColumnFilterDropdown = closeColumnFilterDropdown;
window.applyCurrentColumnFilter = applyCurrentColumnFilter;
window.clearCurrentColumnFilter = clearCurrentColumnFilter;
window.toggleSelectAllPopoverOptions = toggleSelectAllPopoverOptions;
window.renderFilterPopoverListOptions = renderFilterPopoverListOptions;
window.handleSaveVatTuForm = handleSaveVatTuForm;
window.handleHeaderSortClick = handleHeaderSortClick;

// ====== Column Configuration UI Logic ======
// Define as local functions first so they can call each other
function openColumnConfigModal() {
    pendingVatTuColsConfig = JSON.parse(JSON.stringify(currentVatTuCols));
    const modal = document.getElementById('vattu-column-config-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
        renderColConfigList();
    }
}

function closeColumnConfigModal() {
    const modal = document.getElementById('vattu-column-config-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
}

function renderColConfigList() {
    const listEl = document.getElementById('vattu-column-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    // Add Fixed Column Freeze control section at top of modal list
    const freezeHeader = document.createElement('div');
    freezeHeader.style.cssText = 'margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px dashed var(--card-border); display: flex; align-items: center; justify-content: space-between;';
    freezeHeader.innerHTML = `
        <label style="font-size: 13px; font-weight: 600; color: var(--text-color); display: flex; align-items: center; gap: 6px;">
            📌 Số cột ghim cố định khi cuộn ngang:
        </label>
        <select id="vattu-fixed-cols-select" style="padding: 5px 10px; border-radius: 6px; border: 1px solid var(--card-border); background: var(--card-bg); color: var(--text-color); font-weight: 600; font-size: 12px; cursor: pointer;">
            <option value="0" ${vattuFixedColsCount === 0 ? 'selected' : ''}>0 cột (Không ghim)</option>
            <option value="1" ${vattuFixedColsCount === 1 ? 'selected' : ''}>1 cột cố định</option>
            <option value="2" ${vattuFixedColsCount === 2 ? 'selected' : ''}>2 cột cố định (Mặc định)</option>
        </select>
    `;
    listEl.appendChild(freezeHeader);

    pendingVatTuColsConfig.forEach((col, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === pendingVatTuColsConfig.length - 1;
        
        const eyeIconVisible = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const eyeIconHidden = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        
        const item = document.createElement('div');
        item.className = `col-config-item${col.visible ? '' : ' hidden-col'}`;
        item.innerHTML = `
            <button type="button" class="col-visibility-toggle${col.visible ? ' is-visible' : ''}" data-idx="${idx}" title="${col.visible ? 'Đang hiện - nhấn để ẩn' : 'Đang ẩn - nhấn để hiện'}">
                ${col.visible ? eyeIconVisible : eyeIconHidden}
            </button>
            <div class="col-config-name">${escapeHtml(col.title)}</div>
            <div class="col-order-btns">
                <button type="button" class="btn-col-move" data-move="up" data-idx="${idx}" ${isFirst ? 'disabled' : ''} title="Chuyển lên">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                </button>
                <button type="button" class="btn-col-move" data-move="down" data-idx="${idx}" ${isLast ? 'disabled' : ''} title="Chuyển xuống">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
            </div>
        `;
        
        // Bind toggle visibility
        item.querySelector('.col-visibility-toggle').addEventListener('click', function() {
            pendingVatTuColsConfig[idx].visible = !pendingVatTuColsConfig[idx].visible;
            renderColConfigList();
        });
        
        // Bind move up
        const moveUpBtn = item.querySelector('[data-move="up"]');
        if (moveUpBtn && !isFirst) {
            moveUpBtn.addEventListener('click', function() {
                const temp = pendingVatTuColsConfig[idx - 1];
                pendingVatTuColsConfig[idx - 1] = pendingVatTuColsConfig[idx];
                pendingVatTuColsConfig[idx] = temp;
                renderColConfigList();
            });
        }
        
        // Bind move down
        const moveDwnBtn = item.querySelector('[data-move="down"]');
        if (moveDwnBtn && !isLast) {
            moveDwnBtn.addEventListener('click', function() {
                const temp = pendingVatTuColsConfig[idx + 1];
                pendingVatTuColsConfig[idx + 1] = pendingVatTuColsConfig[idx];
                pendingVatTuColsConfig[idx] = temp;
                renderColConfigList();
            });
        }
        
        listEl.appendChild(item);
    });
}

function saveColumnConfig() {
    currentVatTuCols = JSON.parse(JSON.stringify(pendingVatTuColsConfig));
    localStorage.setItem('gaia_vattu_columns_v7', JSON.stringify(currentVatTuCols));

    const fixedSelect = document.getElementById('vattu-fixed-cols-select');
    if (fixedSelect) {
        vattuFixedColsCount = parseInt(fixedSelect.value, 10) || 0;
        localStorage.setItem('gaia_vattu_fixed_cols', vattuFixedColsCount);
    }

    closeColumnConfigModal();
    vattuCurrentPage = 1;
    applyVatTuFilters();
}

// Expose to window for any inline onclick handlers
window.downloadVatTuExcelTemplate = downloadVatTuExcelTemplate;
window.openColumnConfigModal = openColumnConfigModal;
window.closeColumnConfigModal = closeColumnConfigModal;
window.saveColumnConfig = saveColumnConfig;
