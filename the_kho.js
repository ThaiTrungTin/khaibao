/* ==========================================================================
   GAIA Animal Hospital - Thẻ Kho (Stock Movement Log Journal) Module (the_kho.js)
   Features: Search, Per-Column Interdependent Filters with Filter Badges, 
   SVG 3-State Sort Icons (identical to Vật Tư), Table Cell Truncation (No Overlap),
   Pagination identical to Vật Tư, Excel Export, Column Config.
   Read-only: No Add/Edit/Delete buttons.
   ========================================================================== */

let theKhoData = [];
let theKhoFilteredData = [];
let theKhoCurrentPage = 1;
let theKhoPageSize = 25;
let theKhoSortCol = null;
let theKhoSortDir = null; // 'asc', 'desc', or null
let theKhoActiveFilterCol = null;
let theKhoColumnFilters = {}; // { colKey: Set(['val1', 'val2']) }
let theKhoPopoverTempSelectedValues = new Set();

const theKhoColTitles = {
    ma_don: 'MÃ ĐƠN',
    ma_qr: 'MÃ QR',
    ma_vach: 'MÃ VẠCH',
    lot: 'LOT',
    date_expiry: 'DATE',
    ten_hang_hoa: 'TÊN HÀNG HÓA',
    loai: 'LOẠI',
    so_luong: 'SỐ LƯỢNG',
    muc_dich: 'MỤC ĐÍCH / GHI CHÚ',
    user_name: 'USER',
    created_at: 'TIME'
};

// Default Column Definitions for Thẻ Kho
const defaultTheKhoCols = [
    { key: 'ma_don', title: 'MÃ ĐƠN', width: '160px', minWidth: '120px', align: 'center', visible: true },
    { key: 'ma_qr', title: 'MÃ QR', width: '130px', minWidth: '100px', align: 'center', visible: true },
    { key: 'ma_vach', title: 'MÃ VẠCH', width: '140px', minWidth: '110px', align: 'left', visible: true },
    { key: 'lot', title: 'LOT', width: '110px', minWidth: '90px', align: 'left', visible: true },
    { key: 'date_expiry', title: 'DATE', width: '110px', minWidth: '90px', align: 'center', visible: true },
    { key: 'ten_hang_hoa', title: 'TÊN HÀNG HÓA', width: '240px', minWidth: '160px', align: 'left', visible: true },
    { key: 'loai', title: 'LOẠI', width: '100px', minWidth: '80px', align: 'center', visible: true },
    { key: 'so_luong', title: 'SỐ LƯỢNG', width: '100px', minWidth: '80px', align: 'right', visible: true },
    { key: 'muc_dich', title: 'MỤC ĐÍCH / GHI CHÚ', width: '220px', minWidth: '150px', align: 'left', visible: true },
    { key: 'user_name', title: 'USER', width: '150px', minWidth: '110px', align: 'left', visible: true },
    { key: 'created_at', title: 'TIME', width: '150px', minWidth: '110px', align: 'center', visible: true }
];

let currentTheKhoCols = [];
let pendingTheKhoColsConfig = [];
let thekhoFixedColsCount = 2; // Default 2 pinned columns for Thẻ Kho

function initTheKhoFixedColsConfig() {
    try {
        const saved = localStorage.getItem('gaia_thekho_fixed_cols');
        if (saved !== null) {
            thekhoFixedColsCount = parseInt(saved, 10);
            if (isNaN(thekhoFixedColsCount) || thekhoFixedColsCount < 0) thekhoFixedColsCount = 2;
        }
    } catch(e) {
        thekhoFixedColsCount = 2;
    }
}
initTheKhoFixedColsConfig();

function getTheKhoStickyColMeta(visIdx, visibleCols, isHeader = false) {
    if (visIdx >= thekhoFixedColsCount) {
        return { style: '', className: '' };
    }

    let left = 0;
    for (let i = 0; i < visIdx; i++) {
        const colWidth = parseInt(visibleCols[i].width, 10) || 120;
        left += colWidth;
    }

    const isLastSticky = (visIdx === thekhoFixedColsCount - 1) || (visIdx === visibleCols.length - 1);
    const className = `is-sticky-col ${isLastSticky ? 'is-sticky-col-last' : ''}`;
    const zIndex = isHeader ? 30 : 15;
    const style = `position: sticky; left: ${left}px; z-index: ${zIndex};`;

    return { style, className };
}

function initTheKhoColumnsConfig() {
    try {
        const saved = localStorage.getItem('gaia_thekho_columns_v1');
        if (saved) {
            currentTheKhoCols = JSON.parse(saved);
            defaultTheKhoCols.forEach(defCol => {
                if (!currentTheKhoCols.find(c => c.key === defCol.key)) {
                    currentTheKhoCols.push(defCol);
                }
            });
        } else {
            currentTheKhoCols = JSON.parse(JSON.stringify(defaultTheKhoCols));
        }
    } catch (e) {
        currentTheKhoCols = JSON.parse(JSON.stringify(defaultTheKhoCols));
    }
}
initTheKhoColumnsConfig();

// Supabase Client Initializer
function getTheKhoSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabase !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        try {
            window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            return window.supabaseClient;
        } catch (e) {
            console.error("TheKho: Error initializing Supabase client:", e);
        }
    }
    return null;
}

// Module Lifecycle Initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheKhoModule);
} else {
    initTheKhoModule();
}

function initTheKhoModule() {
    console.log("GAIA TheKho: Initializing Stock Journal Module...");

    // Action Buttons
    const btnRefresh = document.getElementById('btn-refresh-thekho');
    if (btnRefresh) btnRefresh.addEventListener('click', fetchTheKhoData);

    const btnExport = document.getElementById('btn-export-excel-thekho');
    if (btnExport) btnExport.addEventListener('click', exportTheKhoToExcel);

    const btnConfigCols = document.getElementById('btn-config-columns-thekho');
    if (btnConfigCols) {
        btnConfigCols.addEventListener('click', openTheKhoColumnConfigModal);
    }

    // Filter & Search Listeners
    const searchInput = document.getElementById('thekho-search-input');
    if (searchInput) searchInput.addEventListener('input', () => {
        theKhoCurrentPage = 1;
        applyTheKhoFilters();
    });

    const loaiFilter = document.getElementById('thekho-loai-filter');
    if (loaiFilter) loaiFilter.addEventListener('change', () => {
        theKhoCurrentPage = 1;
        applyTheKhoFilters();
    });

    // Page Size Selector
    const pageSizeSelect = document.getElementById('thekho-page-size-select');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            theKhoPageSize = parseInt(e.target.value, 10) || 25;
            theKhoCurrentPage = 1;
            renderCurrentTheKhoPageData();
        });
    }

    // Close Column Filter Popover on outside click
    document.addEventListener('click', (e) => {
        const popover = document.getElementById('thekho-col-filter-popover');
        if (!popover || popover.style.display === 'none') return;
        if (popover.contains(e.target) || e.target.closest('.col-filter-btn')) return;
        closeTheKhoColumnFilterDropdown();
    });

    fetchTheKhoData();
    setupTheKhoRealtimeSubscription();
}

