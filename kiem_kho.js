let kiemKhoItemsMap = new Map();
let kiemKhoTotalScans = 0;
let kiemKhoSelectedBranch = '';
let kiemKhoAudioCtx = null;
let currentKiemKhoPhieuId = null;
let currentKiemKhoMaPhieu = null;
const kiemKhoClientSessionId = 'cli_' + Math.random().toString(36).substring(2, 11);

let canBangKhoMap = new Map();
let canBangSearchQuery = '';

let kiemKhoColumnFilters = {};
let canBangColumnFilters = {};
let activeKiemKhoFilterCol = null;
let activeKiemKhoFilterTable = 'kiemkho'; 
let kiemKhoPopoverTempSelectedValues = new Set();

const kiemKhoColTitles = {
    stt: 'STT',
    ma_vach: 'Mã Vạch',
    ten_hang_hoa: 'Tên Hàng Hóa',
    lot: 'LOT',
    date_expiry: 'Date',
    so_luong_thuc_te: 'Thực Tế',
    so_luong_he_thong: 'Tồn HT',
    chenh_lech: 'Chênh Lệch',
    trang_thai: 'Trạng Thái',
    user_name: 'Người Quét - CN',
    time_scanned: 'Thời Gian'
};

const canBangColTitles = {
    stt: 'STT',
    ma_vach: 'Mã Vạch',
    ten_hang_hoa: 'Tên Hàng Hóa',
    ton_gpet: 'Tồn GPET',
    ton_kho: 'Tồn Kho',
    thuc_te: 'Thực Tế',
    chenh_lech: 'Chênh Lệch',
    trang_thai: 'Trạng Thái'
};

let kiemKhoCurrentPage = 1;
let kiemKhoPageSize = 25;
let canBangCurrentPage = 1;
let canBangPageSize = 25;
let kiemKhoSearchQuery = '';

let renderKiemKhoTableTimer = null;
function debouncedRenderKiemKhoTable(delay = 100) {
    if (renderKiemKhoTableTimer) clearTimeout(renderKiemKhoTableTimer);
    renderKiemKhoTableTimer = setTimeout(() => {
        renderKiemKhoTableTimer = null;
        renderKiemKhoTable();
    }, delay);
}

async function generateKiemKhoMaPhieu(branch) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    let targetBranch = branch;
    if (!targetBranch) {
        targetBranch = getKiemKhoLoggedBranch();
    }
    const branchCode = (!targetBranch || targetBranch === 'all') ? 'ALL' : targetBranch.toUpperCase();
    const prefix = `PKK-${branchCode}-${dateStr}_`;

    let seq = 1;
    const client = getVatTuSupabaseClient();
    if (client) {
        try {
            const { data } = await client.from('kiem_kho')
                .select('ma_phieu')
                .ilike('ma_phieu', `${prefix}%`);
            if (data && data.length > 0) seq = data.length + 1;
        } catch (e) {}
    }
    return `${prefix}${String(seq).padStart(2, '0')}`;
}

function getKiemKhoAudioContext() {
    if (!kiemKhoAudioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            kiemKhoAudioCtx = new AudioContext();
        }
    }
    if (kiemKhoAudioCtx && kiemKhoAudioCtx.state === 'suspended') {
        kiemKhoAudioCtx.resume();
    }
    return kiemKhoAudioCtx;
}

function playKiemKhoAudio(type) {
    try {
        const ctx = getKiemKhoAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        if (type === 'match') {

            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(659.25, now); 
            osc1.frequency.setValueAtTime(783.99, now + 0.1); 
            gain1.gain.setValueAtTime(0.3, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.4);
        } else if (type === 'excess') {

            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(349.23, now); 
            osc1.frequency.setValueAtTime(261.63, now + 0.15); 
            gain1.gain.setValueAtTime(0.35, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.45);
        } else {

            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, now);
            gain1.gain.setValueAtTime(0.2, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.08);
        }
    } catch (e) {
        console.warn("KiemKho Audio Error:", e);
    }
}

function getKiemKhoLoggedUserName() {
    let u = null;
    if (typeof window.getCurrentLoggedUser === 'function') {
        u = window.getCurrentLoggedUser();
    }
    if (!u) {
        try {
            const saved = localStorage.getItem("gaia_logged_user");
            if (saved) u = JSON.parse(saved);
        } catch (e) {}
    }
    if (!u) return 'Nhân viên';
    return u.full_name || u.name || u.ten_nhan_vien || u.user_name || u.username || u.email || 'Nhân viên';
}

function extractKiemKhoCNCode(branchStr) {
    if (!branchStr) return '';
    const str = String(branchStr).trim();
    if (str === 'Toàn hệ thống' || str === 'all' || str === 'ALL') return 'ALL';
    const match = str.match(/CN\d+/i);
    if (match) return match[0].toUpperCase();
    const matchNum = str.match(/Chi\s*Nhánh\s*(\d+)/i) || str.match(/CN\s*(\d+)/i);
    if (matchNum) return `CN${matchNum[1]}`;
    if (str.toLowerCase().includes('hà nội')) return 'CN2';
    if (str.toLowerCase().includes('tp.hcm') || str.toLowerCase().includes('hcm')) return 'CN1';
    if (str.toLowerCase().includes('hiệp bình')) return 'CN3';
    return str.toUpperCase();
}

function getKiemKhoLoggedBranch() {
    const userObj = getKiemKhoUserBranchCode();
    return userObj.code || 'CN1';
}

function normalizeScanner(user_name, branch) {
    let name = user_name;
    let br = branch;

    if (name && typeof name === 'object') {
        br = name.branch || br;
        name = name.user_name || name.name || name.user;
    }

    name = (name && String(name).trim()) ? String(name).trim() : 'Nhân viên';
    br = (br && String(br).trim()) ? String(br).trim() : 'CN1';

    if (name.includes('{') || name.includes('[')) {
        try {
            const parsed = JSON.parse(name);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const first = parsed[0];
                name = (first && (first.user_name || first.name || first.user)) || name;
                br = (first && first.branch) || br;
            } else if (parsed && typeof parsed === 'object') {
                name = parsed.user_name || parsed.name || parsed.user || name;
                br = parsed.branch || br;
            }
        } catch (e) {}
    }

    return { user_name: name, branch: br };
}

function parseKiemKhoScanners(userNameStr, defaultBranch = 'CN1', phieuUserName = '') {
    if (Array.isArray(userNameStr)) {
        return userNameStr.map(s => normalizeScanner(s && (s.user_name || s.name || s.user || s), s && (s.branch || defaultBranch)));
    }
    if (userNameStr && typeof userNameStr === 'object') {
        return [normalizeScanner(userNameStr.user_name || userNameStr.name || userNameStr.user, userNameStr.branch || defaultBranch)];
    }
    if (!userNameStr && phieuUserName) {
        userNameStr = phieuUserName;
    }
    if (!userNameStr) {
        return [normalizeScanner('Nhân viên', defaultBranch)];
    }

    const str = String(userNameStr).trim();

    if (str.includes('[') || str.includes('{')) {
        try {
            const arr = JSON.parse(str);
            if (Array.isArray(arr) && arr.length > 0) {
                return arr.map(s => normalizeScanner(s.user_name || s.name || s.user || s, s.branch || defaultBranch));
            } else if (arr && typeof arr === 'object') {
                return [normalizeScanner(arr.user_name || arr.name || arr.user, arr.branch || defaultBranch)];
            }
        } catch (e) {}
    }

    if (str.includes(',')) {
        const parts = str.split(',');
        const list = [];
        parts.forEach(p => {
            const trimmed = p.trim();
            if (trimmed) {
                if (trimmed.includes(' - ')) {
                    const [n, b] = trimmed.split(' - ');
                    list.push(normalizeScanner(n, b || defaultBranch));
                } else {
                    list.push(normalizeScanner(trimmed, defaultBranch));
                }
            }
        });
        if (list.length > 0) return list;
    }

    if (str.includes(' - ')) {
        const [n, b] = str.split(' - ');
        return [normalizeScanner(n, b || defaultBranch)];
    }

    return [normalizeScanner(str, defaultBranch)];
}

function addKiemKhoItemScanner(item, userName, branch) {
    if (!item) return;
    if (!item.scanners || !Array.isArray(item.scanners)) {
        item.scanners = parseKiemKhoScanners(item.user_name, item.branch || branch);
    }
    const newScanner = normalizeScanner(userName, branch);
    const exists = item.scanners.some(s => 
        s.user_name.toLowerCase() === newScanner.user_name.toLowerCase() &&
        s.branch.toLowerCase() === newScanner.branch.toLowerCase()
    );
    if (!exists) {
        item.scanners.push(newScanner);
    }

    item.user_name = JSON.stringify(item.scanners);
    if (item.scanners.length === 1) {
        item.branch = item.scanners[0].branch;
    }
}

