let staffData = [];
let editingStaffId = null;
let deletingStaffId = null;

const defaultStaffData = [
    {
        id: "demo-1",
        full_name: "BS. Nguyễn Thanh Nam",
        email: "nam.nguyen@gaia.vn",
        phone: "0918123456",
        password: "123456",
        role: "Nhân viên",
        branch: "Chi Nhánh TP.HCM",
        status: "active"
    },
    {
        id: "demo-2",
        full_name: "Trần Thị Mai",
        email: "mai.tran@gaia.vn",
        phone: "0909888777",
        password: "654321",
        role: "Admin",
        branch: "Chi Nhánh TP.HCM",
        status: "active"
    },
    {
        id: "demo-3",
        full_name: "Lê Hoàng Phúc",
        email: "phuc.le@gaia.vn",
        phone: "0933111222",
        password: "888888",
        role: "Quản lý",
        branch: "Toàn hệ thống",
        status: "active"
    }
];

function getSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        window.supabaseClient = supabaseClient;
        return supabaseClient;
    }
    if (typeof supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_PROJECT_URL') {
        try {
            window.supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            console.log("GAIA Staff: Supabase Client initialized dynamically!");
            return window.supabaseClient;
        } catch (e) {
            console.error("GAIA Staff: Error initializing Supabase:", e);
        }
    }
    return null;
}

document.addEventListener("DOMContentLoaded", () => {
    initStaffModule();
});

function initStaffModule() {
    fetchStaffData();
    bindStaffEvents();
}

async function fetchStaffData() {
    const gridContainer = document.getElementById("staff-list-grid");
    const loadingSpinner = document.getElementById("staff-loading-spinner");
    if (!gridContainer) return;

    if (loadingSpinner) loadingSpinner.style.display = "flex";

    const client = getSupabaseClient();

    try {
        if (client) {
            const { data, error } = await client
                .from('staff')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.warn("GAIA Staff: Supabase fetch error (Table might not exist yet):", error.message || error);
                staffData = getLocalStaffData();
            } else if (data && data.length > 0) {
                staffData = data;
            } else {
                staffData = getLocalStaffData();
            }
        } else {
            staffData = getLocalStaffData();
        }
    } catch (e) {
        console.warn("GAIA Staff: Using local storage fallback:", e);
        staffData = getLocalStaffData();
    } finally {
        if (loadingSpinner) loadingSpinner.style.display = "none";
        updateBranchDropdowns();
        filterStaffList();
        window.staffData = staffData; 
    }
}

function getLocalStaffData() {
    const saved = localStorage.getItem("gaia_staff_list");
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            return defaultStaffData;
        }
    }
    localStorage.setItem("gaia_staff_list", JSON.stringify(defaultStaffData));
    return defaultStaffData;
}

function saveLocalStaffData(data) {
    localStorage.setItem("gaia_staff_list", JSON.stringify(data));
}

function formatBranchStandard(code, name) {
    const c = (code || '').trim().toUpperCase();
    let n = (name || '').trim();
    if (!c && !n) return 'CN1 - Chi Nhánh TP.HCM';
    if (!c) {
        const extracted = extractCNCode(n);
        if (extracted) {
            const prefixRegex = new RegExp(`^${extracted}\\s*-\\s*`, 'i');
            n = n.replace(prefixRegex, '').trim();
            return `${extracted} - ${n || 'Chi Nhánh'}`;
        }
        return `CN1 - ${n}`;
    }
    if (!n) return `${c} - Chi Nhánh ${c.replace(/\D/g, '') || '1'}`;

    // Xóa tiền tố trùng lặp nếu name đã bắt đầu bằng CNx - 
    const prefixRegex = new RegExp(`^${c}\\s*-\\s*`, 'i');
    n = n.replace(prefixRegex, '').trim();
    return `${c} - ${n}`;
}

