let intakesData = [];
let supabaseClient = null;
let soundEnabled = true;
let loyalPhones = new Set(); 
let duplicateIds = new Set(); 
let activeIntakeRecord = null; 

let viewDate = new Date(); 
viewDate.setHours(0, 0, 0, 0);
let isAllDates = false; 

let currentStatusFilter = 'all';

let currentPage = 1;
const itemsPerPage = 20;

const loadingSpinner = document.getElementById("loading-spinner");
const noDataPlaceholder = document.getElementById("no-data-placeholder");
const intakesList = document.getElementById("intakes-list");
const searchInput = document.getElementById("dashboard-search");

const statDate = document.getElementById("stat-date");

const soundToggleBtn = document.getElementById("sound-toggle-btn");
const soundOnIcon = soundToggleBtn.querySelector(".icon-sound-on");
const soundOffIcon = soundToggleBtn.querySelector(".icon-sound-off");
const soundStatusSpan = soundToggleBtn.querySelector("span");

const qrToggleBtn = document.getElementById("qr-toggle-btn");
const qrModal = document.getElementById("qr-modal");
const qrModalCloseBtn = document.getElementById("qr-modal-close-btn");
const qrCodeContainer = document.getElementById("qr-code-container");
const qrDeclarationUrl = document.getElementById("qr-declaration-url");
const qrCopyLinkBtn = document.getElementById("qr-copy-link-btn");
const qrDownloadBtn = document.getElementById("qr-download-btn");

const detailsModal = document.getElementById("details-modal");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalPrintBtn = document.getElementById("modal-print-btn");

const modalPatientId = document.getElementById("modal-patient-id");
const dOwnerName = document.getElementById("detail-owner-name");
const dOwnerPhone = document.getElementById("detail-owner-phone");
const dOwnerAddress = document.getElementById("detail-owner-address");
const dPetName = document.getElementById("detail-pet-name");
const dPetBreed = document.getElementById("detail-pet-breed");
const dPetWeight = document.getElementById("detail-pet-weight");
const dPetAgeGender = document.getElementById("detail-pet-age-gender");
const dPetNeutered = document.getElementById("detail-pet-neutered");
const dPetColor = document.getElementById("detail-pet-color");
const dVacCore = document.getElementById("detail-vac-core");
const dVacRabies = document.getElementById("detail-vac-rabies");
const dVacParasite = document.getElementById("detail-vac-parasite");
const dMedHistory = document.getElementById("detail-med-history");
const dAllergies = document.getElementById("detail-allergies");
const dMeds = document.getElementById("detail-meds");
const dDietTags = document.getElementById("detail-diet-tags");
const dDateSigned = document.getElementById("detail-date-signed");
const dSignatureImg = document.getElementById("detail-signature-img");

document.addEventListener("DOMContentLoaded", async () => {

    updateDateDisplay();

    initSoundToggle();
    initLiveTypingIndicator();
    initMoreOptionsDropdown();

    if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_PROJECT_URL') {
        try {
            supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            window.supabaseClient = supabaseClient;
            console.log("GAIA Dashboard: Supabase Client initialized successfully!");
        } catch (e) {
            console.error("GAIA Dashboard: Supabase initialization error:", e);
            showErrorState("Lỗi kết nối máy chủ Supabase. Hãy kiểm tra lại env.js.");
            return;
        }
    } else {
        showErrorState("Chưa cấu hình Supabase URL và Key trong env.js. Vui lòng điền thông tin dự án.");
        return;
    }

    await Promise.all([
        fetchLoyalPhones(),
        fetchInitialIntakes()
    ]);

    setupRealtimeSubscription();

    setupEventListeners();
});

async function fetchInitialIntakes() {
    try {
        loadingSpinner.style.display = "flex";
        noDataPlaceholder.style.display = "none";
        intakesList.style.display = "none";

        let query = supabaseClient.from('pet_intakes').select('*');

        const loggedUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem("gaia_logged_user") || "null");
        const roleLower = loggedUser ? (loggedUser.role || "").toLowerCase().trim() : "";
        const isManager = roleLower.includes("quản lý") || roleLower.includes("quan ly") || roleLower.includes("manager");

        if (!isManager && loggedUser) {
            const userCN = loggedUser.cn || extractCNCode(loggedUser.branch || "");
            if (userCN) {
                query = query.eq('cn', userCN);
            }
        }

        if (!isAllDates) {

            const dayStart = new Date(viewDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(viewDate);
            dayEnd.setHours(23, 59, 59, 999);

            query = query
                .gte('created_at', dayStart.toISOString())
                .lte('created_at', dayEnd.toISOString());
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        intakesData = data || [];
        currentPage = 1;

        initBranchFilterDropdown();

        applyStatusFilter();
        updateScheduleCountBadge();
    } catch (e) {
        console.error("GAIA Dashboard: Error fetching initial data:", e);
        showErrorState(`Không thể tải dữ liệu: ${e.message || e}`);
    } finally {
        loadingSpinner.style.display = "none";
    }
}

window.updateScheduleCountBadge = async function () {
    const todayEl = document.getElementById("schedule-today-count");
    const totalEl = document.getElementById("schedule-total-count");
    if (!todayEl && !totalEl) return;

    const todayStr = new Date().toISOString().substring(0, 10);
    const isNewRecord = (r) => !r.trang_thai || r.trang_thai === 'new';

    const scopedIntakes = (intakesData && Array.isArray(intakesData)) ? intakesData.filter(isRecordInSelectedBranch) : [];

    const todayNewCount = scopedIntakes.filter(r => {
        const dateStr = (r.created_at || r.date_signed || "").substring(0, 10);
        return isNewRecord(r) && dateStr === todayStr;
    }).length;

    const totalNewCount = scopedIntakes.filter(r => isNewRecord(r)).length;

    if (todayEl) {
        todayEl.textContent = todayNewCount;
        todayEl.style.display = todayNewCount > 0 ? "inline-flex" : "none";
    }

    if (totalEl) {
        totalEl.textContent = `(${totalNewCount})`;
        totalEl.style.display = "inline-flex";
    }
};

async function fetchLoyalPhones() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('pet_intakes')
            .select('owner_phone');
        if (error) throw error;

        const counts = {};
        if (data) {
            data.forEach(r => {
                if (r.owner_phone) {
                    const phone = r.owner_phone.trim();
                    counts[phone] = (counts[phone] || 0) + 1;
                }
            });
        }

        loyalPhones.clear();
        for (const [phone, count] of Object.entries(counts)) {
            if (count > 1) {
                loyalPhones.add(phone);
            }
        }
    } catch (e) {
        console.error("GAIA Dashboard: Error fetching loyal phones:", e);
    }
}

function analyzeDuplicates() {
    duplicateIds.clear();
    const groups = {}; 

    intakesData.forEach(record => {
        if (!record.owner_phone || !record.pet_name) return;

        const phone = record.owner_phone.trim();
        const petName = record.pet_name.trim().toLowerCase();

        let dateStr = "";
        if (record.created_at) {
            dateStr = record.created_at.substring(0, 10);
        } else if (record.date_signed) {
            dateStr = record.date_signed.substring(0, 10);
        }

        if (!dateStr) return;

        const key = `${phone}_${dateStr}_${petName}`;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(record.id);
    });

    for (const ids of Object.values(groups)) {
        if (ids.length > 1) {
            ids.forEach(id => duplicateIds.add(id));
        }
    }
}

function setupRealtimeSubscription() {
    if (!supabaseClient) return;

    try {
        supabaseClient
            .channel('realtime-intake-channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'pet_intakes' },
                (payload) => {
                    console.log("GAIA Dashboard: Realtime insert received!", payload.new);
                    handleIncomingIntake(payload.new);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'pet_intakes' },
                (payload) => {
                    console.log("GAIA Dashboard: Realtime update received!", payload.new);
                    handleIncomingUpdate(payload.new);
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'pet_intakes' },
                (payload) => {
                    console.log("GAIA Dashboard: Realtime delete received!", payload.old);
                    handleIncomingDelete(payload.old);
                }
            )
            .subscribe((status) => {
                console.log("GAIA Dashboard: Realtime subscription status:", status);
                const indicator = document.querySelector(".status-indicator");
                if (indicator) {
                    if (status === 'SUBSCRIBED') {
                        indicator.className = "status-indicator live";
                        const txt = indicator.querySelector(".status-text");
                        if (txt) txt.textContent = "LIVE";
                    } else {
                        indicator.className = "status-indicator";
                        const txt = indicator.querySelector(".status-text");
                        if (txt) txt.textContent = "DISCONNECTED";
                    }
                }
            });
    } catch (e) {
        console.error("GAIA Dashboard: Realtime subscription error:", e);
    }
}

async function handleIncomingIntake(newRecord) {

    const recDate = new Date(newRecord.created_at);
    const recDay = new Date(recDate); recDay.setHours(0, 0, 0, 0);
    const viewDay = new Date(viewDate); viewDay.setHours(0, 0, 0, 0);

    if (isAllDates || recDay.getTime() === viewDay.getTime()) {

        const exists = intakesData.some(r => r.id === newRecord.id);
        if (!exists) {

            intakesData.unshift(newRecord);

            await fetchLoyalPhones();

            calculateStatistics(intakesData);

            applyStatusFilter();
            updateScheduleCountBadge();

            playAlertPing();

            noDataPlaceholder.style.display = "none";
            intakesList.style.display = "grid";
        }
    }
}