function toggleKiemKhoScannersPopover(event, key) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const existing = document.getElementById('kiemkho-scanners-popover');
    if (existing) {
        const isSameKey = existing.getAttribute('data-popover-key') === key;
        existing.remove();
        if (isSameKey) return;
    }

    const item = kiemKhoItemsMap.get(key);
    if (!item) return;

    const scanners = (item.scanners && item.scanners.length > 0) ? 
        item.scanners : 
        parseKiemKhoScanners(item.user_name, item.branch);

    const btn = event.currentTarget || event.target;
    const rect = btn.getBoundingClientRect();

    const popover = document.createElement('div');
    popover.id = 'kiemkho-scanners-popover';
    popover.className = 'kiemkho-scanners-popover-card';
    popover.setAttribute('data-popover-key', key);

    const top = rect.bottom + window.scrollY + 6;
    let left = rect.left + window.scrollX;
    if (left + 260 > window.innerWidth) {
        left = window.innerWidth - 270;
    }

    popover.style.cssText = `top: ${top}px; left: ${left}px; position: absolute; z-index: 999999;`;

    popover.innerHTML = `
        <div class="kiemkho-scanners-popover-header">
            <div class="kiemkho-scanners-popover-title">
                <span>📁</span>
                <span>Người Quét - CN</span>
            </div>
            <span class="kiemkho-scanners-popover-count">${scanners.length} người</span>
        </div>
        <div class="kiemkho-scanners-popover-list">
            ${scanners.map(s => `
                <div class="kiemkho-scanners-popover-item">
                    <div class="kiemkho-scanners-popover-user">
                        <span style="color: #10b981;">🟢</span>
                        <span>${escapeHtml(s.user_name)}</span>
                    </div>
                    <span class="kiemkho-scanners-popover-branch">${escapeHtml(s.branch)}</span>
                </div>
            `).join('')}
        </div>
    `;

    document.body.appendChild(popover);

    setTimeout(() => {
        const closeHandler = (e) => {
            if (popover && !popover.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                popover.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 50);
}

// Custom Modal Confirm Dialog Window Helper (Replaces native browser confirm alert popups)
function showKiemKhoConfirmModal(title, message, confirmText = 'Đồng ý', cancelText = 'Hủy') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay show';
        overlay.style.cssText = 'display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(0,0,0,0.65) !important; backdrop-filter: blur(4px) !important; z-index: 999999 !important; align-items: center !important; justify-content: center !important; opacity: 0; pointer-events: auto !important; transition: opacity 0.2s ease;';

        // Use a safe wrapper to avoid ID conflicts
        overlay.innerHTML = `
            <div style="background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 14px; max-width: 440px; width: 90%; padding: 22px 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); color: #fff; transform: translateY(-10px); transition: transform 0.2s ease; pointer-events: auto !important;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
                    <span style="font-size: 26px;">⚠️</span>
                    <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #38bdf8;">${escapeHtml(title)}</h3>
                </div>
                <div style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin-bottom: 22px;">
                    ${message}
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" class="btn-kiemkho-cancel" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; padding: 9px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.15s; pointer-events: auto !important;">${escapeHtml(cancelText)}</button>
                    <button type="button" class="btn-kiemkho-ok" style="background: #38bdf8; border: none; color: #0f172a; padding: 9px 22px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; transition: all 0.15s; pointer-events: auto !important;">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            const card = overlay.firstElementChild;
            if (card) card.style.transform = 'translateY(0)';
        });

        const cancelBtn = overlay.querySelector('.btn-kiemkho-cancel');
        const okBtn = overlay.querySelector('.btn-kiemkho-ok');

        let isResolved = false;
        const cleanup = (result) => {
            if (isResolved) return;
            isResolved = true;
            overlay.style.opacity = '0';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                resolve(result);
            }, 200);
        };

        if (cancelBtn) cancelBtn.addEventListener('click', () => cleanup(false));
        if (okBtn) okBtn.addEventListener('click', () => cleanup(true));
    });
}

// Initialize View "Kiểm Kho"
async function initKiemKhoView() {
    initKiemKhoBranchSelect();
    setupKiemKhoScanInput();
    setupKiemKhoPhieuInput();

    // ALWAYS ACTIVATE REALTIME SUBSCRIPTION FOR MULTI-USER LIVE SYNC!
    setupKiemKhoRealtimeSubscription();

    // Initialize Column Resizing & Filter Badges
    initKiemKhoColumnResizing();
    updateKiemKhoColumnFilterBadgesUI('kiemkho');

    // Fetch vatTuData from Supabase if empty
    if (!window.vatTuData || !Array.isArray(window.vatTuData) || window.vatTuData.length === 0) {
        if (typeof window.fetchVatTuData === 'function') {
            await window.fetchVatTuData();
        }
    }

    // Try restoring active session from localStorage (F5 Persistence)
    const restored = restoreKiemKhoLocalSession();

    if (restored && currentKiemKhoMaPhieu) {
        setKiemKhoBranchSelectDisabled(true);
        // Verify if ticket still exists in DB & sync live scan logs from DB (F5 Fix)
        await verifyKiemKhoSessionExistence();
        await syncActiveKiemKhoTicketFromDB();
    } else {
        setKiemKhoBranchSelectDisabled(false);
    }

    // Always update the phiếu input display
    updateKiemKhoPhieuDisplay();

    renderKiemKhoTable();

    // Start background live monitoring timer for system stock changes every 4 seconds!
    if (!window.kiemKhoLiveMonitorTimer) {
        window.kiemKhoLiveMonitorTimer = setInterval(checkKiemKhoLiveSystemQtyChanges, 4000);
    }

    // Start background auto-reconciliation timer for 100% exact multi-device sync (runs every 3 seconds)
    if (!window.kiemKhoAutoReconcileTimer) {
        window.kiemKhoAutoReconcileTimer = setInterval(() => {
            if (currentKiemKhoMaPhieu || currentKiemKhoPhieuId) {
                syncActiveKiemKhoTicketFromDB();
            }
        }, 3000);
    }
}

// Sync active ticket's scan logs from quet_chi_tiet DB table silently
async function syncActiveKiemKhoTicketFromDB() {
    if (!currentKiemKhoMaPhieu && !currentKiemKhoPhieuId) return;

    const client = getVatTuSupabaseClient();
    if (!client) return;

    try {
        let phieuId = currentKiemKhoPhieuId;
        if (!phieuId) {
            const { data: pData } = await client.from('kiem_kho').select('id').eq('ma_phieu', currentKiemKhoMaPhieu).maybeSingle();
            if (pData) {
                phieuId = pData.id;
                currentKiemKhoPhieuId = phieuId;
            }
        }

        if (!phieuId) return;

        const { data: quetLogData } = await client
            .from('quet_chi_tiet')
            .select('*')
            .or(`phieu_id.eq.${phieuId},ma_phieu.eq.${currentKiemKhoMaPhieu}`);

        const quetLogMap = new Map();
        if (quetLogData && quetLogData.length > 0) {
            quetLogData.forEach(log => {
                const key = `${log.ma_vach}_${log.lot || '-'}`;
                if (!quetLogMap.has(key)) {
                    quetLogMap.set(key, {
                        ma_vach: log.ma_vach,
                        ten_hang_hoa: log.ten_hang_hoa,
                        lot: log.lot || '-',
                        date_expiry: log.date_expiry || '-',
                        so_luong_thuc_te: 0,
                        scanners: [],
                        time_scanned: log.created_at
                    });
                }
                const entry = quetLogMap.get(key);
                entry.so_luong_thuc_te += Number(log.so_luong || 1);
                addKiemKhoItemScanner(entry, log.user_name, log.branch);
                if (log.created_at > entry.time_scanned) entry.time_scanned = log.created_at;
            });

            quetLogMap.forEach((entry, key) => {
                if (kiemKhoItemsMap.has(key)) {
                    const existing = kiemKhoItemsMap.get(key);
                    existing.so_luong_thuc_te = entry.so_luong_thuc_te;
                    existing.chenh_lech = existing.so_luong_thuc_te - existing.so_luong_he_thong;
                    existing.trang_thai = getKiemKhoStatus(existing.so_luong_thuc_te, existing.so_luong_he_thong);
                    entry.scanners.forEach(s => addKiemKhoItemScanner(existing, s.user_name, s.branch));
                } else {
                    const systemQty = getSystemQtyForBranch(entry.ma_vach, entry.ma_vach, kiemKhoSelectedBranch, entry.lot);
                    kiemKhoItemsMap.set(key, {
                        key,
                        ma_vach: entry.ma_vach,
                        ten_hang_hoa: entry.ten_hang_hoa || '',
                        lot: entry.lot,
                        date_expiry: entry.date_expiry,
                        so_luong_thuc_te: entry.so_luong_thuc_te,
                        so_luong_he_thong: systemQty,
                        chenh_lech: entry.so_luong_thuc_te - systemQty,
                        trang_thai: getKiemKhoStatus(entry.so_luong_thuc_te, systemQty),
                        user_name: JSON.stringify(entry.scanners),
                        branch: kiemKhoSelectedBranch,
                        scanners: entry.scanners,
                        time_scanned: entry.time_scanned || new Date().toISOString(),
                        is_synced: true,
                        is_system_qty_changed: false
                    });
                }
            });
        }

        // Clean up items in kiemKhoItemsMap that are no longer in DB scan logs quetLogData
        kiemKhoItemsMap.forEach((item, key) => {
            if (!quetLogMap.has(key)) {
                if (item.so_luong_he_thong === 0 || item.is_unmatched || (item.ten_hang_hoa && item.ten_hang_hoa.includes('Không có trong danh mục'))) {
                    kiemKhoItemsMap.delete(key);
                } else {
                    item.so_luong_thuc_te = 0;
                    item.chenh_lech = 0 - item.so_luong_he_thong;
                    item.trang_thai = getKiemKhoStatus(0, item.so_luong_he_thong);
                    item.scanners = [];
                }
            }
        });

        let totalScans = 0;
        kiemKhoItemsMap.forEach(it => {
            totalScans += (it.so_luong_thuc_te || 0);
        });
        kiemKhoTotalScans = totalScans;

        renderKiemKhoTable();
    } catch (e) {
        console.warn("syncActiveKiemKhoTicketFromDB error:", e);
    }
}

// Verify active ticket existence on DB
async function verifyKiemKhoSessionExistence() {
    if (!currentKiemKhoMaPhieu) return;
    const client = getVatTuSupabaseClient();
    if (!client) return;

    try {
        const { data: existingHeader } = await client
            .from('kiem_kho')
            .select('id')
            .eq('ma_phieu', currentKiemKhoMaPhieu)
            .maybeSingle();

        if (!existingHeader) {
            console.log("KiemKho: Ticket no longer exists on DB, clearing local cache.");
            kiemKhoItemsMap.clear();
            kiemKhoTotalScans = 0;
            currentKiemKhoPhieuId = null;
            currentKiemKhoMaPhieu = null;
            localStorage.removeItem("gaia_active_kiemkho_session");
            setKiemKhoBranchSelectDisabled(false);
            updateKiemKhoPhieuDisplay();
            renderKiemKhoTable();
        }
    } catch (e) {
        console.warn("verifyKiemKhoSessionExistence error:", e);
    }
}

// Setup Mã Phiếu Input: load old phiếu on Enter
function setupKiemKhoPhieuInput() {
    const input = document.getElementById('kiemkho-phieu-input');
    if (!input) return;
    input.addEventListener('keydown', async function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = input.value.trim().toUpperCase();
            if (!val) return;
            await loadKiemKhoPhieuByCode(val);
        }
    });
}

// Update phiếu input and display
function updateKiemKhoPhieuDisplay() {
    const input = document.getElementById('kiemkho-phieu-input');
    if (input) {
        input.value = currentKiemKhoMaPhieu || '';
    }
    const canBangDisplay = document.getElementById('canbang-phieu-display');
    if (canBangDisplay) {
        canBangDisplay.textContent = currentKiemKhoMaPhieu || '-- Chưa có phiếu --';
    }
    showOrHideCanBangKhoSection();
}

// Show/Hide Sub-view Cân Bằng Kho (Only visible when an audit ticket exists)
function showOrHideCanBangKhoSection() {
    const subNavItem = document.getElementById('sidebar-sub-can-bang-kho') || document.querySelector('[data-view="can-bang-kho"]');
    if (subNavItem) {
        subNavItem.style.display = currentKiemKhoMaPhieu ? 'flex' : 'none';
    }
}

// Helper to Lock/Unlock Branch Selector
function setKiemKhoBranchSelectDisabled(disabled) {
    const branchSelect = document.getElementById('kiemkho-filter-branch');
    if (!branchSelect) return;
    branchSelect.disabled = disabled;
    if (disabled) {
        branchSelect.style.opacity = '0.6';
        branchSelect.style.cursor = 'not-allowed';
        branchSelect.title = 'Chi nhánh đã cố định theo phiếu kiểm kho này.';
    } else {
        branchSelect.style.opacity = '1';
        branchSelect.style.cursor = 'pointer';
        branchSelect.title = 'Chọn chi nhánh kiểm kho';
    }
}

// Toast Notification Helper for Audit Module (Slide-in Notifications)
function showKiemKhoToast(type, title, message) {
    if (typeof window.showToast === 'function') {
        window.showToast(type, title, message);
    } else if (typeof showToast === 'function') {
        showToast(type, title, message);
    } else if (typeof showVatTuNoticeModalWindow === 'function') {
        showVatTuNoticeModalWindow(type, title, message);
    }
}

// Inline Error Indicator Helper for Mã Phiếu Input Box
function setKiemKhoPhieuError(errorMsg) {
    const errBox = document.getElementById('kiemkho-phieu-error-msg');
    const phieuBox = document.getElementById('kiemkho-phieu-box');
    const loadBtn = document.getElementById('btn-load-branch-kiemkho');

    if (errorMsg) {
        if (errBox) {
            errBox.innerHTML = errorMsg;
            errBox.style.display = 'block';
        }
        if (phieuBox) {
            phieuBox.style.borderColor = '#ef4444';
            phieuBox.style.background = 'rgba(239, 68, 68, 0.12)';
        }
        if (loadBtn) {
            loadBtn.disabled = true;
            loadBtn.style.opacity = '0.5';
            loadBtn.style.cursor = 'not-allowed';
            loadBtn.title = 'Mã phiếu bị trùng trên CSDL, không thể nạp!';
        }
    } else {
        if (errBox) {
            errBox.innerHTML = '';
            errBox.style.display = 'none';
        }
        if (phieuBox) {
            phieuBox.style.borderColor = 'rgba(56, 189, 248, 0.4)';
            phieuBox.style.background = 'rgba(56, 189, 248, 0.10)';
        }
        if (loadBtn) {
            loadBtn.disabled = false;
            loadBtn.style.opacity = '1';
            loadBtn.style.cursor = 'pointer';
            loadBtn.title = 'Nạp toàn bộ tồn kho chi nhánh';
        }
    }
}

// Create a brand-new phiếu (select branch first, then click + to generate code & lock branch select)
async function createNewKiemKhoPhieu() {
    const branchSelect = document.getElementById('kiemkho-filter-branch');
    if (branchSelect && branchSelect.style.display !== 'none' && branchSelect.value) {
        kiemKhoSelectedBranch = branchSelect.value;
    }
    if (!kiemKhoSelectedBranch || kiemKhoSelectedBranch === '') {
        kiemKhoSelectedBranch = getKiemKhoLoggedBranch() || 'CN1';
        if (branchSelect) branchSelect.value = kiemKhoSelectedBranch;
    }

    if (kiemKhoItemsMap.size > 0) {
        const confirmReset = await showKiemKhoConfirmModal(
            'Xác Nhận Tạo Phiếu Mới',
            'Tạo phiếu mới sẽ xóa toàn bộ dữ liệu kiểm kho trên màn hình hiện tại. Bạn có chắc chắn muốn tiếp tục?'
        );
        if (!confirmReset) return;
    }

    const newCode = await generateKiemKhoMaPhieu(kiemKhoSelectedBranch);

    // Check if duplicate in DB
    const client = getVatTuSupabaseClient();
    if (client) {
        const { data: existing } = await client.from('kiem_kho').select('id').eq('ma_phieu', newCode).maybeSingle();
        if (existing) {
            currentKiemKhoMaPhieu = newCode;
            currentKiemKhoPhieuId = existing.id;
            updateKiemKhoPhieuDisplay();
            setKiemKhoPhieuError(`❌ Mã phiếu <b>${newCode}</b> đã bị trùng trên CSDL! Không thể nạp.`);
            showKiemKhoToast(
                'error',
                'Mã Phiếu Trùng Lặp',
                `❌ Mã phiếu <b>${newCode}</b> đã tồn tại trên CSDL! Nhập mã cũ + Enter để tải, hoặc tạo mã khác.`
            );
            return;
        }
    }

    // Clear any previous error state
    setKiemKhoPhieuError(null);

    const loggedUser = window.getCurrentLoggedUser ? window.getCurrentLoggedUser() : null;
    const userName = loggedUser ? (loggedUser.name || loggedUser.user_name || 'Hệ thống') : 'Nhân viên';
    const userBranch = kiemKhoSelectedBranch || (loggedUser ? loggedUser.branch : 'CN1');

    // IMMEDIATELY INSERT HEADER RECORD INTO SUPABASE SO OTHER USERS CAN JOIN REALTIME!
    let newPhieuId = null;
    if (client) {
        const headerPayload = {
            ma_phieu: newCode,
            branch: userBranch,
            user_name: userName,
            tong_ma_quat: 0,
            tong_so_luong_quat: 0,
            so_ma_khop: 0,
            so_ma_du: 0,
            so_ma_thieu: 0,
            trang_thai: 'DANG_KIEM',
            created_at: new Date().toISOString()
        };
        const { data: inserted, error: insertErr } = await client.from('kiem_kho').insert([headerPayload]).select('id').single();
        if (!insertErr && inserted) {
            newPhieuId = inserted.id;
        }
    }

    kiemKhoItemsMap.clear();
    kiemKhoTotalScans = 0;
    canBangKhoMap.clear();
    kiemKhoColumnFilters = {};
    canBangColumnFilters = {};
    updateKiemKhoColumnFilterBadgesUI('all');
    currentKiemKhoPhieuId = newPhieuId;
    currentKiemKhoMaPhieu = newCode;
    kiemKhoCurrentPage = 1;
    kiemKhoSearchQuery = '';

    // Lock branch select after code is generated
    setKiemKhoBranchSelectDisabled(true);

    updateKiemKhoPhieuDisplay();
    renderKiemKhoTable();
    renderCanBangKhoTable();
    showKiemKhoToast('success', 'Đã Tạo Mã Phiếu Mới', `🎉 Đã tạo phiếu kiểm kho mới: <b>${currentKiemKhoMaPhieu}</b> (Realtime kết nối)`);
}

// Helper to check logged-in user's branch code and permissions
function getKiemKhoUserBranchCode() {
    let u = null;
    if (typeof window.getCurrentLoggedUser === 'function') {
        u = window.getCurrentLoggedUser();
    }
    if (!u) {
        try {
            const saved = localStorage.getItem("gaia_logged_user");
            if (saved) u = JSON.parse(saved);
        } catch (e) {}
    }
    if (!u && typeof currentUser !== 'undefined' && currentUser) {
        u = currentUser;
    }
    const rawB = u ? (u.branch || u.chi_nhanh || '') : '';
    let code = extractKiemKhoCNCode(rawB);

    // MANAGERS (quản lý) HAVE ALL-BRANCH PERMISSION EVERYWHERE!
    const isManager = (typeof window.isManagerRole === 'function') ? window.isManagerRole(u) : false;
    const roleLower = u ? String(u.role || '').toLowerCase().trim() : '';
    const isAllPermission = isManager || roleLower.includes('quản lý') || roleLower.includes('quan ly') || roleLower === 'manager' || (!rawB || rawB === 'all' || rawB.toLowerCase() === 'toàn hệ thống' || rawB.toLowerCase() === 'tất cả chi nhánh');

    return {
        raw: rawB,
        code: String(code || 'CN1').trim().toUpperCase(),
        isAllPermission: isAllPermission
    };
}

// Load old phiếu kiểm kho by mã phiếu
async function loadKiemKhoPhieuByCode(maPhieu) {
    const client = getVatTuSupabaseClient();
    if (!client) return;

    showVatTuLoading(true);
    try {
        const { data: phieuData, error: phieuErr } = await client
            .from('kiem_kho')
            .select('*')
            .eq('ma_phieu', maPhieu)
            .maybeSingle();

        if (phieuErr || !phieuData) {
            showKiemKhoToast('warning', 'Không Tìm Thấy Phiếu', `⚠️ Không tìm thấy phiếu kiểm kho mã <b>${maPhieu}</b> trên cơ sở dữ liệu!`);
            showVatTuLoading(false);
            return;
        }

        // Branch Permission Check: Deny if ticket branch doesn't match user's branch!
        const userBranchObj = getKiemKhoUserBranchCode();
        if (!userBranchObj.isAllPermission && userBranchObj.code) {
            let phieuBranchCode = phieuData.branch || '';
            if (typeof window.extractCNCodeFromBranchString === 'function') {
                phieuBranchCode = window.extractCNCodeFromBranchString(phieuBranchCode) || phieuBranchCode;
            } else if (typeof window.extractCNCode === 'function') {
                phieuBranchCode = window.extractCNCode(phieuBranchCode) || phieuBranchCode;
            }
            phieuBranchCode = String(phieuBranchCode).trim().toUpperCase();

            if (phieuBranchCode && phieuBranchCode !== 'ALL' && phieuBranchCode !== 'TOÀN HỆ THỐNG' && phieuBranchCode !== 'TẤT CẢ CHI NHÁNH') {
                if (userBranchObj.code !== phieuBranchCode) {
                    showVatTuLoading(false);
                    showKiemKhoToast(
                        'error',
                        'Khác Chi Nhánh',
                        `❌ Tài khoản của bạn thuộc chi nhánh <b>${userBranchObj.raw || userBranchObj.code}</b>, không được quyền mở hoặc sửa phiếu kiểm kho của <b>${phieuData.branch}</b>!`
                    );
                    return;
                }
            }
        }

        // Clear error text if loading old phiếu successfully
        setKiemKhoPhieuError(null);

        // Load into map & reset all filters/pagination
        kiemKhoItemsMap.clear();
        kiemKhoTotalScans = 0;
        canBangKhoMap.clear();
        kiemKhoCurrentPage = 1;
        kiemKhoSearchQuery = '';
        const searchInput = document.getElementById('kiemkho-search-input');
        if (searchInput) searchInput.value = '';
        kiemKhoColumnFilters = {};
        canBangColumnFilters = {};
        updateKiemKhoColumnFilterBadgesUI('all');
        currentKiemKhoPhieuId = phieuData.id;
        currentKiemKhoMaPhieu = maPhieu;
        kiemKhoSelectedBranch = phieuData.branch || 'all';

        // 1. Try querying SQL View view_kiem_kho_tong_hop_chi_tiet
        let loadedFromView = false;
        try {
            const { data: viewData, error: viewErr } = await client
                .from('view_kiem_kho_tong_hop_chi_tiet')
                .select('*')
                .or(`phieu_id.eq.${phieuData.id},ma_phieu.eq.${maPhieu}`);

            if (!viewErr && viewData && viewData.length > 0) {
                viewData.forEach(row => {
                    const key = `${row.ma_vach}_${row.lot || '-'}`;
                    const defaultBr = phieuData.branch || kiemKhoSelectedBranch || 'CN1';
                    let scanners = [];
                    if (Array.isArray(row.scanners)) {
                        scanners = row.scanners.map(s => normalizeScanner(s.user_name || s.name, s.branch || defaultBr));
                    } else {
                        scanners = parseKiemKhoScanners(row.user_name || row.scanners, defaultBr, phieuData.user_name);
                    }
                    const primary = scanners[0] || normalizeScanner(phieuData.user_name || 'Nhân viên', defaultBr);

                    kiemKhoItemsMap.set(key, {
                        key,
                        ma_vach: row.ma_vach,
                        ten_hang_hoa: row.ten_hang_hoa || '',
                        lot: row.lot || '-',
                        date_expiry: row.date_expiry || '-',
                        so_luong_thuc_te: Number(row.so_luong_thuc_te || 0),
                        so_luong_he_thong: Number(row.so_luong_he_thong || 0),
                        chenh_lech: Number(row.chenh_lech || 0),
                        trang_thai: row.trang_thai || getKiemKhoStatus(row.so_luong_thuc_te, row.so_luong_he_thong),
                        user_name: JSON.stringify(scanners),
                        branch: primary.branch || kiemKhoSelectedBranch,
                        scanners: scanners,
                        time_scanned: row.thoi_gian_quat || new Date().toISOString(),
                        is_synced: true,
                        is_system_qty_changed: false
                    });
                    if (Number(row.so_luong_thuc_te || 0) > 0) kiemKhoTotalScans += Number(row.so_luong_thuc_te);
                });
                loadedFromView = true;
            }
        } catch (e) {
            console.warn("SQL View query fallback:", e);
        }

        // 2. Fallback if SQL view is not created yet
        if (!loadedFromView) {
            const { data: chiTietData } = await client
                .from('kiem_kho_chi_tiet')
                .select('*')
                .or(`phieu_id.eq.${phieuData.id},ma_phieu.eq.${maPhieu}`);

            (chiTietData || []).forEach(row => {
                const key = `${row.ma_vach}_${row.lot || '-'}`;
                const defaultBr = row.branch || phieuData.branch || kiemKhoSelectedBranch || 'CN1';
                const scanners = parseKiemKhoScanners(row.user_name, defaultBr, phieuData.user_name);
                const primary = scanners[0] || normalizeScanner(phieuData.user_name || 'Nhân viên', defaultBr);

                kiemKhoItemsMap.set(key, {
                    key,
                    ma_vach: row.ma_vach,
                    ten_hang_hoa: row.ten_hang_hoa || '',
                    lot: row.lot || '-',
                    date_expiry: row.date_expiry || '-',
                    so_luong_thuc_te: row.so_luong_thuc_te || 0,
                    so_luong_he_thong: row.so_luong_he_thong || 0,
                    chenh_lech: row.chenh_lech || 0,
                    trang_thai: row.trang_thai || 'THIEU',
                    user_name: row.user_name || phieuData.user_name || primary.user_name,
                    branch: row.branch || primary.branch || kiemKhoSelectedBranch,
                    scanners: scanners,
                    time_scanned: row.thoi_gian_quat || new Date().toISOString(),
                    is_synced: true,
                    is_system_qty_changed: false
                });
                if ((row.so_luong_thuc_te || 0) > 0) kiemKhoTotalScans += row.so_luong_thuc_te;
            });

            // Also fetch quet_chi_tiet scan logs to aggregate realtime atomic scan logs
            try {
                const { data: quetLogData } = await client
                    .from('quet_chi_tiet')
                    .select('*')
                    .or(`phieu_id.eq.${phieuData.id},ma_phieu.eq.${maPhieu}`);

                if (quetLogData && quetLogData.length > 0) {
                    const quetLogMap = new Map();
                    quetLogData.forEach(log => {
                        const key = `${log.ma_vach}_${log.lot || '-'}`;
                        if (!quetLogMap.has(key)) {
                            quetLogMap.set(key, {
                                ma_vach: log.ma_vach,
                                ten_hang_hoa: log.ten_hang_hoa,
                                lot: log.lot || '-',
                                date_expiry: log.date_expiry || '-',
                                so_luong_thuc_te: 0,
                                scanners: [],
                                time_scanned: log.created_at
                            });
                        }
                        const entry = quetLogMap.get(key);
                        entry.so_luong_thuc_te += Number(log.so_luong || 1);
                        addKiemKhoItemScanner(entry, log.user_name, log.branch);
                        if (log.created_at > entry.time_scanned) entry.time_scanned = log.created_at;
                    });

                    quetLogMap.forEach((entry, key) => {
                        if (kiemKhoItemsMap.has(key)) {
                            const existing = kiemKhoItemsMap.get(key);
                            existing.so_luong_thuc_te = entry.so_luong_thuc_te;
                            existing.chenh_lech = existing.so_luong_thuc_te - existing.so_luong_he_thong;
                            existing.trang_thai = getKiemKhoStatus(existing.so_luong_thuc_te, existing.so_luong_he_thong);
                            entry.scanners.forEach(s => addKiemKhoItemScanner(existing, s.user_name, s.branch));
                        } else {
                            const systemQty = getSystemQtyForBranch(entry.ma_vach, entry.ma_vach, phieuData.branch, entry.lot);
                            kiemKhoItemsMap.set(key, {
                                key,
                                ma_vach: entry.ma_vach,
                                ten_hang_hoa: entry.ten_hang_hoa || '',
                                lot: entry.lot,
                                date_expiry: entry.date_expiry,
                                so_luong_thuc_te: entry.so_luong_thuc_te,
                                so_luong_he_thong: systemQty,
                                chenh_lech: entry.so_luong_thuc_te - systemQty,
                                trang_thai: getKiemKhoStatus(entry.so_luong_thuc_te, systemQty),
                                user_name: JSON.stringify(entry.scanners),
                                branch: phieuData.branch || kiemKhoSelectedBranch,
                                scanners: entry.scanners,
                                time_scanned: entry.time_scanned || new Date().toISOString(),
                                is_synced: true,
                                is_system_qty_changed: false
                            });
                        }
                    });

                    kiemKhoTotalScans = 0;
                    kiemKhoItemsMap.forEach(it => {
                        kiemKhoTotalScans += (it.so_luong_thuc_te || 0);
                    });
                }
            } catch (e) {
                console.warn("Fetch quet_chi_tiet log error:", e);
            }
        }

        // Auto-fill and lock branch select dropdown based on loaded ticket
        let phieuBranch = phieuData.branch || 'all';
        if (typeof window.extractCNCodeFromBranchString === 'function') {
            phieuBranch = window.extractCNCodeFromBranchString(phieuBranch) || phieuBranch;
        } else if (typeof window.extractCNCode === 'function') {
            phieuBranch = window.extractCNCode(phieuBranch) || phieuBranch;
        }
        kiemKhoSelectedBranch = phieuBranch;

        const branchSelect = document.getElementById('kiemkho-filter-branch');
        if (branchSelect) {
            branchSelect.value = phieuBranch;
        }
        setKiemKhoBranchSelectDisabled(true);

        // Load Cân Bằng Kho (GPET Audit) data from DB
        canBangKhoMap.clear();
        try {
            const { data: canBangData } = await client
                .from('kiem_kho_can_bang')
                .select('*')
                .or(`phieu_id.eq.${phieuData.id},ma_phieu.eq.${maPhieu}`);

            if (canBangData && canBangData.length > 0) {
                canBangData.forEach(row => {
                    const key = (row.ma_vach || '').trim().toLowerCase();
                    if (key) {
                        canBangKhoMap.set(key, {
                            id: row.id,
                            ma_vach: row.ma_vach,
                            ten_hang_hoa: row.ten_hang_hoa || getProductNameByBarcode(row.ma_vach) || 'Mặt hàng chưa tên',
                            ton_gpet: Number(row.ton_gpet) || 0,
                            ton_kho: Number(row.ton_kho) || 0,
                            thuc_te: Number(row.thuc_te) || 0,
                            chenh_lech: Number(row.chenh_lech) || 0,
                            trang_thai: row.trang_thai || 'KHOP'
                        });
                    }
                });
            }
        } catch (e) {
            console.warn("Load kiem_kho_can_bang error:", e);
        }

        updateKiemKhoPhieuDisplay();
        renderKiemKhoTable();
        recalculateCanBangKhoData(false);
        showVatTuLoading(false);
        showKiemKhoToast('success', 'Đã Tải Phiếu Cũ Sửa', `✅ Đã tải thành công phiếu kiểm kho <b>${maPhieu}</b> (${phieuBranch}) với ${kiemKhoItemsMap.size} mã hàng để chỉnh sửa!`);
    } catch (err) {
        showVatTuLoading(false);
        console.error('loadKiemKhoPhieuByCode error:', err);
        showKiemKhoToast('error', 'Lỗi Tải Phiếu', `Không thể tải phiếu: ${err.message}`);
    }
}

// Local Storage Session Persistence Helpers
function saveKiemKhoLocalSession() {
    try {
        if (kiemKhoItemsMap.size === 0 && canBangKhoMap.size === 0 && !currentKiemKhoMaPhieu) {
            localStorage.removeItem("gaia_active_kiemkho_session");
            return;
        }
        const sessionData = {
            phieuId: currentKiemKhoPhieuId,
            maPhieu: currentKiemKhoMaPhieu,
            branch: kiemKhoSelectedBranch,
            totalScans: kiemKhoTotalScans,
            items: Array.from(kiemKhoItemsMap.entries()),
            canBangItems: Array.from(canBangKhoMap.entries()),
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem("gaia_active_kiemkho_session", JSON.stringify(sessionData));
    } catch (e) {
        console.warn("Save local kiemkho session error:", e);
    }
}

function restoreKiemKhoLocalSession() {
    try {
        const saved = localStorage.getItem("gaia_active_kiemkho_session");
        if (!saved) return false;
        const sessionData = JSON.parse(saved);
        if (!sessionData) return false;

        currentKiemKhoPhieuId = sessionData.phieuId || null;
        currentKiemKhoMaPhieu = sessionData.maPhieu || null;
        kiemKhoSelectedBranch = sessionData.branch || 'all';
        kiemKhoTotalScans = sessionData.totalScans || 0;

        if (sessionData.items && Array.isArray(sessionData.items)) {
            kiemKhoItemsMap = new Map(sessionData.items);
        } else {
            kiemKhoItemsMap.clear();
        }

        if (sessionData.canBangItems && Array.isArray(sessionData.canBangItems)) {
            canBangKhoMap = new Map(sessionData.canBangItems);
        } else {
            canBangKhoMap.clear();
        }

        // Update branch select value if element exists
        const branchSelect = document.getElementById('kiemkho-filter-branch');
        if (branchSelect && kiemKhoSelectedBranch) {
            branchSelect.value = kiemKhoSelectedBranch;
        }

        return kiemKhoItemsMap.size > 0 || canBangKhoMap.size > 0 || !!currentKiemKhoMaPhieu;
    } catch (e) {
        console.warn("Restore local kiemkho session error:", e);
        return false;
    }
}

// Setup Branch Selector for Audit
async function initKiemKhoBranchSelect() {
    const branchSelect = document.getElementById('kiemkho-filter-branch');
    if (!branchSelect) return;

    const loggedUser = window.getCurrentLoggedUser ? window.getCurrentLoggedUser() : null;
    const isManager = window.isManagerRole ? window.isManagerRole(loggedUser) : false;
    const defaultBranch = getKiemKhoLoggedBranch() || 'CN1';

    if (!isManager && loggedUser && loggedUser.branch) {
        let userCN = loggedUser.branch;
        if (typeof window.extractCNCodeFromBranchString === 'function') {
            userCN = window.extractCNCodeFromBranchString(loggedUser.branch);
        } else if (typeof window.extractCNCode === 'function') {
            userCN = window.extractCNCode(loggedUser.branch);
        }
        kiemKhoSelectedBranch = userCN || defaultBranch;
        branchSelect.value = kiemKhoSelectedBranch;
        branchSelect.style.display = 'none';
    } else {
        // Manager Account: Always populate and show Branch Selector
        if (!kiemKhoSelectedBranch) {
            kiemKhoSelectedBranch = defaultBranch;
        }
        await populateKiemKhoBranchFilter(branchSelect);
        branchSelect.style.display = 'inline-block';
        branchSelect.removeEventListener('change', handleKiemKhoBranchChange);
        branchSelect.addEventListener('change', handleKiemKhoBranchChange);
    }
}

async function populateKiemKhoBranchFilter(branchSelect) {
    if (!branchSelect) return;

    let branches = [];
    if (window.getVatTuSupabaseClient) {
        const client = window.getVatTuSupabaseClient();
        if (client) {
            try {
                const { data } = await client.from('staff').select('branch');
                if (data && data.length > 0) {
                    data.forEach(s => {
                        if (s.branch && s.branch !== 'Toàn hệ thống') branches.push(s.branch.trim());
                    });
                }
            } catch (e) { }
        }
    }

    if (branches.length === 0) {
        branches = ['CN1 - Chi Nhánh TP.HCM', 'CN2 - Chi Nhánh Hà Nội'];
    }

    const uniqueBranches = Array.from(new Set(branches));
    const currentBranch = kiemKhoSelectedBranch || getKiemKhoLoggedBranch() || 'CN1';

    let html = `<option value="" disabled ${!currentBranch ? 'selected' : ''}>📍 -- Chọn Chi Nhánh --</option>`;
    html += `<option value="all" ${currentBranch === 'all' ? 'selected' : ''}>🏢 Tất cả chi nhánh</option>`;

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

        const isSelected = String(code).toUpperCase() === String(currentBranch).toUpperCase() ? 'selected' : '';
        html += `<option value="${code}" ${isSelected}>📍 ${escapeHtml(labelText)}</option>`;
    });

    branchSelect.innerHTML = html;
    if (currentBranch) {
        branchSelect.value = currentBranch;
        kiemKhoSelectedBranch = currentBranch;
    }
}

function handleKiemKhoBranchChange() {
    const branchSelect = document.getElementById('kiemkho-filter-branch');
    if (branchSelect) {
        kiemKhoSelectedBranch = branchSelect.value;
    }
}

// Setup Input Listener for Barcode / QR Scanner
function setupKiemKhoScanInput() {
    const input = document.getElementById('kiemkho-qr-input');
    if (!input) return;

    input.focus();

    // Keydown listener for Enter (Scanner sends Enter after barcode)
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const codeStr = input.value.trim();
            if (codeStr) {
                processKiemKhoScannedCode(codeStr);
                input.value = '';
            }
            input.focus();
        }
    });

    // Re-focus on click outside table
    document.addEventListener('click', function(e) {
        const kiemKhoView = document.getElementById('view-kiem-kho');
        if (kiemKhoView && kiemKhoView.classList.contains('active')) {
            const isClickInsideInput = input.contains(e.target);
            const isClickButton = e.target.closest('button, select, input, a');
            if (!isClickInsideInput && !isClickButton) {
                input.focus();
            }
        }
    });
}

function handleKiemKhoManualSubmit() {
    const input = document.getElementById('kiemkho-qr-input');
    if (!input) return;
    const codeStr = input.value.trim();
    if (codeStr) {
        processKiemKhoScannedCode(codeStr);
        input.value = '';
    }
    input.focus();
}

// Helper to Parse QR string: "MãVạch;LOT;Date"
function parseKiemKhoQrString(rawVal) {
    if (!rawVal) return { ma_vach: '', lot: '-', date_expiry: '-' };
    const cleanStr = String(rawVal).trim();
    const parts = cleanStr.split(';');

    const ma_vach = parts[0] ? parts[0].trim() : cleanStr;
    const lot = (parts[1] && parts[1].trim() !== '') ? parts[1].trim() : '-';
    let date_expiry = (parts[2] && parts[2].trim() !== '') ? formatDate(parts[2].trim()) : '-';

    return { ma_vach, lot, date_expiry };
}

// Helper to convert date strings safely to ISO format (YYYY-MM-DD)
function formatToIsoDateString(rawDate) {
    if (!rawDate || rawDate === '-' || rawDate === 'null') return null;
    const str = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const parts = str.split(/[\/\.-]/);
    if (parts.length === 3 && parts[2].length === 4) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2];
        return `${y}-${m}-${d}`;
    }
    return str;
}

// Ensure Active Ticket Header Exists in Supabase CSDL (kiem_kho table)
async function ensureActiveKiemKhoHeaderExists() {
    if (currentKiemKhoPhieuId) return currentKiemKhoPhieuId;

    const client = getVatTuSupabaseClient();
    if (!client) return null;

    if (!currentKiemKhoMaPhieu) {
        currentKiemKhoMaPhieu = await generateKiemKhoMaPhieu(kiemKhoSelectedBranch);
        updateKiemKhoPhieuDisplay();
    }

    try {
        const { data: existing } = await client.from('kiem_kho').select('id').eq('ma_phieu', currentKiemKhoMaPhieu).maybeSingle();
        if (existing) {
            currentKiemKhoPhieuId = existing.id;
            return currentKiemKhoPhieuId;
        }

        const loggedUser = window.getCurrentLoggedUser ? window.getCurrentLoggedUser() : null;
        const userName = loggedUser ? (loggedUser.name || loggedUser.user_name || 'Hệ thống') : 'Nhân viên';
        const userBranch = kiemKhoSelectedBranch || (loggedUser ? loggedUser.branch : 'CN1');

        const headerPayload = {
            ma_phieu: currentKiemKhoMaPhieu,
            branch: userBranch,
            user_name: userName,
            tong_ma_quat: 0,
            tong_so_luong_quat: 0,
            so_ma_khop: 0,
            so_ma_du: 0,
            so_ma_thieu: 0,
            trang_thai: 'DANG_KIEM',
            created_at: new Date().toISOString()
        };

        const { data: inserted, error: insertErr } = await client.from('kiem_kho').insert([headerPayload]).select('id').single();
        if (!insertErr && inserted) {
            currentKiemKhoPhieuId = inserted.id;
        }
    } catch (e) {
        console.warn("ensureActiveKiemKhoHeaderExists warning:", e);
    }
    return currentKiemKhoPhieuId;
}

// Append-Only Scan Log DB Writer (Ultra-fast insert, zero lock conflicts)
async function logScanToQuetChiTietDB(item, deltaQty = 1) {
    if (!item || !item.ma_vach) return;

    const phieuId = await ensureActiveKiemKhoHeaderExists();
    if (!currentKiemKhoMaPhieu) return;

    const client = getVatTuSupabaseClient();
    if (!client) return;

    const userName = getKiemKhoLoggedUserName();
    const userBranch = getKiemKhoLoggedBranch();
    const normLot = (item.lot && item.lot !== '-') ? item.lot : '-';
    const normDate = formatToIsoDateString(item.date_expiry);

    try {
        const { data, error } = await client.from('quet_chi_tiet').insert([{
            phieu_id: phieuId || null,
            ma_phieu: currentKiemKhoMaPhieu,
            ma_vach: item.ma_vach,
            ten_hang_hoa: item.ten_hang_hoa,
            lot: normLot,
            date_expiry: normDate,
            so_luong: deltaQty,
            user_name: userName,
            branch: userBranch
        }]);

        if (error) {
            console.error("❌ GAIA KiemKho: quet_chi_tiet INSERT Failed:", error.message || error);
        } else {
            console.log(`✅ GAIA KiemKho: quet_chi_tiet INSERT OK -> ${item.ma_vach} (+${deltaQty}) [Phieu: ${currentKiemKhoMaPhieu}]`);
        }
    } catch (e) {
        console.warn("logScanToQuetChiTietDB error:", e);
    }
}

// Core Barcode / QR Scanner Processing Logic
async function processKiemKhoScannedCode(codeStr) {
    if (!codeStr) return;

    // Ensure view_vattu_tong_hop data is loaded
    if (!window.vatTuData || !Array.isArray(window.vatTuData) || window.vatTuData.length === 0) {
        if (typeof window.fetchVatTuData === 'function') {
            await window.fetchVatTuData();
        }
    }

    kiemKhoTotalScans += 1;

    // 1. Tách chuỗi QR dạng "MãVạch;LOT;Date" (ví dụ: 300000000076;1111;20/11/2023)
    const parsed = parseKiemKhoQrString(codeStr);
    const maVach = parsed.ma_vach;
    let lot = parsed.lot;
    let dateExpiry = parsed.date_expiry;

    // 2. Tra cứu sản phẩm trong danh mục VatTu (vatTuData) bằng mã vạch vừa tách
    let foundVatTu = null;
    if (window.vatTuData && Array.isArray(window.vatTuData)) {
        foundVatTu = window.vatTuData.find(item => {
            const vachMatch = item.ma_vach && String(item.ma_vach).trim().toLowerCase() === maVach.toLowerCase();
            const qrMatch = item.ma_qr && String(item.ma_qr).trim().toLowerCase() === codeStr.toLowerCase();
            return vachMatch || qrMatch;
        });
    }

    // 3. Cảnh báo nếu không tìm thấy sản phẩm trong danh mục vật tư
    if (!foundVatTu) {
        showVatTuNoticeModal(
            'warning',
            'Không Tìm Thấy Sản Phẩm',
            `Mã vạch <b>${escapeHtml(maVach)}</b> từ mã QR vừa quét không có trong danh mục Vật Tư hệ thống!<br><br>` +
            `<i>Mặt hàng này vẫn sẽ được nạp vào bảng kiểm kho với tên "Không có trong danh mục vật tư".</i>`
        );
    }

    const ten_hang_hoa = foundVatTu ? 
        (foundVatTu.ten_mat_hang || foundVatTu.ten_hang_hoa || foundVatTu.ten_hoa_don || 'Mặt hàng chưa tên') : 
        `Không có trong danh mục vật tư (${maVach})`;

    if (lot === '-' && foundVatTu && foundVatTu.lot) {
        lot = foundVatTu.lot;
    }
    if (dateExpiry === '-' && foundVatTu && (foundVatTu.date_expiry || foundVatTu.han_su_dung)) {
        dateExpiry = foundVatTu.date_expiry || foundVatTu.han_su_dung;
    }

    const itemKey = `${maVach}_${lot}`;

    let existingItem = kiemKhoItemsMap.get(itemKey);

    if (existingItem) {
        // Scanned twice or more -> Increment +1
        existingItem.so_luong_thuc_te += 1;
        existingItem.chenh_lech = existingItem.so_luong_thuc_te - existingItem.so_luong_he_thong;
        existingItem.trang_thai = getKiemKhoStatus(existingItem.so_luong_thuc_te, existingItem.so_luong_he_thong);
        existingItem.time_scanned = new Date().toISOString();
        existingItem.is_synced = false;

        const userName = getKiemKhoLoggedUserName();
        const userBranch = getKiemKhoLoggedBranch();
        addKiemKhoItemScanner(existingItem, userName, userBranch);

        // Play Sound
        if (existingItem.trang_thai === 'DU') {
            playKiemKhoAudio('excess');
        } else if (existingItem.trang_thai === 'KHOP') {
            playKiemKhoAudio('match');
        } else {
            playKiemKhoAudio('scan');
        }
    } else {
        // New scanned item
        const userName = getKiemKhoLoggedUserName();
        const userBranch = getKiemKhoLoggedBranch();

        const systemQty = getSystemQtyForBranch(maVach, codeStr, kiemKhoSelectedBranch, lot);
        const scannedQty = 1;
        const chenhLech = scannedQty - systemQty;
        const trangThai = getKiemKhoStatus(scannedQty, systemQty);

        const initialScanners = [normalizeScanner(userName, userBranch)];

        const newItem = {
            key: itemKey,
            ma_vach: maVach,
            ten_hang_hoa: ten_hang_hoa,
            lot: lot,
            date_expiry: dateExpiry,
            so_luong_thuc_te: scannedQty,
            so_luong_he_thong: systemQty,
            chenh_lech: chenhLech,
            trang_thai: trangThai,
            user_name: JSON.stringify(initialScanners),
            branch: userBranch,
            scanners: initialScanners,
            time_scanned: new Date().toISOString(),
            is_synced: false
        };

        kiemKhoItemsMap.set(itemKey, newItem);

        // Play Sound
        if (trangThai === 'DU') {
            playKiemKhoAudio('excess');
        } else if (trangThai === 'KHOP') {
            playKiemKhoAudio('match');
        } else {
            playKiemKhoAudio('scan');
        }
    }

    renderKiemKhoTable();

    // Fast Append-Only Log Insert to Supabase DB (never locks rows or collides)
    const scannedItem = kiemKhoItemsMap.get(itemKey);
    if (scannedItem) {
        logScanToQuetChiTietDB(scannedItem, 1);
    }
}

// Get System Quantity from tonKhoDetailData or vatTuData for specific branch & LOT
function getSystemQtyForBranch(maVach, maQr, branch, lotFilter) {
    const queryVach = maVach ? String(maVach).trim().toLowerCase() : '';
    const queryQr = maQr ? String(maQr).trim().toLowerCase() : '';
    const queryLot = (lotFilter !== undefined && lotFilter !== null) ? String(lotFilter).trim().toLowerCase() : '';

    if (!queryVach && !queryQr) return 0;

    const isAll = !branch || branch === 'all' || branch.toLowerCase() === 'toàn hệ thống' || branch.toLowerCase() === 'tất cả chi nhánh';

    const isLotMatch = (recLot) => {
        if (!queryLot) return true;
        const rLot = recLot ? String(recLot).trim().toLowerCase() : '-';
        if (queryLot === '-' || queryLot === '' || queryLot === 'null' || queryLot === 'undefined') {
            return !recLot || rLot === '-' || rLot === '' || rLot === 'null' || rLot === 'undefined';
        }
        return rLot === queryLot;
    };

    // 1. Try to compute from window.tonKhoDetailData if available
    if (window.tonKhoDetailData && Array.isArray(window.tonKhoDetailData) && window.tonKhoDetailData.length > 0) {
        let matchingDetails = window.tonKhoDetailData.filter(d => {
            const dBarcode = d.ma_vach ? String(d.ma_vach).trim().toLowerCase() : '';
            const dQr = d.ma_qr ? String(d.ma_qr).trim().toLowerCase() : '';
            const codeMatch = (queryVach && dBarcode === queryVach) || (queryQr && dQr === queryQr);
            return codeMatch && isLotMatch(d.lot);
        });

        if (matchingDetails.length > 0) {
            if (isAll) {
                return matchingDetails.reduce((acc, r) => acc + (Number(r.ton_kho) || Number(r.ton_cuoi) || 0), 0);
            }

            let targetCN = (typeof window.extractCNCodeFromBranchString === 'function') ? 
                window.extractCNCodeFromBranchString(branch) : 
                ((typeof window.extractCNCode === 'function') ? window.extractCNCode(branch) : branch);

            const branchDetails = matchingDetails.filter(d => {
                let dCN = d.chi_nhanh || d.branch || '';
                let dCode = dCN;
                if (typeof window.extractCNCodeFromBranchString === 'function') {
                    dCode = window.extractCNCodeFromBranchString(dCN);
                } else if (typeof window.extractCNCode === 'function') {
                    dCode = window.extractCNCode(dCN);
                }
                return String(dCode).trim().toUpperCase() === String(targetCN).trim().toUpperCase() ||
                       String(dCN).trim().toUpperCase() === String(branch).trim().toUpperCase();
            });

            if (branchDetails.length > 0) {
                return branchDetails.reduce((acc, r) => acc + (Number(r.ton_kho) || Number(r.ton_cuoi) || 0), 0);
            }

            return 0;
        }
    }

    // 2. Try window.vatTuData (view_vattu_tong_hop / san_pham)
    if (window.vatTuData && Array.isArray(window.vatTuData) && window.vatTuData.length > 0) {
        let matched = window.vatTuData.filter(v => {
            const vCode = v.ma_vach ? String(v.ma_vach).trim().toLowerCase() : '';
            const vQr = v.ma_qr ? String(v.ma_qr).trim().toLowerCase() : '';
            const codeMatch = (queryVach && vCode === queryVach) || (queryQr && vQr === queryQr);
            return codeMatch && isLotMatch(v.lot);
        });

        if (matched.length > 0) {
            if (isAll) {
                return matched.reduce((acc, curr) => acc + (Number(curr.ton_cuoi ?? curr.ton_kho ?? curr.cuoi ?? 0)), 0);
            }

            let targetCN = (typeof window.extractCNCodeFromBranchString === 'function') ? 
                window.extractCNCodeFromBranchString(branch) : 
                ((typeof window.extractCNCode === 'function') ? window.extractCNCode(branch) : branch);

            const branchMatch = matched.find(item => {
                let itemCN = item.chi_nhanh || item.branch || '';
                let itemCode = itemCN;
                if (typeof window.extractCNCodeFromBranchString === 'function') {
                    itemCode = window.extractCNCodeFromBranchString(itemCN);
                } else if (typeof window.extractCNCode === 'function') {
                    itemCode = window.extractCNCode(itemCN);
                }
                return String(itemCode).trim().toUpperCase() === String(targetCN).trim().toUpperCase() ||
                       String(itemCN).trim().toUpperCase() === String(branch).trim().toUpperCase();
            });

            if (branchMatch) {
                return Number(branchMatch.ton_cuoi ?? branchMatch.ton_kho ?? branchMatch.cuoi ?? 0);
            }

            return 0;
        }
    }

    return 0;
}

// Status Evaluation
function getKiemKhoStatus(scannedQty, systemQty) {
    if (scannedQty === systemQty) return 'KHOP'; // Đủ
    if (scannedQty > systemQty) return 'DU';   // Dư
    return 'THIEU';                            // Thiếu
}

// Load All Branch Stock Items into Audit List (without overwriting code or clearing map)
async function loadAllBranchItemsToKiemKho() {
    const errBox = document.getElementById('kiemkho-phieu-error-msg');
    if (errBox && errBox.style.display !== 'none') {
        showKiemKhoToast('error', 'Mã Phiếu Trùng Lặp', '❌ Mã phiếu hiện tại bị trùng lặp trên CSDL hệ thống. Không thể nạp!');
        return;
    }

    const inputPhieu = document.getElementById('kiemkho-phieu-input');
    const inputVal = inputPhieu ? inputPhieu.value.trim().toUpperCase() : '';

    if (!currentKiemKhoMaPhieu && inputVal) {
        currentKiemKhoMaPhieu = inputVal;
    }

    if (!currentKiemKhoMaPhieu) {
        showKiemKhoToast('warning', 'Chưa Có Mã Phiếu', '⚠️ Vui lòng ấn nút (+) để tạo mã phiếu mới hoặc nhập mã cũ rồi Enter trước khi nạp dữ liệu!');
        return;
    }

    const branchSelect = document.getElementById('kiemkho-filter-branch');
    if (branchSelect && branchSelect.style.display !== 'none' && branchSelect.value) {
        kiemKhoSelectedBranch = branchSelect.value;
    }
    if (!kiemKhoSelectedBranch) {
        if (currentKiemKhoMaPhieu) {
            const match = currentKiemKhoMaPhieu.match(/^PKK-([A-Z0-9]+)-/i);
            if (match && match[1] && match[1].toUpperCase() !== 'ALL') {
                kiemKhoSelectedBranch = match[1].toUpperCase();
            }
        }
    }
    if (!kiemKhoSelectedBranch) {
        kiemKhoSelectedBranch = getKiemKhoLoggedBranch() || 'CN1';
    }
    if (branchSelect && kiemKhoSelectedBranch) {
        branchSelect.value = kiemKhoSelectedBranch;
    }

    // Branch Permission Check
    const userBranchObj = getKiemKhoUserBranchCode();
    if (!userBranchObj.isAllPermission && userBranchObj.code) {
        let selectedCode = kiemKhoSelectedBranch || '';
        if (typeof window.extractCNCodeFromBranchString === 'function') {
            selectedCode = window.extractCNCodeFromBranchString(selectedCode) || selectedCode;
        } else if (typeof window.extractCNCode === 'function') {
            selectedCode = window.extractCNCode(selectedCode) || selectedCode;
        }
        selectedCode = String(selectedCode).trim().toUpperCase();

        if (selectedCode && selectedCode !== 'ALL' && selectedCode !== 'TOÀN HỆ THỐNG' && selectedCode !== 'TẤT CẢ CHI NHÁNH') {
            if (userBranchObj.code !== selectedCode) {
                showKiemKhoToast(
                    'error',
                    'Khác Chi Nhánh',
                    `❌ Tài khoản thuộc chi nhánh <b>${userBranchObj.raw || userBranchObj.code}</b>, không được nạp dữ liệu kiểm kho cho <b>${kiemKhoSelectedBranch}</b>!`
                );
                return;
            }
        }
    }

    showVatTuLoading(true);

    try {
        if (!window.vatTuData || !Array.isArray(window.vatTuData) || window.vatTuData.length === 0) {
            if (typeof window.fetchVatTuData === 'function') {
                await window.fetchVatTuData();
            }
        }

        const userName = getKiemKhoLoggedUserName();
        const userBranch = getKiemKhoLoggedBranch();
        const selectedBranch = kiemKhoSelectedBranch || 'all';

        let targetCN = selectedBranch;
        if (typeof window.extractCNCodeFromBranchString === 'function') {
            targetCN = window.extractCNCodeFromBranchString(selectedBranch);
        } else if (typeof window.extractCNCode === 'function') {
            targetCN = window.extractCNCode(selectedBranch);
        }

        let addedCount = 0;
        let updatedCount = 0;
        const sourceData = (window.tonKhoDetailData && window.tonKhoDetailData.length > 0) ? window.tonKhoDetailData : (window.vatTuData || []);

        sourceData.forEach(item => {
            const maVach = item.ma_vach || item.ma_qr || '';
            if (!maVach) return;

            if (selectedBranch && selectedBranch !== 'all' && selectedBranch.toLowerCase() !== 'toàn hệ thống' && selectedBranch.toLowerCase() !== 'tất cả chi nhánh') {
                let itemCN = item.chi_nhanh || item.branch || '';
                let itemCode = itemCN;
                if (typeof window.extractCNCodeFromBranchString === 'function') {
                    itemCode = window.extractCNCodeFromBranchString(itemCN);
                } else if (typeof window.extractCNCode === 'function') {
                    itemCode = window.extractCNCode(itemCN);
                }
                const isBranchMatch = String(itemCode).trim().toUpperCase() === String(targetCN).trim().toUpperCase() ||
                                      String(itemCN).trim().toUpperCase() === String(selectedBranch).trim().toUpperCase();
                if (!isBranchMatch) return;
            }

            const lot = item.lot || '-';
            const dateExpiry = item.date_expiry || item.han_su_dung || '-';
            const tenHangHoa = item.ten_mat_hang || item.ten_hang_hoa || item.ten_hoa_don || 'Mặt hàng chưa tên';

            const systemQty = getSystemQtyForBranch(maVach, maVach, selectedBranch, lot);
            if (systemQty <= 0) return;

            const itemKey = `${maVach}_${lot}`;

            if (kiemKhoItemsMap.has(itemKey)) {
                // Refresh system stock & recalculate diff for existing item
                const existingItem = kiemKhoItemsMap.get(itemKey);
                existingItem.so_luong_he_thong = systemQty;
                existingItem.chenh_lech = existingItem.so_luong_thuc_te - systemQty;
                existingItem.trang_thai = getKiemKhoStatus(existingItem.so_luong_thuc_te, systemQty);
                updatedCount++;
            } else {
                // Add new branch item
                const initialScanners = [normalizeScanner(userName, userBranch)];
                kiemKhoItemsMap.set(itemKey, {
                    key: itemKey,
                    ma_vach: maVach,
                    ten_hang_hoa: tenHangHoa,
                    lot: lot,
                    date_expiry: dateExpiry,
                    so_luong_thuc_te: 0,
                    so_luong_he_thong: systemQty,
                    chenh_lech: 0 - systemQty,
                    trang_thai: getKiemKhoStatus(0, systemQty),
                    user_name: JSON.stringify(initialScanners),
                    branch: userBranch,
                    scanners: initialScanners,
                    time_scanned: new Date().toISOString(),
                    is_synced: true
                });
                addedCount++;
            }
        });

        // Lock branch selector after loading
        setKiemKhoBranchSelectDisabled(true);

        updateKiemKhoPhieuDisplay();
        renderKiemKhoTable();

        // Save Header and Details into Supabase directly if connected
        const client = getVatTuSupabaseClient();
        if (client && kiemKhoItemsMap.size > 0) {
            const maPhieu = currentKiemKhoMaPhieu;
            const items = Array.from(kiemKhoItemsMap.values());
            let matchCount = 0, excessCount = 0, missingCount = 0, totalScannedQty = 0;
            items.forEach(it => {
                totalScannedQty += it.so_luong_thuc_te;
                if (it.trang_thai === 'KHOP') matchCount++;
                else if (it.trang_thai === 'DU') excessCount++;
                else if (it.trang_thai === 'THIEU') missingCount++;
            });

            let phieuId = currentKiemKhoPhieuId;
            if (!phieuId) {
                const { data: existingPhieu } = await client
                    .from('kiem_kho')
                    .select('id')
                    .eq('ma_phieu', maPhieu)
                    .maybeSingle();
                if (existingPhieu) phieuId = existingPhieu.id;
            }

            const headerPayload = {
                ma_phieu: maPhieu,
                branch: selectedBranch,
                user_name: userName,
                tong_ma_quat: items.length,
                tong_so_luong_quat: totalScannedQty,
                so_ma_khop: matchCount,
                so_ma_du: excessCount,
                so_ma_thieu: missingCount,
                trang_thai: 'DANG_KIEM',
                updated_at: new Date().toISOString()
            };

            if (phieuId) {
                await client.from('kiem_kho').update(headerPayload).eq('id', phieuId);
                currentKiemKhoPhieuId = phieuId;
            } else {
                const { data: headerData, error: headerErr } = await client
                    .from('kiem_kho')
                    .insert([headerPayload])
                    .select();
                if (!headerErr && headerData && headerData[0]) {
                    currentKiemKhoPhieuId = headerData[0].id;
                }
            }

            if (currentKiemKhoPhieuId) {
                await client.from('kiem_kho_chi_tiet').delete().eq('phieu_id', currentKiemKhoPhieuId);

                const detailsPayload = items.map(it => ({
                    phieu_id: currentKiemKhoPhieuId,
                    ma_phieu: maPhieu,
                    ma_qr: it.ma_vach || null,
                    ma_vach: it.ma_vach || null,
                    ten_hang_hoa: it.ten_hang_hoa,
                    lot: (it.lot && it.lot !== '-') ? it.lot : null,
                    date_expiry: (it.date_expiry && it.date_expiry !== '-') ? it.date_expiry : null,
                    so_luong_thuc_te: it.so_luong_thuc_te,
                    so_luong_he_thong: it.so_luong_he_thong,
                    chenh_lech: it.chenh_lech,
                    trang_thai: it.trang_thai,
                    branch: selectedBranch,
                    user_name: it.user_name || JSON.stringify(it.scanners || [normalizeScanner(userName, userBranch)])
                }));

                await client.from('kiem_kho_chi_tiet').insert(detailsPayload);
            }
        }

        showVatTuLoading(false);
        showKiemKhoToast(
            'success',
            'Nạp Dữ Liệu Thành Công',
            `✅ Đã nạp / cập nhật thành công ${kiemKhoItemsMap.size} mặt hàng cho phiếu <b>${currentKiemKhoMaPhieu}</b>!`
        );
    } catch (e) {
        showVatTuLoading(false);
        console.error("loadAllBranchItemsToKiemKho error:", e);
        showKiemKhoToast('error', 'Lỗi Nạp Dữ Liệu', `Có lỗi xảy ra: ${e.message}`);
    }
}

// Supabase Realtime Channel for Multi-User Collaborative Audit
let kiemKhoRealtimeChannel = null;

function setupKiemKhoRealtimeSubscription() {
    const client = getVatTuSupabaseClient();
    if (!client || kiemKhoRealtimeChannel) return;

    try {
        kiemKhoRealtimeChannel = client
            .channel('realtime-kiem-kho-all')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'quet_chi_tiet' }, (payload) => {
                handleQuetChiTietRealtimeChange(payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'kiem_kho_chi_tiet' }, (payload) => {
                handleKiemKhoChiTietRealtimeChange(payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'kiem_kho' }, (payload) => {
                handleKiemKhoHeaderRealtimeChange(payload);
            })
            .subscribe((status) => {
                console.log("GAIA KiemKho: Realtime channel subscription status:", status);
            });
    } catch (e) {
        console.warn("KiemKho: Realtime subscription warning:", e);
    }
}

function handleQuetChiTietRealtimeChange(payload) {
    if (!currentKiemKhoMaPhieu && !currentKiemKhoPhieuId) return;

    const eventType = payload.eventType; // 'INSERT', 'DELETE'
    const newRow = payload.new;
    const oldRow = payload.old;
    const row = newRow || oldRow;

    if (!row) return;

    const isSameTicket = (currentKiemKhoPhieuId && String(row.phieu_id) === String(currentKiemKhoPhieuId)) ||
                         (currentKiemKhoMaPhieu && String(row.ma_phieu).toUpperCase() === String(currentKiemKhoMaPhieu).toUpperCase());

    if (!isSameTicket) return;

    if (eventType === 'DELETE') {
        const deletedVach = oldRow ? oldRow.ma_vach : null;
        if (deletedVach) {
            const key = `${deletedVach}_${oldRow.lot || '-'}`;
            kiemKhoItemsMap.delete(key);
            renderKiemKhoTable();
        }
        if (typeof debouncedKiemKhoAutoReconcile === 'function') {
            debouncedKiemKhoAutoReconcile();
        }
        return;
    }

    if (eventType === 'INSERT') {
        const scannerName = newRow.user_name || 'Nhân viên';
        const scannerBranch = newRow.branch || 'CN1';
        const myName = getKiemKhoLoggedUserName();
        const myBranch = getKiemKhoLoggedBranch();

        // If event was generated by THIS logged-in user on THIS branch, ignore to avoid double counting (already updated optimistically in 0ms)
        if (scannerName.trim().toLowerCase() === myName.trim().toLowerCase() && 
            scannerBranch.trim().toLowerCase() === myBranch.trim().toLowerCase()) {
            return;
        }

        const maVach = newRow.ma_vach;
        if (!maVach) return;

        const lot = newRow.lot || '-';
        const key = `${maVach}_${lot}`;
        const addQty = Number(newRow.so_luong || 1);

        const existing = kiemKhoItemsMap.get(key);

        if (existing) {
            existing.so_luong_thuc_te += addQty;
            existing.chenh_lech = existing.so_luong_thuc_te - existing.so_luong_he_thong;
            existing.trang_thai = getKiemKhoStatus(existing.so_luong_thuc_te, existing.so_luong_he_thong);
            addKiemKhoItemScanner(existing, scannerName, scannerBranch);
        } else {
            const systemQty = getSystemQtyForBranch(maVach, maVach, kiemKhoSelectedBranch, lot);
            const chenhLech = addQty - systemQty;
            const status = getKiemKhoStatus(addQty, systemQty);
            const initialScanners = [normalizeScanner(scannerName, scannerBranch)];

            kiemKhoItemsMap.set(key, {
                key: key,
                ma_vach: maVach,
                ten_hang_hoa: newRow.ten_hang_hoa || 'Mặt hàng chưa tên',
                lot: lot,
                date_expiry: newRow.date_expiry || '-',
                so_luong_thuc_te: addQty,
                so_luong_he_thong: systemQty,
                chenh_lech: chenhLech,
                trang_thai: status,
                scanners: initialScanners,
                user_name: JSON.stringify(initialScanners),
                branch: scannerBranch,
                time_scanned: newRow.created_at || new Date().toISOString(),
                is_synced: true
            });
        }

        let totalScans = 0;
        kiemKhoItemsMap.forEach(it => {
            totalScans += (it.so_luong_thuc_te || 0);
        });
        kiemKhoTotalScans = totalScans;

        debouncedRenderKiemKhoTable(100);
    } else if (eventType === 'DELETE') {
        const maVach = oldRow ? oldRow.ma_vach : null;
        if (!maVach) return;
        const lot = (oldRow && oldRow.lot) ? oldRow.lot : '-';
        const key = `${maVach}_${lot}`;
        const subQty = Number((oldRow && oldRow.so_luong) ? oldRow.so_luong : 1);

        if (kiemKhoItemsMap.has(key)) {
            const existing = kiemKhoItemsMap.get(key);
            existing.so_luong_thuc_te = Math.max(0, existing.so_luong_thuc_te - subQty);
            existing.chenh_lech = existing.so_luong_thuc_te - existing.so_luong_he_thong;
            existing.trang_thai = getKiemKhoStatus(existing.so_luong_thuc_te, existing.so_luong_he_thong);

            let totalScans = 0;
            kiemKhoItemsMap.forEach(it => {
                totalScans += (it.so_luong_thuc_te || 0);
            });
            kiemKhoTotalScans = totalScans;

            renderKiemKhoTable();
        }
    }
}

function handleKiemKhoChiTietRealtimeChange(payload) {
    if (!currentKiemKhoMaPhieu && !currentKiemKhoPhieuId) return;

    const eventType = payload.eventType; // 'INSERT', 'UPDATE', 'DELETE'
    const newRow = payload.new;
    const oldRow = payload.old;
    const row = newRow || oldRow;

    if (!row) return;

    // Only process events belonging to the current active audit ticket!
    const isSameTicket = (currentKiemKhoPhieuId && String(row.phieu_id) === String(currentKiemKhoPhieuId)) ||
                         (currentKiemKhoMaPhieu && String(row.ma_phieu).toUpperCase() === String(currentKiemKhoMaPhieu).toUpperCase());

    if (!isSameTicket) return;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const maVach = newRow.ma_vach || newRow.ma_qr;
        if (!maVach) return;

        const lot = newRow.lot || '-';
        const key = `${maVach}_${lot}`;

        const scannedQty = Number(newRow.so_luong_thuc_te || 0);
        const systemQty = Number(newRow.so_luong_he_thong || 0);
        const diff = Number(newRow.chenh_lech !== undefined ? newRow.chenh_lech : (scannedQty - systemQty));
        const status = newRow.trang_thai || getKiemKhoStatus(scannedQty, systemQty);

        const incomingScanners = parseKiemKhoScanners(newRow.user_name, newRow.branch);
        const existing = kiemKhoItemsMap.get(key);

        if (existing) {
            existing.so_luong_thuc_te = scannedQty;
            existing.so_luong_he_thong = systemQty;
            existing.chenh_lech = diff;
            existing.trang_thai = status;
            if (!existing.scanners) existing.scanners = parseKiemKhoScanners(existing.user_name, existing.branch);

            incomingScanners.forEach(s => {
                const exists = existing.scanners.some(es => 
                    es.user_name.toLowerCase() === s.user_name.toLowerCase() &&
                    es.branch.toLowerCase() === s.branch.toLowerCase()
                );
                if (!exists) existing.scanners.push(s);
            });
            existing.user_name = JSON.stringify(existing.scanners);
            if (newRow.branch) existing.branch = newRow.branch;
        } else {
            kiemKhoItemsMap.set(key, {
                key: key,
                ma_vach: maVach,
                ten_hang_hoa: newRow.ten_hang_hoa || 'Mặt hàng chưa tên',
                lot: lot,
                date_expiry: newRow.date_expiry || '-',
                so_luong_thuc_te: scannedQty,
                so_luong_he_thong: systemQty,
                chenh_lech: diff,
                trang_thai: status,
                scanners: incomingScanners,
                user_name: JSON.stringify(incomingScanners),
                branch: newRow.branch || kiemKhoSelectedBranch,
                time_scanned: newRow.created_at || new Date().toISOString(),
                is_synced: true
            });
        }

        let totalScans = 0;
        kiemKhoItemsMap.forEach(it => {
            totalScans += (it.so_luong_thuc_te || 0);
        });
        kiemKhoTotalScans = totalScans;

        renderKiemKhoTable();
    } else if (eventType === 'DELETE') {
        const maVach = oldRow ? oldRow.ma_vach : null;
        if (!maVach) return;
        const lot = (oldRow && oldRow.lot) ? oldRow.lot : '-';
        const key = `${maVach}_${lot}`;

        if (kiemKhoItemsMap.has(key)) {
            kiemKhoItemsMap.delete(key);

            let totalScans = 0;
            kiemKhoItemsMap.forEach(it => {
                totalScans += (it.so_luong_thuc_te || 0);
            });
            kiemKhoTotalScans = totalScans;

            renderKiemKhoTable();
        }
    }
}

function handleKiemKhoHeaderRealtimeChange(payload) {
    if (!currentKiemKhoMaPhieu) return;

    const eventType = payload.eventType; // 'INSERT', 'UPDATE', 'DELETE'
    const newRow = payload.new;
    const oldRow = payload.old;
    const row = newRow || oldRow;

    if (!row) return;

    if (String(row.ma_phieu).toUpperCase() === String(currentKiemKhoMaPhieu).toUpperCase()) {
        if (eventType === 'DELETE' || row.trang_thai === 'DA_HOAN_THANH') {
            if (eventType === 'DELETE') {
                showKiemKhoToast('warning', 'Phiếu Đã Bị Xóa', `⚠️ Phiếu kiểm <b>${row.ma_phieu}</b> đã bị xóa khỏi CSDL!`);
            } else {
                showKiemKhoToast('info', 'Phiếu Đã Hoàn Thành', `🎉 Phiếu kiểm <b>${row.ma_phieu}</b> đã được hoàn tất và lưu bởi ${row.user_name || 'đồng nghiệp'}!`);
            }
            kiemKhoItemsMap.clear();
            kiemKhoTotalScans = 0;
            currentKiemKhoPhieuId = null;
            currentKiemKhoMaPhieu = null;
            localStorage.removeItem("gaia_active_kiemkho_session");
            setKiemKhoBranchSelectDisabled(false);
            updateKiemKhoPhieuDisplay();
            renderKiemKhoTable();
        }
    }
}

// Synchronize Single Item Change & Header Totals to Supabase Database in Real-Time
async function syncKiemKhoItemToDB(item) {
    if (!currentKiemKhoPhieuId) return;

    const client = getVatTuSupabaseClient();
    if (!client) return;

    try {
        const normLot = (item.lot && item.lot !== '-') ? item.lot : null;

        let query = client.from('kiem_kho_chi_tiet')
            .update({
                so_luong_thuc_te: item.so_luong_thuc_te,
                so_luong_he_thong: item.so_luong_he_thong,
                chenh_lech: item.chenh_lech,
                trang_thai: item.trang_thai,
                user_name: item.user_name || JSON.stringify(item.scanners || []),
                branch: item.branch || kiemKhoSelectedBranch
            })
            .eq('phieu_id', currentKiemKhoPhieuId)
            .eq('ma_vach', item.ma_vach);

        if (normLot) {
            query = query.eq('lot', normLot);
        } else {
            query = query.is('lot', null);
        }

        const { error, count } = await query;

        if (error || count === 0) {
            await client.from('kiem_kho_chi_tiet').insert([{
                phieu_id: currentKiemKhoPhieuId,
                ma_phieu: currentKiemKhoMaPhieu,
                ma_vach: item.ma_vach,
                ten_hang_hoa: item.ten_hang_hoa,
                lot: normLot,
                date_expiry: (item.date_expiry && item.date_expiry !== '-') ? item.date_expiry : null,
                so_luong_thuc_te: item.so_luong_thuc_te,
                so_luong_he_thong: item.so_luong_he_thong,
                chenh_lech: item.chenh_lech,
                trang_thai: item.trang_thai,
                branch: item.branch || kiemKhoSelectedBranch,
                user_name: item.user_name || JSON.stringify(item.scanners || [])
            }]);
        }

        // Update header totals in kiem_kho
        const items = Array.from(kiemKhoItemsMap.values());
        let matchCount = 0, excessCount = 0, missingCount = 0, totalScannedQty = 0;
        items.forEach(it => {
            totalScannedQty += it.so_luong_thuc_te;
            if (it.trang_thai === 'KHOP') matchCount++;
            else if (it.trang_thai === 'DU') excessCount++;
            else if (it.trang_thai === 'THIEU') missingCount++;
        });

        await client.from('kiem_kho')
            .update({
                tong_ma_quat: items.length,
                tong_so_luong_quat: totalScannedQty,
                so_ma_khop: matchCount,
                so_ma_du: excessCount,
                so_ma_thieu: missingCount
            })
            .eq('id', currentKiemKhoPhieuId);

    } catch (err) {
        console.warn("syncKiemKhoItemToDB warning:", err);
    }
}

// Render Audit Table & Live Stats (with Search + Pagination)
function renderKiemKhoTable() {
    const tbody = document.getElementById('kiemkho-tbody');
    const emptyState = document.getElementById('kiemkho-empty-state');

    const totalScansEl = document.getElementById('kiemkho-stat-total-scans');
    const matchCountEl = document.getElementById('kiemkho-stat-match-count');
    const excessCountEl = document.getElementById('kiemkho-stat-excess-count');
    const missingCountEl = document.getElementById('kiemkho-stat-missing-count');
    const unscannedCountEl = document.getElementById('kiemkho-stat-unscanned-count');

    if (!tbody) return;

    const allItems = Array.from(kiemKhoItemsMap.values());

    if (totalScansEl) totalScansEl.textContent = kiemKhoTotalScans;

    let matchCount = 0, excessCount = 0, missingCount = 0, unscannedCount = 0;
    allItems.forEach(item => {
        if (item.so_luong_thuc_te === 0) unscannedCount++;
        if (item.trang_thai === 'KHOP') matchCount++;
        else if (item.trang_thai === 'DU') excessCount++;
        else if (item.trang_thai === 'THIEU') missingCount++;
    });

    if (matchCountEl) matchCountEl.textContent = matchCount;
    if (excessCountEl) excessCountEl.textContent = excessCount;
    if (missingCountEl) missingCountEl.textContent = missingCount;
    if (unscannedCountEl) unscannedCountEl.textContent = unscannedCount;

    // Update phiếu input display
    updateKiemKhoPhieuDisplay();

    // Persist active session state to localStorage
    saveKiemKhoLocalSession();

    // Auto-update Cân Bằng Kho (GPET Audit) table
    if (canBangKhoMap.size > 0) {
        recalculateCanBangKhoData(false);
    } else {
        renderCanBangKhoTable();
    }

    if (allItems.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        const resetBtn = document.getElementById('btn-reset-kiem-kho');
        if (resetBtn) resetBtn.style.display = 'inline-flex';
        renderKiemKhoPaginationControls(0, 1, 0, 0);
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Hide "Làm Mới" button as soon as scanning starts or data modified
    const resetBtn = document.getElementById('btn-reset-kiem-kho');
    if (resetBtn) {
        if (kiemKhoTotalScans > 0 || allItems.some(it => it.so_luong_thuc_te > 0)) {
            resetBtn.style.display = 'none';
        } else {
            resetBtn.style.display = 'inline-flex';
        }
    }

    // Apply search filter and active column filters
    const q = (kiemKhoSearchQuery || '').trim().toLowerCase();
    let filtered = q
        ? allItems.filter(item =>
            (item.ma_vach || '').toLowerCase().includes(q) ||
            (item.ten_hang_hoa || '').toLowerCase().includes(q) ||
            (item.lot || '').toLowerCase().includes(q)
          )
        : allItems;

    if (Object.keys(kiemKhoColumnFilters).length > 0) {
        filtered = filtered.filter(item => {
            for (const [colKey, selectedSet] of Object.entries(kiemKhoColumnFilters)) {
                if (!selectedSet || selectedSet.size === 0) continue;
                const valStr = getKiemKhoItemColValueStr(item, colKey);
                if (!selectedSet.has(valStr)) return false;
            }
            return true;
        });
    }

    // Pagination
    const pageSize = kiemKhoPageSize === Infinity ? (filtered.length || 1) : (kiemKhoPageSize || 25);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (kiemKhoCurrentPage > totalPages) kiemKhoCurrentPage = totalPages;
    const startIdx = (kiemKhoCurrentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, filtered.length);
    const pageItems = filtered.slice(startIdx, endIdx);

    renderKiemKhoPaginationControls(filtered.length, totalPages, startIdx, endIdx);

    let html = '';
    pageItems.forEach((item, idx) => {
        const globalIdx = startIdx + idx;
        let statusBadge = '';
        if (item.trang_thai === 'KHOP') {
            statusBadge = `<span style="color: #10b981; font-weight: 700; font-size: 13px;">✅ ĐỦ</span>`;
        } else if (item.trang_thai === 'DU') {
            statusBadge = `<span style="color: #f59e0b; font-weight: 700; font-size: 13px;">⚠️ DƯ</span>`;
        } else {
            statusBadge = `<span style="color: #ef4444; font-weight: 700; font-size: 13px;">🔵 THIẾU</span>`;
        }

        let systemQtyTd = `<td style="text-align: center; font-weight: 700; color: #94a3b8;">${item.so_luong_he_thong}</td>`;
        let trClass = 'vattu-table-row';

        if (item.is_system_qty_changed) {
            trClass += ' tr-system-changed';
            systemQtyTd = `
                <td style="text-align: center; font-weight: 800; background: rgba(239, 68, 68, 0.2); border: 2px solid #ef4444; color: #ef4444; border-radius: 6px; padding: 4px 6px;" title="Tồn hệ thống vừa biến động! Tồn cũ: ${item.old_so_luong_he_thong ?? '-'} ➔ Tồn mới: ${item.so_luong_he_thong}">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <span>⚠️ ${item.so_luong_he_thong}</span>
                        <button type="button" onclick="acknowledgeSystemStockChange('${encodeURIComponent(item.key)}')" 
                                style="background: rgba(16, 185, 129, 0.3); border: 1px solid #10b981; color: #10b981; border-radius: 6px; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 13px; font-weight: bold; transition: all 0.2s ease; animation: kiemkhoRedPulse 1.2s infinite;" 
                                title="Ấn dấu tick để xác nhận tồn hệ thống thay đổi mới nhất">
                            ✅
                        </button>
                    </div>
                    <span style="font-size: 10px; display: block; color: #ef4444; font-weight: 700; margin-top: 2px;">(Tồn thay đổi!)</span>
                </td>
            `;
        }

        const scanners = (item.scanners && Array.isArray(item.scanners) && item.scanners.length > 0) ? 
            item.scanners.map(s => normalizeScanner(s && (s.user_name || s.name || s), s && (s.branch || item.branch))) : 
            parseKiemKhoScanners(item.user_name || item.scanners, item.branch);

        let scannerTdHtml = '';
        if (scanners.length > 1) {
            scannerTdHtml = `
                <td>
                    <button type="button" class="btn-kiemkho-scanners-dropdown" 
                            onclick="toggleKiemKhoScannersPopover(event, '${item.key}')" 
                            title="Ấn để xem danh sách ${scanners.length} người tham gia quét mã này">
                        <span style="font-size:12px;">👥</span>
                        <span>Danh sách (${scanners.length})</span>
                        <span style="font-size:10px; opacity:0.8;">▾</span>
                    </button>
                </td>
            `;
        } else {
            const single = (scanners && scanners[0]) ? scanners[0] : normalizeScanner(item.user_name, item.branch);
            scannerTdHtml = `<td><span class="subrow-branch-badge">${escapeHtml(single.user_name)} - ${escapeHtml(single.branch)}</span></td>`;
        }

        html += `
            <tr class="${trClass}">
                <td style="text-align: center; color: #94a3b8;">${globalIdx + 1}</td>
                <td><strong style="color: var(--text-color);">${escapeHtml(item.ma_vach || '-')}</strong></td>
                <td><div class="cell-truncate-wrap" title="${escapeHtml(item.ten_hang_hoa)}"><span class="cell-truncate-text" style="font-weight: 600;">${escapeHtml(item.ten_hang_hoa)}</span></div></td>
                <td>${escapeHtml(item.lot || '-')}</td>
                <td>${escapeHtml(formatDate(item.date_expiry))}</td>
                <td style="text-align: center; font-size: 15px; font-weight: 800; color: #10b981;">
                    <input type="number" min="0" step="any" value="${item.so_luong_thuc_te}" onchange="updateKiemKhoItemQtyDirect('${item.key}', this.value)" style="width: 70px; text-align: center; font-weight: 800; font-size: 14px; background: rgba(0,0,0,0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #10b981; border-radius: 6px; padding: 4px 6px; outline: none;">
                </td>
                ${systemQtyTd}
                <td style="text-align: center; font-weight: 800; color: ${item.chenh_lech > 0 ? '#f59e0b' : (item.chenh_lech < 0 ? '#ef4444' : '#10b981')};">
                    ${item.chenh_lech > 0 ? `+${(typeof formatQuantity === 'function' ? formatQuantity(item.chenh_lech) : item.chenh_lech)}` : (typeof formatQuantity === 'function' ? formatQuantity(item.chenh_lech) : item.chenh_lech)}
                </td>
                <td style="text-align: center;">${statusBadge}</td>
                ${scannerTdHtml}
                <td style="white-space: nowrap;"><span style="font-size: 12px; color: #94a3b8;">${formatDateTime(item.time_scanned)}</span></td>
                <td style="text-align: center;">
                    ${(item.so_luong_he_thong === 0 || item.is_unmatched || (item.ten_hang_hoa && item.ten_hang_hoa.includes('Không có trong danh mục'))) ? `
                        <button type="button" onclick="deleteKiemKhoItem('${encodeURIComponent(item.key)}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px;" title="Xóa mã không có trong danh mục này khỏi phiếu">🗑️</button>
                    ` : ''}
                </td>
            </tr>
        `;
    });

    if (tbody.dataset.currentHtml !== html) {
        tbody.innerHTML = html;
        tbody.dataset.currentHtml = html;
    }
    updateKiemKhoColumnFilterBadgesUI('kiemkho');
}

// Change Page Size for Kiểm Kho
function changeKiemKhoPageSize(val) {
    kiemKhoPageSize = val === 'all' ? Infinity : (parseInt(val, 10) || 25);
    kiemKhoCurrentPage = 1;
    renderKiemKhoTable();
}

// Compatibility wrapper for the older Kiểm Kho pagination call name.
function renderKiemKhoPagination(totalFiltered, totalPages, startIdx = 0, endIdx = totalFiltered || 0) {
    renderKiemKhoPaginationControls(totalFiltered, Math.max(1, Number(totalPages) || 1), startIdx, endIdx);
}

// Old UI/HTML reference sometimes hit the typo-ish combined name directly.
function KhoPagnation(totalFiltered, totalPages, startIdx = 0, endIdx = totalFiltered || 0) {
    renderKiemKhoPaginationControls(totalFiltered, Math.max(1, Number(totalPages) || 1), startIdx, endIdx);
}

// Render Pagination Bar for Kiểm Kho (Matches View Vật Tư UX)
function renderKiemKhoPaginationControls(totalFiltered, totalPages, startIdx, endIdx) {
    const rangeTextEl = document.getElementById('kiemkho-page-range-text');
    const totalTextEl = document.getElementById('kiemkho-page-total-text');
    const btnsContainer = document.getElementById('kiemkho-page-btns-container');
    const paginationBar = document.getElementById('kiemkho-pagination-bar');

    if (!paginationBar) return;

    if (totalFiltered === 0) {
        paginationBar.style.display = 'none';
        if (rangeTextEl) rangeTextEl.textContent = '0 - 0';
        if (totalTextEl) totalTextEl.textContent = '0';
        if (btnsContainer) btnsContainer.innerHTML = '';
        return;
    }

    paginationBar.style.display = 'flex';
    if (rangeTextEl) rangeTextEl.textContent = `${startIdx + 1} - ${endIdx}`;
    if (totalTextEl) totalTextEl.textContent = totalFiltered.toLocaleString('vi-VN');

    if (!btnsContainer) return;
    btnsContainer.innerHTML = '';

    if (totalPages <= 1 && kiemKhoPageSize === Infinity) return;

    // Prev Button
    const btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.className = `vattu-page-btn ${kiemKhoCurrentPage <= 1 ? 'disabled' : ''}`;
    btnPrev.innerHTML = `&laquo; Trước`;
    btnPrev.disabled = kiemKhoCurrentPage <= 1;
    btnPrev.onclick = () => {
        if (kiemKhoCurrentPage > 1) {
            kiemKhoCurrentPage--;
            renderKiemKhoTable();
        }
    };
    btnsContainer.appendChild(btnPrev);

    // Page Number Buttons (Limit to max 5 page numbers around current)
    let startPage = Math.max(1, kiemKhoCurrentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let p = startPage; p <= endPage; p++) {
        const pageBtn = document.createElement('button');
        pageBtn.type = 'button';
        pageBtn.className = `vattu-page-btn ${p === kiemKhoCurrentPage ? 'active' : ''}`;
        pageBtn.textContent = p;
        pageBtn.onclick = () => {
            kiemKhoCurrentPage = p;
            renderKiemKhoTable();
        };
        btnsContainer.appendChild(pageBtn);
    }


    // Next Button
    const btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = `vattu-page-btn ${kiemKhoCurrentPage >= totalPages ? 'disabled' : ''}`;
    btnNext.innerHTML = `Sau &raquo;`;
    btnNext.disabled = kiemKhoCurrentPage >= totalPages;
    btnNext.onclick = () => {
        if (kiemKhoCurrentPage < totalPages) {
            kiemKhoCurrentPage++;
            renderKiemKhoTable();
        }
    };
    btnsContainer.appendChild(btnNext);
}

function kiemKhoGoPage(page) {
    const allItems = Array.from(kiemKhoItemsMap.values());
    const q = (kiemKhoSearchQuery || '').trim().toLowerCase();
    const filtered = q ? allItems.filter(item =>
        (item.ma_vach || '').toLowerCase().includes(q) ||
        (item.ten_hang_hoa || '').toLowerCase().includes(q) ||
        (item.lot || '').toLowerCase().includes(q)
    ) : allItems;
    const totalPages = Math.max(1, Math.ceil(filtered.length / KIEMKHO_PAGE_SIZE));
    kiemKhoCurrentPage = Math.max(1, Math.min(page, totalPages));
    renderKiemKhoTable();
}

function kiemKhoSearchFilter(query) {
    kiemKhoSearchQuery = query || '';
    kiemKhoCurrentPage = 1;
    renderKiemKhoTable();
}

// Directly Update Item Quantity via Input Field
function updateKiemKhoItemQtyDirect(key, rawVal) {
    const item = kiemKhoItemsMap.get(key);
    if (!item) return;
    const oldQty = Number(item.so_luong_thuc_te) || 0;
    const parsed = parseFloat(rawVal);
    const newQty = (isNaN(parsed) || parsed < 0) ? 0 : Math.round(parsed * 10000) / 10000;
    const delta = Math.round((newQty - oldQty) * 10000) / 10000;

    item.so_luong_thuc_te = newQty;
    item.chenh_lech = Math.round((item.so_luong_thuc_te - item.so_luong_he_thong) * 10000) / 10000;
    item.trang_thai = getKiemKhoStatus(item.so_luong_thuc_te, item.so_luong_he_thong);
    item.time_scanned = new Date().toISOString();
    item.is_synced = false;

    const userName = getKiemKhoLoggedUserName();
    const userBranch = getKiemKhoLoggedBranch();
    addKiemKhoItemScanner(item, userName, userBranch);

    renderKiemKhoTable();

    if (delta !== 0) {
        logScanToQuetChiTietDB(item, delta);
    }
}

// Adjust Quantity (+ / -) manually in table
function adjustKiemKhoItemQty(key, delta) {
    const item = kiemKhoItemsMap.get(key);
    if (!item) return;

    item.so_luong_thuc_te += delta;
    if (item.so_luong_thuc_te <= 0) {
        deleteKiemKhoItem(key);
        return;
    } else {
        item.chenh_lech = item.so_luong_thuc_te - item.so_luong_he_thong;
        item.trang_thai = getKiemKhoStatus(item.so_luong_thuc_te, item.so_luong_he_thong);
        item.is_synced = false;
    }

    const userName = getKiemKhoLoggedUserName();
    const userBranch = getKiemKhoLoggedBranch();
    addKiemKhoItemScanner(item, userName, userBranch);

    renderKiemKhoTable();

    logScanToQuetChiTietDB(item, delta);
}

// Acknowledge Live System Stock Change & Hide Tick Button
async function acknowledgeSystemStockChange(rawKey) {
    const key = decodeURIComponent(rawKey || '');
    const item = kiemKhoItemsMap.get(key);
    if (!item) return;

    item.is_system_qty_changed = false;
    delete item.old_so_luong_he_thong;

    // Sync updated status & discrepancies to Supabase DB
    await syncKiemKhoItemToDB(item);

    renderKiemKhoTable();

    if (typeof showKiemKhoToast === 'function') {
        showKiemKhoToast('success', 'Đã Xác Nhận Tồn Hệ Thống', `✅ Đã cập nhật tồn hệ thống mới (${item.so_luong_he_thong}) lên CSDL cho mã <b>${item.ma_vach}</b>!`);
    } else if (typeof showToast === 'function') {
        showToast('success', 'Đã Xác Nhận Tồn Hệ Thống', `✅ Đã cập nhật tồn hệ thống mới (${item.so_luong_he_thong}) cho mã "${item.ma_vach}"!`);
    }
}

// Delete Single Item from Audit List
async function deleteKiemKhoItem(rawKey) {
    const key = decodeURIComponent(rawKey || '');
    const item = kiemKhoItemsMap.get(key);
    if (!item) return;

    // Delete locally from memory immediately
    kiemKhoItemsMap.delete(key);
    renderKiemKhoTable();

    // Delete from BOTH tables in Supabase DB (quet_chi_tiet & kiem_kho_chi_tiet)
    if (currentKiemKhoPhieuId || currentKiemKhoMaPhieu) {
        const client = getVatTuSupabaseClient();
        if (client) {
            try {
                // 1. Delete from kiem_kho_chi_tiet (match ma_vach & ticket)
                let q1 = client.from('kiem_kho_chi_tiet').delete().eq('ma_vach', item.ma_vach);
                if (currentKiemKhoPhieuId) {
                    q1 = q1.eq('phieu_id', currentKiemKhoPhieuId);
                } else if (currentKiemKhoMaPhieu) {
                    q1 = q1.eq('ma_phieu', currentKiemKhoMaPhieu);
                }

                // 2. Delete from quet_chi_tiet (scan logs - match ma_vach & ticket)
                let q2 = client.from('quet_chi_tiet').delete().eq('ma_vach', item.ma_vach);
                if (currentKiemKhoPhieuId && currentKiemKhoMaPhieu) {
                    q2 = q2.or(`phieu_id.eq.${currentKiemKhoPhieuId},ma_phieu.eq.${currentKiemKhoMaPhieu}`);
                } else if (currentKiemKhoPhieuId) {
                    q2 = q2.eq('phieu_id', currentKiemKhoPhieuId);
                } else if (currentKiemKhoMaPhieu) {
                    q2 = q2.eq('ma_phieu', currentKiemKhoMaPhieu);
                }

                const [res1, res2] = await Promise.all([q1, q2]);
                console.log("GAIA KiemKho: Deleted item from DB:", { ma_vach: item.ma_vach, kiem_kho_chi_tiet: res1, quet_chi_tiet: res2 });

                // Ensure memory map stays deleted and re-render
                kiemKhoItemsMap.delete(key);
                renderKiemKhoTable();

                if (typeof showKiemKhoToast === 'function') {
                    showKiemKhoToast('success', 'Đã Xóa Mã Lạ', `✅ Đã xóa sạch mã "<b>${escapeHtml(item.ma_vach)}</b>" khỏi CSDL thành công!`);
                }
            } catch (err) {
                console.warn("deleteKiemKhoItem DB delete warning:", err);
            }
        }
    }
}

// Reset Audit Session & Clear Data
async function resetKiemKhoSession() {
    if (kiemKhoItemsMap.size === 0 && canBangKhoMap.size === 0 && !currentKiemKhoMaPhieu) return;

    const confirmed = await showKiemKhoConfirmModal(
        'Xác Nhận Làm Mới',
        'Bạn có chắc chắn muốn làm mới và xóa toàn bộ dữ liệu phiếu kiểm kho trên màn hình hiện tại?'
    );
    if (!confirmed) return;

    kiemKhoItemsMap.clear();
    canBangKhoMap.clear();
    kiemKhoColumnFilters = {};
    canBangColumnFilters = {};
    updateKiemKhoColumnFilterBadgesUI('all');
    kiemKhoTotalScans = 0;
    currentKiemKhoPhieuId = null;
    currentKiemKhoMaPhieu = null;

    localStorage.removeItem("gaia_active_kiemkho_session");

    // Unlock branch selector & reset value
    setKiemKhoBranchSelectDisabled(false);
    const defaultBranch = getKiemKhoLoggedBranch() || 'CN1';
    kiemKhoSelectedBranch = defaultBranch;
    const branchSelect = document.getElementById('kiemkho-filter-branch');
    if (branchSelect) branchSelect.value = defaultBranch;

    const inputPhieu = document.getElementById('kiemkho-phieu-input');
    if (inputPhieu) inputPhieu.value = '';

    updateKiemKhoPhieuDisplay();
    renderKiemKhoTable();
    renderCanBangKhoTable();

    if (typeof showKiemKhoToast === 'function') {
        showKiemKhoToast('info', 'Đã Làm Mới', '✅ Đã làm mới giao diện phiếu kiểm kho.');
    }
}

// Background Live Monitoring for System Stock Changes (Only updates existing items in the audit session)
async function checkKiemKhoLiveSystemQtyChanges() {
    const viewKiemKho = document.getElementById('view-kiem-kho');
    if (!viewKiemKho || (!viewKiemKho.classList.contains('active') && viewKiemKho.style.display === 'none')) return;
    if (kiemKhoItemsMap.size === 0) return;

    const allItems = Array.from(kiemKhoItemsMap.values());
    let hasStockChange = false;

    // Check existing items in audit session for live stock differences
    allItems.forEach(item => {
        const freshSystemQty = getSystemQtyForBranch(item.ma_vach, item.ma_vach, kiemKhoSelectedBranch, item.lot);
        if (item.so_luong_he_thong !== freshSystemQty) {
            item.so_luong_he_thong = freshSystemQty;
            item.chenh_lech = item.so_luong_thuc_te - freshSystemQty;
            item.trang_thai = getKiemKhoStatus(item.so_luong_thuc_te, freshSystemQty);
            item.is_system_qty_changed = true;
            hasStockChange = true;
            syncKiemKhoItemToDB(item);
        }
    });

    if (hasStockChange) {
        renderKiemKhoTable();
    }
}

// Save Audit Session to Supabase Database (`kiem_kho` and `kiem_kho_chi_tiet`)
async function saveKiemKhoSession() {
    const items = Array.from(kiemKhoItemsMap.values());
    if (items.length === 0 && canBangKhoMap.size === 0) {
        showKiemKhoToast('warning', 'Phiếu Kiểm Trống', '⚠️ Chưa có mã hàng nào được quét hoặc nhập để lưu phiếu kiểm!');
        return;
    }

    const client = getVatTuSupabaseClient();
    if (!client) {
        showKiemKhoToast('error', 'Lỗi Kết Nối', '❌ Không thể kết nối với cơ sở dữ liệu Supabase!');
        return;
    }

    const loggedUser = window.getCurrentLoggedUser ? window.getCurrentLoggedUser() : null;
    const userName = loggedUser ? (loggedUser.name || loggedUser.user_name || 'Hệ thống') : 'Nhân viên';
    let userBranch = loggedUser ? (loggedUser.branch || 'CN1') : 'CN1';

    if (kiemKhoSelectedBranch && kiemKhoSelectedBranch !== 'all') {
        userBranch = kiemKhoSelectedBranch;
    }

    if (!currentKiemKhoMaPhieu) {
        currentKiemKhoMaPhieu = await generateKiemKhoMaPhieu(userBranch);
    }
    const maPhieu = currentKiemKhoMaPhieu;
    updateKiemKhoPhieuDisplay();

    let matchCount = 0;
    let excessCount = 0;
    let missingCount = 0;
    let totalScannedQty = 0;

    items.forEach(item => {
        totalScannedQty += item.so_luong_thuc_te;
        if (item.trang_thai === 'KHOP') matchCount++;
        else if (item.trang_thai === 'DU') excessCount++;
        else if (item.trang_thai === 'THIEU') missingCount++;
    });

    showVatTuLoading(true);

    try {
        let phieuId = currentKiemKhoPhieuId;

        // Check if header already exists by ma_phieu if phieuId is not set
        if (!phieuId) {
            const { data: existingPhieu } = await client
                .from('kiem_kho')
                .select('id')
                .eq('ma_phieu', maPhieu)
                .maybeSingle();
            if (existingPhieu) {
                phieuId = existingPhieu.id;
                currentKiemKhoPhieuId = phieuId;
            }
        }

        const headerPayload = {
            ma_phieu: maPhieu,
            branch: userBranch,
            user_name: userName,
            tong_ma_quat: items.length,
            tong_so_luong_quat: totalScannedQty,
            so_ma_khop: matchCount,
            so_ma_du: excessCount,
            so_ma_thieu: missingCount,
            ghi_chu: `Kiểm kê kho thực tế tại ${userBranch}`
        };

        if (phieuId) {
            const { error: updateErr } = await client
                .from('kiem_kho')
                .update(headerPayload)
                .eq('id', phieuId);
            if (updateErr) throw updateErr;
        } else {
            const { data: headerData, error: headerErr } = await client
                .from('kiem_kho')
                .insert([headerPayload])
                .select();
            if (headerErr) throw headerErr;
            if (headerData && headerData[0]) {
                phieuId = headerData[0].id;
                currentKiemKhoPhieuId = phieuId;
            }
        }

        // Clean up old details for this phieu_id and insert latest details payload
        if (phieuId) {
            await client.from('kiem_kho_chi_tiet').delete().eq('phieu_id', phieuId);

            if (items.length > 0) {
                const detailsPayload = items.map(item => ({
                    phieu_id: phieuId,
                    ma_phieu: maPhieu,
                    ma_qr: item.ma_qr || item.ma_vach || null,
                    ma_vach: item.ma_vach || null,
                    ten_hang_hoa: item.ten_hang_hoa,
                    lot: (item.lot && item.lot !== '-') ? item.lot : null,
                    date_expiry: (item.date_expiry && item.date_expiry !== '-') ? item.date_expiry : null,
                    so_luong_thuc_te: item.so_luong_thuc_te,
                    so_luong_he_thong: item.so_luong_he_thong,
                    chenh_lech: item.chenh_lech,
                    trang_thai: item.trang_thai,
                    branch: userBranch,
                    user_name: item.user_name || JSON.stringify(item.scanners || [normalizeScanner(userName, userBranch)])
                }));

                const { error: detailErr } = await client
                    .from('kiem_kho_chi_tiet')
                    .insert(detailsPayload);

                if (detailErr) throw detailErr;
            }

            // Sync Cân Bằng Kho records
            if (canBangKhoMap.size > 0) {
                await syncCanBangKhoToDB();
            }
        }

        showVatTuLoading(false);

        showKiemKhoToast(
            'success',
            'Lưu Phiếu Kiểm Thành Công',
            `🎉 Đã lưu phiếu kiểm kho <b>${maPhieu}</b> (${items.length} mã quét, ${canBangKhoMap.size} mã cân bằng) tại chi nhánh <b>${userBranch}</b> thành công!`
        );

        // Reset session after successful save
        kiemKhoItemsMap.clear();
        canBangKhoMap.clear();
        kiemKhoTotalScans = 0;
        currentKiemKhoPhieuId = null;
        currentKiemKhoMaPhieu = null;
        localStorage.removeItem("gaia_active_kiemkho_session");
        updateKiemKhoPhieuDisplay();
        renderKiemKhoTable();
        renderCanBangKhoTable();

    } catch (err) {
        showVatTuLoading(false);
        console.error("KiemKho: Save error:", err);
        showKiemKhoToast('error', 'Lỗi Lưu Phiếu Kiểm', `Không thể lưu phiếu kiểm kho vào CSDL: ${err.message}`);
    }
}

// Export Current Audit List to Excel (.xlsx)
function exportKiemKhoToExcel() {
    const items = Array.from(kiemKhoItemsMap.values());
    if (items.length === 0) {
        showKiemKhoToast('warning', 'Bảng Dữ Liệu Trống', '⚠️ Chưa có mã hàng nào trong danh sách kiểm để xuất file Excel!');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showKiemKhoToast('warning', 'Chưa Sẵn Sàng', '⚠️ Thư viện SheetJS chưa sẵn sàng!');
        return;
    }

    try {
        const exportRows = items.map((item, idx) => {
            const scanners = (item.scanners && item.scanners.length > 0) ? item.scanners : parseKiemKhoScanners(item.user_name, item.branch);
            const scannerStr = scanners.map(s => `${s.user_name} - ${s.branch}`).join(', ');
            return {
                "STT": idx + 1,
                "Mã Vạch": item.ma_vach || '',
                "Tên Hàng Hóa": item.ten_hang_hoa || '',
                "LOT": item.lot || '',
                "Date": formatDate(item.date_expiry),
                "Số Lượng Thực Tế": item.so_luong_thuc_te,
                "Tồn Kho Hệ Thống": item.so_luong_he_thong,
                "Chênh Lệch": item.chenh_lech,
                "Trạng Thái": item.trang_thai === 'KHOP' ? 'ĐỦ (KHỚP)' : (item.trang_thai === 'DU' ? 'DƯ' : 'THIẾU'),
                "Người Quét - CN": scannerStr,
                "Thời Gian Quét": formatDateTime(item.time_scanned)
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportRows);

        const colWidths = [
            { wch: 6 },  // STT
            { wch: 18 }, // Mã Vạch
            { wch: 38 }, // Tên Hàng Hóa
            { wch: 14 }, // LOT
            { wch: 14 }, // Date
            { wch: 18 }, // Số Lượng Thực Tế
            { wch: 18 }, // Tồn Kho Hệ Thống
            { wch: 14 }, // Chênh Lệch
            { wch: 16 }, // Trạng Thái
            { wch: 28 }, // Người Quét - CN
            { wch: 20 }  // Thời Gian Quét
        ];
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Bao_Cao_Kiem_Kho");

        const todayStr = new Date().toISOString().split('T')[0];
        const fileName = `Bao_Cao_Kiem_Kho_GAIA_${todayStr}.xlsx`;

        downloadExcelWorkbook(workbook, fileName);
    } catch (err) {
        console.error("KiemKho: Export Excel Error:", err);
        showVatTuNoticeModal('error', 'Lỗi Xuất File Excel', 'Có lỗi xảy ra khi tạo file Excel: ' + err.message);
    }
}

// Global Window Exports
window.initKiemKhoView = initKiemKhoView;
window.handleKiemKhoManualSubmit = handleKiemKhoManualSubmit;
window.adjustKiemKhoItemQty = adjustKiemKhoItemQty;
window.updateKiemKhoItemQtyDirect = updateKiemKhoItemQtyDirect;
window.showKiemKhoConfirmModal = showKiemKhoConfirmModal;
window.deleteKiemKhoItem = deleteKiemKhoItem;
window.resetKiemKhoSession = resetKiemKhoSession;
window.saveKiemKhoSession = saveKiemKhoSession;
window.loadAllBranchItemsToKiemKho = loadAllBranchItemsToKiemKho;
window.acknowledgeSystemStockChange = acknowledgeSystemStockChange;
window.exportKiemKhoToExcel = exportKiemKhoToExcel;
window.kiemKhoGoPage = kiemKhoGoPage;
window.kiemKhoSearchFilter = kiemKhoSearchFilter;
window.loadKiemKhoPhieuByCode = loadKiemKhoPhieuByCode;
window.createNewKiemKhoPhieu = createNewKiemKhoPhieu;
window.toggleKiemKhoScannersPopover = toggleKiemKhoScannersPopover;
window.showKiemKhoItemScanLogsModal = showKiemKhoItemScanLogsModal;
window.closeKiemKhoItemLogsModal = closeKiemKhoItemLogsModal;
window.deleteSingleQuetChiTietLog = deleteSingleQuetChiTietLog;
window.changeKiemKhoPageSize = changeKiemKhoPageSize;
window.renderKiemKhoPagination = renderKiemKhoPagination;
window.renderKiemKhoPaginationControls = renderKiemKhoPaginationControls;
window.KhoPagnation = KhoPagnation;
window.clearAllKiemKhoFilters = clearAllKiemKhoFilters;

// Open AppSheet-Style Scan Logs Detail Modal
async function showKiemKhoItemScanLogsModal(rawKey) {
    const itemKey = decodeURIComponent(rawKey || '');
    const item = kiemKhoItemsMap.get(itemKey);
    if (!item) {
        console.warn("showKiemKhoItemScanLogsModal: Item not found for key:", itemKey);
        return;
    }

    const modal = document.getElementById('kiemkho-item-logs-modal');
    if (!modal) return;

    document.getElementById('kiemkho-modal-item-name').textContent = item.ten_hang_hoa || item.ma_vach;
    document.getElementById('kiemkho-modal-item-code').textContent = item.ma_vach || '-';
    document.getElementById('kiemkho-modal-item-lot').textContent = item.lot || '-';
    document.getElementById('kiemkho-modal-item-date').textContent = item.date_expiry || '-';
    document.getElementById('kiemkho-modal-item-total').textContent = item.so_luong_thuc_te || 0;

    const tbody = document.getElementById('kiemkho-item-logs-tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 24px; color: #94a3b8;">⏳ Đang tải nhật ký quét chi tiết...</td></tr>';
    }

    modal.style.display = 'flex';

    const client = getVatTuSupabaseClient();
    if (!client) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #ef4444;">Chưa kết nối CSDL Supabase.</td></tr>';
        return;
    }

    try {
        let query = client.from('quet_chi_tiet').select('*').eq('ma_vach', item.ma_vach);

        if (currentKiemKhoMaPhieu) {
            query = query.eq('ma_phieu', currentKiemKhoMaPhieu);
        }

        const normLot = (item.lot && item.lot !== '-') ? item.lot : '-';
        if (normLot !== '-') {
            query = query.eq('lot', normLot);
        }

        const { data: logs, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error("showKiemKhoItemScanLogsModal query error:", error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #ef4444;">Lỗi CSDL: ${escapeHtml(error.message || error)}</td></tr>`;
            return;
        }

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 24px; color: #94a3b8;">ℹ️ Chưa có phát quét nào cho mặt hàng này (tồn hệ thống ban đầu).</td></tr>';
            return;
        }

        let html = '';
        logs.forEach((log, idx) => {
            html += `
                <tr>
                    <td style="text-align: center; color: #94a3b8;">${idx + 1}</td>
                    <td><strong style="color: var(--text-color);">${escapeHtml(log.ma_vach)}</strong></td>
                    <td>${escapeHtml(log.lot || '-')}</td>
                    <td>${escapeHtml(log.date_expiry || '-')}</td>
                    <td style="text-align: center; font-weight: 800; color: #10b981;">+${log.so_luong || 1}</td>
                    <td><span class="subrow-branch-badge">${escapeHtml(log.user_name || 'Nhân viên')} - ${escapeHtml(log.branch || 'CN1')}</span></td>
                    <td style="white-space: nowrap;"><span style="font-size: 12px; color: #94a3b8;">${formatDateTime(log.created_at)}</span></td>
                    <td style="text-align: center;">
                        <button type="button" onclick="deleteSingleQuetChiTietLog(${log.id}, '${encodeURIComponent(itemKey)}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 15px;" title="Xóa duy nhất phát quét này">🗑️</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (e) {
        console.error("showKiemKhoItemScanLogsModal exception:", e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #ef4444;">Có lỗi xảy ra: ${escapeHtml(e.message || e)}</td></tr>`;
    }
}