function updateBranchDropdowns() {
    const branchSelect = document.getElementById("staff-input-branch");
    const branchFilter = document.getElementById("staff-branch-filter");

    const loggedUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem("gaia_logged_user") || "null");
    const roleLower = loggedUser ? (loggedUser.role || "").toLowerCase().trim() : "";
    const isManager = roleLower.includes("quản lý") || roleLower.includes("quan ly") || roleLower.includes("manager");
    const rawMyBranch = (loggedUser ? (loggedUser.branch || "CN1 - Chi Nhánh TP.HCM") : "CN1 - Chi Nhánh TP.HCM").trim();
    const myBranchCode = (loggedUser ? (loggedUser.cn || extractCNCode(rawMyBranch)) : "CN1") || "CN1";
    const myBranch = formatBranchStandard(myBranchCode, rawMyBranch);

    // 1. Lấy danh sách chi nhánh chính thức từ bảng cài đặt cai_dat_he_thong
    const branchList = [];
    const seenFull = new Set();

    if (typeof window.getSystemBranchesDetailed === 'function') {
        const sysBranches = window.getSystemBranchesDetailed();
        if (Array.isArray(sysBranches)) {
            sysBranches.forEach(b => {
                const code = b.code ? b.code.trim().toUpperCase() : '';
                const name = b.name ? b.name.trim() : '';
                if (code || name) {
                    const full = formatBranchStandard(code, name);
                    if (!seenFull.has(full)) {
                        seenFull.add(full);
                        branchList.push({
                            code: code || extractCNCode(full),
                            name: name,
                            full: full
                        });
                    }
                }
            });
        }
    }

    // 2. Dự phòng lấy từ dữ liệu nhân viên hiện có nếu chưa có bảng cài đặt
    if (branchList.length === 0) {
        (staffData || []).forEach(s => {
            if (s.branch && s.branch !== "Toàn hệ thống" && s.branch.trim() !== "") {
                const sCN = s.cn || extractCNCode(s.branch);
                const full = formatBranchStandard(sCN, s.branch);
                if (!seenFull.has(full)) {
                    seenFull.add(full);
                    branchList.push({
                        code: sCN || extractCNCode(full),
                        name: s.branch,
                        full: full
                    });
                }
            }
        });
    }

    if (branchList.length === 0 && myBranch) {
        branchList.push({
            code: myBranchCode,
            name: myBranch,
            full: myBranch
        });
    }

    if (branchSelect && branchSelect.tagName === "SELECT") {
        const savedVal = branchSelect.value;
        branchSelect.innerHTML = "";

        if (!isManager && loggedUser) {
            // Admin: cố định chi nhánh của chính Admin theo chuẩn [Mã Chi Nhánh] - [Tên Chi Nhánh]
            const option = document.createElement("option");
            option.value = myBranch;
            option.textContent = myBranch;
            branchSelect.appendChild(option);
            branchSelect.value = myBranch;
            branchSelect.disabled = true;
            branchSelect.style.opacity = "0.75";
            branchSelect.style.cursor = "not-allowed";
        } else {
            // Quản lý: lấy toàn bộ danh sách chuẩn [Mã Chi Nhánh] - [Tên Chi Nhánh] (VD: CN1 - Chi Nhánh TP.HCM, CN2 - Hiệp Bình)
            if (branchList.length === 0) {
                const opt = document.createElement("option");
                opt.value = "";
                opt.textContent = "(Chưa có chi nhánh - Vui lòng tạo tại Cài Đặt)";
                branchSelect.appendChild(opt);
            } else {
                branchList.forEach(item => {
                    const option = document.createElement("option");
                    option.value = item.full;
                    option.textContent = item.full;
                    branchSelect.appendChild(option);
                });
            }

            if (savedVal) {
                const matchItem = branchList.find(b => b.full === savedVal || b.code === savedVal || b.name === savedVal);
                if (matchItem) {
                    branchSelect.value = matchItem.full;
                }
            }
            branchSelect.disabled = false;
            branchSelect.style.opacity = "1";
            branchSelect.style.cursor = "default";
        }
    }

    if (branchFilter) {
        const filterWrap = document.getElementById("wrap-staff-branch-filter") || branchFilter.closest(".staff-select-wrap");

        if (!isManager && loggedUser) {
            branchFilter.style.display = "none";
            if (filterWrap) filterWrap.style.display = "none";
        } else {
            branchFilter.style.display = "";
            if (filterWrap) filterWrap.style.display = "";

            const currentSelected = branchFilter.value;
            branchFilter.innerHTML = `<option value="all">Tất cả chi nhánh</option>`;
            branchList.forEach(item => {
                const option = document.createElement("option");
                option.value = item.full;
                option.textContent = item.full;
                branchFilter.appendChild(option);
            });
            if (currentSelected) branchFilter.value = currentSelected;
        }
    }
}

