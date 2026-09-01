/* ==========================================================================
   GAIA Animal Hospital - Authentication & Role Permission Engine (auth.js)
   Login System, Role Access Control, Live Profile Update & Supabase Sync
   ========================================================================== */

let currentUser = null;
let supabaseRealtimeChannel = null;

// Initial Fallback Users if database is empty
const defaultAuthUsers = [
    {
        id: "demo-admin",
        full_name: "Bác Sĩ Trưởng (Admin)",
        email: "admin@gaia.vn",
        phone: "0918123456",
        password: "123456",
        role: "Admin",
        branch: "Chi Nhánh TP.HCM"
    },
    {
        id: "demo-quanly",
        full_name: "Quản Lý Hệ Thống GAIA",
        email: "quanly@gaia.vn",
        phone: "0909888777",
        password: "123456",
        role: "Quản lý",
        branch: "Toàn hệ thống"
    },
    {
        id: "demo-nhanvien",
        full_name: "Nguyễn Văn Nhân Viên",
        email: "nhanvien@gaia.vn",
        phone: "0933111222",
        password: "123456",
        role: "Nhân viên",
        branch: "Chi Nhánh TP.HCM"
    }
];

document.addEventListener("DOMContentLoaded", () => {
    initAuthEngine();
});

// Initialize Auth State
function initAuthEngine() {
    bindAuthEvents();
    checkSavedUserSession();
    initSupabaseRealtimeSync();
}

// Get or Initialize Supabase Client
function getAuthSupabaseClient() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
    if (typeof supabase !== 'undefined' && typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_PROJECT_URL') {
        try {
            window.supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            return window.supabaseClient;
        } catch (e) {
            console.error("Auth: Supabase init error:", e);
        }
    }
    return null;
}

// Check Local Saved Session
function checkSavedUserSession() {
    const saved = localStorage.getItem("gaia_logged_user");
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            showAppInterface();
            return;
        } catch (e) {
            currentUser = null;
        }
    }
    showLoginScreen();
}

// Show Login Screen Overlay
function showLoginScreen() {
    const loginScreen = document.getElementById("login-screen");
    const appWrapper = document.querySelector(".app-wrapper");

    if (loginScreen) loginScreen.style.display = "flex";
    if (appWrapper) appWrapper.style.display = "none";
}

// Show Main App Interface & Apply Permissions
function showAppInterface() {
    const loginScreen = document.getElementById("login-screen");
    const appWrapper = document.querySelector(".app-wrapper");

    if (loginScreen) loginScreen.style.display = "none";
    if (appWrapper) appWrapper.style.display = "flex";

    updateHeaderProfileWidget();
    applyRolePermissions();
}

// Bind Event Listeners
function bindAuthEvents() {
    const loginForm = document.getElementById("login-form");
    const btnLogout = document.getElementById("btn-app-logout");
    const widget = document.getElementById("user-profile-widget");
    const btnEditProfile = document.getElementById("btn-edit-my-profile");
    const profileForm = document.getElementById("profile-edit-form");
    const loginThemeToggle = document.getElementById("login-theme-toggle-btn");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            await handleLoginSubmit();
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            handleLogout();
        });
    }

    // Toggle Header Dropdown
    if (widget) {
        widget.addEventListener("click", (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById("user-profile-dropdown");
            if (dropdown) dropdown.classList.toggle("show");
        });

        document.addEventListener("click", () => {
            const dropdown = document.getElementById("user-profile-dropdown");
            if (dropdown) dropdown.classList.remove("show");
        });
    }

    if (btnEditProfile) {
        btnEditProfile.addEventListener("click", () => {
            openProfileEditModal();
        });
    }

    if (profileForm) {
        profileForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            await handleSaveMyProfile();
        });
    }

    // Theme toggle button on login screen
    if (loginThemeToggle) {
        loginThemeToggle.addEventListener("click", () => {
            if (typeof toggleTheme === 'function') {
                toggleTheme();
            } else {
                const current = document.documentElement.getAttribute("data-theme") || "dark";
                const target = current === "dark" ? "light" : "dark";
                document.documentElement.setAttribute("data-theme", target);
                localStorage.setItem("gaia_theme", target);
            }
        });
    }
}