function handleIncomingUpdate(updatedRecord) {
    const idx = intakesData.findIndex(r => r.id === updatedRecord.id);
    if (idx !== -1) {

        const oldRecord = intakesData[idx];
        const mergedRecord = { ...oldRecord, ...updatedRecord };

        if (oldRecord.pet_photo && !updatedRecord.pet_photo) {
            mergedRecord.pet_photo = oldRecord.pet_photo;
        }

        intakesData[idx] = mergedRecord;

        calculateStatistics(intakesData);
        applyStatusFilter();

        const detailsModal = document.getElementById("details-modal");
        const modalPatientId = document.getElementById("modal-patient-id");
        if (detailsModal && detailsModal.classList.contains("show") && modalPatientId) {
            const currentModalId = modalPatientId.textContent.replace("#ID-", "");
            if (parseInt(currentModalId) === mergedRecord.id) {

                openIntakeDetails(mergedRecord);
            }
        }
    } else {

        const recDate = new Date(updatedRecord.created_at);
        const recDay = new Date(recDate); recDay.setHours(0, 0, 0, 0);
        const viewDay = new Date(viewDate); viewDay.setHours(0, 0, 0, 0);

        if (isAllDates || recDay.getTime() === viewDay.getTime()) {
            intakesData.unshift(updatedRecord);
            calculateStatistics(intakesData);
            applyStatusFilter();
        }
    }
}

async function handleIncomingDelete(oldRecord) {
    const idx = intakesData.findIndex(r => r.id === oldRecord.id);
    if (idx !== -1) {
        intakesData.splice(idx, 1);

        await fetchLoyalPhones();

        calculateStatistics(intakesData);
        applyStatusFilter();

        const detailsModal = document.getElementById("details-modal");
        const modalPatientId = document.getElementById("modal-patient-id");
        if (detailsModal && detailsModal.classList.contains("show") && modalPatientId) {
            const currentModalId = modalPatientId.textContent.replace("#ID-", "");
            if (parseInt(currentModalId) === oldRecord.id) {
                detailsModal.classList.remove("show");
            }
        }
    }
}

function playAlertPing() {
    if (!soundEnabled) return;

    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.type = "sine";

        osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(1109, audioCtx.currentTime + 0.12); 

        gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8); 

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
        console.error("GAIA Dashboard: Failed to synthesize notification sound:", e);
    }
}

function initMoreOptionsDropdown() {
    const btnMoreOptions = document.getElementById("btn-more-options");
    const moreOptionsDropdown = document.getElementById("more-options-dropdown");

    if (btnMoreOptions && moreOptionsDropdown) {
        btnMoreOptions.addEventListener("click", (e) => {
            e.stopPropagation();
            moreOptionsDropdown.classList.toggle("show");
        });

        document.addEventListener("click", (e) => {
            if (!moreOptionsDropdown.contains(e.target) && !btnMoreOptions.contains(e.target)) {
                moreOptionsDropdown.classList.remove("show");
            }
        });
    }
}

function getPhotosArray(petPhotoString) {
    if (!petPhotoString) return [];
    try {
        const parsed = JSON.parse(petPhotoString);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        return [petPhotoString];
    } catch (e) {

        return [petPhotoString];
    }
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

function isRecordInSelectedBranch(record) {
    const selectEl = document.getElementById("branch-select-filter");
    const loggedUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem("gaia_logged_user") || "null");
    if (!loggedUser) return true;

    const roleLower = (loggedUser.role || "").toLowerCase().trim();
    const isManager = roleLower.includes("quản lý") || roleLower.includes("quan ly") || roleLower.includes("manager");

    let selectedBranch = selectEl ? selectEl.value : "all";

    if (!isManager) {
        selectedBranch = loggedUser.cn || extractCNCode(loggedUser.branch || "");
    }

    if (!selectedBranch || selectedBranch === "all") return true;

    const recordCN = (record.cn || extractCNCode(record.chi_nhanh || record.branch || "")).toUpperCase().trim();
    return recordCN === selectedBranch.toUpperCase().trim();
}

function initBranchFilterDropdown() {
    const selectEl = document.getElementById("branch-select-filter");
    if (!selectEl) return;

    const loggedUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem("gaia_logged_user") || "null");
    const roleLower = loggedUser ? (loggedUser.role || "").toLowerCase().trim() : "";
    const isManager = roleLower.includes("quản lý") || roleLower.includes("quan ly") || roleLower.includes("manager");

    let userCN = loggedUser ? (loggedUser.cn || extractCNCode(loggedUser.branch || "")) : "";
    userCN = userCN ? userCN.toUpperCase().trim() : "";

    const cnMap = new Map();

    // 1. Ưu tiên lấy từ bảng cài đặt cai_dat_he_thong
    if (typeof window.getSystemBranchesDetailed === 'function') {
        const sysBranches = window.getSystemBranchesDetailed();
        sysBranches.forEach(b => {
            if (b.code && b.code !== 'ALL') {
                cnMap.set(b.code, b.name || `Chi nhánh ${b.code}`);
            }
        });
    }

    if (userCN && !cnMap.has(userCN)) {
        cnMap.set(userCN, `Chi nhánh ${userCN}`);
    }

    (intakesData || []).forEach(item => {
        const c = (item.cn || extractCNCode(item.chi_nhanh || item.branch || "")).toUpperCase().trim();
        if (c && !cnMap.has(c)) cnMap.set(c, `Chi nhánh ${c}`);
    });

    if (cnMap.size === 0) {
        cnMap.set("CN1", "Chi nhánh CN1");
    }

    const currentSelection = selectEl.value;
    selectEl.innerHTML = "";

    if (isManager) {
        selectEl.disabled = false;
        selectEl.style.opacity = "1";
        selectEl.style.cursor = "pointer";

        const optAll = document.createElement("option");
        optAll.value = "all";
        optAll.textContent = "🌐 Tất cả chi nhánh";
        selectEl.appendChild(optAll);

        Array.from(cnMap.keys()).sort().forEach(cnCode => {
            const opt = document.createElement("option");
            opt.value = cnCode;
            opt.textContent = `📍 ${cnMap.get(cnCode)} (${cnCode})`;
            selectEl.appendChild(opt);
        });

        selectEl.value = currentSelection && cnMap.has(currentSelection) ? currentSelection : "all";
    } else {

        selectEl.disabled = true;
        selectEl.style.opacity = "0.85";
        selectEl.style.cursor = "not-allowed";

        const opt = document.createElement("option");
        opt.value = userCN || "CN1";
        opt.textContent = `🔒 ${userCN || "CN1"}`;
        selectEl.appendChild(opt);
        selectEl.value = userCN || "CN1";
    }

    selectEl.removeEventListener("change", handleBranchFilterChange);
    selectEl.addEventListener("change", handleBranchFilterChange);
}

function handleBranchFilterChange() {
    applyStatusFilter();
}

function applyStatusFilter() {

    analyzeDuplicates();

    const scopedData = intakesData.filter(isRecordInSelectedBranch);

    const totalCount = scopedData.length;
    const newCount = scopedData.filter(r => !r.trang_thai || r.trang_thai === 'new').length;
    const doneCount = scopedData.filter(r => r.trang_thai === 'done').length;

    const countAllEl = document.getElementById("count-all");
    const countNewEl = document.getElementById("count-new");
    const countDoneEl = document.getElementById("count-done");

    if (countAllEl) countAllEl.textContent = totalCount;
    if (countNewEl) countNewEl.textContent = newCount;
    if (countDoneEl) countDoneEl.textContent = doneCount;

    let filtered = scopedData;
    if (currentStatusFilter === 'new') {
        filtered = scopedData.filter(r => !r.trang_thai || r.trang_thai === 'new');
    } else if (currentStatusFilter === 'done') {
        filtered = scopedData.filter(r => r.trang_thai === 'done');
    } else {
        filtered = scopedData;
    }

    const query = searchInput.value.toLowerCase().trim();
    if (query) {
        filtered = filtered.filter(record =>
            (record.owner_name && record.owner_name.toLowerCase().includes(query)) ||
            (record.owner_phone && record.owner_phone.toLowerCase().includes(query)) ||
            (record.pet_name && record.pet_name.toLowerCase().includes(query)) ||
            (record.pet_breed && record.pet_breed.toLowerCase().includes(query))
        );
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    if (currentPage < 1) {
        currentPage = 1;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

    renderAllIntakes(paginatedItems);
    renderPagination(totalItems);
    updateScheduleCountBadge();
}

function renderPagination(totalItems) {
    const container = document.getElementById("pagination-container");
    if (!container) return;

    container.innerHTML = "";

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) {

        return;
    }

    const prevBtn = document.createElement("button");
    prevBtn.className = "pagination-btn pagination-btn-arrow";
    prevBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            applyStatusFilter();
            scrollToIntakesList();
        }
    });
    container.appendChild(prevBtn);

    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        const firstBtn = document.createElement("button");
        firstBtn.className = `pagination-btn ${currentPage === 1 ? 'active' : ''}`;
        firstBtn.textContent = "1";
        firstBtn.addEventListener("click", () => {
            currentPage = 1;
            applyStatusFilter();
            scrollToIntakesList();
        });
        container.appendChild(firstBtn);

        if (startPage > 2) {
            const dots = document.createElement("span");
            dots.className = "pagination-dots";
            dots.textContent = "...";
            container.appendChild(dots);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement("button");
        btn.className = `pagination-btn ${currentPage === i ? 'active' : ''}`;
        btn.textContent = i;
        btn.addEventListener("click", () => {
            currentPage = i;
            applyStatusFilter();
            scrollToIntakesList();
        });
        container.appendChild(btn);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement("span");
            dots.className = "pagination-dots";
            dots.textContent = "...";
            container.appendChild(dots);
        }

        const lastBtn = document.createElement("button");
        lastBtn.className = `pagination-btn ${currentPage === totalPages ? 'active' : ''}`;
        lastBtn.textContent = totalPages;
        lastBtn.addEventListener("click", () => {
            currentPage = totalPages;
            applyStatusFilter();
            scrollToIntakesList();
        });
        container.appendChild(lastBtn);
    }

    const nextBtn = document.createElement("button");
    nextBtn.className = "pagination-btn pagination-btn-arrow";
    nextBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
            currentPage++;
            applyStatusFilter();
            scrollToIntakesList();
        }
    });
    container.appendChild(nextBtn);
}