function closeKiemKhoItemLogsModal() {
    const modal = document.getElementById('kiemkho-item-logs-modal');
    if (modal) modal.style.display = 'none';
}

async function deleteSingleQuetChiTietLog(logId, itemKey) {
    if (!confirm("Bạn có chắc chắn muốn xóa phát quét này khỏi cơ sở dữ liệu?")) return;
    const client = getVatTuSupabaseClient();
    if (!client) return;

    try {
        const { error } = await client.from('quet_chi_tiet').delete().eq('id', logId);
        if (!error) {
            showKiemKhoToast('success', 'Đã Xóa Phát Quét', '✅ Đã xóa phát quét thành công!');
            await showKiemKhoItemScanLogsModal(itemKey);
            await syncActiveKiemKhoTicketFromDB();
        } else {
            showKiemKhoToast('error', 'Lỗi Xóa Bản Ghi', 'Không thể xóa: ' + error.message);
        }
    } catch (e) {
        console.error("deleteSingleQuetChiTietLog error:", e);
    }
}

// Helper to look up master product name by barcode
function getProductNameByBarcode(barcode) {
    if (!barcode) return '';
    const rawCode = String(barcode).trim().toLowerCase();
    if (window.vatTuData && Array.isArray(window.vatTuData)) {
        const found = window.vatTuData.find(item => {
            const vCode = item.ma_vach ? String(item.ma_vach).trim().toLowerCase() : '';
            const qCode = item.ma_qr ? String(item.ma_qr).trim().toLowerCase() : '';
            return vCode === rawCode || qCode === rawCode;
        });
        if (found) {
            return found.ten_mat_hang || found.ten_hang_hoa || found.ten_hoa_don || '';
        }
    }
    return '';
}