// Handle Login Submit
async function handleLoginSubmit() {
    const emailInput = document.getElementById("login-email");
    const passInput = document.getElementById("login-pass");
    const errEl = document.getElementById("login-error-msg");

    if (!emailInput || !passInput) return;

    const email = emailInput.value.trim().toLowerCase();
    const password = passInput.value.trim();

    if (errEl) {
        errEl.textContent = "";
        errEl.style.display = "none";
    }

    if (!email || !password) {
        showLoginError("Vui lòng điền đầy đủ Email và Mật khẩu!");
        return;
    }

    const client = getAuthSupabaseClient();
    let foundUser = null;

    try {
        if (client) {
            // Search in Supabase 'staff' table
            const { data, error } = await client
                .from('staff')
                .select('*')
                .eq('email', email)
                .eq('password', password)
                .maybeSingle();

            if (!error && data) {
                foundUser = data;
            }
        }
    } catch (e) {
        console.warn("Auth: Supabase query exception:", e);
    }

    // Local Storage / Seed Data Fallback Search
    if (!foundUser) {
        let localList = [];
        const saved = localStorage.getItem("gaia_staff_list");
        if (saved) {
            try { localList = JSON.parse(saved); } catch (e) { }
        }
        if (!localList || localList.length === 0) localList = defaultAuthUsers;

        foundUser = localList.find(u =>
            u.email && u.email.toLowerCase() === email &&
            String(u.password) === String(password)
        );
    }

    if (foundUser) {
        currentUser = foundUser;
        localStorage.setItem("gaia_logged_user", JSON.stringify(currentUser));
        showAppInterface();
    } else {
        showLoginError("Email hoặc mật khẩu không chính xác! Vui lòng thử lại.");
    }
}

function showLoginError(msg) {
    const errEl = document.getElementById("login-error-msg");
    if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = "block";
    }
}

// Handle Logout
function handleLogout() {
    currentUser = null;
    localStorage.removeItem("gaia_logged_user");
    const dropdown = document.getElementById("user-profile-dropdown");
    if (dropdown) dropdown.classList.remove("show");
    showLoginScreen();
}

// Update Top-Right Profile Header Widget
function updateHeaderProfileWidget() {
    if (!currentUser) return;

    const avatarEl = document.getElementById("header-user-avatar");
    const nameEl = document.getElementById("header-user-name");
    const roleEl = document.getElementById("header-user-role");
    const emailEl = document.getElementById("dropdown-user-email");
    const phoneEl = document.getElementById("dropdown-user-phone");

    const initials = currentUser.full_name ? currentUser.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : "NV";

    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = currentUser.full_name || "Tài khoản";

    if (roleEl) {
        const roleVal = currentUser.role || "Nhân viên";
        roleEl.textContent = roleVal;

        // Reset classes
        roleEl.className = "user-role-badge";
        if (roleVal === "Quản lý") roleEl.classList.add("role-badge-manager");
        else if (roleVal === "Admin") roleEl.classList.add("role-badge-admin");
        else roleEl.classList.add("role-badge-staff");
    }

    if (emailEl) emailEl.textContent = currentUser.email || "";
    if (phoneEl) phoneEl.textContent = currentUser.phone || "Chưa có SĐT";

    const locationBranchEl = document.getElementById("header-user-branch-location");
    if (locationBranchEl) {
        locationBranchEl.textContent = currentUser.branch || "Chi Nhánh TP.HCM";
    }
}

// Apply Role Permissions (RBAC)
function applyRolePermissions() {
    if (!currentUser) return;

    const roleLower = (currentUser.role || "").toLowerCase().trim();
    // Only Admin and Quản lý have full access to Staff Management View
    const isAdminOrManager = roleLower === "admin" || roleLower.includes("quản lý") || roleLower.includes("quan ly") || roleLower.includes("manager");
    const isEmployee = !isAdminOrManager;

    const accessDeniedBox = document.getElementById("staff-access-denied-box");
    const staffModuleContent = document.getElementById("staff-module-content");

    if (isEmployee) {
        // Show Access Denied Box and Hide Staff Module Content for all Non-Admin/Manager users
        if (accessDeniedBox) accessDeniedBox.style.display = "flex";
        if (staffModuleContent) staffModuleContent.style.display = "none";
    } else {
        // Show Staff Module Content for 'Admin' and 'Quản lý'
        if (accessDeniedBox) accessDeniedBox.style.display = "none";
        if (staffModuleContent) staffModuleContent.style.display = "block";
    }
}