function scrollToIntakesList() {
    const listEl = document.getElementById("intakes-list");
    if (listEl) {
        const yOffset = -120;
        const y = listEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
}

function renderAllIntakes(records) {
    intakesList.innerHTML = "";

    if (records.length === 0) {
        noDataPlaceholder.style.display = "flex";
        intakesList.style.display = "none";

        const h3 = noDataPlaceholder.querySelector("h3");
        const p = noDataPlaceholder.querySelector("p");
        const query = searchInput.value.toLowerCase().trim();
        if (query) {
            if (h3) h3.textContent = "Không tìm thấy kết quả phù hợp";
            if (p) p.textContent = "Hãy kiểm tra lại từ khóa tìm kiếm của bạn.";
        } else if (currentStatusFilter === 'new') {
            if (h3) h3.textContent = "Không có ca nào chưa xử lý";
            if (p) p.textContent = "Tất cả đã được đánh dấu xử lý!";
        } else if (currentStatusFilter === 'done') {
            if (h3) h3.textContent = "Chưa có ca nào được xử lý";
            if (p) p.textContent = "Hãy nhấn 'Xác nhận Xử lý' trên từng thẻ bệnh nhân.";
        } else {
            if (h3) h3.textContent = "Chưa có ca đăng ký nào";
            if (p) p.textContent = "Mở trang đăng ký gửi form !";
        }
        return;
    }

    noDataPlaceholder.style.display = "none";
    intakesList.style.display = "grid";

    records.forEach(record => {
        const card = createIntakeCard(record);
        intakesList.appendChild(card);
    });
}

function getFormattedIntakeId(record) {
    if (!record) return "--.------.----";
    const dateObj = new Date(record.created_at || record.date_signed || new Date());
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yy = String(dateObj.getFullYear()).slice(-2);
    const dateDDMMYY = `${d}${m}${yy}`;

    const rawPhone = String(record.owner_phone || "").replace(/\D/g, "");
    const phoneTail = rawPhone.slice(-4).padStart(4, '0');

    const sameDayRecords = (intakesData || []).filter(r => {
        const dt = new Date(r.created_at || r.date_signed || new Date());
        const dtDDMMYY = `${String(dt.getDate()).padStart(2, '0')}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getFullYear()).slice(-2)}`;
        return dtDDMMYY === dateDDMMYY;
    }).sort((a, b) => (new Date(a.created_at || 0)) - (new Date(b.created_at || 0)));

    const seqIdx = sameDayRecords.findIndex(r => r.id === record.id);
    const stt = String(seqIdx >= 0 ? seqIdx + 1 : 1).padStart(2, '0');
    return `${stt}.${dateDDMMYY}.${phoneTail}`;
}

function createIntakeCard(record) {
    const card = document.createElement("div");
    const gaiaIdStr = getFormattedIntakeId(record);
    const isDone = record.trang_thai === 'done';
    card.className = `intake-card ${isDone ? 'card-status-done' : 'card-status-new'}`;
    card.setAttribute("data-id", record.id);
    card.setAttribute("data-status", isDone ? 'done' : 'new');

    const isLoyal = record.owner_phone && loyalPhones.has(record.owner_phone.trim()) && (!record.trang_thai || record.trang_thai === 'new');
    const loyalBadgeHTML = isLoyal
        ? `<span class="customer-loyal-badge" title="Khách hàng đã đăng ký nhiều lần">(Khách quen)</span>`
        : ``;

    const isDuplicate = duplicateIds.has(record.id);
    const duplicateHTML = isDuplicate
        ? `<div class="duplicate-indicator-wrap">
            <span class="duplicate-exclamation" title="Trùng số điện thoại, ngày đăng ký và tên thú cưng trong ngày">!</span>
            <button class="btn-delete-duplicate" data-id="${record.id}" title="Xóa ca khai báo trùng lặp này">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
            </button>
           </div>`
        : ``;

    const localTimeStr = formatDateTime(record.created_at || record.date_signed);

    const coreClass = record.vaccine_core === 'yes' ? 'badge-yes' : (record.vaccine_core === 'no' ? 'badge-no' : 'badge-unknown');
    const coreText = record.vaccine_core === 'yes' ? 'Core Vac ✓' : (record.vaccine_core === 'no' ? 'Core Vac ✗' : 'Core Vac ?');

    const rabiesClass = record.vaccine_rabies === 'yes' ? 'badge-yes' : (record.vaccine_rabies === 'no' ? 'badge-no' : 'badge-unknown');
    const rabiesText = record.vaccine_rabies === 'yes' ? 'Rabies ✓' : (record.vaccine_rabies === 'no' ? 'Rabies ✗' : 'Rabies ?');

    const neuteredClass = record.pet_neutered === 'yes' ? 'badge-neutered' : 'badge-unknown';
    const neuteredText = record.pet_neutered === 'yes' ? 'Đã Triệt Sản' : 'Chưa Triệt Sản';

    const statusBadgeHTML = isDone
        ? `<span class="card-status-badge badge-done-card">✔ Đã xử lý</span>`
        : `<span class="card-status-badge badge-new-card">● Mới</span>`;

    const toggleBtnHTML = isDone
        ? `<button class="btn-toggle-status btn-mark-new" data-id="${record.id}" title="Đánh dấu là Mới">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 18 0A9 9 0 0 0 3 12z"/><path d="M12 8v4m0 4h.01"/></svg>
            Đánh dấu Mới
           </button>`
        : `<button class="btn-toggle-status btn-mark-done" data-id="${record.id}" title="Đánh dấu Đã xử lý">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Xác nhận Xử lý
           </button>`;

    const photosArray = getPhotosArray(record.pet_photo);
    const coverHTML = photosArray.length > 0
        ? `<div class="card-cover-wrap"><img src="${photosArray[0]}" class="card-cover-img" alt="${escapeHtml(record.pet_name)}"></div>`
        : `<div class="card-cover-wrap">
            <div class="card-cover-placeholder">
                <svg viewBox="0 0 24 24" fill="currentColor" style="width: 36px; height: 36px; opacity: 0.85;">
                    <circle cx="12" cy="14" r="4"/>
                    <circle cx="6.5" cy="10.5" r="2"/>
                    <circle cx="17.5" cy="10.5" r="2"/>
                    <circle cx="9" cy="6" r="2"/>
                    <circle cx="15" cy="6" r="2"/>
                </svg>
                <span>GAIA Animal Hospital Ho Chi Minh City</span>
            </div>
           </div>`;

    card.innerHTML = `
        ${coverHTML}
        <div class="card-body-wrap">
            <div class="card-top">
                <div class="pet-details-brief" style="width: 100%;">
                    <div style="margin-bottom: 5px;">
                        <span class="card-id-badge">ID: ${gaiaIdStr}</span>
                    </div>
                    <div class="pet-name-row">
                        <h3>${escapeHtml(record.pet_name)}</h3>
                        ${duplicateHTML}
                    </div>
                    <p class="pet-breed-tag">${escapeHtml(record.pet_breed)}</p>
                </div>
                <div class="card-top-right">
                    ${statusBadgeHTML}
                    <span class="time-stamp-badge">${localTimeStr}</span>
                </div>
            </div>
            <div class="card-owner-info">
                <div class="owner-row">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="owner-icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span>Chủ: <strong>${escapeHtml(record.owner_name)}</strong></span>
                </div>
                <div class="owner-row">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="owner-icon"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    <span>SĐT: <strong>${escapeHtml(record.owner_phone)}</strong>${loyalBadgeHTML}</span>
                </div>
            </div>
            <div class="card-bottom-tags">
                <span class="badge ${coreClass}">${coreText}</span>
                <span class="badge ${rabiesClass}">${rabiesText}</span>
                <span class="badge ${neuteredClass}">${neuteredText}</span>
            </div>
            <div class="card-action-row">
                ${toggleBtnHTML}
            </div>
        </div>
    `;

    card.addEventListener("click", (e) => {
        if (e.target.closest(".btn-toggle-status") || e.target.closest(".btn-delete-duplicate")) return; 
        openIntakeDetails(record);
    });

    const toggleBtn = card.querySelector(".btn-toggle-status");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await toggleCardStatus(record, card, toggleBtn);
        });
    }

    const deleteDupBtn = card.querySelector(".btn-delete-duplicate");
    if (deleteDupBtn) {
        deleteDupBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await deleteDuplicateRecord(record, deleteDupBtn);
        });
    }

    return card;
}

function showCustomConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById("confirm-delete-modal");
        const textEl = document.getElementById("confirm-delete-text");
        const btnCancel = document.getElementById("btn-confirm-delete-cancel");
        const btnOk = document.getElementById("btn-confirm-delete-ok");

        if (!modal || !textEl || !btnCancel || !btnOk) {
            resolve(confirm(message));
            return;
        }

        textEl.textContent = message;
        modal.classList.add("show");

        const cleanUp = (value) => {
            modal.classList.remove("show");
            btnOk.removeEventListener("click", onOk);
            btnCancel.removeEventListener("click", onCancel);
            resolve(value);
        };

        const onOk = () => cleanUp(true);
        const onCancel = () => cleanUp(false);

        btnOk.addEventListener("click", onOk);
        btnCancel.addEventListener("click", onCancel);

        modal.onclick = (e) => {
            if (e.target === modal) cleanUp(false);
        };
    });
}

async function deleteDuplicateRecord(record, btnEl) {
    const confirmMsg = `Bạn có chắc chắn muốn xóa vĩnh viễn ca khai báo trùng lặp này của bé ${record.pet_name} (SĐT: ${record.owner_phone}) không?`;
    const isConfirmed = await showCustomConfirm(confirmMsg);
    if (!isConfirmed) return;

    btnEl.disabled = true;
    const originalHTML = btnEl.innerHTML;
    btnEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 0.8s linear infinite;width:12px;height:12px"><circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="5"/></svg>`;

    try {
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('pet_intakes')
                .delete()
                .eq('id', record.id);

            if (error) throw error;

            try {
                fetch(GOOGLE_SHEET_WEBHOOK_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ id: record.id, is_deleted: true })
                });
            } catch (sheetErr) {
                console.error('GAIA Dashboard: Error deleting from Google Sheet:', sheetErr);
            }
        }

        const idx = intakesData.findIndex(r => r.id === record.id);
        if (idx !== -1) {
            intakesData.splice(idx, 1);
            await fetchLoyalPhones();
            calculateStatistics(intakesData);
            applyStatusFilter();
        }
    } catch (e) {
        console.error('GAIA Dashboard: Error deleting duplicate:', e);
        btnEl.disabled = false;
        btnEl.innerHTML = originalHTML;
        alert(`Lỗi khi xóa ca trùng lặp: ${e.message || e}`);
    }
}

async function toggleCardStatus(record, cardEl, btnEl) {
    const newStatus = (record.trang_thai === 'done') ? 'new' : 'done';

    const loggedUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : JSON.parse(localStorage.getItem("gaia_logged_user") || "null");
    const actorName = loggedUser ? (loggedUser.full_name || "Nhân viên") : "Hệ thống";
    const userCN = loggedUser ? (loggedUser.cn || extractCNCode(loggedUser.branch || "")) : "";

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const timeStr = `${hh}h${mm} ${dd}/${month}/${yyyy}`;

    const statusText = newStatus === 'done' ? 'Đã Xử Lý' : 'Mới';
    const newLogLine = `${statusText} - ${actorName} - ${timeStr}`;

    let currentLogs = [];
    const rawHistory = record.history || record.status_history;
    if (rawHistory) {
        if (Array.isArray(rawHistory)) {
            currentLogs = [...rawHistory];
        } else if (typeof rawHistory === 'string') {
            try {
                const parsed = JSON.parse(rawHistory);
                currentLogs = Array.isArray(parsed) ? parsed : [rawHistory];
            } catch (e) {
                currentLogs = rawHistory.split('\n').filter(Boolean);
            }
        }
    }

    currentLogs.unshift(newLogLine); 

    const updatePayload = {
        trang_thai: newStatus,
        staff_name: actorName,
        history: currentLogs
    };
    if (userCN) updatePayload.cn = userCN;

    btnEl.disabled = true;
    const originalHTML = btnEl.innerHTML;
    btnEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 0.8s linear infinite;width:14px;height:14px"><circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="5"/></svg> Đang lưu...`;

    try {
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('pet_intakes')
                .update(updatePayload)
                .eq('id', record.id);

            if (error) {
                console.warn("GAIA Dashboard: Initial payload update error, trying JSON string history update:", error);
                await supabaseClient
                    .from('pet_intakes')
                    .update({
                        trang_thai: newStatus,
                        staff_name: actorName,
                        history: JSON.stringify(currentLogs)
                    })
                    .eq('id', record.id);
            }

            if (typeof GOOGLE_SHEET_WEBHOOK_URL !== 'undefined' && GOOGLE_SHEET_WEBHOOK_URL) {
                try {
                    let updatedRecord = { ...record, ...updatePayload };
                    delete updatedRecord.signature_data;
                    delete updatedRecord.pet_photo;
                    await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify(updatedRecord)
                    });
                } catch (e) {
                    console.error('GAIA Dashboard: Error pushing update to Google Sheets:', e);
                }
            }
        }

        record.trang_thai = newStatus;
        record.staff_name = actorName;
        record.history = currentLogs;
        record.status_history = currentLogs;
        if (userCN) record.cn = userCN;

        const idx = intakesData.findIndex(r => r.id === record.id);
        if (idx !== -1) {
            intakesData[idx] = { ...intakesData[idx], ...record };
        }

        calculateStatistics(intakesData);
        applyStatusFilter();

    } catch (e) {
        console.error('GAIA Dashboard: Error toggling status:', e);
        btnEl.disabled = false;
        btnEl.innerHTML = originalHTML;
        alert(`Lỗi cập nhật trạng thái: ${e.message || e}`);
    }
}