// Calculate total system stock for a barcode across ALL LOTs for the specified branch
function getCanBangTotalSystemQty(barcode, branch) {
    if (!barcode) return 0;
    const rawBarcode = String(barcode).trim().toLowerCase();
    const isAll = !branch || branch === 'all' || branch.toLowerCase() === 'toàn hệ thống' || branch.toLowerCase() === 'tất cả chi nhánh';
    let targetCN = (typeof window.extractCNCodeFromBranchString === 'function') ? 
        window.extractCNCodeFromBranchString(branch) : 
        ((typeof window.extractCNCode === 'function') ? window.extractCNCode(branch) : branch);
    targetCN = targetCN ? String(targetCN).trim().toUpperCase() : '';

    let total = 0;
    let foundInDetail = false;

    if (window.tonKhoDetailData && Array.isArray(window.tonKhoDetailData) && window.tonKhoDetailData.length > 0) {
        const matching = window.tonKhoDetailData.filter(d => {
            const dVach = d.ma_vach ? String(d.ma_vach).trim().toLowerCase() : '';
            const dQr = d.ma_qr ? String(d.ma_qr).trim().toLowerCase() : '';
            return dVach === rawBarcode || dQr === rawBarcode;
        });

        if (matching.length > 0) {
            foundInDetail = true;
            if (isAll) {
                total = matching.reduce((sum, r) => sum + (Number(r.ton_kho) || Number(r.ton_cuoi) || 0), 0);
            } else {
                const branchMatching = matching.filter(d => {
                    let dCN = d.chi_nhanh || d.branch || '';
                    let dCode = dCN;
                    if (typeof window.extractCNCodeFromBranchString === 'function') {
                        dCode = window.extractCNCodeFromBranchString(dCN);
                    } else if (typeof window.extractCNCode === 'function') {
                        dCode = window.extractCNCode(dCN);
                    }
                    return String(dCode).trim().toUpperCase() === targetCN || String(dCN).trim().toUpperCase() === String(branch).trim().toUpperCase();
                });
                total = branchMatching.reduce((sum, r) => sum + (Number(r.ton_kho) || Number(r.ton_cuoi) || 0), 0);
            }
            return total;
        }
    }

    if (!foundInDetail && window.vatTuData && Array.isArray(window.vatTuData)) {
        const matchingVatTu = window.vatTuData.filter(v => {
            const vVach = v.ma_vach ? String(v.ma_vach).trim().toLowerCase() : '';
            const vQr = v.ma_qr ? String(v.ma_qr).trim().toLowerCase() : '';
            return vVach === rawBarcode || vQr === rawBarcode;
        });

        if (matchingVatTu.length > 0) {
            if (isAll) {
                total = matchingVatTu.reduce((sum, v) => sum + (Number(v.ton_cuoi ?? v.ton_kho ?? v.cuoi ?? 0)), 0);
            } else {
                const branchMatch = matchingVatTu.filter(item => {
                    let itemCN = item.chi_nhanh || item.branch || '';
                    let itemCode = itemCN;
                    if (typeof window.extractCNCodeFromBranchString === 'function') {
                        itemCode = window.extractCNCodeFromBranchString(itemCN);
                    } else if (typeof window.extractCNCode === 'function') {
                        itemCode = window.extractCNCode(itemCN);
                    }
                    return String(itemCode).trim().toUpperCase() === targetCN || String(itemCN).trim().toUpperCase() === String(branch).trim().toUpperCase();
                });
                if (branchMatch.length > 0) {
                    total = branchMatch.reduce((sum, v) => sum + (Number(v.ton_cuoi ?? v.ton_kho ?? v.cuoi ?? 0)), 0);
                } else if (typeof window.computeProductBranchStats === 'function') {
                    const stats = window.computeProductBranchStats(matchingVatTu[0]);
                    if (targetCN === 'CN1') total = Number(stats.cn1_ton || 0);
                    else if (targetCN === 'CN2') total = Number(stats.cn2_ton || 0);
                    else total = Number(stats.ton_cuoi || 0);
                }
            }
        }
    }

    return total;
}