// Live update check when staff data changes locally or via DB
window.checkAndUpdateCurrentUserLive = function (updatedStaff) {
    if (!currentUser || !updatedStaff) return;

    const isMatch = (updatedStaff.id && String(updatedStaff.id) === String(currentUser.id)) ||
        (updatedStaff.email && updatedStaff.email.toLowerCase() === currentUser.email.toLowerCase());

    if (isMatch) {
        console.log("GAIA Auth: Current user permissions/role/branch updated live:", updatedStaff);
        currentUser = { ...currentUser, ...updatedStaff };
        localStorage.setItem("gaia_logged_user", JSON.stringify(currentUser));
        updateHeaderProfileWidget();
        applyRolePermissions();

        // Refresh top control bar branch filter select and sync all count stats live!
        if (typeof initBranchFilterDropdown === 'function') {
            initBranchFilterDropdown();
        }
        if (typeof fetchInitialIntakes === 'function') {
            fetchInitialIntakes();
        } else {
            if (typeof applyStatusFilter === 'function') applyStatusFilter();
            if (typeof updateScheduleCountBadge === 'function') updateScheduleCountBadge();
        }
    }
};

// Open Profile Edit Modal
function openProfileEditModal() {
    if (!currentUser) return;

    const modal = document.getElementById("profile-edit-modal");
    const form = document.getElementById("profile-edit-form");
    const dropdown = document.getElementById("user-profile-dropdown");

    if (dropdown) dropdown.classList.remove("show");
    if (!modal || !form) return;

    form.reset();
    clearProfileErrors();

    document.getElementById("my-input-name").value = currentUser.full_name || "";
    document.getElementById("my-input-email").value = currentUser.email || "";
    document.getElementById("my-input-phone").value = currentUser.phone || "";
    document.getElementById("my-input-new-pass").value = ""; // Leave blank by default!
    document.getElementById("my-input-current-pass").value = "";

    modal.classList.add("show");
}

function closeProfileEditModal() {
    const modal = document.getElementById("profile-edit-modal");
    if (modal) modal.classList.remove("show");
    clearProfileErrors();
}

function clearProfileErrors() {
    ["my-input-name", "my-input-email", "my-input-phone", "my-input-new-pass", "my-input-current-pass"].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.style.borderColor = "";
    });

    ["err-my-name", "err-my-email", "err-my-phone", "err-my-new-pass", "err-my-current-pass"].forEach(id => {
        const err = document.getElementById(id);
        if (err) { err.textContent = ""; err.classList.remove("active"); }
    });
}

function showProfileError(inputId, errId, msg) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(errId);
    if (input) input.style.borderColor = "#ef4444";
    if (err) { err.textContent = msg; err.classList.add("active"); }
}