function openIntakeDetails(record) {
    activeIntakeRecord = record;
    modalPatientId.textContent = `ID: ${getFormattedIntakeId(record)}`;

    dOwnerName.textContent = record.owner_name || "-";
    dOwnerPhone.textContent = record.owner_phone || "-";
    dOwnerAddress.textContent = record.owner_address || "-";

    dPetName.textContent = record.pet_name || "-";
    dPetBreed.textContent = record.pet_breed || "-";
    dPetWeight.textContent = record.pet_weight ? `${record.pet_weight} kg` : "-";
    dPetAgeGender.textContent = record.pet_age_gender || "-";
    dPetColor.textContent = record.pet_color || "-";

    if (record.pet_neutered === 'yes') {
        dPetNeutered.className = "info-value badge badge-neutered";
        dPetNeutered.textContent = "Đã Triệt Sản (Neutered)";
    } else {
        dPetNeutered.className = "info-value badge badge-unknown";
        dPetNeutered.textContent = "Chưa Triệt Sản (Intact)";
    }

    const historyTextEl = document.getElementById("detail-history-text");
    if (historyTextEl) {
        let logsList = [];
        const rawHistory = record.history || record.status_history;
        if (rawHistory) {
            if (Array.isArray(rawHistory)) {
                logsList = rawHistory;
            } else if (typeof rawHistory === 'string') {
                try {
                    const parsed = JSON.parse(rawHistory);
                    logsList = Array.isArray(parsed) ? parsed : [rawHistory];
                } catch (e) {
                    logsList = rawHistory.split('\n').filter(Boolean);
                }
            }
        }

        if (logsList.length > 0) {
            historyTextEl.innerHTML = logsList.map(log => {
                const isDone = log.includes("Đã Xử Lý");
                const badgeColor = isDone ? "#10b981" : "#3b82f6";
                const bgAlpha = isDone ? "rgba(16, 185, 129, 0.12)" : "rgba(59, 130, 246, 0.12)";
                return `<div style="padding: 8px 12px; margin-bottom: 6px; background: ${bgAlpha}; border-left: 3px solid ${badgeColor}; border-radius: 6px; font-size: 12.5px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; justify-content: space-between;"><span>${escapeHtml(log)}</span></div>`;
            }).join("");
        } else {
            historyTextEl.innerHTML = `<span style="color: var(--text-muted); font-size: 13px;">Chưa có lịch sử thao tác.</span>`;
        }
    }

    const photoContainer = document.getElementById("detail-pet-photo-container");
    const activePhotoImg = document.getElementById("detail-active-photo-img");
    const thumbnailsGrid = document.getElementById("detail-photo-thumbnails-grid");
    const activePhotoBox = document.querySelector(".detail-active-photo-box");
    const detailTwoCol = document.querySelector(".detail-two-col");

    if (photoContainer) {
        const photosArray = getPhotosArray(record.pet_photo);

        if (photosArray.length > 0) {
            if (activePhotoBox) activePhotoBox.style.display = "block";
            if (activePhotoImg) activePhotoImg.src = photosArray[0];
            photoContainer.style.display = "block";
            if (detailTwoCol) detailTwoCol.classList.add("has-photos");

            if (thumbnailsGrid) {
                thumbnailsGrid.innerHTML = "";
                if (photosArray.length > 1) {
                    thumbnailsGrid.style.display = "grid";
                    photosArray.forEach((photoSrc, idx) => {
                        const thumb = document.createElement("div");
                        thumb.className = `thumbnail-item ${idx === 0 ? 'active' : ''}`;
                        thumb.innerHTML = `<img src="${photoSrc}" alt="Thumbnail">`;
                        thumb.addEventListener("click", () => {
                            if (activePhotoImg) {
                                activePhotoImg.style.opacity = "0.3";
                                setTimeout(() => {
                                    activePhotoImg.src = photoSrc;
                                    activePhotoImg.style.opacity = "1";
                                }, 150);
                            }
                            thumbnailsGrid.querySelectorAll(".thumbnail-item").forEach(t => t.classList.remove("active"));
                            thumb.classList.add("active");
                        });
                        thumbnailsGrid.appendChild(thumb);
                    });
                } else {
                    thumbnailsGrid.style.display = "none";
                }
            }
        } else {

            if (activePhotoImg) activePhotoImg.src = "";
            if (activePhotoBox) activePhotoBox.style.display = "none";
            if (thumbnailsGrid) {
                thumbnailsGrid.innerHTML = "";
                thumbnailsGrid.style.display = "none";
            }
            photoContainer.style.display = "block"; 
            if (detailTwoCol) detailTwoCol.classList.add("has-photos");
        }
    }

    setupVaccineLabel(dVacCore, record.vaccine_core, "Core Vaccine");
    setupVaccineLabel(dVacRabies, record.vaccine_rabies, "Rabies Vaccine");
    setupVaccineLabel(dVacParasite, record.parasite_prevention, "Parasite Prev");

    dMedHistory.textContent = record.medical_history ? record.medical_history.trim() : "Không ghi nhận";
    dAllergies.textContent = record.allergies ? record.allergies.trim() : "Không ghi nhận";
    dMeds.textContent = record.current_meds ? record.current_meds.trim() : "Không ghi nhận";

    dDietTags.innerHTML = "";
    let hasDiet = false;

    if (record.diet_wet) {
        addDietTag("Thức ăn ướt (Wet Food)");
        hasDiet = true;
    }
    if (record.diet_dry) {
        addDietTag("Thức ăn khô (Dry Food)");
        hasDiet = true;
    }
    if (record.diet_homemade) {
        addDietTag("Tự làm (Homemade)");
        hasDiet = true;
    }

    if (!hasDiet) {
        dDietTags.innerHTML = `<span style="color: var(--text-muted); font-size: 13.5px;">Chưa chọn chế độ ăn đặc biệt.</span>`;
    }

    dDateSigned.textContent = formatDateString(record.created_at || record.date_signed);
    dSignatureImg.src = record.signature_data || "";

    const printBannerIdEl = document.getElementById("print-banner-id");
    if (printBannerIdEl && record) {
        const dateObj = new Date(record.created_at || record.date_signed || new Date());
        const d = String(dateObj.getDate()).padStart(2, '0');
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yy = String(dateObj.getFullYear()).slice(-2);
        const dateDDMMYY = `${d}${m}${yy}`;

        const rawPhone = String(record.owner_phone || "").replace(/\D/g, "");
        const phoneTail = rawPhone.slice(-4).padStart(4, '0');

        const sameDayRecords = (intakesData || []).filter(r => {
            const dt = new Date(r.created_at || r.date_signed || new Date());
            const dtDDMMYY = `${String(dt.getDate()).padStart(2, '0')}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getFullYear()).slice(-2)}`;
            return dtDDMMYY === dateDDMMYY;
        }).sort((a, b) => (new Date(a.created_at || 0)) - (new Date(b.created_at || 0)));

        const seqIdx = sameDayRecords.findIndex(r => r.id === record.id);
        const stt = String(seqIdx >= 0 ? seqIdx + 1 : 1).padStart(2, '0');
        printBannerIdEl.textContent = `ID: ${stt}.${dateDDMMYY}.${phoneTail}`;
    }

    document.getElementById("print-owner-name").textContent = record.owner_name || "-";
    document.getElementById("print-owner-phone").textContent = record.owner_phone || "-";
    document.getElementById("print-owner-address").textContent = record.owner_address || "-";
    document.getElementById("print-pet-name").textContent = record.pet_name || "-";
    document.getElementById("print-pet-weight").textContent = record.pet_weight ? `${record.pet_weight} kg` : "-";
    document.getElementById("print-pet-breed").textContent = record.pet_breed || "-";
    document.getElementById("print-pet-color").textContent = record.pet_color || "-";
    document.getElementById("print-pet-age-gender").textContent = record.pet_age_gender || "-";

    document.getElementById("print-pet-neutered-yes").textContent = record.pet_neutered === "yes" ? "☑" : "☐";
    document.getElementById("print-pet-neutered-no").textContent = record.pet_neutered === "no" ? "☑" : "☐";

    document.getElementById("print-vac-core-yes").textContent = record.vaccine_core === "yes" ? "☑" : "☐";
    document.getElementById("print-vac-core-no").textContent = record.vaccine_core === "no" ? "☑" : "☐";
    document.getElementById("print-vac-core-unknown").textContent = record.vaccine_core === "unknown" ? "☑" : "☐";

    document.getElementById("print-vac-rabies-yes").textContent = record.vaccine_rabies === "yes" ? "☑" : "☐";
    document.getElementById("print-vac-rabies-no").textContent = record.vaccine_rabies === "no" ? "☑" : "☐";
    document.getElementById("print-vac-rabies-unknown").textContent = record.vaccine_rabies === "unknown" ? "☑" : "☐";

    document.getElementById("print-parasite-yes").textContent = record.parasite_prevention === "yes" ? "☑" : "☐";
    document.getElementById("print-parasite-no").textContent = record.parasite_prevention === "no" ? "☑" : "☐";
    document.getElementById("print-parasite-unknown").textContent = record.parasite_prevention === "unknown" ? "☑" : "☐";

    document.getElementById("print-med-history").textContent = record.medical_history ? record.medical_history.trim() : "Không ghi nhận";
    document.getElementById("print-allergies").textContent = record.allergies ? record.allergies.trim() : "Không ghi nhận";
    document.getElementById("print-meds").textContent = record.current_meds ? record.current_meds.trim() : "Không ghi nhận";

    document.getElementById("print-diet-wet").textContent = record.diet_wet ? "☑" : "☐";
    document.getElementById("print-diet-dry").textContent = record.diet_dry ? "☑" : "☐";
    document.getElementById("print-diet-homemade").textContent = record.diet_homemade ? "☑" : "☐";

    document.getElementById("print-consent-accuracy").textContent = record.consent_accuracy ? "☑" : "☐";
    document.getElementById("print-consent-storage").textContent = record.consent_storage ? "☑" : "☐";

    document.getElementById("print-date").textContent = formatDateString(record.created_at || record.date_signed);
    document.getElementById("print-sig-img").src = record.signature_data || "";

    const printPhotosSection = document.getElementById("print-photos-section");
    const printPhotosGrid = document.getElementById("print-photos-grid");

    if (printPhotosSection && printPhotosGrid) {
        const photosArray = getPhotosArray(record.pet_photo);

        if (photosArray.length > 0) {
            printPhotosSection.style.display = "block";
            printPhotosGrid.innerHTML = "";

            photosArray.forEach(photoSrc => {
                const item = document.createElement("div");
                item.className = "print-photo-item";
                item.innerHTML = `<img src="${photoSrc}" alt="Attached Photo">`;
                printPhotosGrid.appendChild(item);
            });
        } else {
            printPhotosSection.style.display = "none";
            printPhotosGrid.innerHTML = "";
        }
    }

    detailsModal.classList.add("show");
}

function setupVaccineLabel(element, value, labelName) {
    if (value === 'yes') {
        element.className = "badge-status bg-badge-yes";
        element.textContent = "Đã phòng ngừa ✓";
    } else if (value === 'no') {
        element.className = "badge-status bg-badge-no";
        element.textContent = "Chưa phòng ngừa ✗";
    } else {
        element.className = "badge-status bg-badge-unknown";
        element.textContent = "Không rõ ?";
    }
}