function getNextAvailableCNCode() {
    const existingCNNumbers = new Set();

    (staffData || []).forEach(s => {
        const cn = s.cn || extractCNCode(s.branch);
        const match = (cn || "").match(/^CN(\d+)$/i);
        if (match) {
            existingCNNumbers.add(parseInt(match[1], 10));
        }
    });

    let nextNum = 1;
    while (existingCNNumbers.has(nextNum)) {
        nextNum++;
    }
    return `CN${nextNum}`;
}

function toggleStaffCustomBranch() {
    const branchSelect = document.getElementById("staff-input-branch");
    const customWrap = document.getElementById("staff-custom-branch-wrap");
    if (branchSelect && customWrap) {
        if (branchSelect.value === "__custom__") {
            customWrap.style.display = "block";
            const customInput = document.getElementById("staff-input-branch-custom");
            if (customInput) {
                if (!customInput.value.trim()) {
                    const nextCN = getNextAvailableCNCode();
                    customInput.value = `${nextCN} - `;
                }
                customInput.focus();
            }
        } else {
            customWrap.style.display = "none";
        }
    }
}

async function updateAllStaffBranchForCN(cnCode, newBranchStr) {
    const client = getSupabaseClient();
    const newCN = extractCNCode(newBranchStr);

    if (client) {
        try {
            const { error } = await client
                .from('staff')
                .update({ 
                    branch: newBranchStr, 
                    cn: newCN,
                    updated_at: new Date().toISOString()
                })
                .eq('cn', cnCode);
            if (error) console.error("GAIA Staff: Error cascading branch update in Supabase:", error);
        } catch (e) {
            console.error("GAIA Staff: Exception cascading branch update:", e);
        }
    }

    (staffData || []).forEach(s => {
        const sCN = s.cn || extractCNCode(s.branch);
        if (sCN.toUpperCase() === cnCode.toUpperCase()) {
            s.branch = newBranchStr;
            s.cn = newCN;
        }
    });

    saveLocalStaffData(staffData);

    const loggedUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem("gaia_logged_user") || "null");
    if (loggedUser) {
        const userCN = loggedUser.cn || extractCNCode(loggedUser.branch || "");
        if (userCN.toUpperCase() === cnCode.toUpperCase()) {
            if (typeof window.checkAndUpdateCurrentUserLive === 'function') {
                window.checkAndUpdateCurrentUserLive({ branch: newBranchStr, cn: newCN });
            }
        }
    }
}

function showBranchConfirmModal(cnCode, oldBranchStr, newBranchStr) {
    return new Promise((resolve) => {
        const modal = document.getElementById("branch-confirm-modal");
        const cnTag = document.getElementById("branch-confirm-cn-tag");
        const oldText = document.getElementById("branch-confirm-old-text");
        const newText = document.getElementById("branch-confirm-new-text");
        const btnOk = document.getElementById("btn-branch-confirm-ok");
        const btnCancel = document.getElementById("btn-branch-confirm-cancel");

        if (!modal || !btnOk || !btnCancel) {
            resolve(confirm(`Mã chi nhánh [${cnCode}] đã tồn tại với địa chỉ cũ:\n"${oldBranchStr}"\n\nBạn có muốn CẬP NHẬT tên/địa chỉ mới:\n"${newBranchStr}"\ncho tất cả nhân viên thuộc chi nhánh [${cnCode}] không?`));
            return;
        }

        if (cnTag) cnTag.textContent = `Mã CN: ${cnCode}`;
        if (oldText) oldText.textContent = `"${oldBranchStr}"`;
        if (newText) newText.textContent = `"${newBranchStr}"`;

        modal.style.zIndex = "100005";
        modal.classList.add("show");

        const cleanup = (result) => {
            modal.classList.remove("show");
            btnOk.removeEventListener("click", onOk);
            btnCancel.removeEventListener("click", onCancel);
            resolve(result);
        };

        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);

        btnOk.addEventListener("click", onOk);
        btnCancel.addEventListener("click", onCancel);
    });
}