// Save Profile Edits (Requires Current Password)
async function handleSaveMyProfile() {
    if (!currentUser) return;

    clearProfileErrors();

    const name = document.getElementById("my-input-name").value.trim();
    const email = document.getElementById("my-input-email").value.trim();
    const phone = document.getElementById("my-input-phone").value.trim();
    const newPass = document.getElementById("my-input-new-pass").value.trim();
    const currentPass = document.getElementById("my-input-current-pass").value.trim();

    let hasError = false;

    if (!name) { showProfileError("my-input-name", "err-my-name", "Vui lòng nhập họ tên"); hasError = true; }
    if (!email) { showProfileError("my-input-email", "err-my-email", "Vui lòng nhập email"); hasError = true; }
    if (!phone) { showProfileError("my-input-phone", "err-my-phone", "Vui lòng nhập số điện thoại"); hasError = true; }

    if (!currentPass) {
        showProfileError("my-input-current-pass", "err-my-current-pass", "Vui lòng nhập mật khẩu hiện tại để xác nhận");
        hasError = true;
    } else if (String(currentPass) !== String(currentUser.password)) {
        showProfileError("my-input-current-pass", "err-my-current-pass", "Mật khẩu hiện tại không chính xác!");
        hasError = true;
    }

    if (hasError) return;

    // Validate Phone format
    const phoneRegex = /^0\d{9,10}$/;
    if (!phoneRegex.test(phone)) {
        showProfileError("my-input-phone", "err-my-phone", "SĐT phải gồm 10 số (VD: 0918123456)");
        return;
    }

    // New Password is OPTIONAL. If entered, must be >= 6 characters (any characters allowed!)
    let finalPassword = currentUser.password;
    if (newPass) {
        if (newPass.length < 6) {
            showProfileError("my-input-new-pass", "err-my-new-pass", "Mật khẩu mới phải có tối thiểu 6 ký tự tùy ý");
            return;
        }
        finalPassword = newPass;
    }

    const myBranch = currentUser.branch || "";
    let cnCode = "";
    if (myBranch.includes("-")) {
        cnCode = myBranch.split("-")[0].trim();
    } else {
        const match = myBranch.match(/^(CN\d+|CN[A-Za-z0-9]+)/i);
        cnCode = match ? match[1].toUpperCase() : myBranch;
    }

    const updatedUser = {
        ...currentUser,
        full_name: name,
        email: email,
        phone: phone,
        password: finalPassword,
        cn: cnCode,
        updated_at: new Date().toISOString()
    };

    const client = getAuthSupabaseClient();

    try {
        if (client && !String(currentUser.id).startsWith("demo-")) {
            const { error } = await client
                .from('staff')
                .update({
                    full_name: name,
                    email: email,
                    phone: phone,
                    password: finalPassword,
                    cn: cnCode,
                    updated_at: updatedUser.updated_at
                })
                .eq('id', currentUser.id);

            if (error) console.error("Auth: Save profile Supabase error:", error);
        }
    } catch (e) {
        console.warn("Auth: Save profile exception:", e);
    } finally {
        currentUser = updatedUser;
        localStorage.setItem("gaia_logged_user", JSON.stringify(currentUser));

        // Sync with local staff list if available
        let staffList = JSON.parse(localStorage.getItem("gaia_staff_list") || "[]");
        const idx = staffList.findIndex(s => String(s.id) === String(currentUser.id));
        if (idx !== -1) {
            staffList[idx] = { ...staffList[idx], ...updatedUser };
            localStorage.setItem("gaia_staff_list", JSON.stringify(staffList));
        }

        updateHeaderProfileWidget();
        applyRolePermissions();
        closeProfileEditModal();

        if (typeof initBranchFilterDropdown === 'function') initBranchFilterDropdown();
        if (typeof fetchInitialIntakes === 'function') fetchInitialIntakes();

        if (typeof fetchStaffData === 'function') fetchStaffData();
    }
}

// Silent DB Poll Sync for active logged in user
async function syncCurrentUserFromDatabase() {
    if (!currentUser || !currentUser.email) return;

    const client = getAuthSupabaseClient();
    if (!client) return;

    try {
        const { data, error } = await client
            .from('staff')
            .select('*')
            .eq('email', currentUser.email)
            .limit(1);

        if (!error && data && data[0]) {
            const dbUser = data[0];
            // If role, name or branch in DB differs from current session, update live!
            if (dbUser.role !== currentUser.role || dbUser.full_name !== currentUser.full_name || dbUser.branch !== currentUser.branch) {
                console.log("GAIA Auth: Silent sync detected DB change for user:", dbUser);
                window.checkAndUpdateCurrentUserLive(dbUser);
            }
        }
    } catch (e) {
        console.warn("GAIA Auth: Silent sync error:", e);
    }
}

// Supabase Realtime Listener (Syncs DB role changes instantly without relogging)
function initSupabaseRealtimeSync() {
    const client = getAuthSupabaseClient();
    if (!client) return;

    if (!supabaseRealtimeChannel) {
        try {
            supabaseRealtimeChannel = client
                .channel('public:staff-realtime-auth')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, (payload) => {
                    console.log("GAIA Auth: Realtime staff update received:", payload);

                    if (payload.new) {
                        window.checkAndUpdateCurrentUserLive(payload.new);
                    }

                    // If staff view is open, refresh staff list automatically
                    if (typeof fetchStaffData === 'function') {
                        fetchStaffData();
                    }
                })
                .subscribe();

            console.log("GAIA Auth: Supabase Realtime Sync activated successfully!");
        } catch (e) {
            console.warn("GAIA Auth: Could not subscribe to Supabase Realtime:", e);
        }
    }

    // Also sync on window focus and every 10 seconds as fail-safe fallback
    window.removeEventListener('focus', syncCurrentUserFromDatabase);
    window.addEventListener('focus', syncCurrentUserFromDatabase);

    if (!window.gaiaAuthSyncInterval) {
        window.gaiaAuthSyncInterval = setInterval(syncCurrentUserFromDatabase, 10000);
    }
}

/* ==========================================================================
   Branch Permission & Role Access Control Engine
   Quản lý: Views ALL data across system
   Admin & Nhân viên: ONLY view data of their own branch (resolved via User)
   ========================================================================== */