function addDietTag(dietText) {
    const span = document.createElement("span");
    span.className = "diet-detail-tag";
    span.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ${dietText}
    `;
    dDietTags.appendChild(span);
}

function setupEventListeners() {

    modalCloseBtn.addEventListener("click", () => {
        detailsModal.classList.remove("show");
    });

    detailsModal.addEventListener("click", (e) => {
        if (e.target === detailsModal) {
            detailsModal.classList.remove("show");
        }
    });

    modalPrintBtn.addEventListener("click", () => {
        if (!activeIntakeRecord) return;

        const petName = activeIntakeRecord.pet_name || "Pet";
        let rawDate = activeIntakeRecord.created_at || activeIntakeRecord.date_signed || new Date().toISOString();
        if (rawDate.includes("T")) rawDate = rawDate.split("T")[0];
        const dateParts = rawDate.split("-");
        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : rawDate;

        const originalTitle = document.title;
        document.title = `Tờ Khai Khám Bệnh - ${petName} - ${formattedDate} _ GAIA Animal Hospital Ho Chi Minh City`;

        const printBannerIdEl = document.getElementById("print-banner-id");
        if (printBannerIdEl) {
            printBannerIdEl.textContent = `ID: ${getFormattedIntakeId(activeIntakeRecord)}`;
        }

        window.print();

        setTimeout(() => { document.title = originalTitle; }, 1000);
    });

    searchInput.addEventListener("input", () => {
        currentPage = 1;
        applyStatusFilter();
    });

    if (qrToggleBtn) {
        qrToggleBtn.addEventListener("click", () => {

            const declarationUrl = window.location.origin + window.location.pathname.replace(/(admin|menu)\.html.*/i, '');
            qrDeclarationUrl.textContent = declarationUrl;

            qrCodeContainer.innerHTML = "";
            try {
                new QRCode(qrCodeContainer, {
                    text: declarationUrl,
                    width: 200,
                    height: 200,
                    colorDark: "#0f172a",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            } catch (err) {
                console.error("Error generating QR Code:", err);
                qrCodeContainer.innerHTML = `<span style="color: var(--danger); font-size: 13px;">Không thể tạo mã QR</span>`;
            }

            qrModal.classList.add("show");
        });
    }

    if (qrModalCloseBtn) {
        qrModalCloseBtn.addEventListener("click", () => {
            qrModal.classList.remove("show");
        });
    }

    if (qrModal) {
        qrModal.addEventListener("click", (e) => {
            if (e.target === qrModal) {
                qrModal.classList.remove("show");
            }
        });
    }

    if (qrCopyLinkBtn) {
        qrCopyLinkBtn.addEventListener("click", () => {
            const urlText = qrDeclarationUrl.textContent;
            navigator.clipboard.writeText(urlText).then(() => {
                const originalText = qrCopyLinkBtn.textContent;
                qrCopyLinkBtn.textContent = "Đã chép!";
                qrCopyLinkBtn.style.background = "var(--primary)";
                qrCopyLinkBtn.style.color = "white";
                setTimeout(() => {
                    qrCopyLinkBtn.textContent = originalText;
                    qrCopyLinkBtn.style.background = "rgba(16, 185, 129, 0.15)";
                    qrCopyLinkBtn.style.color = "var(--primary)";
                }, 1500);
            }).catch(err => {
                console.error("Failed to copy text:", err);
            });
        });
    }

    if (qrDownloadBtn) {
        qrDownloadBtn.addEventListener("click", () => {

            const qrImg = qrCodeContainer.querySelector("img");
            const qrCanvas = qrCodeContainer.querySelector("canvas");
            const urlText = qrDeclarationUrl.textContent || "";

            let qrSource = null;
            if (qrImg && qrImg.complete && qrImg.naturalWidth > 0) {
                qrSource = qrImg;
            } else if (qrCanvas) {
                qrSource = qrCanvas;
            }

            if (!qrSource) {
                alert("Không thể tải mã QR lúc này. Vui lòng thử lại!");
                return;
            }

            const scale = 3; 
            const cardW = 420 * scale;
            const cardH = 460 * scale;
            const radius = 28 * scale;
            const qrSize = 220 * scale;
            const padding = 30 * scale;

            const exportCanvas = document.createElement("canvas");
            exportCanvas.width = cardW;
            exportCanvas.height = cardH;
            const ctx = exportCanvas.getContext("2d");

            ctx.beginPath();
            ctx.moveTo(radius, 0);
            ctx.lineTo(cardW - radius, 0);
            ctx.quadraticCurveTo(cardW, 0, cardW, radius);
            ctx.lineTo(cardW, cardH - radius);
            ctx.quadraticCurveTo(cardW, cardH, cardW - radius, cardH);
            ctx.lineTo(radius, cardH);
            ctx.quadraticCurveTo(0, cardH, 0, cardH - radius);
            ctx.lineTo(0, radius);
            ctx.quadraticCurveTo(0, 0, radius, 0);
            ctx.closePath();
            ctx.fillStyle = "#0f172a";
            ctx.fill();

            ctx.strokeStyle = "rgba(16, 185, 129, 0.25)";
            ctx.lineWidth = 1.5 * scale;
            ctx.stroke();

            const badgeText = "GAIA QR";
            const badgeFontSize = 11 * scale;
            ctx.font = `700 ${badgeFontSize}px 'Outfit', sans-serif`;
            const badgeMetrics = ctx.measureText(badgeText);
            const badgePadX = 8 * scale;
            const badgePadY = 4 * scale;
            const badgeW = badgeMetrics.width + badgePadX * 2;
            const badgeH = badgeFontSize + badgePadY * 2;
            const badgeX = padding;
            const badgeY = padding;

            const badgeRadius = 6 * scale;
            ctx.beginPath();
            ctx.moveTo(badgeX + badgeRadius, badgeY);
            ctx.lineTo(badgeX + badgeW - badgeRadius, badgeY);
            ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeRadius);
            ctx.lineTo(badgeX + badgeW, badgeY + badgeH - badgeRadius);
            ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - badgeRadius, badgeY + badgeH);
            ctx.lineTo(badgeX + badgeRadius, badgeY + badgeH);
            ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - badgeRadius);
            ctx.lineTo(badgeX, badgeY + badgeRadius);
            ctx.quadraticCurveTo(badgeX, badgeY, badgeX + badgeRadius, badgeY);
            ctx.closePath();
            ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
            ctx.fill();
            ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
            ctx.lineWidth = 1 * scale;
            ctx.stroke();

            ctx.fillStyle = "#10b981";
            ctx.textBaseline = "middle";
            ctx.fillText(badgeText, badgeX + badgePadX, badgeY + badgeH / 2);

            const titleFontSize = 18 * scale;
            ctx.font = `700 ${titleFontSize}px 'Outfit', sans-serif`;
            ctx.fillStyle = "#f3f4f6";
            ctx.textBaseline = "middle";
            ctx.fillText("Mã QR Khai Báo", badgeX + badgeW + 12 * scale, badgeY + badgeH / 2);

            const qrBoxSize = qrSize + 32 * scale; 
            const qrBoxX = (cardW - qrBoxSize) / 2;
            const qrBoxY = badgeY + badgeH + 25 * scale;
            const qrBoxRadius = 18 * scale;

            ctx.beginPath();
            ctx.moveTo(qrBoxX + qrBoxRadius, qrBoxY);
            ctx.lineTo(qrBoxX + qrBoxSize - qrBoxRadius, qrBoxY);
            ctx.quadraticCurveTo(qrBoxX + qrBoxSize, qrBoxY, qrBoxX + qrBoxSize, qrBoxY + qrBoxRadius);
            ctx.lineTo(qrBoxX + qrBoxSize, qrBoxY + qrBoxSize - qrBoxRadius);
            ctx.quadraticCurveTo(qrBoxX + qrBoxSize, qrBoxY + qrBoxSize, qrBoxX + qrBoxSize - qrBoxRadius, qrBoxY + qrBoxSize);
            ctx.lineTo(qrBoxX + qrBoxRadius, qrBoxY + qrBoxSize);
            ctx.quadraticCurveTo(qrBoxX, qrBoxY + qrBoxSize, qrBoxX, qrBoxY + qrBoxSize - qrBoxRadius);
            ctx.lineTo(qrBoxX, qrBoxY + qrBoxRadius);
            ctx.quadraticCurveTo(qrBoxX, qrBoxY, qrBoxX + qrBoxRadius, qrBoxY);
            ctx.closePath();
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
            ctx.shadowBlur = 24 * scale;
            ctx.shadowOffsetY = 8 * scale;
            ctx.fill();
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            const qrDrawX = qrBoxX + (qrBoxSize - qrSize) / 2;
            const qrDrawY = qrBoxY + (qrBoxSize - qrSize) / 2;
            ctx.imageSmoothingEnabled = false; 
            ctx.drawImage(qrSource, qrDrawX, qrDrawY, qrSize, qrSize);
            ctx.imageSmoothingEnabled = true;

            const urlY = qrBoxY + qrBoxSize + 30 * scale;
            const urlFontSize = 12 * scale;
            ctx.font = `500 ${urlFontSize}px 'Plus Jakarta Sans', sans-serif`;
            ctx.fillStyle = "#9ca3af";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";

            let displayUrl = urlText;
            const maxUrlWidth = cardW - padding * 2;
            while (ctx.measureText(displayUrl).width > maxUrlWidth && displayUrl.length > 10) {
                displayUrl = displayUrl.slice(0, -1);
            }
            if (displayUrl !== urlText) displayUrl += "…";
            ctx.fillText(displayUrl, cardW / 2, urlY);
            ctx.textAlign = "start"; 

            const dataUrl = exportCanvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = "qrcode-gaia-khaibao.png";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    const lightbox = document.getElementById("image-lightbox");
    const lightboxImg = document.getElementById("lightbox-img");
    const lightboxZoomIn = document.getElementById("lightbox-zoom-in");
    const lightboxZoomOut = document.getElementById("lightbox-zoom-out");
    const lightboxZoomLabel = document.getElementById("lightbox-zoom-level");
    const lightboxDownload = document.getElementById("lightbox-download");
    const lightboxClose = document.getElementById("lightbox-close");
    const lightboxPrev = document.getElementById("lightbox-prev");
    const lightboxNext = document.getElementById("lightbox-next");

    let lightboxZoom = 1;
    let activePhotoIndex = 0; 
    const ZOOM_STEP = 0.25;
    const ZOOM_MIN = 0.25;
    const ZOOM_MAX = 5;

    function openLightbox(src, index) {
        if (!src || !lightbox) return;
        lightboxZoom = 1;
        lightboxImg.src = src;
        lightboxImg.style.transform = "scale(1)";
        lightboxZoomLabel.textContent = "100%";
        activePhotoIndex = index;

        if (activeIntakeRecord) {
            const photosArray = getPhotosArray(activeIntakeRecord.pet_photo);
            if (photosArray.length > 1) {
                if (lightboxPrev) lightboxPrev.style.display = "flex";
                if (lightboxNext) lightboxNext.style.display = "flex";
            } else {
                if (lightboxPrev) lightboxPrev.style.display = "none";
                if (lightboxNext) lightboxNext.style.display = "none";
            }
        } else {
            if (lightboxPrev) lightboxPrev.style.display = "none";
            if (lightboxNext) lightboxNext.style.display = "none";
        }

        lightbox.classList.add("show");
    }

    function closeLightbox() {
        if (!lightbox) return;
        lightbox.classList.remove("show");
        setTimeout(() => { lightboxImg.src = ""; }, 250);
    }

    function setLightboxZoom(newZoom) {
        lightboxZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
        lightboxImg.style.transform = `scale(${lightboxZoom})`;
        lightboxZoomLabel.textContent = `${Math.round(lightboxZoom * 100)}%`;
    }

    function navigateLightbox(direction) {
        if (!activeIntakeRecord) return;
        const photosArray = getPhotosArray(activeIntakeRecord.pet_photo);
        if (photosArray.length <= 1) return;

        let newIdx = activePhotoIndex + direction;
        if (newIdx < 0) {
            newIdx = photosArray.length - 1;
        } else if (newIdx >= photosArray.length) {
            newIdx = 0;
        }

        activePhotoIndex = newIdx;

        lightboxImg.style.opacity = "0";
        setTimeout(() => {
            lightboxImg.src = photosArray[newIdx];
            lightboxZoom = 1;
            lightboxImg.style.transform = "scale(1)";
            lightboxZoomLabel.textContent = "100%";
            lightboxImg.style.opacity = "1";
        }, 150);
    }

    const activePhotoBox = document.querySelector(".detail-active-photo-box");
    if (activePhotoBox) {
        activePhotoBox.addEventListener("click", () => {
            const img = document.getElementById("detail-active-photo-img");
            if (img && img.src && img.src !== window.location.href) {
                let idx = 0;
                if (activeIntakeRecord) {
                    const photosArray = getPhotosArray(activeIntakeRecord.pet_photo);
                    const currentSrc = img.getAttribute("src");
                    const foundIdx = photosArray.findIndex(p => {
                        if (!p) return false;
                        if (p.startsWith("data:") && currentSrc.startsWith("data:")) {
                            return p === currentSrc;
                        }
                        try {
                            const pAbs = new URL(p, window.location.href).href;
                            const curAbs = new URL(currentSrc, window.location.href).href;
                            return pAbs === curAbs;
                        } catch (err) {
                            return currentSrc.endsWith(p) || p.endsWith(currentSrc);
                        }
                    });
                    if (foundIdx !== -1) {
                        idx = foundIdx;
                    }
                }
                openLightbox(img.src, idx);
            }
        });
    }

    if (lightboxZoomIn) lightboxZoomIn.addEventListener("click", () => setLightboxZoom(lightboxZoom + ZOOM_STEP));
    if (lightboxZoomOut) lightboxZoomOut.addEventListener("click", () => setLightboxZoom(lightboxZoom - ZOOM_STEP));
    if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);

    if (lightboxPrev) lightboxPrev.addEventListener("click", () => navigateLightbox(-1));
    if (lightboxNext) lightboxNext.addEventListener("click", () => navigateLightbox(1));

    if (lightbox) {
        lightbox.addEventListener("wheel", (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            setLightboxZoom(lightboxZoom + delta);
        }, { passive: false });
    }

    if (lightbox) {
        lightbox.addEventListener("click", (e) => {
            if (e.target === lightbox || e.target.classList.contains("lightbox-image-wrap")) {
                closeLightbox();
            }
        });
    }

    if (lightboxDownload) {
        lightboxDownload.addEventListener("click", () => {
            if (lightboxImg.src && lightboxImg.src !== window.location.href) {
                const petName = (activeIntakeRecord && activeIntakeRecord.pet_name) ? activeIntakeRecord.pet_name.trim() : "Pet";
                const phone = (activeIntakeRecord && activeIntakeRecord.owner_phone) ? activeIntakeRecord.owner_phone.trim() : "phone";

                let rawDate = (activeIntakeRecord && (activeIntakeRecord.created_at || activeIntakeRecord.date_signed)) || new Date().toISOString();
                if (rawDate.includes("T")) rawDate = rawDate.split("T")[0];
                const dateParts = rawDate.split("-");
                const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : rawDate;

                const photoNum = activePhotoIndex + 1;

                const cleanPetName = petName.replace(/[\/\\?%*:|"<>\s]+/g, "_");
                const cleanPhone = phone.replace(/[\/\\?%*:|"<>\s]+/g, "_");
                const cleanDate = formattedDate.replace(/[\/\\?%*:|"<>\s]+/g, "-");

                const filename = `photo_${cleanPetName}_${cleanPhone}_${cleanDate}_${photoNum}.png`;
                fetchImageAndDownload(lightboxImg.src, filename);
            }
        });
    }

    async function fetchImageAndDownload(url, filename) {
        try {
            if (url.startsWith("data:")) {
                const link = document.createElement("a");
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                return;
            }

            const response = await fetch(url, { mode: 'cors' });
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        } catch (err) {
            console.error("Failed to download image with fetch, falling back:", err);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.key === "Esc") {
            if (lightbox && lightbox.classList.contains("show")) {
                closeLightbox();
            } else {
                detailsModal.classList.remove("show");
                if (qrModal) qrModal.classList.remove("show");
            }
        } else if (lightbox && lightbox.classList.contains("show")) {
            if (e.key === "ArrowLeft") {
                navigateLightbox(-1);
            } else if (e.key === "ArrowRight") {
                navigateLightbox(1);
            }
        }
    });

    const prevBtn = document.getElementById('date-prev-btn');
    const nextBtn = document.getElementById('date-next-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => navigateDate(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateDate(1));

    const dateAllBtn = document.getElementById('date-all-btn');
    if (dateAllBtn) {
        dateAllBtn.addEventListener('click', () => {
            if (isAllDates) {

                isAllDates = false;
                viewDate = new Date();
                viewDate.setHours(0, 0, 0, 0);
                syncDatePickerInput();
            } else {

                isAllDates = true;
            }
            currentPage = 1;
            updateDateDisplay();
            fetchInitialIntakes();
        });
    }

    const datePickerInput = document.getElementById('date-picker-input');
    if (datePickerInput) {
        const todayISO = new Date().toISOString().split('T')[0];

        datePickerInput.value = todayISO;

        datePickerInput.addEventListener('change', () => {
            const val = datePickerInput.value; 
            if (!val) return;
            isAllDates = false;

            const [y, m, d] = val.split('-').map(Number);
            const picked = new Date(y, m - 1, d);
            picked.setHours(0, 0, 0, 0);

            viewDate = picked;
            currentPage = 1;
            updateDateDisplay();
            fetchInitialIntakes();
        });
    }

    document.querySelectorAll('.status-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentStatusFilter = tab.getAttribute('data-filter');
            currentPage = 1;
            applyStatusFilter();
        });
    });

    const backToTopBtn = document.getElementById("back-to-top-btn");
    if (backToTopBtn) {
        window.addEventListener("scroll", () => {
            if (window.pageYOffset > 300) {
                backToTopBtn.classList.add("show");
            } else {
                backToTopBtn.classList.remove("show");
            }
        });

        backToTopBtn.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    detailsModal.addEventListener("click", (e) => {
        const copyBtn = e.target.closest(".btn-copy-field");
        if (!copyBtn) return;

        let textToCopy = "";
        const valueWrap = copyBtn.closest(".info-value-wrap");
        const medCard = copyBtn.closest(".medical-text-card");

        if (valueWrap) {
            const valEl = valueWrap.querySelector(".info-value");
            if (valEl) {
                textToCopy = valEl.textContent.trim();
            }
        } else if (medCard) {
            const pEl = medCard.querySelector("p");
            if (pEl) {
                textToCopy = pEl.textContent.trim();
            }
        }

        if (textToCopy && textToCopy !== "-" && textToCopy !== "Không ghi nhận") {

            const cleanedText = textToCopy.replace(/[✓✗\?]/g, "").trim();

            navigator.clipboard.writeText(cleanedText).then(() => {
                showCopiedTooltip(copyBtn);
            }).catch(err => {
                console.error("Failed to copy text:", err);
            });
        }
    });
}

function showCopiedTooltip(button) {

    if (button.querySelector(".copied-tooltip")) return;

    const tooltip = document.createElement("span");
    tooltip.className = "copied-tooltip";
    tooltip.textContent = "Đã chép!";

    button.appendChild(tooltip);

    setTimeout(() => {
        tooltip.remove();
    }, 1500);
}

function filterCards(query) {
    currentPage = 1;
    applyStatusFilter();
}

function calculateStatistics(records) {
    const newCount = records.filter(r => !r.trang_thai || r.trang_thai === 'new').length;
    const doneCount = records.filter(r => r.trang_thai === 'done').length;
    const allCount = records.length;

    const countAll = document.getElementById('count-all');
    const countNew = document.getElementById('count-new');
    const countDone = document.getElementById('count-done');
    if (countAll) countAll.textContent = allCount;
    if (countNew) countNew.textContent = newCount;
    if (countDone) countDone.textContent = doneCount;
}

function updateDateDisplay() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = viewDate.getTime() === today.getTime();

    const isMobile = window.innerWidth <= 600;
    const options = isMobile
        ? { day: '2-digit', month: '2-digit', year: 'numeric' }
        : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    let dateStr = viewDate.toLocaleDateString('vi-VN', options);
    if (isMobile) {
        dateStr = "Ngày " + dateStr;
    }
    const statDateEl = document.getElementById('stat-date');
    const labelEl = document.getElementById('date-nav-label');
    const nextBtn = document.getElementById('date-next-btn');
    const prevBtn = document.getElementById('date-prev-btn');
    const allBtn = document.getElementById('date-all-btn');

    if (allBtn) {
        if (isAllDates) {
            allBtn.classList.add('active');
            allBtn.textContent = "Hôm nay";
        } else {
            allBtn.classList.remove('active');
            allBtn.textContent = "Tất cả";
        }
    }

    if (isAllDates) {
        if (statDateEl) {
            statDateEl.textContent = "Tất cả các ngày";
        }
        if (labelEl) {
            labelEl.textContent = "Tất cả thời gian";
        }
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.style.opacity = '0.3';
        }
        if (prevBtn) {
            prevBtn.disabled = false;
            prevBtn.style.opacity = '1';
        }
        return;
    }

    if (statDateEl) {

        statDateEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    }
    if (labelEl) {
        labelEl.textContent = isToday ? 'Hôm nay' : (viewDate.getTime() > today.getTime() ? 'Kế hoạch tương lai' : 'Ngày đã chọn');
    }

    if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
    }
    if (prevBtn) {
        prevBtn.disabled = false;
        prevBtn.style.opacity = '1';
    }
}

function navigateDate(delta) {
    if (isAllDates) {
        isAllDates = false;
    }

    const newDate = new Date(viewDate);
    newDate.setDate(newDate.getDate() + delta);

    viewDate = newDate;
    updateDateDisplay();
    syncDatePickerInput();
    fetchInitialIntakes(); 
}

function syncDatePickerInput() {
    const input = document.getElementById('date-picker-input');
    if (!input) return;

    const y = viewDate.getFullYear();
    const m = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(viewDate.getDate()).padStart(2, '0');
    input.value = `${y}-${m}-${d}`;
}

function setTodayDateStat() {
    updateDateDisplay();
}

function formatDateTime(isoString) {
    if (!isoString) return "-";
    try {
        const date = new Date(isoString);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${hours}:${minutes} - ${day}/${month}/${year}`;
    } catch (e) {
        return "-";
    }
}