function bindStaffEvents() {
    const btnAdd = document.getElementById("btn-add-staff");
    const modal = document.getElementById("staff-modal");
    const btnCloseModal = document.getElementById("btn-close-staff-modal");
    const form = document.getElementById("staff-form");
    const searchInput = document.getElementById("staff-search-input");
    const branchFilter = document.getElementById("staff-branch-filter");
    const roleInput = document.getElementById("staff-input-role");
    const btnToggleFormPass = document.getElementById("btn-toggle-form-pass");

    const deleteModal = document.getElementById("staff-delete-modal");
    const btnConfirmDelete = document.getElementById("btn-confirm-delete-staff");

    if (btnAdd) {
        btnAdd.addEventListener("click", () => {
            openStaffModal();
        });
    }

    if (btnCloseModal) {
        btnCloseModal.addEventListener("click", () => {
            closeStaffModal();
        });
    }

    if (deleteModal) {
        deleteModal.addEventListener("click", (e) => {
            if (e.target === deleteModal) closeDeleteStaffModal();
        });
    }

    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", async () => {
            await executeDeleteStaff();
        });
    }

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            await handleSaveStaff();
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", filterStaffList);
    }

    if (branchFilter) {
        branchFilter.addEventListener("change", filterStaffList);
    }

    if (roleInput) {
        roleInput.addEventListener("change", () => {
            toggleBranchFieldByRole(roleInput.value);
        });
    }

    if (btnToggleFormPass) {
        btnToggleFormPass.addEventListener("click", () => {
            const passInput = document.getElementById("staff-input-pass");
            if (!passInput) return;
            if (passInput.type === "password") {
                passInput.type = "text";
                btnToggleFormPass.style.color = "#10b981";
            } else {
                passInput.type = "password";
                btnToggleFormPass.style.color = "var(--text-muted)";
            }
        });
    }

    ["staff-input-name", "staff-input-email", "staff-input-phone", "staff-input-pass", "staff-input-branch"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", () => {
                clearSingleInputError(id);
            });
        }
    });
}

function toggleBranchFieldByRole(roleValue) {
    const branchGroup = document.getElementById("group-staff-branch");
    const branchInput = document.getElementById("staff-input-branch");

    if (!branchGroup) return;

    if (roleValue === "Quản lý") {
        branchGroup.style.display = "none";
        if (branchInput) branchInput.value = "Toàn hệ thống";
    } else {
        branchGroup.style.display = "flex";
        if (branchInput && branchInput.value === "Toàn hệ thống") {
            branchInput.value = "Chi Nhánh TP.HCM";
        }
    }
}

function filterStaffList() {
    const query = (document.getElementById("staff-search-input")?.value || "").toLowerCase().trim();
    const branchVal = document.getElementById("staff-branch-filter")?.value || "all";

    const loggedUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem("gaia_logged_user") || "null");

    const roleLower = loggedUser ? (loggedUser.role || "").toLowerCase().trim() : "";
    const isManager = roleLower.includes("quản lý") || roleLower.includes("quan ly") || roleLower.includes("manager");
    const isAdmin = roleLower === "admin";
    const myEmail = loggedUser ? (loggedUser.email || "").toLowerCase().trim() : "";
    const myBranch = loggedUser ? (loggedUser.branch || "Chi Nhánh TP.HCM").toLowerCase().trim() : "";

    const filtered = staffData.filter(item => {
        const itemEmail = (item.email || "").toLowerCase().trim();
        const itemRole = (item.role || "").toLowerCase().trim();
        const itemBranch = (item.branch || "Chi Nhánh TP.HCM").toLowerCase().trim();

        const isSelf = (loggedUser && item.id && String(item.id) === String(loggedUser.id)) ||
                       (loggedUser && itemEmail && myEmail && itemEmail === myEmail) ||
                       (loggedUser && item.full_name && loggedUser.full_name && item.full_name.trim().toLowerCase() === loggedUser.full_name.trim().toLowerCase());
        if (isSelf) return false;

        if (!isManager && loggedUser) {
            const userCN = loggedUser.cn || extractCNCode(loggedUser.branch || "");
            const itemCN = item.cn || extractCNCode(item.branch || "");
            const isTargetManager = itemRole.includes("quản lý") || itemRole.includes("quan ly") || itemRole.includes("manager");

            if (!isTargetManager) {
                if (userCN && itemCN && userCN.toUpperCase() !== itemCN.toUpperCase()) {
                    return false; 
                }
            }
        }

        const matchesQuery = !query || 
            (item.full_name && item.full_name.toLowerCase().includes(query)) ||
            (item.email && item.email.toLowerCase().includes(query)) ||
            (item.phone && item.phone.toLowerCase().includes(query));

        const matchesBranch = branchVal === "all" || (item.branch && item.branch.toLowerCase() === branchVal.toLowerCase());

        return matchesQuery && matchesBranch;
    });

    renderStaffList(filtered);
}