// Calculate total actual scanned quantity across ALL LOTs in the current audit ticket
function getCanBangTotalActualScannedQty(barcode) {
    if (!barcode) return 0;
    const rawBarcode = String(barcode).trim().toLowerCase();
    let total = 0;
    kiemKhoItemsMap.forEach(item => {
        const itemVach = item.ma_vach ? String(item.ma_vach).trim().toLowerCase() : '';
        const itemQr = item.ma_qr ? String(item.ma_qr).trim().toLowerCase() : '';
        if (itemVach === rawBarcode || itemQr === rawBarcode) {
            total += Number(item.so_luong_thuc_te || 0);
        }
    });
    return total;
}

// Recalculate Cân Bằng Kho Data (aggregates ton_kho and thuc_te for all barcodes in map)
function recalculateCanBangKhoData(manualNotify = false) {
    const branch = kiemKhoSelectedBranch || 'CN1';

    canBangKhoMap.forEach(item => {
        item.ton_kho = getCanBangTotalSystemQty(item.ma_vach, branch);
        item.thuc_te = getCanBangTotalActualScannedQty(item.ma_vach);
        item.chenh_lech = item.thuc_te - (Number(item.ton_gpet) || 0);
        if (item.chenh_lech === 0) item.trang_thai = 'KHOP';
        else if (item.chenh_lech > 0) item.trang_thai = 'DU';
        else item.trang_thai = 'THIEU';
    });

    renderCanBangKhoTable();

    if (manualNotify) {
        showKiemKhoToast('info', 'Đã Tính Lại', `Đã đồng bộ lại dữ liệu Cân Bằng Kho (${canBangKhoMap.size} mặt hàng).`);
    }
}