// Fetch Data from Supabase table 'the_kho'
async function fetchTheKhoData() {
    showTheKhoLoading(true);
    const client = getTheKhoSupabaseClient();

    try {
        if (client) {
            const { data, error } = await client
                .from('the_kho')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.warn("TheKho: Supabase fetch error, using sample fallback:", error.message);
                theKhoData = getSampleTheKhoData();
            } else if (data && data.length > 0) {
                theKhoData = data;
            } else {
                theKhoData = getSampleTheKhoData();
            }
        } else {
            theKhoData = getSampleTheKhoData();
        }
    } catch (err) {
        console.error("TheKho: Error fetching data:", err);
        theKhoData = getSampleTheKhoData();
    } finally {
        showTheKhoLoading(false);
        await initTheKhoBranchFilterForManager();
        applyTheKhoFilters();
    }
}

// Sample Fallback Data
function getSampleTheKhoData() {
    const now = new Date();
    return [
        {
            id: 1,
            ma_qr: 'QR-AMOX-500',
            ma_vach: '8935001234567',
            lot: 'LOT202601',
            date_expiry: '2026-12-31',
            ten_hang_hoa: 'Thuốc Kháng Sinh Amoxicillin 500mg',
            loai: 'Nhập',
            so_luong: 100,
            muc_dich: 'Nhập kho định kỳ từ Mekophar',
            user_name: 'Thái Trung Tín (Quản Lý)',
            created_at: new Date(now - 48 * 3600 * 1000).toISOString()
        },
        {
            id: 2,
            ma_qr: 'QR-BIOFEL-PCH',
            ma_vach: '8935007654321',
            lot: 'LOT202602',
            date_expiry: '2027-06-30',
            ten_hang_hoa: 'Vắc xin Phòng 5 Bệnh Cho Mèo (Biofel PCH)',
            loai: 'Nhập',
            so_luong: 50,
            muc_dich: 'Nhập bổ sung từ Bioveta',
            user_name: 'Thái Trung Tín (Quản Lý)',
            created_at: new Date(now - 24 * 3600 * 1000).toISOString()
        },
        {
            id: 3,
            ma_qr: 'QR-AMOX-500',
            ma_vach: '8935001234567',
            lot: 'LOT202601',
            date_expiry: '2026-12-31',
            ten_hang_hoa: 'Thuốc Kháng Sinh Amoxicillin 500mg',
            loai: 'Xuất',
            so_luong: 2,
            muc_dich: 'Xuất sử dụng ca điều trị #1042',
            user_name: 'Bác sĩ Thú y Hùng',
            created_at: new Date(now - 5 * 3600 * 1000).toISOString()
        },
        {
            id: 4,
            ma_qr: 'QR-BIOFEL-PCH',
            ma_vach: '8935007654321',
            lot: 'LOT202602',
            date_expiry: '2027-06-30',
            ten_hang_hoa: 'Vắc xin Phòng 5 Bệnh Cho Mèo (Biofel PCH)',
            loai: 'Xuất',
            so_luong: 1,
            muc_dich: 'Xuất tiêm phòng ca #1045',
            user_name: 'Kỹ thuật viên Nam',
            created_at: new Date(now - 2 * 3600 * 1000).toISOString()
        }
    ];
}

// Supabase Realtime Channel
function setupTheKhoRealtimeSubscription() {
    const client = getTheKhoSupabaseClient();
    if (!client) return;

    try {
        client
            .channel('public:the_kho')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'the_kho' }, () => {
                fetchTheKhoData();
            })
            .subscribe();
    } catch (e) {
        console.warn("TheKho: Realtime subscription warning:", e);
    }
}