window.getCurrentLoggedUser = function () {
    if (currentUser) return currentUser;
    try {
        const saved = localStorage.getItem("gaia_logged_user");
        if (saved) return JSON.parse(saved);
    } catch (e) { }
    return null;
};

window.isManagerRole = function (user) {
    const u = user || window.getCurrentLoggedUser();
    if (!u) return false;
    const roleLower = (u.role || "").toLowerCase().trim();
    return roleLower.includes("quản lý") || roleLower.includes("quan ly") || roleLower.includes("manager");
};

window.getUserBranch = function (userNameOrEmail) {
    if (!userNameOrEmail) return "";
    const cleanQuery = String(userNameOrEmail).toLowerCase().trim();

    let staffList = [];
    try {
        const saved = localStorage.getItem("gaia_staff_list");
        if (saved) staffList = JSON.parse(saved);
    } catch (e) { }

    if (!staffList || staffList.length === 0) {
        staffList = (typeof defaultAuthUsers !== 'undefined') ? defaultAuthUsers : [
            { full_name: "Thái Trung Tín (Quản Lý)", email: "quanly@gaia.vn", role: "Quản lý", branch: "Toàn hệ thống" },
            { full_name: "Bác Sĩ Trưởng (Admin)", email: "admin@gaia.vn", role: "Admin", branch: "Chi Nhánh TP.HCM" },
            { full_name: "Nguyễn Văn Nhân Viên", email: "nhanvien@gaia.vn", role: "Nhân viên", branch: "Chi Nhánh TP.HCM" },
            { full_name: "Bác sĩ Thú y Hùng", role: "Nhân viên", branch: "Chi Nhánh TP.HCM" },
            { full_name: "Kỹ thuật viên Nam", role: "Nhân viên", branch: "Chi Nhánh Hà Nội" }
        ];
    }

    const found = staffList.find(s => {
        const nameMatch = s.full_name && (cleanQuery.includes(s.full_name.toLowerCase().trim()) || s.full_name.toLowerCase().trim().includes(cleanQuery));
        const emailMatch = s.email && s.email.toLowerCase().trim() === cleanQuery;
        const idMatch = s.id && String(s.id).toLowerCase().trim() === cleanQuery;
        return nameMatch || emailMatch || idMatch;
    });

    return found ? found.branch : "";
};

if (typeof window.extractCNCode !== 'function') {
    window.extractCNCode = function (branchStr) {
        if (!branchStr) return "";
        const str = String(branchStr).toUpperCase().trim();
        const match = str.match(/CN\s*(\d+)/) || str.match(/CHI\s*NHÁNH\s*(\d+)/) || str.match(/CƠ\s*SỞ\s*(\d+)/);
        if (match) return `CN${match[1]}`;
        if (str.includes("TP.HCM") || str.includes("TPHCM") || str.includes("HỒ CHÍ MINH")) return "CN_TPHCM";
        if (str.includes("HÀ NỘI") || str.includes("HANOI")) return "CN_HANOI";
        return str;
    };
}

window.canUserAccessRecord = function (record) {
    if (!record) return true;
    const loggedUser = window.getCurrentLoggedUser();
    if (!loggedUser) return true; // Default show if no login session

    // Rule 1: Quản Lý (Manager) can view ALL data across all branches
    if (window.isManagerRole(loggedUser)) {
        return true;
    }

    // Rule 2: Admin & Nhân Viên ONLY view data of their branch (via User branch)
    const userBranch = loggedUser.branch || "Chi Nhánh TP.HCM";
    const userCN = window.extractCNCode(userBranch);

    if (!userBranch || userBranch === "Toàn hệ thống" || userBranch === "all") {
        return true;
    }

    // Determine branch of the record creator/owner
    let recordBranch = record.branch || record.chi_nhanh || "";
    if (!recordBranch && record.user_name) {
        recordBranch = window.getUserBranch(record.user_name);
    }

    if (recordBranch) {
        const recordCN = window.extractCNCode(recordBranch);
        if (userCN && recordCN && userCN === recordCN) return true;
        if (recordBranch.toLowerCase().trim() === userBranch.toLowerCase().trim()) return true;
    }

    // Fallback: Check if record creator is the logged user themselves
    if (record.user_name && loggedUser.full_name) {
        const recordUser = record.user_name.toLowerCase().trim();
        const me = loggedUser.full_name.toLowerCase().trim();
        if (recordUser.includes(me) || me.includes(recordUser)) return true;
    }

    // If record branch matches user branch, allow access; otherwise restrict
    return false;
};