// Render Cân Bằng Kho Table Rows & Stats Dashboard
function renderCanBangKhoTable() {
    const tbody = document.getElementById('canbang-tbody');
    const emptyState = document.getElementById('canbang-empty-state');
    const statTotal = document.getElementById('canbang-stat-total');
    const statMatch = document.getElementById('canbang-stat-match');
    const statExcess = document.getElementById('canbang-stat-excess');
    const statMissing = document.getElementById('canbang-stat-missing');
    const phieuInput = document.getElementById('canbang-phieu-input');

    if (phieuInput && currentKiemKhoMaPhieu && !phieuInput.value) {
        phieuInput.value = currentKiemKhoMaPhieu;
    }

    let matchCount = 0;
    let excessCount = 0;
    let missingCount = 0;

    canBangKhoMap.forEach(item => {
        if (item.trang_thai === 'KHOP') matchCount++;
        else if (item.trang_thai === 'DU') excessCount++;
        else if (item.trang_thai === 'THIEU') missingCount++;
    });

    if (statTotal) statTotal.textContent = canBangKhoMap.size;
    if (statMatch) statMatch.textContent = matchCount;
    if (statExcess) statExcess.textContent = excessCount;
    if (statMissing) statMissing.textContent = missingCount;

    if (!tbody) return;

    if (canBangKhoMap.size === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        renderCanBangPaginationControls(0, 0, 0, 0);
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    let items = Array.from(canBangKhoMap.values());
    if (canBangSearchQuery) {
        const q = canBangSearchQuery.toLowerCase().trim();
        items = items.filter(it => 
            (it.ma_vach || '').toLowerCase().includes(q) ||
            (it.ten_hang_hoa || '').toLowerCase().includes(q)
        );
    }
    if (Object.keys(canBangColumnFilters).length > 0) {
        items = items.filter(item => {
            for (const [colKey, selectedSet] of Object.entries(canBangColumnFilters)) {
                if (!selectedSet || selectedSet.size === 0) continue;
                const valStr = getCanBangItemColValueStr(item, colKey);
                if (!selectedSet.has(valStr)) return false;
            }
            return true;
        });
    }

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: #94a3b8;">Không tìm thấy mặt hàng nào khớp với bộ lọc</td></tr>`;
        renderCanBangPaginationControls(0, 0, 0, 0);
        return;
    }

    // Pagination for Cân Bằng Kho
    const pageSize = canBangPageSize === Infinity ? (items.length || 1) : (canBangPageSize || 25);
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    if (canBangCurrentPage > totalPages) canBangCurrentPage = totalPages;
    const startIdx = (canBangCurrentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, items.length);
    const pageItems = items.slice(startIdx, endIdx);

    renderCanBangPaginationControls(items.length, totalPages, startIdx, endIdx);

    let html = '';
    pageItems.forEach((item, idx) => {
        const globalIdx = startIdx + idx;
        const key = item.ma_vach.trim().toLowerCase();
        let badgeHtml = '';
        if (item.trang_thai === 'KHOP') {
            badgeHtml = '<span class="canbang-badge badge-canbang-match">✅ Khớp</span>';
        } else if (item.trang_thai === 'DU') {
            badgeHtml = `<span class="canbang-badge badge-canbang-excess">🔺 Dư (+${item.chenh_lech})</span>`;
        } else {
            badgeHtml = `<span class="canbang-badge badge-canbang-missing">🔻 Thiếu (${item.chenh_lech})</span>`;
        }

        let diffClass = 'cell-diff-zero';
        if (item.chenh_lech > 0) diffClass = 'cell-diff-pos';
        else if (item.chenh_lech < 0) diffClass = 'cell-diff-neg';

        html += `
            <tr>
                <td style="text-align: center; color: var(--text-muted, #94a3b8); font-size: 12px;">${globalIdx + 1}</td>
                <td><strong style="color: var(--text-primary, #f9fafb); font-family: monospace; font-size: 13px;">${escapeHtml(item.ma_vach)}</strong></td>
                <td><div class="cell-truncate-wrap" title="${escapeHtml(item.ten_hang_hoa)}"><span class="cell-truncate-text" style="font-weight: 600; font-size: 12.5px;">${escapeHtml(item.ten_hang_hoa || 'Chưa có tên')}</span></div></td>
                <td style="text-align: center;">
                    <input type="number" min="0" step="any" class="canbang-input-gpet" value="${item.ton_gpet !== undefined ? item.ton_gpet : 0}" onchange="handleCanBangGpetQtyChange('${encodeURIComponent(key)}', this.value)" />
                </td>
                <td style="text-align: center;" class="cell-qty-ton-kho">${typeof formatQuantity === 'function' ? formatQuantity(item.ton_kho) : item.ton_kho}</td>
                <td style="text-align: center;" class="cell-qty-thuc-te">${typeof formatQuantity === 'function' ? formatQuantity(item.thuc_te) : item.thuc_te}</td>
                <td style="text-align: center;" class="${diffClass}">${item.chenh_lech > 0 ? '+' : ''}${typeof formatQuantity === 'function' ? formatQuantity(item.chenh_lech) : item.chenh_lech}</td>
                <td style="text-align: center;">${badgeHtml}</td>
                <td style="text-align: center;">
                    <button type="button" onclick="deleteCanBangKhoRow('${encodeURIComponent(key)}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px; opacity: 0.8;" title="Xóa dòng này">🗑️</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    updateKiemKhoColumnFilterBadgesUI('canbang');
}

// Change Page Size for Cân Bằng Kho
function changeCanBangPageSize(val) {
    canBangPageSize = val === 'all' ? Infinity : (parseInt(val, 10) || 25);
    canBangCurrentPage = 1;
    renderCanBangKhoTable();
}

// Render Pagination Bar for Cân Bằng Kho (Matches View Vật Tư UX)
function renderCanBangPaginationControls(totalFiltered, totalPages, startIdx, endIdx) {
    const rangeTextEl = document.getElementById('canbang-page-range-text');
    const totalTextEl = document.getElementById('canbang-page-total-text');
    const btnsContainer = document.getElementById('canbang-page-btns-container');
    const paginationBar = document.getElementById('canbang-pagination-bar');

    if (!paginationBar) return;

    if (totalFiltered === 0) {
        paginationBar.style.display = 'none';
        if (rangeTextEl) rangeTextEl.textContent = '0 - 0';
        if (totalTextEl) totalTextEl.textContent = '0';
        if (btnsContainer) btnsContainer.innerHTML = '';
        return;
    }

    paginationBar.style.display = 'flex';
    if (rangeTextEl) rangeTextEl.textContent = `${startIdx + 1} - ${endIdx}`;
    if (totalTextEl) totalTextEl.textContent = totalFiltered.toLocaleString('vi-VN');

    if (!btnsContainer) return;
    btnsContainer.innerHTML = '';

    if (totalPages <= 1 && canBangPageSize === Infinity) return;

    // Prev Button
    const btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.className = `vattu-page-btn ${canBangCurrentPage <= 1 ? 'disabled' : ''}`;
    btnPrev.innerHTML = `&laquo; Trước`;
    btnPrev.disabled = canBangCurrentPage <= 1;
    btnPrev.onclick = () => {
        if (canBangCurrentPage > 1) {
            canBangCurrentPage--;
            renderCanBangKhoTable();
        }
    };
    btnsContainer.appendChild(btnPrev);

    // Page Number Buttons (Limit to max 5 page numbers around current)
    let startPage = Math.max(1, canBangCurrentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let p = startPage; p <= endPage; p++) {
        const pageBtn = document.createElement('button');
        pageBtn.type = 'button';
        pageBtn.className = `vattu-page-btn ${p === canBangCurrentPage ? 'active' : ''}`;
        pageBtn.textContent = p;
        pageBtn.onclick = () => {
            canBangCurrentPage = p;
            renderCanBangKhoTable();
        };
        btnsContainer.appendChild(pageBtn);
    }

    // Next Button
    const btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = `vattu-page-btn ${canBangCurrentPage >= totalPages ? 'disabled' : ''}`;
    btnNext.innerHTML = `Sau &raquo;`;
    btnNext.disabled = canBangCurrentPage >= totalPages;
    btnNext.onclick = () => {
        if (canBangCurrentPage < totalPages) {
            canBangCurrentPage++;
            renderCanBangKhoTable();
        }
    };
    btnsContainer.appendChild(btnNext);
}

// Initialize View "Cân Bằng Kho"
async function initCanBangKhoView() {
    if (!currentKiemKhoMaPhieu) {
        showKiemKhoToast('warning', 'Chưa Có Phiếu Kiểm', '⚠️ Vui lòng tạo hoặc tải một phiếu kiểm kho ở mục Kiểm Kho trước!');
        const kiemKhoNav = document.querySelector('[data-view="kiem-kho"]');
        if (kiemKhoNav) kiemKhoNav.click();
        return;
    }

    // Ensure vatTuData is available
    if (!window.vatTuData || !Array.isArray(window.vatTuData) || window.vatTuData.length === 0) {
        if (typeof window.fetchVatTuData === 'function') {
            await window.fetchVatTuData();
        }
    }

    // Initialize Column Resizing & Filter Badges for Cân Bằng Kho
    initKiemKhoColumnResizing();
    updateKiemKhoColumnFilterBadgesUI('canbang');

    const canBangDisplay = document.getElementById('canbang-phieu-display');
    if (canBangDisplay) {
        canBangDisplay.textContent = currentKiemKhoMaPhieu;
    }

    // Auto recalculate and render table
    recalculateCanBangKhoData(false);
}

// Save Cân Bằng Kho directly from Cân Bằng Kho view
async function saveCanBangKhoDataToDB() {
    if (canBangKhoMap.size === 0) {
        showKiemKhoToast('warning', 'Bảng Trống', 'Chưa có dữ liệu nào trong bảng Cân Bằng Kho để lưu!');
        return;
    }
    if (!currentKiemKhoMaPhieu) {
        showKiemKhoToast('warning', 'Chưa Có Mã Phiếu', 'Phiếu kiểm kho chưa có mã. Vui lòng tạo hoặc tải một phiếu kiểm kho trước khi lưu!');
        return;
    }

    showVatTuLoading(true);
    try {
        await syncCanBangKhoToDB();
        showVatTuLoading(false);
        showKiemKhoToast('success', 'Lưu Cân Bằng Kho Thành Công', `🎉 Đã lưu thành công <b>${canBangKhoMap.size}</b> mặt hàng đối chiếu GPET cho phiếu <b>${currentKiemKhoMaPhieu}</b>!`);
    } catch (e) {
        showVatTuLoading(false);
        showKiemKhoToast('error', 'Lỗi Lưu Dữ Liệu', `Không thể lưu bảng cân bằng: ${e.message}`);
    }
}

// User changes Tồn GPET directly in the input box
function handleCanBangGpetQtyChange(encodedKey, newVal) {
    const key = decodeURIComponent(encodedKey);
    const item = canBangKhoMap.get(key);
    if (!item) return;
    const num = Math.max(0, Number(newVal) || 0);
    item.ton_gpet = num;
    item.chenh_lech = item.thuc_te - num;
    if (item.chenh_lech === 0) item.trang_thai = 'KHOP';
    else if (item.chenh_lech > 0) item.trang_thai = 'DU';
    else item.trang_thai = 'THIEU';

    renderCanBangKhoTable();
    saveKiemKhoLocalSession();
    syncCanBangKhoToDB();
}

// Delete a single row from Cân Bằng Kho
function deleteCanBangKhoRow(encodedKey) {
    const key = decodeURIComponent(encodedKey);
    if (canBangKhoMap.has(key)) {
        canBangKhoMap.delete(key);
        renderCanBangKhoTable();
        saveKiemKhoLocalSession();
        syncCanBangKhoToDB();
    }
}

// Clear all rows from Cân Bằng Kho
async function clearCanBangKhoTable() {
    if (canBangKhoMap.size === 0) return;
    const ok = await showKiemKhoConfirmModal('Xóa Bảng Cân Bằng Kho', 'Bạn có chắc chắn muốn xóa toàn bộ danh sách cân bằng kho của phiếu này?');
    if (!ok) return;

    canBangKhoMap.clear();
    renderCanBangKhoTable();
    saveKiemKhoLocalSession();
    syncCanBangKhoToDB();
    showKiemKhoToast('info', 'Đã Xóa', 'Đã xóa toàn bộ dữ liệu bảng Cân Bằng Kho.');
}

// Filter Cân Bằng Kho table
function filterCanBangKhoTable(query) {
    canBangSearchQuery = (query || '').trim();
    renderCanBangKhoTable();
}

// Normalize string removing Vietnamese diacritics and special characters for column header matching
function normalizeExcelHeaderKey(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/[\s_\-\.\:\/\(\)\[\]\{\}]/g, '');
}

// Handle Excel Import for GPET Stock
async function handleCanBangExcelImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        showKiemKhoToast('error', 'Lỗi Thư Viện', 'Thư viện SheetJS chưa sẵn sàng!');
        event.target.value = '';
        return;
    }

    showVatTuLoading(true);

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', raw: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            throw new Error('File Excel không có sheet dữ liệu nào!');
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true });

        if (!rawJson || rawJson.length === 0) {
            showVatTuLoading(false);
            showKiemKhoToast('warning', 'File Trống', 'File Excel không có dữ liệu hàng nào!');
            event.target.value = '';
            return;
        }

        // Helper to extract value from row matching aliases
        const getColValue = (row, ...aliasList) => {
            const rowEntries = Object.entries(row);
            for (const alias of aliasList) {
                const targetNorm = normalizeExcelHeaderKey(alias);
                const found = rowEntries.find(([k, v]) => {
                    const normK = normalizeExcelHeaderKey(k);
                    return normK === targetNorm || normK.includes(targetNorm);
                });
                if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') {
                    return found[1];
                }
            }
            return '';
        };

        let importedCount = 0;
        const branch = kiemKhoSelectedBranch || 'CN1';

        for (let i = 0; i < rawJson.length; i++) {
            const row = rawJson[i];

            // 1. Mã Vạch / Mã VT
            let rawBarcodeVal = getColValue(
                row,
                'mavach', 'mã vạch', 'ma vach', 'mavt', 'mã vt', 'ma vt', 'mã vật tư', 'ma vat tu',
                'barcode', 'itemcode', 'item code', 'code', 'sku', 'mahang', 'mã hàng', 'mã hàng hóa',
                'masp', 'mã sp', 'mã sản phẩm', 'ma'
            );

            let rawBarcode = '';
            if (typeof rawBarcodeVal === 'number') {
                rawBarcode = Number.isInteger(rawBarcodeVal) ? rawBarcodeVal.toLocaleString('fullwide', { useGrouping: false }) : String(rawBarcodeVal).trim();
            } else {
                rawBarcode = String(rawBarcodeVal || '').trim();
            }

            if (!rawBarcode || rawBarcode === '-' || rawBarcode.toLowerCase() === 'stt') continue;

            // 2. Tên hàng hóa
            const rawTenVal = getColValue(
                row,
                'tenhanghoa', 'tên hàng hóa', 'tenhang', 'tên hàng', 'tenmathang', 'tên mặt hàng',
                'tenvattu', 'tên vật tư', 'tensanpham', 'tên sản phẩm', 'tenvt', 'ten', 'tên',
                'productname', 'itemname', 'name', 'description'
            );
            const rawTen = String(rawTenVal || '').trim();

            // 3. Tồn GPET
            let rawGpetVal = getColValue(
                row,
                'tongpet', 'tồn gpet', 'ton gpet', 'gpet', 'soluonggpet', 'số lượng gpet',
                'slgpet', 'sl gpet', 'soluong', 'số lượng', 'sl', 'tonkho', 'tồn kho', 'ton', 'tồn',
                'quantity', 'qty', 'stock'
            );

            let gpetQty = 0;
            if (typeof rawGpetVal === 'number') {
                gpetQty = Math.max(0, rawGpetVal);
            } else if (rawGpetVal) {
                const parsedNum = parseFloat(String(rawGpetVal).replace(/,/g, '.').replace(/[^\d.-]/g, ''));
                gpetQty = !isNaN(parsedNum) ? Math.max(0, parsedNum) : 0;
            }

            const barcodeKey = rawBarcode.trim().toLowerCase();
            const masterName = getProductNameByBarcode(rawBarcode);
            const finalTen = masterName || rawTen || `Mặt hàng ${rawBarcode}`;

            const tonKho = getCanBangTotalSystemQty(rawBarcode, branch);
            const thucTe = getCanBangTotalActualScannedQty(rawBarcode);
            const diff = thucTe - gpetQty;
            let status = 'KHOP';
            if (diff > 0) status = 'DU';
            else if (diff < 0) status = 'THIEU';

            canBangKhoMap.set(barcodeKey, {
                ma_vach: rawBarcode,
                ten_hang_hoa: finalTen,
                ton_gpet: gpetQty,
                ton_kho: tonKho,
                thuc_te: thucTe,
                chenh_lech: diff,
                trang_thai: status
            });

            importedCount++;
        }

        showVatTuLoading(false);
        renderCanBangKhoTable();
        saveKiemKhoLocalSession();
        await syncCanBangKhoToDB();

        if (importedCount === 0) {
            showKiemKhoToast('warning', 'Không Nhận Diện Được Cột', '⚠️ Không tìm thấy cột Mã Vạch hoặc Tồn GPET trong file! Vui lòng tải "Template" để kiểm tra định dạng chuẩn.');
        } else {
            showKiemKhoToast('success', 'Nhập Excel Thành Công', `🎉 Đã nhập thành công <b>${importedCount}</b> sản phẩm GPET vào bảng cân bằng kho!`);
        }
    } catch (err) {
        showVatTuLoading(false);
        console.error("handleCanBangExcelImportFile error:", err);
        showKiemKhoToast('error', 'Lỗi Đọc File Excel', `Không thể đọc file: ${err.message}`);
    } finally {
        event.target.value = '';
    }
}

// Download Excel Template for GPET Stock Import
function downloadCanBangExcelTemplate() {
    if (typeof XLSX === 'undefined') {
        showKiemKhoToast('error', 'Lỗi Thư Viện', 'Thư viện SheetJS chưa sẵn sàng!');
        return;
    }

    const sampleRows = [
        { "STT": 1, "Mã Vạch": "893000000001", "Tên Hàng Hóa": "Kháng sinh Amoxicillin 500mg", "Tồn GPET": 50 },
        { "STT": 2, "Mã Vạch": "893000000002", "Tên Hàng Hóa": "Thuốc hạ sốt Paracetamol 100ml", "Tồn GPET": 20 },
        { "STT": 3, "Mã Vạch": "893000000003", "Tên Hàng Hóa": "Vitamin B-Complex thú y", "Tồn GPET": 15 }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    worksheet['!cols'] = [
        { wch: 6 },
        { wch: 20 },
        { wch: 38 },
        { wch: 14 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mau_Nhap_GPET");
    downloadExcelWorkbook(workbook, "Mau_Nhap_Ton_GPET_Can_Bang_Kho.xlsx");
}

function exportCanBangKhoToExcel() {
    if (canBangKhoMap.size === 0) {
        showKiemKhoToast('warning', 'Bảng Dữ Liệu Trống', 'Chưa có sản phẩm nào trong bảng Cân Bằng Kho để xuất Excel!');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showKiemKhoToast('error', 'Lỗi Thư Viện', 'Thư viện SheetJS chưa sẵn sàng!');
        return;
    }

    try {
        const items = Array.from(canBangKhoMap.values());
        const exportRows = items.map((item, idx) => ({
            "STT": idx + 1,
            "Mã Vạch": item.ma_vach || '',
            "Tên Hàng Hóa": item.ten_hang_hoa || '',
            "Tồn GPET": item.ton_gpet,
            "Tồn Kho Hệ Thống": item.ton_kho,
            "Số Lượng Thực Tế": item.thuc_te,
            "Chênh Lệch (Thực Tế - GPET)": item.chenh_lech,
            "Trạng Thái": item.trang_thai === 'KHOP' ? 'KHỚP' : (item.trang_thai === 'DU' ? 'DƯ THỰC TẾ' : 'THIẾU THỰC TẾ')
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        worksheet['!cols'] = [
            { wch: 6 },
            { wch: 18 },
            { wch: 38 },
            { wch: 14 },
            { wch: 18 },
            { wch: 18 },
            { wch: 26 },
            { wch: 18 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Can_Bang_Kho_GPET");

        const maPhieuStr = currentKiemKhoMaPhieu ? currentKiemKhoMaPhieu.replace(/[\/:]/g, '-') : 'CAN_BANG';
        const todayStr = new Date().toISOString().split('T')[0];
        const fileName = `Can_Bang_Kho_GPET_${maPhieuStr}_${todayStr}.xlsx`;

        downloadExcelWorkbook(workbook, fileName);
    } catch (err) {
        console.error("exportCanBangKhoToExcel error:", err);
        showKiemKhoToast('error', 'Lỗi Xuất Excel', err.message);
    }
}

async function syncCanBangKhoToDB() {
    const client = getVatTuSupabaseClient();
    if (!client) return;

    const phieuId = await ensureActiveKiemKhoHeaderExists();
    const maPhieu = currentKiemKhoMaPhieu;
    if (!maPhieu && !phieuId) return;

    try {
        if (phieuId) {
            await client.from('kiem_kho_can_bang').delete().eq('phieu_id', phieuId);
        }
        if (maPhieu) {
            await client.from('kiem_kho_can_bang').delete().eq('ma_phieu', maPhieu);
        }

        const items = Array.from(canBangKhoMap.values());
        if (items.length === 0) return;

        const payload = items.map((item, idx) => ({
            phieu_id: phieuId || null,
            ma_phieu: maPhieu,
            stt: idx + 1,
            ma_vach: item.ma_vach,
            ten_hang_hoa: item.ten_hang_hoa,
            ton_gpet: Number(item.ton_gpet) || 0,
            ton_kho: Number(item.ton_kho) || 0,
            thuc_te: Number(item.thuc_te) || 0,
            chenh_lech: Number(item.chenh_lech) || 0,
            trang_thai: item.trang_thai || 'KHOP'
        }));

        const { error } = await client.from('kiem_kho_can_bang').insert(payload);
        if (error) {
            console.error("❌ GAIA KiemKho: syncCanBangKhoToDB Error:", error.message || error);

            if (error.message && error.message.includes('column')) {
                const fallbackPayload = items.map(item => ({
                    phieu_id: phieuId || null,
                    ma_phieu: maPhieu,
                    ma_vach: item.ma_vach,
                    ten_hang_hoa: item.ten_hang_hoa,
                    ton_gpet: Number(item.ton_gpet) || 0,
                    ton_kho: Number(item.ton_kho) || 0,
                    thuc_te: Number(item.thuc_te) || 0,
                    chenh_lech: Number(item.chenh_lech) || 0
                }));
                const { error: err2 } = await client.from('kiem_kho_can_bang').insert(fallbackPayload);
                if (err2) {
                    console.error("❌ GAIA KiemKho: syncCanBangKhoToDB Fallback Error:", err2.message || err2);
                } else {
                    console.log(`✅ GAIA KiemKho: syncCanBangKhoToDB Fallback OK -> ${items.length} items`);
                }
            }
        } else {
            console.log(`✅ GAIA KiemKho: syncCanBangKhoToDB Saved -> ${items.length} items for [${maPhieu}]`);
        }
    } catch (e) {
        console.warn("syncCanBangKhoToDB error:", e);
    }
}

window.initCanBangKhoView = initCanBangKhoView;
window.handleCanBangExcelImportFile = handleCanBangExcelImportFile;
window.downloadCanBangExcelTemplate = downloadCanBangExcelTemplate;
window.exportCanBangKhoToExcel = exportCanBangKhoToExcel;
window.recalculateCanBangKhoData = recalculateCanBangKhoData;
window.clearCanBangKhoTable = clearCanBangKhoTable;
window.filterCanBangKhoTable = filterCanBangKhoTable;
window.handleCanBangGpetQtyChange = handleCanBangGpetQtyChange;
window.deleteCanBangKhoRow = deleteCanBangKhoRow;
window.saveCanBangKhoDataToDB = saveCanBangKhoDataToDB;
window.showOrHideCanBangKhoSection = showOrHideCanBangKhoSection;
window.changeCanBangPageSize = changeCanBangPageSize;
window.renderCanBangPaginationControls = renderCanBangPaginationControls;
window.clearAllCanBangFilters = clearAllCanBangFilters;

function getKiemKhoItemColValueStr(item, colKey) {
    if (!item) return '(Trống)';
    let raw = '';
    switch (colKey) {
        case 'ma_vach':
            raw = item.ma_vach;
            break;
        case 'ten_hang_hoa':
            raw = item.ten_hang_hoa;
            break;
        case 'lot':
            raw = item.lot;
            break;
        case 'date_expiry':
            raw = (item.date_expiry && item.date_expiry !== '-') ? formatDate(item.date_expiry) : '-';
            break;
        case 'so_luong_thuc_te':
            raw = String(item.so_luong_thuc_te ?? 0);
            break;
        case 'so_luong_he_thong':
            raw = String(item.so_luong_he_thong ?? 0);
            break;
        case 'chenh_lech':
            raw = item.chenh_lech > 0 ? `+${item.chenh_lech}` : String(item.chenh_lech ?? 0);
            break;
        case 'trang_thai':
            raw = item.trang_thai === 'KHOP' ? 'ĐỦ' : (item.trang_thai === 'DU' ? 'DƯ' : 'THIẾU');
            break;
        case 'user_name': {
            const scanners = (item.scanners && Array.isArray(item.scanners) && item.scanners.length > 0) ? 
                item.scanners.map(s => normalizeScanner(s && (s.user_name || s.name || s), s && (s.branch || item.branch))) : 
                parseKiemKhoScanners(item.user_name || item.scanners, item.branch);
            if (scanners.length > 1) {
                raw = scanners.map(s => `${s.user_name} (${s.branch})`).join(', ');
            } else if (scanners.length === 1) {
                raw = `${scanners[0].user_name} - ${scanners[0].branch}`;
            } else {
                const single = normalizeScanner(item.user_name, item.branch);
                raw = `${single.user_name} - ${single.branch}`;
            }
            break;
        }
        case 'time_scanned':
            raw = item.time_scanned ? formatDate(item.time_scanned) : '-';
            break;
        default:
            raw = item[colKey];
    }
    if (raw === null || raw === undefined || String(raw).trim() === '' || String(raw).trim() === '-') {
        return '(Trống)';
    }
    return String(raw).trim();
}

function getCanBangItemColValueStr(item, colKey) {
    if (!item) return '(Trống)';
    let raw = '';
    switch (colKey) {
        case 'ma_vach':
            raw = item.ma_vach;
            break;
        case 'ten_hang_hoa':
            raw = item.ten_hang_hoa;
            break;
        case 'ton_gpet':
            raw = String(item.ton_gpet !== undefined ? item.ton_gpet : 0);
            break;
        case 'ton_kho':
            raw = String(item.ton_kho ?? 0);
            break;
        case 'thuc_te':
            raw = String(item.thuc_te ?? 0);
            break;
        case 'chenh_lech':
            raw = item.chenh_lech > 0 ? `+${item.chenh_lech}` : String(item.chenh_lech ?? 0);
            break;
        case 'trang_thai':
            raw = item.trang_thai === 'KHOP' ? 'Khớp' : (item.trang_thai === 'DU' ? 'Dư' : 'Thiếu');
            break;
        default:
            raw = item[colKey];
    }
    if (raw === null || raw === undefined || String(raw).trim() === '' || String(raw).trim() === '-') {
        return '(Trống)';
    }
    return String(raw).trim();
}

function getAvailableOptionsForKiemKhoCol(colKey, tableType) {
    if (tableType === 'canbang') {
        let items = Array.from(canBangKhoMap.values());
        if (canBangSearchQuery) {
            const q = canBangSearchQuery.toLowerCase().trim();
            items = items.filter(it => 
                (it.ma_vach || '').toLowerCase().includes(q) ||
                (it.ten_hang_hoa || '').toLowerCase().includes(q)
            );
        }
        for (const [otherCol, selectedSet] of Object.entries(canBangColumnFilters)) {
            if (otherCol === colKey) continue;
            if (!selectedSet || selectedSet.size === 0) continue;
            items = items.filter(item => {
                const valStr = getCanBangItemColValueStr(item, otherCol);
                return selectedSet.has(valStr);
            });
        }
        const countsMap = new Map();
        items.forEach(item => {
            const valStr = getCanBangItemColValueStr(item, colKey);
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
    } else {
        let items = Array.from(kiemKhoItemsMap.values());
        if (kiemKhoSearchQuery) {
            const q = kiemKhoSearchQuery.toLowerCase().trim();
            items = items.filter(it => 
                (it.ma_vach || '').toLowerCase().includes(q) ||
                (it.ten_hang_hoa || '').toLowerCase().includes(q) ||
                (it.lot || '').toLowerCase().includes(q)
            );
        }
        for (const [otherCol, selectedSet] of Object.entries(kiemKhoColumnFilters)) {
            if (otherCol === colKey) continue;
            if (!selectedSet || selectedSet.size === 0) continue;
            items = items.filter(item => {
                const valStr = getKiemKhoItemColValueStr(item, otherCol);
                return selectedSet.has(valStr);
            });
        }
        const countsMap = new Map();
        items.forEach(item => {
            const valStr = getKiemKhoItemColValueStr(item, colKey);
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
}

function toggleKiemKhoColumnFilter(event, colKey, tableType = 'kiemkho') {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const popover = document.getElementById('kiemkho-col-filter-popover');
    if (!popover) return;

    if (popover.style.display === 'flex' && activeKiemKhoFilterCol === colKey && activeKiemKhoFilterTable === tableType) {
        closeKiemKhoColumnFilterDropdown();
        return;
    }

    activeKiemKhoFilterCol = colKey;
    activeKiemKhoFilterTable = tableType;

    const btn = (event && event.currentTarget) ? event.currentTarget : document.querySelector(`.col-filter-btn[data-col="${colKey}"][data-table="${tableType}"]`);
    if (btn) {
        const rect = btn.getBoundingClientRect();
        let left = rect.left - 80;
        let top = rect.bottom + 6;

        if (left + 260 > window.innerWidth) {
            left = window.innerWidth - 270;
        }
        if (left < 10) left = 10;
        if (top + 380 > window.innerHeight) {
            top = Math.max(10, rect.top - 380);
        }

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
    }

    const titles = (tableType === 'canbang') ? canBangColTitles : kiemKhoColTitles;
    const titleEl = document.getElementById('kiemkho-filter-popover-title');
    if (titleEl) titleEl.textContent = `Lọc Cột: ${titles[colKey] || colKey}`;

    const searchInput = document.getElementById('kiemkho-filter-popover-search-input');
    if (searchInput) searchInput.value = '';

    const filterObj = (tableType === 'canbang') ? canBangColumnFilters : kiemKhoColumnFilters;
    const existing = filterObj[colKey];
    const availableOptions = getAvailableOptionsForKiemKhoCol(colKey, tableType);

    if (existing && existing.size > 0) {
        kiemKhoPopoverTempSelectedValues = new Set(existing);
    } else {
        kiemKhoPopoverTempSelectedValues = new Set(availableOptions.map(x => x.valStr));
    }

    popover.style.display = 'flex';
    renderKiemKhoFilterPopoverListOptions();
}

function closeKiemKhoColumnFilterDropdown() {
    const popover = document.getElementById('kiemkho-col-filter-popover');
    if (popover) popover.style.display = 'none';
    activeKiemKhoFilterCol = null;
}

function renderKiemKhoFilterPopoverListOptions() {
    if (!activeKiemKhoFilterCol) return;

    const listContainer = document.getElementById('kiemkho-filter-popover-list');
    const searchVal = (document.getElementById('kiemkho-filter-popover-search-input')?.value || '').toLowerCase().trim();
    if (!listContainer) return;

    const options = getAvailableOptionsForKiemKhoCol(activeKiemKhoFilterCol, activeKiemKhoFilterTable);
    const filteredOptions = options.filter(opt => !searchVal || opt.valStr.toLowerCase().includes(searchVal));

    listContainer.innerHTML = '';

    if (filteredOptions.length === 0) {
        listContainer.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 12px;">Không có giá trị trùng khớp</div>`;
    } else {
        filteredOptions.forEach(opt => {
            const isChecked = kiemKhoPopoverTempSelectedValues.has(opt.valStr);
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
                    kiemKhoPopoverTempSelectedValues.add(opt.valStr);
                } else {
                    kiemKhoPopoverTempSelectedValues.delete(opt.valStr);
                }
                updateKiemKhoSelectAllCheckboxState(filteredOptions);
            };

            listContainer.appendChild(label);
        });
    }

    updateKiemKhoSelectAllCheckboxState(filteredOptions);
}