function formatDateString(isoString) {
    if (!isoString) return "-";
    try {
        const trimmed = isoString.trim();

        if (!trimmed.includes(":") && !trimmed.includes("T")) {
            const match = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
            if (match) {
                return `${match[3]}/${match[2]}/${match[1]}`;
            }
        }

        const date = new Date(isoString);
        return date.toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) {
        return isoString;
    }
}

function escapeHtml(string) {
    if (!string) return "";
    return String(string)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function initSoundToggle() {
    soundToggleBtn.addEventListener("click", () => {
        soundEnabled = !soundEnabled;

        if (soundEnabled) {
            soundToggleBtn.classList.add("active");
            soundOnIcon.style.display = "block";
            soundOffIcon.style.display = "none";
            soundStatusSpan.textContent = "Âm thanh: Bật";
        } else {
            soundToggleBtn.classList.remove("active");
            soundOnIcon.style.display = "none";
            soundOffIcon.style.display = "block";
            soundStatusSpan.textContent = "Âm thanh: Tắt";
        }
    });
}

function initLiveTypingIndicator() {
    const typingTextEl = document.getElementById("live-typing-text");
    const typingDotsEl = document.querySelector(".live-typing-dots");
    const onlineBadgeEl = document.querySelector(".live-online-badge");
    if (!typingTextEl) return;

    const localActiveClients = new Set();
    const remoteActiveClients = new Map();
    let activeUsersCount = 0;

    try {
        if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('gaia_live_form');
            bc.onmessage = (event) => {
                if (!event.data) return;
                if (event.data.type === 'PING') {
                    localActiveClients.add(event.data.clientId);
                    checkActiveCount();
                } else if (event.data.type === 'LEAVE') {
                    localActiveClients.delete(event.data.clientId);
                    checkActiveCount();
                }
            };
        }
    } catch (e) { }

    setInterval(() => {
        try {
            const lastPing = parseInt(localStorage.getItem('gaia_live_form_ping') || '0', 10);
            if (Date.now() - lastPing > 5000) {
                localActiveClients.clear();
            } else if (Date.now() - lastPing <= 5000 && localActiveClients.size === 0) {
                localActiveClients.add('local_fallback');
            }
        } catch (e) { }
        checkActiveCount();
    }, 1500);

    if (supabaseClient) {
        try {
            const liveRoom = supabaseClient.channel('gaia_live_form_room_v1', {
                config: {
                    broadcast: { self: true, ack: false },
                    presence: { key: 'admin_dashboard' }
                }
            });

            liveRoom
                .on('broadcast', { event: 'FORM_USER_PING' }, (message) => {
                    const payload = message.payload;
                    if (payload && payload.clientId) {
                        remoteActiveClients.set(payload.clientId, Date.now());
                        checkActiveCount();
                    }
                })
                .on('broadcast', { event: 'FORM_USER_LEAVE' }, (message) => {
                    const payload = message.payload;
                    if (payload && payload.clientId) {
                        remoteActiveClients.delete(payload.clientId);
                        checkActiveCount();
                    }
                })
                .on('presence', { event: 'sync' }, () => {
                    const state = liveRoom.presenceState();
                    let count = 0;
                    for (const key in state) {
                        if (key !== 'admin_dashboard') count++;
                    }
                    activeUsersCount = count;
                    checkActiveCount();
                })
                .subscribe();
        } catch (e) {
            console.warn("Could not sync real-time live users:", e);
        }
    }

    function checkActiveCount() {
        const now = Date.now();
        for (const [id, time] of remoteActiveClients.entries()) {
            if (now - time > 6000) remoteActiveClients.delete(id);
        }
        const total = Math.max(localActiveClients.size, remoteActiveClients.size, activeUsersCount);
        updateLiveUI(total);
    }

    function updateLiveUI(count) {
        const typingWidgetEl = document.getElementById("live-typing-widget");
        const countBadgeEl = document.getElementById("live-count-badge");
        if (!typingTextEl) return;
        if (count === 0) {
            if (typingWidgetEl) typingWidgetEl.style.display = "none";
        } else {
            if (typingWidgetEl) typingWidgetEl.style.display = "flex";
            typingTextEl.textContent = `Có ${count} người đang điền form`;
            typingTextEl.style.color = "#10B981";
            if (countBadgeEl) countBadgeEl.textContent = count;
            if (typingDotsEl) typingDotsEl.style.display = "flex";
            if (onlineBadgeEl) {
                onlineBadgeEl.style.background = "#10B981";
                onlineBadgeEl.style.boxShadow = "0 0 6px #10B981";
            }
        }
    }

    updateLiveUI(0);
}

function showErrorState(errorMessage) {
    loadingSpinner.style.display = "none";
    noDataPlaceholder.style.display = "flex";
    noDataPlaceholder.querySelector(".empty-icon-wrap").style.color = "var(--danger)";
    noDataPlaceholder.querySelector(".empty-icon-wrap").style.borderColor = "var(--danger)";
    noDataPlaceholder.querySelector("h3").textContent = "Không thể khởi động Dashboard";
    noDataPlaceholder.querySelector("p").innerHTML = `<span style="color: var(--danger); font-weight: 600;">${errorMessage}</span>`;
}