function renderStaffList(list) {
    if (typeof applyRolePermissions === 'function') applyRolePermissions();

    const gridContainer = document.getElementById("staff-list-grid");
    const emptyState = document.getElementById("staff-empty-state");
    if (!gridContainer) return;

    gridContainer.innerHTML = "";

    if (!list || list.length === 0) {
        if (emptyState) emptyState.style.display = "block";
        return;
    }

    if (emptyState) emptyState.style.display = "none";

    list.forEach(staff => {
        const card = createStaffCard(staff);
        gridContainer.appendChild(card);
    });
}

function createStaffCard(staff) {
    const div = document.createElement("div");
    div.className = "staff-card";

    const loggedUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem("gaia_logged_user") || "null");
    const myRoleLower = loggedUser ? (loggedUser.role || "").toLowerCase().trim() : "";
    const isLoggedAdmin = myRoleLower === "admin";

    const targetRoleLower = (staff.role || "").toLowerCase().trim();
    const isTargetManager = targetRoleLower.includes("quản lý") || targetRoleLower.includes("quan ly") || targetRoleLower.includes("manager");

    const isSuperior = isLoggedAdmin && isTargetManager;

    const initials = staff.full_name ? staff.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : "NV";

    let roleClass = "role-badge-default";
    const roleVal = staff.role || "Nhân viên";
    if (roleVal === "Quản lý") roleClass = "role-badge-manager";
    else if (roleVal === "Admin") roleClass = "role-badge-admin";
    else roleClass = "role-badge-staff";

    let actionsHtml = "";
    if (!isSuperior) {
        actionsHtml = `
            <button type="button" class="btn-staff-action btn-edit" title="Chỉnh sửa" onclick="editStaff('${staff.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button type="button" class="btn-staff-action btn-delete" title="Xóa nhân viên" onclick="promptDeleteStaff('${staff.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
    }

    let passToggleHtml = "";
    if (!isSuperior) {
        passToggleHtml = `
            <button type="button" class="btn-toggle-pass" onclick="togglePassVisibility('${staff.id}', '${escapeHtml(staff.password)}')">
                <svg id="pass-icon-${staff.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
        `;
    }

    let branchRowHtml = "";
    if (!isTargetManager) {
        branchRowHtml = `
            <div class="staff-info-row">
                <span class="info-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                </span>
                <span class="info-text branch-tag">${escapeHtml(staff.branch || 'Chi Nhánh TP.HCM')}</span>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="staff-card-header">
            <div class="staff-avatar">${initials}</div>
            <div class="staff-header-info">
                <h3 class="staff-name">${escapeHtml(staff.full_name || 'Chưa nhập tên')}</h3>
                <span class="staff-role-badge ${roleClass}">${escapeHtml(roleVal)}</span>
            </div>
            <div class="staff-actions">
                ${actionsHtml}
            </div>
        </div>
        <div class="staff-card-body">
            <div class="staff-info-row">
                <span class="info-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                </span>
                <span class="info-text">${escapeHtml(staff.email || 'Chưa có email')}</span>
            </div>
            <div class="staff-info-row">
                <span class="info-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                </span>
                <span class="info-text">${escapeHtml(staff.phone || 'Chưa có SĐT')}</span>
            </div>
            <div class="staff-info-row">
                <span class="info-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </span>
                <span class="info-text password-text" id="pass-text-${staff.id}">••••••</span>
                ${passToggleHtml}
            </div>
            ${branchRowHtml}
        </div>
    `;

    return div;
}

window.togglePassVisibility = function(id, rawPassword) {
    const textEl = document.getElementById(`pass-text-${id}`);
    if (!textEl) return;

    if (textEl.textContent === '••••••') {
        textEl.textContent = rawPassword;
        textEl.classList.add("revealed");
    } else {
        textEl.textContent = '••••••';
        textEl.classList.remove("revealed");
    }
};

function showInputError(inputId, errId, message) {
    const inputEl = document.getElementById(inputId);
    const errEl = document.getElementById(errId);

    if (inputEl) inputEl.style.borderColor = "#ef4444";
    if (errEl) {
        errEl.textContent = message;
        errEl.classList.add("active");
    }
}

function clearAllInputErrors() {
    ["staff-input-name", "staff-input-email", "staff-input-phone", "staff-input-pass", "staff-input-branch"].forEach(id => {
        clearSingleInputError(id);
    });
}

function clearSingleInputError(inputId) {
    const inputEl = document.getElementById(inputId);
    if (inputEl) inputEl.style.borderColor = "";

    const errIdMap = {
        "staff-input-name": "err-staff-name",
        "staff-input-email": "err-staff-email",
        "staff-input-phone": "err-staff-phone",
        "staff-input-pass": "err-staff-pass",
        "staff-input-branch": "err-staff-branch"
    };

    const errEl = document.getElementById(errIdMap[inputId]);
    if (errEl) {
        errEl.textContent = "";
        errEl.classList.remove("active");
    }
}

function openStaffModal(staff = null) {
    const modal = document.getElementById("staff-modal");
    const modalTitle = document.getElementById("staff-modal-title");
    const form = document.getElementById("staff-form");

    if (!modal || !form) return;

    form.reset();
    clearAllInputErrors();
    updateBranchDropdowns();

    const passInput = document.getElementById("staff-input-pass");
    if (passInput) passInput.type = "password";

    const loggedUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem("gaia_logged_user") || "null");
    const myRoleLower = loggedUser ? (loggedUser.role || "").toLowerCase().trim() : "";
    const isLoggedManager = myRoleLower.includes("quản lý") || myRoleLower.includes("quan ly") || myRoleLower.includes("manager");
    const isLoggedAdmin = !isLoggedManager;
    const myBranch = loggedUser ? (loggedUser.branch || "Chi Nhánh TP.HCM") : "Chi Nhánh TP.HCM";

    const roleSelect = document.getElementById("staff-input-role");
    const branchInput = document.getElementById("staff-input-branch");

    if (roleSelect) {
        const quanLyOption = roleSelect.querySelector('option[value="Quản lý"]');
        if (quanLyOption) {
            quanLyOption.disabled = isLoggedAdmin;
        }
    }

    if (staff) {
        editingStaffId = staff.id;
        if (modalTitle) modalTitle.textContent = "Chỉnh Sửa Thông Tin Nhân Viên";
        document.getElementById("staff-input-name").value = staff.full_name || "";
        document.getElementById("staff-input-email").value = staff.email || "";
        document.getElementById("staff-input-phone").value = staff.phone || "";
        document.getElementById("staff-input-pass").value = staff.password || "";

        const roleVal = staff.role || "Nhân viên";
        if (roleSelect) roleSelect.value = roleVal;
        toggleBranchFieldByRole(roleVal);

        if (branchInput) {
            updateBranchDropdowns();
            const staffBranch = isLoggedAdmin ? myBranch : (staff.branch || myBranch);
            branchInput.value = staffBranch || (branchInput.options[0] ? branchInput.options[0].value : "");
        }

        const isSelf = (loggedUser && staff.id && String(staff.id) === String(loggedUser.id)) ||
                       (loggedUser && staff.email && staff.email.toLowerCase() === loggedUser.email.toLowerCase());

        if (isSelf) {
            if (roleSelect) { roleSelect.disabled = true; roleSelect.style.opacity = "0.5"; }
            if (branchInput) { branchInput.disabled = true; branchInput.style.opacity = "0.5"; }
        } else {
            if (roleSelect) { roleSelect.disabled = false; roleSelect.style.opacity = "1"; }
            if (branchInput) {
                branchInput.disabled = isLoggedAdmin;
                branchInput.style.opacity = isLoggedAdmin ? "0.7" : "1";
                branchInput.style.cursor = isLoggedAdmin ? "not-allowed" : "default";
                branchInput.title = isLoggedAdmin ? `Admin chỉ quản lý nhân viên thuộc chi nhánh ${myBranch}` : "";
            }
        }
    } else {
        editingStaffId = null;
        if (modalTitle) modalTitle.textContent = "Thêm Nhân Viên Mới";
        if (roleSelect) {
            roleSelect.value = "Nhân viên";
            roleSelect.disabled = false;
            roleSelect.style.opacity = "1";
        }
        toggleBranchFieldByRole("Nhân viên");

        if (branchInput) {
            updateBranchDropdowns();
            const targetVal = isLoggedAdmin ? myBranch : (branchInput.options[0] ? branchInput.options[0].value : "");
            branchInput.value = targetVal;
            branchInput.disabled = isLoggedAdmin;
            branchInput.style.opacity = isLoggedAdmin ? "0.7" : "1";
            branchInput.style.cursor = isLoggedAdmin ? "not-allowed" : "default";
            branchInput.title = isLoggedAdmin ? `Admin chỉ có thể thêm nhân viên cho chi nhánh ${myBranch}` : "";
        }
    }

    modal.classList.add("show");
}

function closeStaffModal() {
    const modal = document.getElementById("staff-modal");
    if (modal) modal.classList.remove("show");
    editingStaffId = null;
    clearAllInputErrors();

    const roleSelect = document.getElementById("staff-input-role");
    const branchInput = document.getElementById("staff-input-branch");
    if (roleSelect) { roleSelect.disabled = false; roleSelect.style.opacity = "1"; }
    if (branchInput) { branchInput.disabled = false; branchInput.style.opacity = "1"; }
}

window.editStaff = function(id) {
    const staff = staffData.find(s => String(s.id) === String(id));
    if (staff) {
        openStaffModal(staff);
    }
};

async function handleSaveStaff() {
    clearAllInputErrors();

    const name = document.getElementById("staff-input-name").value.trim();
    const email = document.getElementById("staff-input-email").value.trim();
    const phone = document.getElementById("staff-input-phone").value.trim();
    const password = document.getElementById("staff-input-pass").value.trim();
    const role = document.getElementById("staff-input-role").value;

    const branchSelect = document.getElementById("staff-input-branch");
    const customBranchInput = document.getElementById("staff-input-branch-custom");
    let branch = "";
    if (branchSelect) {
        if (branchSelect.value === "__custom__") {
            branch = customBranchInput ? customBranchInput.value.trim() : "";
        } else {
            branch = branchSelect.value.trim();
        }
    }

    if (role === "Quản lý") {
        branch = "Toàn hệ thống";
    } else if (!branch) {
        branch = "Chi Nhánh TP.HCM";
    }

    let hasError = false;

    if (!name) {
        showInputError("staff-input-name", "err-staff-name", "Vui lòng nhập họ và tên nhân viên");
        hasError = true;
    }

    if (!email) {
        showInputError("staff-input-email", "err-staff-email", "Vui lòng nhập địa chỉ email");
        hasError = true;
    }

    if (!phone) {
        showInputError("staff-input-phone", "err-staff-phone", "Vui lòng nhập số điện thoại");
        hasError = true;
    }

    if (!password) {
        showInputError("staff-input-pass", "err-staff-pass", "Vui lòng nhập mật khẩu");
        hasError = true;
    }

    if (hasError) return;

    const phoneRegex = /^0\d{9,10}$/;
    if (!phoneRegex.test(phone)) {
        showInputError("staff-input-phone", "err-staff-phone", "Số điện thoại phải bao gồm 10 chữ số bắt đầu bằng số 0 (VD: 0918123456)");
        return;
    }

    const isDuplicateEmail = staffData.some(s => 
        s.email && 
        s.email.toLowerCase() === email.toLowerCase() && 
        String(s.id) !== String(editingStaffId)
    );

    if (isDuplicateEmail) {
        showInputError("staff-input-email", "err-staff-email", `Email "${email}" đã tồn tại trong hệ thống! Vui lòng dùng email khác.`);
        return;
    }

    if (password.length < 6) {
        showInputError("staff-input-pass", "err-staff-pass", "Mật khẩu phải có tối thiểu 6 ký tự tùy ý (chữ, số, ký tự đặc biệt)");
        return;
    }

function extractCNCode(branchStr) {
    if (!branchStr) return "";
    const str = branchStr.trim();
    if (str.includes("-")) {
        return str.split("-")[0].trim();
    }
    const match = str.match(/^(CN\d+|CN[A-Za-z0-9]+)/i);
    if (match) {
        return match[1].toUpperCase();
    }
    return str;
}

    const rawBranch = branch ? branch.trim() : '';
    const cnCode = extractCNCode(rawBranch) || 'CN1';
    const standardBranch = (role === "Quản lý") ? "Toàn hệ thống" : formatBranchStandard(cnCode, rawBranch);

    if (role !== "Quản lý" && cnCode) {
        const existingBranchesWithSameCN = Array.from(new Set(
            (staffData || [])
                .filter(s => {
                    const sCN = s.cn || extractCNCode(s.branch);
                    return sCN && sCN.toUpperCase() === cnCode.toUpperCase() && s.branch;
                })
                .map(s => s.branch.trim())
        ));

        const oldBranchStr = existingBranchesWithSameCN.find(bStr => bStr.toLowerCase() !== standardBranch.toLowerCase());

        if (oldBranchStr) {
            const proceed = await showBranchConfirmModal(cnCode, oldBranchStr, standardBranch);

            if (proceed) {
                await updateAllStaffBranchForCN(cnCode, standardBranch);
            } else {
                return; 
            }
        }
    }

    const payload = {
        full_name: name,
        email: email,
        phone: phone,
        password: password,
        role: role,
        branch: standardBranch,
        cn: (role === "Quản lý") ? "ALL" : cnCode,
        status: 'active',
        updated_at: new Date().toISOString()
    };

    const submitBtn = document.querySelector("#staff-form .btn-submit-save");
    const originalHTML = submitBtn ? submitBtn.innerHTML : "Lưu Nhân Viên";
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 0.8s linear infinite;width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px"><circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="5"/></svg> Đang lưu...`;
    }

    const client = getSupabaseClient();

    try {
        if (client) {
            if (editingStaffId) {

                const { error } = await client
                    .from('staff')
                    .update(payload)
                    .eq('id', editingStaffId);

                if (error) {
                    console.error("GAIA Staff: Supabase update error:", error);
                    showInputError("staff-input-name", "err-staff-name", "Chưa thể cập nhật Supabase: " + (error.message || JSON.stringify(error)));
                }
            } else {

                const { data, error } = await client
                    .from('staff')
                    .insert([payload])
                    .select();

                if (error) {
                    console.error("GAIA Staff: Supabase insert error:", error);
                    showInputError("staff-input-name", "err-staff-name", "Chưa thể chèn Supabase: " + (error.message || JSON.stringify(error)));
                } else if (data && data[0]) {
                    payload.id = data[0].id;
                }
            }
        }
    } catch (e) {
        console.error("GAIA Staff: Network/Supabase exception:", e);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHTML;
        }

        if (editingStaffId) {
            const idx = staffData.findIndex(s => String(s.id) === String(editingStaffId));
            if (idx !== -1) staffData[idx] = { ...staffData[idx], ...payload };
        } else {
            if (!payload.id) payload.id = "local-" + Date.now();
            staffData.unshift(payload);
        }

        saveLocalStaffData(staffData);
        updateBranchDropdowns();
        filterStaffList();
        closeStaffModal();

        if (typeof window.checkAndUpdateCurrentUserLive === 'function') {
            window.checkAndUpdateCurrentUserLive({ ...payload, id: editingStaffId });
        }
    }
}