function updateKiemKhoSelectAllCheckboxState(filteredOptions) {
    const selectAllCb = document.getElementById('kiemkho-popover-select-all');
    if (!selectAllCb || !filteredOptions || filteredOptions.length === 0) return;
    const allChecked = filteredOptions.every(opt => kiemKhoPopoverTempSelectedValues.has(opt.valStr));
    selectAllCb.checked = allChecked;
}

function toggleSelectAllKiemKhoPopoverOptions(checked) {
    if (!activeKiemKhoFilterCol) return;
    const options = getAvailableOptionsForKiemKhoCol(activeKiemKhoFilterCol, activeKiemKhoFilterTable);
    options.forEach(opt => {
        if (checked) {
            kiemKhoPopoverTempSelectedValues.add(opt.valStr);
        } else {
            kiemKhoPopoverTempSelectedValues.delete(opt.valStr);
        }
    });
    renderKiemKhoFilterPopoverListOptions();
}

function applyCurrentKiemKhoColumnFilter() {
    if (!activeKiemKhoFilterCol) return;
    const colKey = activeKiemKhoFilterCol;
    const tableType = activeKiemKhoFilterTable;
    const availableOptions = getAvailableOptionsForKiemKhoCol(colKey, tableType);

    const filterObj = (tableType === 'canbang') ? canBangColumnFilters : kiemKhoColumnFilters;

    if (kiemKhoPopoverTempSelectedValues.size >= availableOptions.length) {
        delete filterObj[colKey];
    } else {
        filterObj[colKey] = new Set(kiemKhoPopoverTempSelectedValues);
    }

    updateKiemKhoColumnFilterBadgesUI(tableType);
    closeKiemKhoColumnFilterDropdown();

    if (tableType === 'canbang') {
        renderCanBangKhoTable();
    } else {
        kiemKhoCurrentPage = 1;
        renderKiemKhoTable();
    }
}

