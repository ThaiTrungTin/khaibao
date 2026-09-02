/* ==========================================================================
   GAIA Animal Hospital - Kiểm Kho Vật Tư (kiem_kho.js)
   Quét mã QR/Vạch, Tự động cộng dồn, Âm thanh Đủ/Dư, Lưu CSDL & Xuất Excel
   ========================================================================== */

let kiemKhoItemsMap = new Map();
let kiemKhoTotalScans = 0;
let kiemKhoSelectedBranch = '';
let kiemKhoAudioCtx = null;
let currentKiemKhoPhieuId = null;
let currentKiemKhoMaPhieu = null;

// Pagination state
let kiemKhoCurrentPage = 1;
const KIEMKHO_PAGE_SIZE = 20;
let kiemKhoSearchQuery = '';

// Generate Mã Phiếu: PKK-CN1-02/09/2026_01
async function generateKiemKhoMaPhieu(branch) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    const branchCode = (!branch || branch === 'all') ? 'ALL' : branch.toUpperCase();
    const prefix = `PKK-${branchCode}-${dateStr}_`;

    // Count today's existing phieus to get sequence
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

// Initialize Web Audio API Synthesizer Context
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

// Play Audio Feedback (Web Audio API Synthesizer)
// 'match' -> Âm báo ĐỦ (Chime 2 nốt cao E5 -> G5)
// 'excess' -> Âm báo DƯ (Cảnh báo F4 -> C4)
// 'scan' -> Âm beep quét mã vạch
function playKiemKhoAudio(type) {
    try {
        const ctx = getKiemKhoAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        if (type === 'match') {
            // Âm báo KHỐP / ĐỦ: 2 nốt ngân cao dịu ngọt (659Hz - E5, 784Hz - G5)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(659.25, now); // E5
            osc1.frequency.setValueAtTime(783.99, now + 0.1); // G5
            gain1.gain.setValueAtTime(0.3, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.4);
        } else if (type === 'excess') {
            // Âm báo DƯ / VƯỢT: Tiếng còi cảnh báo gấp đôi (349Hz - F4, 261Hz - C4)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(349.23, now); // F4
            osc1.frequency.setValueAtTime(261.63, now + 0.15); // C4
            gain1.gain.setValueAtTime(0.35, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.45);
        } else {
            // Standard Scan Beep: 880Hz (A5)
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

// Get current logged-in user name & branch with fallback
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

function getKiemKhoLoggedBranch() {
    if (kiemKhoSelectedBranch && kiemKhoSelectedBranch !== 'all') {
        return kiemKhoSelectedBranch;
    }
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
    let b = u ? (u.branch || u.chi_nhanh || 'CN1') : 'CN1';
    if (typeof window.extractCNCodeFromBranchString === 'function') {
        b = window.extractCNCodeFromBranchString(b);
    } else if (typeof window.extractCNCode === 'function') {
        b = window.extractCNCode(b);
    }
    return b || 'CN1';
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
    if (input && currentKiemKhoMaPhieu) {
        input.value = currentKiemKhoMaPhieu;
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
    if (branchSelect && branchSelect.style.display !== 'none') {
        if (!branchSelect.value) {
            showKiemKhoToast('warning', 'Chưa Chọn Chi Nhánh', '⚠️ Vui lòng chọn chi nhánh trước khi tạo phiếu mới!');
            return;
        }
        kiemKhoSelectedBranch = branchSelect.value;
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
    currentKiemKhoPhieuId = newPhieuId;
    currentKiemKhoMaPhieu = newCode;
    kiemKhoCurrentPage = 1;
    kiemKhoSearchQuery = '';

    // Lock branch select after code is generated
    setKiemKhoBranchSelectDisabled(true);

    updateKiemKhoPhieuDisplay();
    renderKiemKhoTable();
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
    const rawB = u ? (u.branch || u.chi_nhanh || '') : '';
    let code = rawB;
    if (typeof window.extractCNCodeFromBranchString === 'function') {
        code = window.extractCNCodeFromBranchString(rawB);
    } else if (typeof window.extractCNCode === 'function') {
        code = window.extractCNCode(rawB);
    }
    
    // MANAGERS (quản lý) HAVE ALL-BRANCH PERMISSION EVERYWHERE!
    const isManager = (typeof window.isManagerRole === 'function') ? window.isManagerRole(u) : false;
    const roleLower = u ? String(u.role || '').toLowerCase().trim() : '';
    const isAllPermission = isManager || roleLower.includes('quản lý') || roleLower.includes('quan ly') || roleLower === 'manager' || (!rawB || rawB === 'all' || rawB.toLowerCase() === 'toàn hệ thống' || rawB.toLowerCase() === 'tất cả chi nhánh');

    return {
        raw: rawB,
        code: String(code || rawB || '').trim().toUpperCase(),
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

        const { data: chiTietData, error: chiTietErr } = await client
            .from('kiem_kho_chi_tiet')
            .select('*')
            .eq('phieu_id', phieuData.id);

        if (chiTietErr) throw chiTietErr;

        // Load into map
        kiemKhoItemsMap.clear();
        kiemKhoTotalScans = 0;
        currentKiemKhoPhieuId = phieuData.id;
        currentKiemKhoMaPhieu = maPhieu;
        kiemKhoSelectedBranch = phieuData.branch || 'all';

        (chiTietData || []).forEach(row => {
            const key = `${row.ma_vach}_${row.lot || '-'}`;
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
                user_name: row.user_name || '',
                branch: row.branch || kiemKhoSelectedBranch,
                time_scanned: row.thoi_gian_quat || new Date().toISOString(),
                is_synced: true,
                is_system_qty_changed: false
            });
            if ((row.so_luong_thuc_te || 0) > 0) kiemKhoTotalScans += row.so_luong_thuc_te;
        });

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

        updateKiemKhoPhieuDisplay();
        renderKiemKhoTable();
        showVatTuLoading(false);
        showKiemKhoToast('success', 'Đã Tải Phiếu Cũ Sửa', `✅ Đã tải thành công phiếu kiểm kho <b>${maPhieu}</b> (${phieuBranch}) với ${chiTietData.length} mã hàng để chỉnh sửa!`);
    } catch (err) {
        showVatTuLoading(false);
        console.error('loadKiemKhoPhieuByCode error:', err);
        showKiemKhoToast('error', 'Lỗi Tải Phiếu', `Không thể tải phiếu: ${err.message}`);
    }
}

// Local Storage Session Persistence Helpers
function saveKiemKhoLocalSession() {
    try {
        if (kiemKhoItemsMap.size === 0) {
            localStorage.removeItem("gaia_active_kiemkho_session");
            return;
        }
        const sessionData = {
            phieuId: currentKiemKhoPhieuId,
            maPhieu: currentKiemKhoMaPhieu,
            branch: kiemKhoSelectedBranch,
            totalScans: kiemKhoTotalScans,
            items: Array.from(kiemKhoItemsMap.entries()),
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
        if (!sessionData || !sessionData.items || !Array.isArray(sessionData.items)) return false;

        currentKiemKhoPhieuId = sessionData.phieuId || null;
        currentKiemKhoMaPhieu = sessionData.maPhieu || null;
        kiemKhoSelectedBranch = sessionData.branch || 'all';
        kiemKhoTotalScans = sessionData.totalScans || 0;

        kiemKhoItemsMap = new Map(sessionData.items);

        // Update branch select value if element exists
        const branchSelect = document.getElementById('kiemkho-filter-branch');
        if (branchSelect && kiemKhoSelectedBranch) {
            branchSelect.value = kiemKhoSelectedBranch;
        }

        return kiemKhoItemsMap.size > 0;
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

    if (!isManager && loggedUser && loggedUser.branch) {
        let userCN = loggedUser.branch;
        if (typeof window.extractCNCodeFromBranchString === 'function') {
            userCN = window.extractCNCodeFromBranchString(loggedUser.branch);
        } else if (typeof window.extractCNCode === 'function') {
            userCN = window.extractCNCode(loggedUser.branch);
        }
        kiemKhoSelectedBranch = userCN || 'all';
        branchSelect.style.display = 'none';
    } else {
        // Manager Account: Always populate and show Branch Selector
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
    let html = `<option value="" disabled ${!kiemKhoSelectedBranch ? 'selected' : ''}>📍 -- Chọn Chi Nhánh --</option>`;
    html += `<option value="all">🏢 Tất cả chi nhánh</option>`;

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

        html += `<option value="${code}">📍 ${escapeHtml(labelText)}</option>`;
    });

    branchSelect.innerHTML = html;
    if (kiemKhoSelectedBranch) {
        branchSelect.value = kiemKhoSelectedBranch;
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
    let date_expiry = (parts[2] && parts[2].trim() !== '') ? parts[2].trim() : '-';

    return { ma_vach, lot, date_expiry };
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
            user_name: userName,
            branch: userBranch,
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

    // Real-time DB sync for scanned item
    const scannedItem = kiemKhoItemsMap.get(itemKey);
    if (scannedItem) {
        syncKiemKhoItemToDB(scannedItem);
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
    if (branchSelect && branchSelect.style.display !== 'none') {
        if (!branchSelect.value) {
            showKiemKhoToast('warning', 'Chưa Chọn Chi Nhánh', '⚠️ Vui lòng chọn chi nhánh trước khi nạp dữ liệu!');
            return;
        }
        kiemKhoSelectedBranch = branchSelect.value;
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
                    user_name: userName,
                    branch: userBranch,
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
                    branch: selectedBranch
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

        const existing = kiemKhoItemsMap.get(key);

        if (existing) {
            existing.so_luong_thuc_te = scannedQty;
            existing.so_luong_he_thong = systemQty;
            existing.chenh_lech = diff;
            existing.trang_thai = status;
            if (newRow.user_name) existing.user_name = newRow.user_name;
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
                user_name: newRow.user_name || 'Đồng nghiệp',
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
        const maVach = oldRow.ma_vach;
        if (!maVach) return;
        const lot = oldRow.lot || '-';
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

    const row = payload.new;
    if (!row) return;

    if (String(row.ma_phieu).toUpperCase() === String(currentKiemKhoMaPhieu).toUpperCase()) {
        if (row.trang_thai === 'DA_HOAN_THANH') {
            showKiemKhoToast('info', 'Phiếu Đã Hoàn Thành', `🎉 Phiếu kiểm <b>${row.ma_phieu}</b> đã được hoàn tất và lưu bởi ${row.user_name || 'đồng nghiệp'}!`);
            kiemKhoItemsMap.clear();
            kiemKhoTotalScans = 0;
            currentKiemKhoPhieuId = null;
            currentKiemKhoMaPhieu = null;
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
                chenh_lech: item.chenh_lech,
                trang_thai: item.trang_thai
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
                branch: item.branch || kiemKhoSelectedBranch
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

    if (allItems.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        const resetBtn = document.getElementById('btn-reset-kiem-kho');
        if (resetBtn) resetBtn.style.display = 'inline-flex';
        renderKiemKhoPagination(0, 0);
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

    // Apply search filter
    const q = (kiemKhoSearchQuery || '').trim().toLowerCase();
    const filtered = q
        ? allItems.filter(item =>
            (item.ma_vach || '').toLowerCase().includes(q) ||
            (item.ten_hang_hoa || '').toLowerCase().includes(q) ||
            (item.lot || '').toLowerCase().includes(q)
          )
        : allItems;

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filtered.length / KIEMKHO_PAGE_SIZE));
    if (kiemKhoCurrentPage > totalPages) kiemKhoCurrentPage = totalPages;
    const startIdx = (kiemKhoCurrentPage - 1) * KIEMKHO_PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + KIEMKHO_PAGE_SIZE);

    renderKiemKhoPagination(filtered.length, totalPages);

    let html = '';
    pageItems.forEach((item, idx) => {
        const globalIdx = startIdx + idx;
        let statusBadge = '';
        if (item.trang_thai === 'KHOP') {
            statusBadge = `<span class="badge-status badge-success" style="background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid #10b981; padding: 4px 10px; border-radius: 6px; font-weight: 700;">✅ ĐỦ (KHỚP)</span>`;
        } else if (item.trang_thai === 'DU') {
            statusBadge = `<span class="badge-status badge-warning" style="background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid #f59e0b; padding: 4px 10px; border-radius: 6px; font-weight: 700;">⚠️ DƯ (+${item.chenh_lech})</span>`;
        } else {
            statusBadge = `<span class="badge-status badge-info" style="background: rgba(59,130,246,0.15); color: #3b82f6; border: 1px solid #3b82f6; padding: 4px 10px; border-radius: 6px; font-weight: 700;">🔵 THIẾU (${item.chenh_lech})</span>`;
        }

        let systemQtyTd = `<td style="text-align: center; font-weight: 700; color: #94a3b8;">${item.so_luong_he_thong}</td>`;
        let trClass = 'vattu-table-row';

        if (item.is_system_qty_changed) {
            trClass += ' tr-system-changed';
            systemQtyTd = `
                <td style="text-align: center; font-weight: 800; background: rgba(239, 68, 68, 0.2); border: 2px solid #ef4444; color: #ef4444; border-radius: 6px; padding: 4px 6px;" title="Tồn hệ thống vừa biến động! Tồn cũ: ${item.old_so_luong_he_thong ?? '-'} ➔ Tồn mới: ${item.so_luong_he_thong}">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <span>⚠️ ${item.so_luong_he_thong}</span>
                        <button type="button" onclick="acknowledgeSystemStockChange('${item.key}')" 
                                style="background: rgba(16, 185, 129, 0.3); border: 1px solid #10b981; color: #10b981; border-radius: 6px; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 13px; font-weight: bold; transition: all 0.2s ease; animation: kiemkhoRedPulse 1.2s infinite;" 
                                title="Ấn dấu tick để xác nhận tồn hệ thống thay đổi mới nhất">
                            ✅
                        </button>
                    </div>
                    <span style="font-size: 10px; display: block; color: #ef4444; font-weight: 700; margin-top: 2px;">(Tồn thay đổi!)</span>
                </td>
            `;
        }

        html += `
            <tr class="${trClass}">
                <td style="text-align: center; color: #94a3b8;">${globalIdx + 1}</td>
                <td><strong style="color: var(--text-color);">${escapeHtml(item.ma_vach || '-')}</strong></td>
                <td><div class="cell-truncate-wrap" title="${escapeHtml(item.ten_hang_hoa)}"><span class="cell-truncate-text" style="font-weight: 600;">${escapeHtml(item.ten_hang_hoa)}</span></div></td>
                <td>${escapeHtml(item.lot || '-')}</td>
                <td>${escapeHtml(formatDate(item.date_expiry))}</td>
                <td style="text-align: center; font-size: 15px; font-weight: 800; color: #10b981;">
                    <input type="number" min="0" value="${item.so_luong_thuc_te}" onchange="updateKiemKhoItemQtyDirect('${item.key}', this.value)" style="width: 65px; text-align: center; font-weight: 800; font-size: 14px; background: rgba(0,0,0,0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #10b981; border-radius: 6px; padding: 4px 6px; outline: none;">
                </td>
                ${systemQtyTd}
                <td style="text-align: center; font-weight: 800; color: ${item.chenh_lech > 0 ? '#f59e0b' : (item.chenh_lech < 0 ? '#ef4444' : '#10b981')};">
                    ${item.chenh_lech > 0 ? `+${item.chenh_lech}` : item.chenh_lech}
                </td>
                <td style="text-align: center;">${statusBadge}</td>
                <td><span class="subrow-branch-badge">${escapeHtml(item.user_name || 'Nhân viên')} - ${escapeHtml(item.branch || 'CN1')}</span></td>
                <td><span style="font-size: 12px; color: #94a3b8;">${formatDateTime(item.time_scanned)}</span></td>
                <td style="text-align: center;">
                    <button type="button" onclick="deleteKiemKhoItem('${item.key}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px;" title="Xóa mặt hàng này khỏi phiếu">🗑️</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Render Pagination Bar
function renderKiemKhoPagination(totalFiltered, totalPages) {
    // Container
    let container = document.getElementById('kiemkho-pagination-bar');
    if (!container) return;

    // Always show pagination info bar
    const start = totalFiltered === 0 ? 0 : (kiemKhoCurrentPage - 1) * KIEMKHO_PAGE_SIZE + 1;
    const end = Math.min(kiemKhoCurrentPage * KIEMKHO_PAGE_SIZE, totalFiltered);

    let btns = '';
    if (totalPages > 1) {
        for (let p = 1; p <= totalPages; p++) {
            if (totalPages > 7 && Math.abs(p - kiemKhoCurrentPage) > 2 && p !== 1 && p !== totalPages) {
                if (p === 2 || p === totalPages - 1) btns += `<span style="color:#94a3b8;padding:0 4px;">…</span>`;
                continue;
            }
            const active = p === kiemKhoCurrentPage;
            btns += `<button type="button" onclick="kiemKhoGoPage(${p})" style="min-width:28px;height:28px;border-radius:6px;border:1px solid ${active ? '#38bdf8' : 'rgba(255,255,255,0.15)'};background:${active ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.07)'};color:${active ? '#38bdf8' : '#94a3b8'};font-weight:${active ? '800' : '600'};font-size:12px;cursor:pointer;transition:all 0.15s;">${p}</button>`;
        }
    }

    container.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap;">
            <span style="font-size:12px;color:#94a3b8;">Hiển thị <b style="color:#e2e8f0;">${start > 0 ? start + '–' + end : '0'}</b> / <b style="color:#38bdf8;">${totalFiltered}</b> mặt hàng (${KIEMKHO_PAGE_SIZE}/trang)</span>
            ${totalPages > 1 ? `
            <div style="display:flex;align-items:center;gap:4px;">
                <button type="button" onclick="kiemKhoGoPage(${kiemKhoCurrentPage - 1})" ${kiemKhoCurrentPage <= 1 ? 'disabled' : ''} style="min-width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#94a3b8;cursor:pointer;font-size:12px;opacity:${kiemKhoCurrentPage <= 1 ? '0.4' : '1'};">◀</button>
                ${btns}
                <button type="button" onclick="kiemKhoGoPage(${kiemKhoCurrentPage + 1})" ${kiemKhoCurrentPage >= totalPages ? 'disabled' : ''} style="min-width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);color:#94a3b8;cursor:pointer;font-size:12px;opacity:${kiemKhoCurrentPage >= totalPages ? '0.4' : '1'};">▶</button>
            </div>` : ''}
        </div>
    `;
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
    const newQty = Math.max(0, parseInt(rawVal, 10) || 0);
    item.so_luong_thuc_te = newQty;
    item.chenh_lech = item.so_luong_thuc_te - item.so_luong_he_thong;
    item.trang_thai = getKiemKhoStatus(item.so_luong_thuc_te, item.so_luong_he_thong);
    item.time_scanned = new Date().toISOString();
    item.is_synced = false;
    renderKiemKhoTable();

    // Real-time DB Sync
    syncKiemKhoItemToDB(item);
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
    renderKiemKhoTable();

    // Real-time DB Sync
    syncKiemKhoItemToDB(item);
}

// Acknowledge Live System Stock Change & Hide Tick Button
async function acknowledgeSystemStockChange(key) {
    const item = kiemKhoItemsMap.get(key);
    if (!item) return;

    item.is_system_qty_changed = false;
    delete item.old_so_luong_he_thong;

    // Sync updated status & discrepancies to Supabase DB
    await syncKiemKhoItemToDB(item);

    renderKiemKhoTable();

    if (typeof showToast === 'function') {
        showToast('success', 'Đã Xác Nhận Tồn Hệ Thống', `✅ Đã xác nhận tồn hệ thống mới (${item.so_luong_he_thong}) cho mã "${item.ma_vach}"!`);
    } else if (typeof window.showToast === 'function') {
        window.showToast('success', 'Đã Xác Nhận Tồn Hệ Thống', `✅ Đã xác nhận tồn hệ thống mới (${item.so_luong_he_thong}) cho mã "${item.ma_vach}"!`);
    }
}

// Delete Single Item from Audit List
async function deleteKiemKhoItem(key) {
    const item = kiemKhoItemsMap.get(key);
    if (!item) return;

    kiemKhoItemsMap.delete(key);
    renderKiemKhoTable();

    // Delete from DB in real time if session exists
    if (currentKiemKhoPhieuId) {
        const client = getVatTuSupabaseClient();
        if (client) {
            const normLot = (item.lot && item.lot !== '-') ? item.lot : null;
            let q = client.from('kiem_kho_chi_tiet').delete().eq('phieu_id', currentKiemKhoPhieuId).eq('ma_vach', item.ma_vach);
            if (normLot) q = q.eq('lot', normLot);
            else q = q.is('lot', null);
            await q;
        }
    }
}

// Reset Audit Session & Clear Data
async function resetKiemKhoSession() {
    if (kiemKhoItemsMap.size === 0) return;

    const confirmed = await showKiemKhoConfirmModal(
        'Xác Nhận Làm Mới',
        'Bạn có chắc chắn muốn làm mới và xóa toàn bộ dữ liệu phiếu kiểm kho trên màn hình hiện tại?'
    );
    if (!confirmed) return;

    kiemKhoItemsMap.clear();
    kiemKhoTotalScans = 0;
    currentKiemKhoPhieuId = null;
    currentKiemKhoMaPhieu = null;

    localStorage.removeItem("gaia_active_kiemkho_session");

    // Unlock branch selector & reset value if manager
    setKiemKhoBranchSelectDisabled(false);
    const loggedUser = window.getCurrentLoggedUser ? window.getCurrentLoggedUser() : null;
    const isManager = window.isManagerRole ? window.isManagerRole(loggedUser) : false;
    if (isManager) {
        kiemKhoSelectedBranch = '';
        const branchSelect = document.getElementById('kiemkho-filter-branch');
        if (branchSelect) branchSelect.value = '';
    }

    const inputPhieu = document.getElementById('kiemkho-phieu-input');
    if (inputPhieu) inputPhieu.value = '';

    renderKiemKhoTable();

    if (typeof showKiemKhoToast === 'function') {
        showKiemKhoToast('info', 'Đã Làm Mới', '✅ Đã làm mới giao diện phiếu kiểm kho.');
    }
}

// Background Live Monitoring for System Stock Changes & Auto-Detecting New Products
async function checkKiemKhoLiveSystemQtyChanges() {
    const viewKiemKho = document.getElementById('view-kiem-kho');
    if (!viewKiemKho || viewKiemKho.style.display === 'none' || !viewKiemKho.classList.contains('active')) {
        return;
    }

    if (typeof window.fetchVatTuData === 'function') {
        await window.fetchVatTuData();
    }

    let hasStockChange = false;

    // 1. Re-evaluate system stock for existing items in audit list
    kiemKhoItemsMap.forEach(item => {
        const freshSystemQty = getSystemQtyForBranch(item.ma_vach, item.ma_vach, kiemKhoSelectedBranch, item.lot);
        if (freshSystemQty !== item.so_luong_he_thong) {
            item.old_so_luong_he_thong = item.so_luong_he_thong;
            item.so_luong_he_thong = freshSystemQty;
            item.chenh_lech = item.so_luong_thuc_te - item.so_luong_he_thong;
            item.trang_thai = getKiemKhoStatus(item.so_luong_thuc_te, item.so_luong_he_thong);
            item.is_system_qty_changed = true;
            hasStockChange = true;

            syncKiemKhoItemToDB(item);
        }
    });

    // 2. Auto-detect any newly added products/LOTs in system stock for active branch
    if (kiemKhoItemsMap.size > 0) {
        const selectedBranch = kiemKhoSelectedBranch || 'all';
        let targetCN = selectedBranch;
        if (typeof window.extractCNCodeFromBranchString === 'function') {
            targetCN = window.extractCNCodeFromBranchString(selectedBranch);
        } else if (typeof window.extractCNCode === 'function') {
            targetCN = window.extractCNCode(selectedBranch);
        }

        const userName = getKiemKhoLoggedUserName();
        const userBranch = getKiemKhoLoggedBranch();
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
            if (!kiemKhoItemsMap.has(itemKey)) {
                const newItem = {
                    key: itemKey,
                    ma_vach: maVach,
                    ten_hang_hoa: tenHangHoa,
                    lot: lot,
                    date_expiry: dateExpiry,
                    so_luong_thuc_te: 0,
                    so_luong_he_thong: systemQty,
                    chenh_lech: 0 - systemQty,
                    trang_thai: getKiemKhoStatus(0, systemQty),
                    user_name: userName,
                    branch: userBranch,
                    is_system_qty_changed: true,
                    time_scanned: new Date().toISOString()
                };
                kiemKhoItemsMap.set(itemKey, newItem);
                hasStockChange = true;
                syncKiemKhoItemToDB(newItem);
            }
        });
    }

    if (hasStockChange) {
        renderKiemKhoTable();
        playKiemKhoAudio('excess');
    }
}

// Save Audit Session to Supabase Database (`kiem_kho` and `kiem_kho_chi_tiet`)
async function saveKiemKhoSession() {
    const items = Array.from(kiemKhoItemsMap.values());
    if (items.length === 0) {
        showKiemKhoToast('warning', 'Phiếu Kiểm Trống', '⚠️ Chưa có mã hàng nào được quét để lưu phiếu kiểm!');
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
                branch: userBranch
            }));

            const { error: detailErr } = await client
                .from('kiem_kho_chi_tiet')
                .insert(detailsPayload);

            if (detailErr) throw detailErr;
        }

        showVatTuLoading(false);

        showKiemKhoToast(
            'success',
            'Lưu Phiếu Kiểm Thành Công',
            `🎉 Đã lưu phiếu kiểm kho <b>${maPhieu}</b> (${items.length} mã, ${totalScannedQty} sản phẩm) tại chi nhánh <b>${userBranch}</b> thành công!`
        );

        // Reset session after successful save
        kiemKhoItemsMap.clear();
        kiemKhoTotalScans = 0;
        renderKiemKhoTable();

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
        const exportRows = items.map((item, idx) => ({
            "STT": idx + 1,
            "Mã Vạch": item.ma_vach || '',
            "Tên Hàng Hóa": item.ten_hang_hoa || '',
            "LOT": item.lot || '',
            "Date": formatDate(item.date_expiry),
            "Số Lượng Thực Tế": item.so_luong_thuc_te,
            "Tồn Kho Hệ Thống": item.so_luong_he_thong,
            "Chênh Lệch": item.chenh_lech,
            "Trạng Thái": item.trang_thai === 'KHOP' ? 'ĐỦ (KHỚP)' : (item.trang_thai === 'DU' ? 'DƯ' : 'THIẾU'),
            "Người Quét - CN": `${item.user_name || ''} - ${item.branch || ''}`,
            "Thời Gian Quét": formatDateTime(item.time_scanned)
        }));

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
            { wch: 24 }, // Người Quét - CN
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