// Init & Populate Manager Branch Filter for Thẻ Kho View
async function initTheKhoBranchFilterForManager() {
    const filterBranchSelect = document.getElementById('thekho-filter-branch');
    if (!filterBranchSelect) return;

    const loggedUser = (typeof window.getCurrentLoggedUser === 'function') ? window.getCurrentLoggedUser() : null;
    const isStrictManager = (typeof window.isManagerRole === 'function') ? window.isManagerRole(loggedUser) : false;

    if (!isStrictManager) {
        filterBranchSelect.style.display = 'none';
        return;
    }

    let branches = [];
    if (typeof fetchBranchesFromStaffTable === 'function') {
        branches = await fetchBranchesFromStaffTable();
    } else {
        try {
            const saved = localStorage.getItem('gaia_staff_list');
            if (saved) {
                const list = JSON.parse(saved);
                (list || []).forEach(s => {
                    if (s.branch && s.branch !== 'Toàn hệ thống') branches.push(s.branch.trim());
                });
            }
        } catch (e) {}
    }

    const uniqueBranches = Array.from(new Set(branches));

    filterBranchSelect.innerHTML = `<option value="all">🏢 Tất cả chi nhánh</option>`;
    uniqueBranches.forEach(bStr => {
        let code = bStr;
        if (typeof extractCNCodeFromBranchString === 'function') {
            code = extractCNCodeFromBranchString(bStr);
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
        optionEl.value = code || bStr;
        optionEl.textContent = `📍 ${labelText}`;
        optionEl.title = bStr;
        filterBranchSelect.appendChild(optionEl);
    });

    filterBranchSelect.style.display = 'inline-block';
}

// Filters & 3-State A-Z / Z-A Sorting Execution
function applyTheKhoFilters() {
    const searchInput = document.getElementById('thekho-search-input');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const filterBranchSelect = document.getElementById('thekho-filter-branch');
    const selectedBranch = filterBranchSelect ? filterBranchSelect.value : 'all';

    let result = arraySearchTheKho(theKhoData, searchTerm);

    // Apply Role & Branch Permission Filter: Quản lý sees all data; Admin & Nhân Viên only see data of their branch via User
    result = result.filter(item => {
        return (typeof window.canUserAccessRecord === 'function') ? window.canUserAccessRecord(item) : true;
    });

    // Apply Manager Branch Filter Dropdown
    if (selectedBranch && selectedBranch !== 'all') {
        result = result.filter(x => {
            let itemCN = '';
            if (typeof extractCNCodeFromBranchString === 'function') {
                itemCN = extractCNCodeFromBranchString(x.user_name || x.branch || '');
            } else if (typeof window.extractCNCode === 'function') {
                itemCN = window.extractCNCode(x.user_name || x.branch || '');
            }
            return itemCN.toUpperCase() === selectedBranch.toUpperCase();
        });
    }

    // Apply Date Range Filter if active
    if (theKhoDateFilterRange.from || theKhoDateFilterRange.to) {
        result = result.filter(item => {
            const itemTime = item.created_at ? new Date(item.created_at).getTime() : 0;
            if (theKhoDateFilterRange.from && itemTime < theKhoDateFilterRange.from) return false;
            if (theKhoDateFilterRange.to && itemTime > theKhoDateFilterRange.to) return false;
            return true;
        });
    }

    // Apply per-column popover filters
    for (const [colKey, selectedSet] of Object.entries(theKhoColumnFilters)) {
        if (!selectedSet || selectedSet.size === 0) continue;

        result = result.filter(item => {
            let valStr = formatTheKhoValForFilter(colKey, item[colKey]);
            return selectedSet.has(valStr);
        });
    }


    // Working 3-State Column A-Z, Z-A Sorting
    if (theKhoSortCol && theKhoSortDir) {
        result.sort((a, b) => {
            let valA = a[theKhoSortCol] ?? '';
            let valB = b[theKhoSortCol] ?? '';

            if (theKhoSortCol === 'so_luong') {
                const numA = Number(valA) || 0;
                const numB = Number(valB) || 0;
                return theKhoSortDir === 'asc' ? numA - numB : numB - numA;
            }

            if (theKhoSortCol === 'date_expiry' || theKhoSortCol === 'created_at') {
                const timeA = valA ? new Date(valA).getTime() : 0;
                const timeB = valB ? new Date(valB).getTime() : 0;
                return theKhoSortDir === 'asc' ? timeA - timeB : timeB - timeA;
            }

            valA = String(valA).toLowerCase().trim();
            valB = String(valB).toLowerCase().trim();

            if (valA === '(trống)' || !valA) return 1;
            if (valB === '(trống)' || !valB) return -1;

            const cmp = valA.localeCompare(valB, 'vi', { numeric: true, sensitivity: 'base' });
            return theKhoSortDir === 'asc' ? cmp : -cmp;
        });
    }

    theKhoFilteredData = result;
    updateTheKhoColumnFilterBadgesUI();
    renderCurrentTheKhoPageData();
}

function arraySearchTheKho(data, term) {
    if (!term) return [...data];
    return data.filter(item => {
        return (item.ma_qr && String(item.ma_qr).toLowerCase().includes(term)) ||
            (item.ma_vach && String(item.ma_vach).toLowerCase().includes(term)) ||
            (item.lot && String(item.lot).toLowerCase().includes(term)) ||
            (item.ten_hang_hoa && String(item.ten_hang_hoa).toLowerCase().includes(term)) ||
            (item.muc_dich && String(item.muc_dich).toLowerCase().includes(term)) ||
            (item.user_name && String(item.user_name).toLowerCase().includes(term));
    });
}

function renderCurrentTheKhoPageData() {
    const totalItems = theKhoFilteredData.length;
    const totalPages = Math.ceil(totalItems / theKhoPageSize) || 1;

    if (theKhoCurrentPage > totalPages) theKhoCurrentPage = totalPages;
    if (theKhoCurrentPage < 1) theKhoCurrentPage = 1;

    const startIndex = (theKhoCurrentPage - 1) * theKhoPageSize;
    const endIndex = Math.min(startIndex + theKhoPageSize, totalItems);
    const pageItems = theKhoFilteredData.slice(startIndex, endIndex);

    renderTheKhoTableHeader();
    renderTheKhoTable(pageItems);
    renderTheKhoPaginationControls(totalItems, totalPages, startIndex, endIndex);
}

// Requirement 1 & 2: Render Table Header with SVG Sort Arrows & Filter Badges (Identical to Vật Tư)
function renderTheKhoTableHeader() {
    const thead = document.querySelector('.thekho-table thead tr');
    if (!thead) return;

    thead.innerHTML = '';

    const visibleCols = currentTheKhoCols.filter(c => c.visible);

    visibleCols.forEach((col, visIdx) => {
        const { style: stickyStyle, className: stickyClass } = getTheKhoStickyColMeta(visIdx, visibleCols, true);

        const th = document.createElement('th');
        th.setAttribute('data-sort-col', col.key);

        const sortActiveAsc = theKhoSortCol === col.key && theKhoSortDir === 'asc' ? 'sort-active-asc' : '';
        const sortActiveDesc = theKhoSortCol === col.key && theKhoSortDir === 'desc' ? 'sort-active-desc' : '';

        th.className = `sortable-th ${sortActiveAsc} ${sortActiveDesc} ${stickyClass}`;
        th.style.width = col.width;
        th.style.minWidth = col.minWidth || '60px';
        th.style.textAlign = col.align;
        if (stickyStyle) {
            th.style.cssText += `; ${stickyStyle}`;
        }

        const selectedSet = theKhoColumnFilters[col.key];
        const hasFilter = selectedSet && selectedSet.size > 0;
        const filterBadgeStyle = hasFilter ? 'display:inline-flex;' : 'display:none;';
        const filterBadgeCount = hasFilter ? selectedSet.size : '0';
        const filterBtnCls = hasFilter ? 'col-filter-btn filter-active' : 'col-filter-btn';

        th.innerHTML = `
            <div class="th-content" style="justify-content: ${col.align === 'right' ? 'flex-end' : (col.align === 'center' ? 'center' : 'flex-start')}; pointer-events: none;">
                <span class="th-title-text">${escapeHtml(col.title)}</span>
                <div class="th-actions" style="pointer-events: auto;">
                    <span class="sort-icon-wrap" title="Sắp xếp">
                        <svg class="sort-icon icon-neutral" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"></path></svg>
                        <svg class="sort-icon icon-asc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"></path></svg>
                        <svg class="sort-icon icon-desc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7 7 7-7"></path></svg>
                    </span>
                    <button type="button" class="${filterBtnCls}" data-col="${col.key}" title="Lọc ${escapeHtml(col.title)}">
                        <svg class="funnel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        <span class="filter-badge" id="thekho-filter-badge-${col.key}" style="${filterBadgeStyle}">${filterBadgeCount}</span>
                    </button>
                </div>
            </div>
            <div class="col-resizer"></div>
        `;

        // Direct Click Listener for 3-State A-Z / Z-A Sorting
        th.addEventListener('click', (e) => {
            if (e.target.classList.contains('col-resizer') || e.target.closest('.col-filter-btn')) {
                return;
            }
            handleTheKhoHeaderSortClick(col.key);
        });

        // Filter button listener
        const filterBtn = th.querySelector('.col-filter-btn');
        if (filterBtn) {
            filterBtn.addEventListener('click', (e) => {
                toggleTheKhoColumnFilterDropdown(e, col.key);
            });
        }

        thead.appendChild(th);
    });

    updateTheKhoColumnFilterBadgesUI();
    initTheKhoColumnResizing();
}

// 3-State Sorting Handler (asc -> desc -> null)
function handleTheKhoHeaderSortClick(colKey) {
    if (theKhoSortCol !== colKey) {
        theKhoSortCol = colKey;
        theKhoSortDir = 'asc';
    } else if (theKhoSortDir === 'asc') {
        theKhoSortDir = 'desc';
    } else if (theKhoSortDir === 'desc') {
        theKhoSortCol = null;
        theKhoSortDir = null;
    }
    applyTheKhoFilters();
}

// Requirement 3: Render Table Rows with Cell Truncation (Prevents Overlapping)
function renderTheKhoTable(items) {
    const tbody = document.querySelector('.thekho-table tbody');
    const emptyState = document.getElementById('thekho-empty-state');
    const tableWrapper = document.getElementById('thekho-table-wrapper');
    const paginationBar = document.getElementById('thekho-pagination-bar');

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

    const visibleCols = currentTheKhoCols.filter(c => c.visible);

    items.forEach(item => {
        const tr = document.createElement('tr');

        let trHtml = '';
        visibleCols.forEach((col, visIdx) => {
            const { style: stickyStyle, className: stickyClass } = getTheKhoStickyColMeta(visIdx, visibleCols);

            let cellContent = '';

            if (col.key === 'ma_don') {
                cellContent = `<span class="badge-lot" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; font-weight: 700;">${escapeHtml(item.ma_don || '-')}</span>`;
            } else if (col.key === 'ma_qr') {
                cellContent = `<span class="thekho-qr-pill" onclick="showTheKhoQrModal('${escapeHtml(item.ma_qr || item.ma_vach)}')">📱 ${escapeHtml(item.ma_qr || 'QR')}</span>`;
            } else if (col.key === 'ma_vach') {
                cellContent = `<code class="vattu-barcode-code">${escapeHtml(item.ma_vach || '-')}</code>`;
            } else if (col.key === 'lot') {
                cellContent = `<span class="badge-lot">${escapeHtml(item.lot || '-')}</span>`;
            } else if (col.key === 'date_expiry') {
                cellContent = `<span class="badge-date">${formatDate(item.date_expiry)}</span>`;
            } else if (col.key === 'ten_hang_hoa') {
                cellContent = `<strong>${formatTruncateCell(item.ten_hang_hoa, '-')}</strong>`;
            } else if (col.key === 'loai') {
                const isNhap = item.loai === 'Nhập';
                cellContent = `<span class="badge-type ${isNhap ? 'badge-nhap' : 'badge-xuat'}">${isNhap ? '📥 Nhập' : '📤 Xuất'}</span>`;
            } else if (col.key === 'so_luong') {
                const qty = Number(item.so_luong) || 0;
                cellContent = `<span style="font-weight: 700; color: ${item.loai === 'Nhập' ? '#10b981' : '#f59e0b'};">${qty.toLocaleString('vi-VN')}</span>`;
            } else if (col.key === 'muc_dich') {
                cellContent = formatTruncateCell(item.muc_dich, '-');
            } else if (col.key === 'user_name') {
                const formattedUser = formatUserWithCN(item.user_name);
                cellContent = formatTruncateCell(formattedUser !== '-' ? `👤 ${formattedUser}` : '-', '-');
            } else if (col.key === 'created_at') {
                cellContent = `<span style="font-size: 12px; color: var(--text-muted);">${formatDateTime(item.created_at)}</span>`;
            } else {
                cellContent = formatTruncateCell(item[col.key], '-');
            }

            trHtml += `<td style="text-align: ${col.align}; ${stickyStyle}" class="${stickyClass}">${cellContent}</td>`;
        });

        tr.innerHTML = trHtml;
        tbody.appendChild(tr);
    });
}

// Requirement 2: Interdependent Column Filter Options & Badge Updates
let theKhoDateFilterRange = { from: null, to: null };

function formatTheKhoValForFilter(colKey, rawVal) {
    if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '' || String(rawVal).trim() === '-') {
        return '(Trống)';
    }
    if (colKey === 'created_at') {
        if (typeof formatDateTime === 'function') {
            return formatDateTime(rawVal);
        }
        try {
            const d = new Date(rawVal);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const hours = String(d.getHours()).padStart(2, '0');
                const mins = String(d.getMinutes()).padStart(2, '0');
                return `${day}/${month}/${year} ${hours}:${mins}`;
            }
        } catch (e) {}
    }
    if (colKey === 'date_expiry') {
        if (typeof formatDateForNx === 'function') return formatDateForNx(rawVal);
    }
    return String(rawVal).trim();
}