window.promptDeleteStaff = function(id) {
    const staff = staffData.find(s => String(s.id) === String(id));
    if (!staff) return;

    deletingStaffId = id;

    const nameEl = document.getElementById("delete-staff-name-text");
    if (nameEl) nameEl.textContent = `"${staff.full_name}"`;

    const deleteModal = document.getElementById("staff-delete-modal");
    if (deleteModal) deleteModal.classList.add("show");
};

function closeDeleteStaffModal() {
    const deleteModal = document.getElementById("staff-delete-modal");
    if (deleteModal) deleteModal.classList.remove("show");
    deletingStaffId = null;
}

async function executeDeleteStaff() {
    if (!deletingStaffId) return;

    const id = deletingStaffId;
    const client = getSupabaseClient();

    try {
        if (client && !String(id).startsWith("demo-") && !String(id).startsWith("local-")) {
            const { error } = await client.from('staff').delete().eq('id', id);
            if (error) {
                console.error("GAIA Staff: Delete error:", error);
            }
        }
    } catch (e) {
        console.warn("GAIA Staff: Delete Supabase warning:", e);
    } finally {
        staffData = staffData.filter(s => String(s.id) !== String(id));
        saveLocalStaffData(staffData);
        updateBranchDropdowns();
        filterStaffList();
        closeDeleteStaffModal();
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