function clearCurrentKiemKhoColumnFilter() {
    if (!activeKiemKhoFilterCol) return;
    const colKey = activeKiemKhoFilterCol;
    const tableType = activeKiemKhoFilterTable;
    const filterObj = (tableType === 'canbang') ? canBangColumnFilters : kiemKhoColumnFilters;

    delete filterObj[colKey];

    updateKiemKhoColumnFilterBadgesUI(tableType);
    closeKiemKhoColumnFilterDropdown();

    if (tableType === 'canbang') {
        renderCanBangKhoTable();
    } else {
        kiemKhoCurrentPage = 1;
        renderKiemKhoTable();
    }
}

function clearAllKiemKhoFilters() {
    kiemKhoColumnFilters = {};
    kiemKhoSearchQuery = '';
    const searchInput = document.getElementById('kiemkho-search-input');
    if (searchInput) searchInput.value = '';

    closeKiemKhoColumnFilterDropdown();
    updateKiemKhoColumnFilterBadgesUI('kiemkho');
    kiemKhoCurrentPage = 1;
    renderKiemKhoTable();
}

function clearAllCanBangFilters() {
    canBangColumnFilters = {};
    canBangSearchQuery = '';
    const searchInput = document.getElementById('canbang-search-input');
    if (searchInput) searchInput.value = '';

    closeKiemKhoColumnFilterDropdown();
    updateKiemKhoColumnFilterBadgesUI('canbang');
    canBangCurrentPage = 1;
    renderCanBangKhoTable();
}

function updateKiemKhoColumnFilterBadgesUI(tableType = 'all') {
    if (tableType === 'kiemkho' || tableType === 'all') {
        let hasActiveKiemKho = !!(kiemKhoSearchQuery && kiemKhoSearchQuery.trim() !== '');
        const kiemKhoBtns = document.querySelectorAll('#kiemkho-table .col-filter-btn[data-col]');
        kiemKhoBtns.forEach(btn => {
            const colKey = btn.getAttribute('data-col');
            const badge = document.getElementById(`kiemkho-filter-badge-${colKey}`);
            const selectedSet = kiemKhoColumnFilters[colKey];

            if (selectedSet && selectedSet.size > 0) {
                btn.classList.add('filter-active');
                hasActiveKiemKho = true;
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

        const clearBtnKiemKho = document.getElementById('btn-clear-all-filters-kiemkho');
        if (clearBtnKiemKho) {
            if (hasActiveKiemKho) {
                clearBtnKiemKho.classList.add('filter-has-active');
            } else {
                clearBtnKiemKho.classList.remove('filter-has-active');
            }
        }
    }

    if (tableType === 'canbang' || tableType === 'all') {
        let hasActiveCanBang = !!(canBangSearchQuery && canBangSearchQuery.trim() !== '');
        const canBangBtns = document.querySelectorAll('#canbang-table .col-filter-btn[data-col]');
        canBangBtns.forEach(btn => {
            const colKey = btn.getAttribute('data-col');
            const badge = document.getElementById(`canbang-filter-badge-${colKey}`);
            const selectedSet = canBangColumnFilters[colKey];

            if (selectedSet && selectedSet.size > 0) {
                btn.classList.add('filter-active');
                hasActiveCanBang = true;
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

        const clearBtnCanBang = document.getElementById('btn-clear-all-filters-canbang');
        if (clearBtnCanBang) {
            if (hasActiveCanBang) {
                clearBtnCanBang.classList.add('filter-has-active');
            } else {
                clearBtnCanBang.classList.remove('filter-has-active');
            }
        }
    }
}

function initKiemKhoColumnResizing() {
    initGenericTableResizing('#kiemkho-table', 'gaia_kiemkho_column_widths');
    initGenericTableResizing('#canbang-table', 'gaia_canbang_column_widths');
}

function initGenericTableResizing(tableSelector, storageKey) {
    const table = document.querySelector(tableSelector);
    if (!table) return;

    if (storageKey) {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
            table.querySelectorAll('th[data-col]').forEach(th => {
                const col = th.getAttribute('data-col');
                if (saved[col]) {
                    th.style.width = saved[col] + 'px';
                }
            });
        } catch (e) {}
    }

    const resizers = table.querySelectorAll('.col-resizer');
    resizers.forEach(resizer => {
        const th = resizer.parentElement;
        if (!th) return;

        let startX, startWidth;

        const onMouseMove = (e) => {
            if (!startX) return;
            const diffX = e.pageX - startX;
            const minW = parseInt(th.style.minWidth, 10) || 50;
            const newWidth = Math.max(minW, startWidth + diffX);
            th.style.width = `${newWidth}px`;
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

            if (storageKey) {
                try {
                    const widths = {};
                    table.querySelectorAll('th[data-col]').forEach(h => {
                        const colKey = h.getAttribute('data-col');
                        if (colKey) widths[colKey] = h.offsetWidth;
                    });
                    localStorage.setItem(storageKey, JSON.stringify(widths));
                } catch (err) {}
            }
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

        resizer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });
}

document.addEventListener('click', (e) => {
    const popover = document.getElementById('kiemkho-col-filter-popover');
    if (!popover || popover.style.display === 'none') return;
    if (popover.contains(e.target) || e.target.closest('.col-filter-btn')) return;
    closeKiemKhoColumnFilterDropdown();
});

window.toggleKiemKhoColumnFilter = toggleKiemKhoColumnFilter;
window.closeKiemKhoColumnFilterDropdown = closeKiemKhoColumnFilterDropdown;
window.renderKiemKhoFilterPopoverListOptions = renderKiemKhoFilterPopoverListOptions;
window.toggleSelectAllKiemKhoPopoverOptions = toggleSelectAllKiemKhoPopoverOptions;
window.applyCurrentKiemKhoColumnFilter = applyCurrentKiemKhoColumnFilter;
window.clearCurrentKiemKhoColumnFilter = clearCurrentKiemKhoColumnFilter;
window.initKiemKhoColumnResizing = initKiemKhoColumnResizing;
window.changeKiemKhoPageSize = changeKiemKhoPageSize;
window.changeCanBangPageSize = changeCanBangPageSize;