function getAvailableOptionsForTheKhoColumn(colKey) {
    if (!theKhoData || theKhoData.length === 0) return [];

    const filterBranchSelect = document.getElementById('thekho-filter-branch');
    const selectedBranch = filterBranchSelect ? filterBranchSelect.value : 'all';

    let subset = theKhoData.filter(item => {
        // Role & Branch Permission Filter: Quản lý sees all; Admin & Nhân Viên only see their branch
        if (typeof window.canUserAccessRecord === 'function' && !window.canUserAccessRecord(item)) {
            return false;
        }

        // Manager Branch Filter Dropdown selection
        if (selectedBranch && selectedBranch !== 'all') {
            let itemCN = '';
            if (typeof extractCNCodeFromBranchString === 'function') {
                itemCN = extractCNCodeFromBranchString(item.user_name || item.branch || '');
            } else if (typeof window.extractCNCode === 'function') {
                itemCN = window.extractCNCode(item.user_name || item.branch || '');
            }
            if (itemCN.toUpperCase() !== selectedBranch.toUpperCase()) return false;
        }

        // Date Range filter if active
        if (theKhoDateFilterRange.from || theKhoDateFilterRange.to) {
            const itemTime = item.created_at ? new Date(item.created_at).getTime() : 0;
            if (theKhoDateFilterRange.from && itemTime < theKhoDateFilterRange.from) return false;
            if (theKhoDateFilterRange.to && itemTime > theKhoDateFilterRange.to) return false;
        }

        const searchInput = document.getElementById('thekho-search-input');
        const term = searchInput ? searchInput.value.trim().toLowerCase() : '';

        const loaiFilter = document.getElementById('thekho-loai-filter');
        const selectedLoai = loaiFilter ? loaiFilter.value : '';

        let matchSearch = true;
        if (term) {
            matchSearch = Object.values(item).some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(term));
        }

        const matchLoai = !selectedLoai || item.loai === selectedLoai;

        if (!matchSearch || !matchLoai) return false;

        // Check other active column filters
        for (const [otherCol, selectedSet] of Object.entries(theKhoColumnFilters)) {
            if (otherCol === colKey) continue;
            if (!selectedSet || selectedSet.size === 0) continue;
            let valStr = formatTheKhoValForFilter(otherCol, item[otherCol]);
            if (!selectedSet.has(valStr)) return false;
        }

        return true;
    });

    const countsMap = new Map();
    subset.forEach(item => {
        let valStr = formatTheKhoValForFilter(colKey, item[colKey]);
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

function toggleTheKhoColumnFilterDropdown(event, colKey) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const popover = document.getElementById('thekho-col-filter-popover');
    if (!popover) return;

    if (popover.style.display === 'flex' && theKhoActiveFilterCol === colKey) {
        closeTheKhoColumnFilterDropdown();
        return;
    }

    theKhoActiveFilterCol = colKey;

    const btn = (event && event.currentTarget) ? event.currentTarget : document.querySelector(`.col-filter-btn[data-col="${colKey}"]`);
    if (btn) {
        const rect = btn.getBoundingClientRect();
        const popoverWidth = (colKey === 'created_at') ? 300 : 260;
        let left = rect.left - 90; // Shift leftwards for easy access & clear visibility
        let top = rect.bottom + 6;

        if (left + popoverWidth > window.innerWidth - 15) {
            left = window.innerWidth - popoverWidth - 15;
        }
        if (left < 10) left = 10;
        if (top + 400 > window.innerHeight) {
            top = Math.max(10, rect.top - 400);
        }

        popover.style.width = `${popoverWidth}px`;
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
    }

    const titleEl = document.getElementById('thekho-filter-popover-title');
    if (titleEl) titleEl.textContent = `Lọc Cột: ${theKhoColTitles[colKey] || colKey}`;

    const dateSection = document.getElementById('thekho-date-range-section');
    if (dateSection) {
        dateSection.style.display = (colKey === 'created_at') ? 'flex' : 'none';
    }

    const searchInput = document.getElementById('thekho-filter-popover-search-input');
    if (searchInput) searchInput.value = '';

    const existing = theKhoColumnFilters[colKey];
    const availableOptions = getAvailableOptionsForTheKhoColumn(colKey);

    if (existing && existing.size > 0) {
        theKhoPopoverTempSelectedValues = new Set(existing);
    } else {
        theKhoPopoverTempSelectedValues = new Set(availableOptions.map(x => x.valStr));
    }

    popover.style.display = 'flex';
    renderTheKhoFilterPopoverListOptions();
}

function handleTheKhoDateRangeChange() {
    const fromInput = document.getElementById('thekho-filter-date-from');
    const toInput = document.getElementById('thekho-filter-date-to');

    const fromVal = fromInput ? fromInput.value : '';
    const toVal = toInput ? toInput.value : '';

    if (fromVal) {
        const dFrom = new Date(`${fromVal}T00:00:00`);
        theKhoDateFilterRange.from = isNaN(dFrom.getTime()) ? null : dFrom.getTime();
    } else {
        theKhoDateFilterRange.from = null;
    }

    if (toVal) {
        const dTo = new Date(`${toVal}T23:59:59`);
        theKhoDateFilterRange.to = isNaN(dTo.getTime()) ? null : dTo.getTime();
    } else {
        theKhoDateFilterRange.to = null;
    }

    renderTheKhoFilterPopoverListOptions();
    updateTheKhoColumnFilterBadgesUI();
    applyTheKhoFilters();
}

function setTheKhoDatePreset(preset) {
    const fromInput = document.getElementById('thekho-filter-date-from');
    const toInput = document.getElementById('thekho-filter-date-to');

    const now = new Date();
    if (preset === 'today') {
        if (fromInput) fromInput.value = formatDateLocalInput(now);
        if (toInput) toInput.value = formatDateLocalInput(now);
    } else if (preset === '7days') {
        const start7Days = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
        if (fromInput) fromInput.value = formatDateLocalInput(start7Days);
        if (toInput) toInput.value = formatDateLocalInput(now);
    } else if (preset === 'thisMonth') {
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        if (fromInput) fromInput.value = formatDateLocalInput(startMonth);
        if (toInput) toInput.value = formatDateLocalInput(now);
    } else if (preset === 'clear') {
        if (fromInput) fromInput.value = '';
        if (toInput) toInput.value = '';
    }

    handleTheKhoDateRangeChange();
}

function formatDateLocalInput(d) {
    if (!d || isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function renderTheKhoFilterPopoverListOptions() {
    if (!theKhoActiveFilterCol) return;

    const listContainer = document.getElementById('thekho-filter-popover-list');
    const searchVal = (document.getElementById('thekho-filter-popover-search-input')?.value || '').toLowerCase().trim();
    if (!listContainer) return;

    const options = getAvailableOptionsForTheKhoColumn(theKhoActiveFilterCol);
    const filteredOptions = options.filter(opt => !searchVal || opt.valStr.toLowerCase().includes(searchVal));

    listContainer.innerHTML = '';

    if (filteredOptions.length === 0) {
        listContainer.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 12px;">Không có giá trị trùng khớp</div>`;
    } else {
        filteredOptions.forEach(opt => {
            const isChecked = theKhoPopoverTempSelectedValues.has(opt.valStr);
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
                    theKhoPopoverTempSelectedValues.add(opt.valStr);
                } else {
                    theKhoPopoverTempSelectedValues.delete(opt.valStr);
                }
                updateTheKhoSelectAllCheckboxState(filteredOptions);
            };

            listContainer.appendChild(label);
        });
    }

    updateTheKhoSelectAllCheckboxState(filteredOptions);
}

function updateTheKhoSelectAllCheckboxState(filteredOptions) {
    const selectAllCb = document.getElementById('thekho-popover-select-all');
    if (!selectAllCb || !filteredOptions || filteredOptions.length === 0) return;
    const allChecked = filteredOptions.every(opt => theKhoPopoverTempSelectedValues.has(opt.valStr));
    selectAllCb.checked = allChecked;
}

function toggleSelectAllTheKhoPopoverOptions(checked) {
    if (!theKhoActiveFilterCol) return;
    const options = getAvailableOptionsForTheKhoColumn(theKhoActiveFilterCol);
    options.forEach(opt => {
        if (checked) {
            theKhoPopoverTempSelectedValues.add(opt.valStr);
        } else {
            theKhoPopoverTempSelectedValues.delete(opt.valStr);
        }
    });
    renderTheKhoFilterPopoverListOptions();
}

function applyCurrentTheKhoColumnFilter() {
    if (!theKhoActiveFilterCol) return;
    const colKey = theKhoActiveFilterCol;
    const availableOptions = getAvailableOptionsForTheKhoColumn(colKey);

    if (theKhoPopoverTempSelectedValues.size >= availableOptions.length) {
        delete theKhoColumnFilters[colKey];
    } else {
        theKhoColumnFilters[colKey] = new Set(theKhoPopoverTempSelectedValues);
    }

    updateTheKhoColumnFilterBadgesUI();
    closeTheKhoColumnFilterDropdown();
    theKhoCurrentPage = 1;
    applyTheKhoFilters();
}

function clearCurrentTheKhoColumnFilter() {
    if (!theKhoActiveFilterCol) return;
    delete theKhoColumnFilters[theKhoActiveFilterCol];
    updateTheKhoColumnFilterBadgesUI();
    closeTheKhoColumnFilterDropdown();
    theKhoCurrentPage = 1;
    applyTheKhoFilters();
}

function updateTheKhoColumnFilterBadgesUI() {
    let hasActiveFilters = false;
    const hasDateRange = !!(theKhoDateFilterRange.from || theKhoDateFilterRange.to);

    const allBtns = document.querySelectorAll('#view-the-kho .col-filter-btn[data-col]');
    allBtns.forEach(btn => {
        const colKey = btn.getAttribute('data-col');
        const badge = document.getElementById(`thekho-filter-badge-${colKey}`);
        const selectedSet = theKhoColumnFilters[colKey];
        const isActive = (selectedSet && selectedSet.size > 0) || (colKey === 'created_at' && hasDateRange);

        if (isActive) {
            btn.classList.add('filter-active');
            hasActiveFilters = true;
            if (badge) {
                badge.textContent = selectedSet ? selectedSet.size : '📅';
                badge.style.display = 'inline-flex';
            }
        } else {
            btn.classList.remove('filter-active');
            if (badge) {
                badge.textContent = '0';
                badge.style.display = 'none';
            }
        }
    });

    const clearBtn = document.getElementById('btn-clear-all-filters-thekho');
    if (clearBtn) {
        const searchInput = document.getElementById('thekho-search-input');
        const hasSearch = searchInput && searchInput.value.trim() !== '';
        if (hasActiveFilters || hasSearch || theKhoSortCol || hasDateRange) {
            clearBtn.classList.add('btn-clear-active');
        } else {
            clearBtn.classList.remove('btn-clear-active');
        }
    }
}

function closeTheKhoColumnFilterDropdown() {
    const popover = document.getElementById('thekho-col-filter-popover');
    if (popover) popover.style.display = 'none';
    theKhoActiveFilterCol = null;
}

function clearAllTheKhoFilters() {
    const searchInput = document.getElementById('thekho-search-input');
    if (searchInput) searchInput.value = '';

    const loaiFilter = document.getElementById('thekho-loai-filter');
    if (loaiFilter) loaiFilter.value = '';

    const branchFilter = document.getElementById('thekho-filter-branch');
    if (branchFilter) branchFilter.value = 'all';

    const fromInput = document.getElementById('thekho-filter-date-from');
    const toInput = document.getElementById('thekho-filter-date-to');
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    theKhoDateFilterRange = { from: null, to: null };

    theKhoSortCol = null;
    theKhoSortDir = null;
    theKhoColumnFilters = {};
    theKhoCurrentPage = 1;

    updateTheKhoColumnFilterBadgesUI();
    applyTheKhoFilters();
}

window.handleTheKhoDateRangeChange = handleTheKhoDateRangeChange;
window.setTheKhoDatePreset = setTheKhoDatePreset;

// Pagination Controls & Button Rendering (Identical to Vật Tư)
function renderTheKhoPaginationControls(totalItems, totalPages, startIdx, endIdx) {
    const rangeTextEl = document.getElementById('thekho-page-range-text');
    const totalTextEl = document.getElementById('thekho-page-total-text');
    const btnsContainer = document.getElementById('thekho-page-btns-container');

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
    btnPrev.className = `vattu-page-btn ${theKhoCurrentPage <= 1 ? 'disabled' : ''}`;
    btnPrev.innerHTML = `&laquo; Trước`;
    btnPrev.disabled = theKhoCurrentPage <= 1;
    btnPrev.onclick = () => {
        if (theKhoCurrentPage > 1) {
            theKhoCurrentPage--;
            renderCurrentTheKhoPageData();
        }
    };
    btnsContainer.appendChild(btnPrev);

    // Numbered Page Buttons
    let startPage = Math.max(1, theKhoCurrentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let p = startPage; p <= endPage; p++) {
        const pageBtn = document.createElement('button');
        pageBtn.type = 'button';
        pageBtn.className = `vattu-page-btn ${p === theKhoCurrentPage ? 'active' : ''}`;
        pageBtn.textContent = p;
        pageBtn.onclick = () => {
            theKhoCurrentPage = p;
            renderCurrentTheKhoPageData();
        };
        btnsContainer.appendChild(pageBtn);
    }

    // Next Button
    const btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = `vattu-page-btn ${theKhoCurrentPage >= totalPages ? 'disabled' : ''}`;
    btnNext.innerHTML = `Sau &raquo;`;
    btnNext.disabled = theKhoCurrentPage >= totalPages;
    btnNext.onclick = () => {
        if (theKhoCurrentPage < totalPages) {
            theKhoCurrentPage++;
            renderCurrentTheKhoPageData();
        }
    };
    btnsContainer.appendChild(btnNext);
}

function changeTheKhoPage(newPage) {
    theKhoCurrentPage = newPage;
    renderCurrentTheKhoPageData();
}

// Column Resizing Dragging Handler
function initTheKhoColumnResizing() {
    const resizers = document.querySelectorAll('.thekho-table .col-resizer');
    resizers.forEach(resizer => {
        const th = resizer.parentElement;
        let startX, startWidth;

        const onMouseMove = (e) => {
            if (!startX) return;
            const diffX = e.pageX - startX;
            const newWidth = Math.max(60, startWidth + diffX);
            th.style.width = `${newWidth}px`;
            th.style.minWidth = `${newWidth}px`;
            const colKey = th.getAttribute('data-sort-col');
            const colObj = currentTheKhoCols.find(c => c.key === colKey);
            if (colObj) colObj.width = `${newWidth}px`;
        };

        const onMouseUp = () => {
            startX = null;
            resizer.classList.remove('resizing');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            localStorage.setItem('gaia_thekho_columns_v1', JSON.stringify(currentTheKhoCols));
        };

        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startX = e.pageX;
            startWidth = th.offsetWidth;
            resizer.classList.add('resizing');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });
}

// Column Configuration UI Logic
function openTheKhoColumnConfigModal() {
    pendingTheKhoColsConfig = JSON.parse(JSON.stringify(currentTheKhoCols));
    const modal = document.getElementById('thekho-column-config-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
        renderTheKhoColConfigList();
    }
}

function closeTheKhoColumnConfigModal() {
    const modal = document.getElementById('thekho-column-config-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
}

function renderTheKhoColConfigList() {
    const listEl = document.getElementById('thekho-column-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';

    // Add Fixed Column Freeze control section at top of modal list
    const freezeHeader = document.createElement('div');
    freezeHeader.style.cssText = 'margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px dashed var(--card-border); display: flex; align-items: center; justify-content: space-between;';
    freezeHeader.innerHTML = `
        <label style="font-size: 13px; font-weight: 600; color: var(--text-color); display: flex; align-items: center; gap: 6px;">
            📌 Số cột ghim cố định khi cuộn ngang:
        </label>
        <select id="thekho-fixed-cols-select" style="padding: 5px 10px; border-radius: 6px; border: 1px solid var(--card-border); background: var(--card-bg); color: var(--text-color); font-weight: 600; font-size: 12px; cursor: pointer;">
            <option value="0" ${thekhoFixedColsCount === 0 ? 'selected' : ''}>0 cột (Không ghim)</option>
            <option value="1" ${thekhoFixedColsCount === 1 ? 'selected' : ''}>1 cột cố định</option>
            <option value="2" ${thekhoFixedColsCount === 2 ? 'selected' : ''}>2 cột cố định (Mặc định)</option>
        </select>
    `;
    listEl.appendChild(freezeHeader);
    
    pendingTheKhoColsConfig.forEach((col, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === pendingTheKhoColsConfig.length - 1;
        
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
        
        item.querySelector('.col-visibility-toggle').addEventListener('click', function() {
            pendingTheKhoColsConfig[idx].visible = !pendingTheKhoColsConfig[idx].visible;
            renderTheKhoColConfigList();
        });
        
        const moveUpBtn = item.querySelector('[data-move="up"]');
        if (moveUpBtn && !isFirst) {
            moveUpBtn.addEventListener('click', function() {
                const temp = pendingTheKhoColsConfig[idx - 1];
                pendingTheKhoColsConfig[idx - 1] = pendingTheKhoColsConfig[idx];
                pendingTheKhoColsConfig[idx] = temp;
                renderTheKhoColConfigList();
            });
        }
        
        const moveDwnBtn = item.querySelector('[data-move="down"]');
        if (moveDwnBtn && !isLast) {
            moveDwnBtn.addEventListener('click', function() {
                const temp = pendingTheKhoColsConfig[idx + 1];
                pendingTheKhoColsConfig[idx + 1] = pendingTheKhoColsConfig[idx];
                pendingTheKhoColsConfig[idx] = temp;
                renderTheKhoColConfigList();
            });
        }
        
        listEl.appendChild(item);
    });
}

function saveTheKhoColumnConfig() {
    currentTheKhoCols = JSON.parse(JSON.stringify(pendingTheKhoColsConfig));
    localStorage.setItem('gaia_thekho_columns_v1', JSON.stringify(currentTheKhoCols));

    const fixedSelect = document.getElementById('thekho-fixed-cols-select');
    if (fixedSelect) {
        thekhoFixedColsCount = parseInt(fixedSelect.value, 10) || 0;
        localStorage.setItem('gaia_thekho_fixed_cols', thekhoFixedColsCount);
    }

    closeTheKhoColumnConfigModal();
    theKhoCurrentPage = 1;
    applyTheKhoFilters();
}

// Open Export Excel Choice Modal for Thẻ Kho
function exportTheKhoToExcel() {
    const filteredCount = theKhoFilteredData ? theKhoFilteredData.length : 0;
    const allCount = theKhoData ? theKhoData.length : 0;

    const filteredBadge = document.getElementById('thekho-export-filtered-count-badge');
    const allBadge = document.getElementById('thekho-export-all-count-badge');

    if (filteredBadge) filteredBadge.textContent = `${filteredCount} dòng`;
    if (allBadge) allBadge.textContent = `${allCount} dòng`;

    const modal = document.getElementById('thekho-excel-export-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
    }
}

function closeTheKhoExcelExportModal() {
    const modal = document.getElementById('thekho-excel-export-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
}

// Execute Export based on selected mode ('filtered' or 'all') for Thẻ Kho
function executeTheKhoExcelExport(type) {
    closeTheKhoExcelExportModal();

    const targetData = (type === 'filtered') ? theKhoFilteredData : theKhoData;

    if (!targetData || targetData.length === 0) {
        showVatTuNoticeModal('warning', 'Bảng Dữ Liệu Trống', 'Không có dòng dữ liệu Thẻ Kho nào phù hợp với tùy chọn này để xuất Excel!');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showVatTuNoticeModal('warning', 'Chưa Sẵn Sàng', 'Thư viện SheetJS chưa sẵn sàng!');
        return;
    }

    try {
        const exportRows = targetData.map((item, index) => ({
            "STT": index + 1,
            "Mã Đơn": item.ma_don || '',
            "Mã QR": item.ma_qr || '',
            "Mã Vạch": item.ma_vach || '',
            "LOT": item.lot || '',
            "Date": formatDate(item.date_expiry),
            "Tên Hàng Hóa": item.ten_hang_hoa || '',
            "Loại": item.loai || '',
            "Số Lượng": Number(item.so_luong) || 0,
            "Mục Đích / Ghi Chú": item.muc_dich || '',
            "User / Chi Nhánh": formatUserWithCN(item.user_name),
            "Thời Gian": formatDateTime(item.created_at)
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        
        const colWidths = [
            { wch: 6 },  // STT
            { wch: 18 }, // Mã Đơn
            { wch: 16 }, // Mã QR
            { wch: 18 }, // Mã Vạch
            { wch: 14 }, // LOT
            { wch: 14 }, // Date
            { wch: 32 }, // Tên hàng hóa
            { wch: 10 }, // Loại
            { wch: 12 }, // Số lượng
            { wch: 30 }, // Mục đích
            { wch: 22 }, // User / Chi Nhánh
            { wch: 20 }  // Thời Gian
        ];
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Nhat Ky The Kho");

        const todayStr = new Date().toISOString().split('T')[0];
        const fileName = `Nhat_Ky_The_Kho_GAIA_${type === 'filtered' ? 'Bo_Loc' : 'Toan_Bo'}_${todayStr}.xlsx`;

        downloadExcelWorkbook(workbook, fileName);
    } catch (err) {
        console.error("TheKho: Error generating Excel workbook:", err);
        showVatTuNoticeModal('error', 'Lỗi Xuất File Excel', 'Có lỗi xảy ra khi khởi tạo file Excel: ' + err.message);
    }
}

// QR Modal Dialog Renderer
function showTheKhoQrModal(qrCodeStr) {
    showVatTuNoticeModal(
        'info',
        'Mã QR Thẻ Kho',
        `<div style="text-align: center; padding: 10px;">` +
        `<div id="thekho-qr-target" style="display: flex; justify-content: center; margin-bottom: 12px;"></div>` +
        `<code>${escapeHtml(qrCodeStr)}</code></div>`
    );

    setTimeout(() => {
        const target = document.getElementById('thekho-qr-target');
        if (target && typeof QRCode !== 'undefined') {
            target.innerHTML = '';
            new QRCode(target, { text: qrCodeStr, width: 128, height: 128 });
        }
    }, 100);
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

function formatDate(dateStr) {
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

function formatUserWithCN(userNameStr) {
    if (!userNameStr || userNameStr === '-') return '-';

    let cleanName = String(userNameStr).trim();
    cleanName = cleanName.replace(/\s*\([^)]*\)/g, '').trim();

    if (/-\s*CN\d+/i.test(cleanName)) {
        return cleanName;
    }

    let userBranch = "";
    if (typeof window.getUserBranch === 'function') {
        userBranch = window.getUserBranch(userNameStr);
    }

    let cnCode = "";
    if (typeof window.extractCNCode === 'function') {
        cnCode = window.extractCNCode(userBranch);
    }

    if (!cnCode || cnCode === 'ALL' || cnCode === 'TOÀN HỆ THỐNG') {
        cnCode = 'CN1';
    } else {
        if (cnCode === 'CN_TPHCM') cnCode = 'CN1';
        else if (cnCode === 'CN_HANOI') cnCode = 'CN2';
    }

    return `${cleanName} - ${cnCode}`;
}

function formatDateTime(dateStr) {
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

function showTheKhoLoading(show) {
    const spinner = document.getElementById('thekho-loading-spinner');
    if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

// Global Window Exports
window.fetchTheKhoData = fetchTheKhoData;
window.handleTheKhoHeaderSortClick = handleTheKhoHeaderSortClick;
window.openTheKhoColumnConfigModal = openTheKhoColumnConfigModal;
window.closeTheKhoColumnConfigModal = closeTheKhoColumnConfigModal;
window.saveTheKhoColumnConfig = saveTheKhoColumnConfig;
window.clearAllTheKhoFilters = clearAllTheKhoFilters;
window.toggleTheKhoColumnFilterDropdown = toggleTheKhoColumnFilterDropdown;
window.renderTheKhoFilterPopoverListOptions = renderTheKhoFilterPopoverListOptions;
window.toggleSelectAllTheKhoPopoverOptions = toggleSelectAllTheKhoPopoverOptions;
window.clearCurrentTheKhoColumnFilter = clearCurrentTheKhoColumnFilter;
window.applyCurrentTheKhoColumnFilter = applyCurrentTheKhoColumnFilter;
window.closeTheKhoColumnFilterDropdown = closeTheKhoColumnFilterDropdown;
window.changeTheKhoPage = changeTheKhoPage;
window.exportTheKhoToExcel = exportTheKhoToExcel;
window.closeTheKhoExcelExportModal = closeTheKhoExcelExportModal;
window.executeTheKhoExcelExport = executeTheKhoExcelExport;
window.showTheKhoQrModal = showTheKhoQrModal;
