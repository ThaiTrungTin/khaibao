/* ==========================================================================
   GAIA Animal Hospital Ho Chi Minh City Realtime Admin Dashboard Logic
   ========================================================================== */

// --- Global State Variables ---
let intakesData = [];
let supabaseClient = null;
let soundEnabled = true;
let loyalPhones = new Set(); // Set of owner_phone strings that have registered > 1 times in database
let duplicateIds = new Set(); // Set of record IDs that are duplicates (same phone, same day, same pet_name)
let activeIntakeRecord = null; // The record currently opened in the details modal

// Date navigation state
let viewDate = new Date(); // The date currently being viewed
viewDate.setHours(0, 0, 0, 0);
let isAllDates = false; // true if showing all dates

// Status filter state: 'all' | 'new' | 'done'
let currentStatusFilter = 'all';

// Pagination state variables
let currentPage = 1;
const itemsPerPage = 20;

// DOM Elements
const loadingSpinner = document.getElementById("loading-spinner");
const noDataPlaceholder = document.getElementById("no-data-placeholder");
const intakesList = document.getElementById("intakes-list");
const searchInput = document.getElementById("dashboard-search");

// Stats Elements
const statDate = document.getElementById("stat-date");

// Sound Toggle Elements
const soundToggleBtn = document.getElementById("sound-toggle-btn");
const soundOnIcon = soundToggleBtn.querySelector(".icon-sound-on");
const soundOffIcon = soundToggleBtn.querySelector(".icon-sound-off");
const soundStatusSpan = soundToggleBtn.querySelector("span");

// Modal Elements
const detailsModal = document.getElementById("details-modal");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalPrintBtn = document.getElementById("modal-print-btn");

// Modal detail fields
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

// --- Initialize Dashboard ---
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Set current date stat
    updateDateDisplay();

    // 2. Initialize sound settings
    initSoundToggle();

    // 3. Initialize Supabase Client
    if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_PROJECT_URL') {
        try {
            supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
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

    // 4. Load loyal phone numbers and initial entries in parallel (speeds up initial page load!)
    await Promise.all([
        fetchLoyalPhones(),
        fetchInitialIntakes()
    ]);

    // 5. Subscribe to Supabase Realtime changes
    setupRealtimeSubscription();

    // 6. Setup general event listeners
    setupEventListeners();
});

// --- Fetch Intakes for the Currently Viewed Date ---
async function fetchInitialIntakes() {
    try {
        loadingSpinner.style.display = "flex";
        noDataPlaceholder.style.display = "none";
        intakesList.style.display = "none";

        let query = supabaseClient.from('pet_intakes').select('*');

        if (!isAllDates) {
            // Build date range: from 00:00:00 to 23:59:59 of viewDate
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
        calculateStatistics(intakesData);
        applyStatusFilter();
    } catch (e) {
        console.error("GAIA Dashboard: Error fetching initial data:", e);
        showErrorState(`Không thể tải dữ liệu: ${e.message || e}`);
    } finally {
        loadingSpinner.style.display = "none";
    }
}

// --- Fetch loyal phones (registered more than once in database) ---
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

// --- Analyze duplicates in intakesData (same phone, same day, same pet name) ---
function analyzeDuplicates() {
    duplicateIds.clear();
    const groups = {}; // key format: phone_date_petname -> array of ids

    intakesData.forEach(record => {
        if (!record.owner_phone || !record.pet_name) return;

        const phone = record.owner_phone.trim();
        const petName = record.pet_name.trim().toLowerCase();
        
        // Extract date part (YYYY-MM-DD) from created_at or date_signed
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

    // Mark IDs with group size > 1 as duplicates
    for (const ids of Object.values(groups)) {
        if (ids.length > 1) {
            ids.forEach(id => duplicateIds.add(id));
        }
    }
}


// --- Setup Supabase Realtime Subscription ---
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
                if (status === 'SUBSCRIBED') {
                    indicator.className = "status-indicator live";
                    indicator.querySelector(".status-text").textContent = "LIVE";
                } else {
                    indicator.className = "status-indicator";
                    indicator.querySelector(".status-text").textContent = "DISCONNECTED";
                }
            });
    } catch (e) {
        console.error("GAIA Dashboard: Realtime subscription error:", e);
    }
}

// --- Handle Incoming Realtime Entries ---
async function handleIncomingIntake(newRecord) {
    // Only show on the current viewed date
    const recDate = new Date(newRecord.created_at);
    const recDay = new Date(recDate); recDay.setHours(0, 0, 0, 0);
    const viewDay = new Date(viewDate); viewDay.setHours(0, 0, 0, 0);

    if (isAllDates || recDay.getTime() === viewDay.getTime()) {
        // Avoid duplicates if we already fetched/added it
        const exists = intakesData.some(r => r.id === newRecord.id);
        if (!exists) {
            // Add to global state array at the beginning
            intakesData.unshift(newRecord);

            // Update database-wide loyal phones list
            await fetchLoyalPhones();

            // Calculate updated statistics
            calculateStatistics(intakesData);

            // Re-apply current filter (which will also render)
            applyStatusFilter();

            // Play synthesized bell alert chime
            playAlertPing();

            // Toggle empty state placeholder off if active
            noDataPlaceholder.style.display = "none";
            intakesList.style.display = "grid";
        }
    }
}

// --- Handle Incoming Realtime Updates ---
function handleIncomingUpdate(updatedRecord) {
    const idx = intakesData.findIndex(r => r.id === updatedRecord.id);
    if (idx !== -1) {
        // Update local data with the updated record from database
        intakesData[idx] = updatedRecord;
        
        // Recalculate statistics and re-apply current filter & render
        calculateStatistics(intakesData);
        applyStatusFilter();
        
        // If details modal is open for this updated record, refresh the modal view
        const detailsModal = document.getElementById("details-modal");
        const modalPatientId = document.getElementById("modal-patient-id");
        if (detailsModal && detailsModal.classList.contains("show") && modalPatientId) {
            const currentModalId = modalPatientId.textContent.replace("#ID-", "");
            if (parseInt(currentModalId) === updatedRecord.id) {
                // Refresh modal with new data
                openIntakeDetails(updatedRecord);
            }
        }
    } else {
        // If it's a new record or updated record that fits our current date but we don't have it yet
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

// --- Handle Incoming Realtime Deletions ---
async function handleIncomingDelete(oldRecord) {
    const idx = intakesData.findIndex(r => r.id === oldRecord.id);
    if (idx !== -1) {
        intakesData.splice(idx, 1);

        // Update database-wide loyal phones list
        await fetchLoyalPhones();

        calculateStatistics(intakesData);
        applyStatusFilter();
        
        // Close modal if deleted record was being viewed
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


// --- Synthesize alert bell chime (Web Audio API) ---
function playAlertPing() {
    if (!soundEnabled) return;

    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Bell sound envelope
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.type = "sine";
        // Play sweet major 3rd jump (A5 to C#6)
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1109, audioCtx.currentTime + 0.12); // C#6

        gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8); // Smooth decay

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
        console.error("GAIA Dashboard: Failed to synthesize notification sound:", e);
    }
}

// --- Utility to Parse Photos Array ---
function getPhotosArray(petPhotoString) {
    if (!petPhotoString) return [];
    try {
        const parsed = JSON.parse(petPhotoString);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        return [petPhotoString];
    } catch (e) {
        // Not a JSON array, treat it as a single photo string
        return [petPhotoString];
    }
}

// --- Status Filter and Rendering ---
function applyStatusFilter() {
    // Analyze duplicates across full dataset before filtering/pagination
    analyzeDuplicates();

    let filtered;
    if (currentStatusFilter === 'new') {
        filtered = intakesData.filter(r => !r.trang_thai || r.trang_thai === 'new');
    } else if (currentStatusFilter === 'done') {
        filtered = intakesData.filter(r => r.trang_thai === 'done');
    } else {
        filtered = intakesData;
    }

    // Apply search filter if query exists (now integrated into the filter data flow)
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

    // Safety check for currentPage bounds
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
}

// --- Pagination Renderer ---
function renderPagination(totalItems) {
    const container = document.getElementById("pagination-container");
    if (!container) return;

    container.innerHTML = "";

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) {
        // Hide pagination if only 1 page or empty
        return;
    }

    // Previous Page Button
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

    // Page Numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // First page and dots if startPage > 1
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

    // Last page and dots if endPage < totalPages
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

    // Next Page Button
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

// Helper to scroll smoothly to the top of the intakes list when changing page
function scrollToIntakesList() {
    const listEl = document.getElementById("intakes-list");
    if (listEl) {
        const yOffset = -120; 
        const y = listEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
}

// --- Rendering Intakes Cards ---
function renderAllIntakes(records) {
    intakesList.innerHTML = "";

    if (records.length === 0) {
        noDataPlaceholder.style.display = "flex";
        intakesList.style.display = "none";
        // Context-aware empty state
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


function createIntakeCard(record) {
    const card = document.createElement("div");
    const isDone = record.trang_thai === 'done';
    card.className = `intake-card ${isDone ? 'card-status-done' : 'card-status-new'}`;
    card.setAttribute("data-id", record.id);
    card.setAttribute("data-status", isDone ? 'done' : 'new');

    // Loyal customer detection (only show for 'new' status, not 'done')
    const isLoyal = record.owner_phone && loyalPhones.has(record.owner_phone.trim()) && (!record.trang_thai || record.trang_thai === 'new');
    const loyalBadgeHTML = isLoyal 
        ? `<span class="customer-loyal-badge" title="Khách hàng đã đăng ký nhiều lần">(Khách quen)</span>`
        : ``;

    // Duplicate detection
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

    // Parse time
    const localTimeStr = formatDateTime(record.created_at || record.date_signed);

    // Get vaccines status HTML classes
    const coreClass = record.vaccine_core === 'yes' ? 'badge-yes' : (record.vaccine_core === 'no' ? 'badge-no' : 'badge-unknown');
    const coreText = record.vaccine_core === 'yes' ? 'Core Vac ✓' : (record.vaccine_core === 'no' ? 'Core Vac ✗' : 'Core Vac ?');

    const rabiesClass = record.vaccine_rabies === 'yes' ? 'badge-yes' : (record.vaccine_rabies === 'no' ? 'badge-no' : 'badge-unknown');
    const rabiesText = record.vaccine_rabies === 'yes' ? 'Rabies ✓' : (record.vaccine_rabies === 'no' ? 'Rabies ✗' : 'Rabies ?');

    const neuteredClass = record.pet_neutered === 'yes' ? 'badge-neutered' : 'badge-unknown';
    const neuteredText = record.pet_neutered === 'yes' ? 'Đã Triệt Sản' : 'Chưa Triệt Sản';

    // Status badge HTML
    const statusBadgeHTML = isDone
        ? `<span class="card-status-badge badge-done-card">✔ Đã xử lý</span>`
        : `<span class="card-status-badge badge-new-card">● Mới</span>`;

    // Toggle button HTML
    const toggleBtnHTML = isDone
        ? `<button class="btn-toggle-status btn-mark-new" data-id="${record.id}" title="Đánh dấu là Mới">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 18 0A9 9 0 0 0 3 12z"/><path d="M12 8v4m0 4h.01"/></svg>
            Đánh dấu Mới
           </button>`
        : `<button class="btn-toggle-status btn-mark-done" data-id="${record.id}" title="Đánh dấu Đã xử lý">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Xác nhận Xử lý
           </button>`;

    // Renders pet cover banner (takes first image from array if exists)
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

    // Click on card body (but NOT on the toggle button or delete button) triggers modal view popup
    card.addEventListener("click", (e) => {
        if (e.target.closest(".btn-toggle-status") || e.target.closest(".btn-delete-duplicate")) return; // Don't open modal on button click
        openIntakeDetails(record);
    });

    // Toggle status button
    const toggleBtn = card.querySelector(".btn-toggle-status");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await toggleCardStatus(record, card, toggleBtn);
        });
    }

    // Delete duplicate button
    const deleteDupBtn = card.querySelector(".btn-delete-duplicate");
    if (deleteDupBtn) {
        deleteDupBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await deleteDuplicateRecord(record, deleteDupBtn);
        });
    }

    return card;
}

// --- Custom Confirm Modal Promise ---
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

        // Also clean up/cancel if clicked outside card (on overlay backdrop)
        modal.onclick = (e) => {
            if (e.target === modal) cleanUp(false);
        };
    });
}

// --- Delete Duplicate Record ---
async function deleteDuplicateRecord(record, btnEl) {
    const confirmMsg = `Bạn có chắc chắn muốn xóa vĩnh viễn ca khai báo trùng lặp này của bé ${record.pet_name} (SĐT: ${record.owner_phone}) không?`;
    const isConfirmed = await showCustomConfirm(confirmMsg);
    if (!isConfirmed) return;

    // Disable button & show loading state
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
        }

        // Local fallback in case realtime delay or disconnect occurs
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

// --- Toggle Status (Mới ↔ Đã xử lý) ---
async function toggleCardStatus(record, cardEl, btnEl) {
    const newStatus = (record.trang_thai === 'done') ? 'new' : 'done';

    // Optimistic UI: disable button and show loading
    btnEl.disabled = true;
    const originalHTML = btnEl.innerHTML;
    btnEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 0.8s linear infinite;width:14px;height:14px"><circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="5"/></svg> Đang lưu...`;

    try {
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('pet_intakes')
                .update({ trang_thai: newStatus })
                .eq('id', record.id);
            if (error) throw error;
        }

        // Update local data
        record.trang_thai = newStatus;
        const idx = intakesData.findIndex(r => r.id === record.id);
        if (idx !== -1) intakesData[idx].trang_thai = newStatus;

        // Recalculate counts and re-render
        calculateStatistics(intakesData);
        applyStatusFilter(); // This will re-render cards & remove this one if needed

    } catch (e) {
        console.error('GAIA Dashboard: Error toggling status:', e);
        btnEl.disabled = false;
        btnEl.innerHTML = originalHTML;
        alert(`Lỗi cập nhật trạng thái: ${e.message || e}`);
    }
}

// --- Open Detailed Modal View ---
function openIntakeDetails(record) {
    activeIntakeRecord = record;
    modalPatientId.textContent = `#ID-${record.id}`;

    // Owner Details
    dOwnerName.textContent = record.owner_name || "-";
    dOwnerPhone.textContent = record.owner_phone || "-";
    dOwnerAddress.textContent = record.owner_address || "-";

    // Pet Details
    dPetName.textContent = record.pet_name || "-";
    dPetBreed.textContent = record.pet_breed || "-";
    dPetWeight.textContent = record.pet_weight ? `${record.pet_weight} kg` : "-";
    dPetAgeGender.textContent = record.pet_age_gender || "-";
    dPetColor.textContent = record.pet_color || "-";

    // Neutered translation
    if (record.pet_neutered === 'yes') {
        dPetNeutered.className = "info-value badge badge-neutered";
        dPetNeutered.textContent = "Đã Triệt Sản (Neutered)";
    } else {
        dPetNeutered.className = "info-value badge badge-unknown";
        dPetNeutered.textContent = "Chưa Triệt Sản (Intact)";
    }

    // Pet photo details show/hide with multi-photo gallery support
    const photoContainer = document.getElementById("detail-pet-photo-container");
    const activePhotoImg = document.getElementById("detail-active-photo-img");
    const thumbnailsGrid = document.getElementById("detail-photo-thumbnails-grid");
    const detailTwoCol = document.querySelector(".detail-two-col");

    if (photoContainer && activePhotoImg && thumbnailsGrid) {
        const photosArray = getPhotosArray(record.pet_photo);

        if (photosArray.length > 0) {
            activePhotoImg.src = photosArray[0];
            photoContainer.style.display = "block";
            if (detailTwoCol) {
                detailTwoCol.classList.add("has-photos");
            }

            // Clear existing thumbnails
            thumbnailsGrid.innerHTML = "";

            if (photosArray.length > 1) {
                thumbnailsGrid.style.display = "grid";
                photosArray.forEach((photoSrc, idx) => {
                    const thumb = document.createElement("div");
                    thumb.className = `thumbnail-item ${idx === 0 ? 'active' : ''}`;
                    thumb.innerHTML = `<img src="${photoSrc}" alt="Thumbnail">`;

                    thumb.addEventListener("click", () => {
                        // Switch active image source
                        activePhotoImg.style.opacity = "0.3";
                        setTimeout(() => {
                            activePhotoImg.src = photoSrc;
                            activePhotoImg.style.opacity = "1";
                        }, 150);

                        // Switch active class on thumbnails
                        thumbnailsGrid.querySelectorAll(".thumbnail-item").forEach(t => t.classList.remove("active"));
                        thumb.classList.add("active");
                    });

                    thumbnailsGrid.appendChild(thumb);
                });
            } else {
                thumbnailsGrid.style.display = "none";
            }
        } else {
            activePhotoImg.src = "";
            photoContainer.style.display = "none";
            thumbnailsGrid.innerHTML = "";
            thumbnailsGrid.style.display = "none";
            if (detailTwoCol) {
                detailTwoCol.classList.remove("has-photos");
            }
        }
    }

    // Vaccines translations
    setupVaccineLabel(dVacCore, record.vaccine_core, "Core Vaccine");
    setupVaccineLabel(dVacRabies, record.vaccine_rabies, "Rabies Vaccine");
    setupVaccineLabel(dVacParasite, record.parasite_prevention, "Parasite Prev");

    // Texts fields
    dMedHistory.textContent = record.medical_history ? record.medical_history.trim() : "Không ghi nhận";
    dAllergies.textContent = record.allergies ? record.allergies.trim() : "Không ghi nhận";
    dMeds.textContent = record.current_meds ? record.current_meds.trim() : "Không ghi nhận";

    // Diets checkboxes render
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

    // Date signed and base64 signature
    dDateSigned.textContent = formatDateString(record.created_at || record.date_signed);
    dSignatureImg.src = record.signature_data || "";

    // ==========================================
    // 🖨️ Populate High-Fidelity Print Template
    // ==========================================
    document.getElementById("print-owner-name").textContent = record.owner_name || "-";
    document.getElementById("print-owner-phone").textContent = record.owner_phone || "-";
    document.getElementById("print-owner-address").textContent = record.owner_address || "-";
    document.getElementById("print-pet-name").textContent = record.pet_name || "-";
    document.getElementById("print-pet-weight").textContent = record.pet_weight ? `${record.pet_weight} kg` : "-";
    document.getElementById("print-pet-breed").textContent = record.pet_breed || "-";
    document.getElementById("print-pet-color").textContent = record.pet_color || "-";
    document.getElementById("print-pet-age-gender").textContent = record.pet_age_gender || "-";

    // Neutered checkbox representation
    document.getElementById("print-pet-neutered-yes").textContent = record.pet_neutered === "yes" ? "☑" : "☐";
    document.getElementById("print-pet-neutered-no").textContent = record.pet_neutered === "no" ? "☑" : "☐";

    // Vaccine Core checkbox representation
    document.getElementById("print-vac-core-yes").textContent = record.vaccine_core === "yes" ? "☑" : "☐";
    document.getElementById("print-vac-core-no").textContent = record.vaccine_core === "no" ? "☑" : "☐";
    document.getElementById("print-vac-core-unknown").textContent = record.vaccine_core === "unknown" ? "☑" : "☐";

    // Vaccine Rabies checkbox representation
    document.getElementById("print-vac-rabies-yes").textContent = record.vaccine_rabies === "yes" ? "☑" : "☐";
    document.getElementById("print-vac-rabies-no").textContent = record.vaccine_rabies === "no" ? "☑" : "☐";
    document.getElementById("print-vac-rabies-unknown").textContent = record.vaccine_rabies === "unknown" ? "☑" : "☐";

    // Parasite Prevention checkbox representation
    document.getElementById("print-parasite-yes").textContent = record.parasite_prevention === "yes" ? "☑" : "☐";
    document.getElementById("print-parasite-no").textContent = record.parasite_prevention === "no" ? "☑" : "☐";
    document.getElementById("print-parasite-unknown").textContent = record.parasite_prevention === "unknown" ? "☑" : "☐";

    // Medical text values representation
    document.getElementById("print-med-history").textContent = record.medical_history ? record.medical_history.trim() : "Không ghi nhận";
    document.getElementById("print-allergies").textContent = record.allergies ? record.allergies.trim() : "Không ghi nhận";
    document.getElementById("print-meds").textContent = record.current_meds ? record.current_meds.trim() : "Không ghi nhận";

    // Diet checkbox representation
    document.getElementById("print-diet-wet").textContent = record.diet_wet ? "☑" : "☐";
    document.getElementById("print-diet-dry").textContent = record.diet_dry ? "☑" : "☐";
    document.getElementById("print-diet-homemade").textContent = record.diet_homemade ? "☑" : "☐";

    // Consent checkbox representation
    document.getElementById("print-consent-accuracy").textContent = record.consent_accuracy ? "☑" : "☐";
    document.getElementById("print-consent-storage").textContent = record.consent_storage ? "☑" : "☐";

    // Signature and date representation
    document.getElementById("print-date").textContent = formatDateString(record.created_at || record.date_signed);
    document.getElementById("print-sig-img").src = record.signature_data || "";

    // Dedicated print photos attachments
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

    // Show modal overlay
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

// --- Setup Event Listeners ---
function setupEventListeners() {
    // Close Modal button
    modalCloseBtn.addEventListener("click", () => {
        detailsModal.classList.remove("show");
    });

    // Close Modal on clicking dark backdrop
    detailsModal.addEventListener("click", (e) => {
        if (e.target === detailsModal) {
            detailsModal.classList.remove("show");
        }
    });

    // PDF direct download trigger
    modalPrintBtn.addEventListener("click", () => {
        if (!activeIntakeRecord) return;
        window.print();
    });

    // Realtime search bar dynamic filtering
    searchInput.addEventListener("input", () => {
        currentPage = 1;
        applyStatusFilter();
    });

    // Close modal on pressing the Escape key
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.key === "Esc") {
            detailsModal.classList.remove("show");
        }
    });

    // Date navigation arrows
    const prevBtn = document.getElementById('date-prev-btn');
    const nextBtn = document.getElementById('date-next-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => navigateDate(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateDate(1));

    // 'All Dates' / 'Today' toggle button click handler
    const dateAllBtn = document.getElementById('date-all-btn');
    if (dateAllBtn) {
        dateAllBtn.addEventListener('click', () => {
            if (isAllDates) {
                // If showing all, toggle back to Today
                isAllDates = false;
                viewDate = new Date();
                viewDate.setHours(0, 0, 0, 0);
                syncDatePickerInput();
            } else {
                // If showing specific date, toggle to All Dates
                isAllDates = true;
            }
            currentPage = 1;
            updateDateDisplay();
            fetchInitialIntakes();
        });
    }

    // Calendar picker: clicking the calendar icon opens native date picker
    const datePickerInput = document.getElementById('date-picker-input');
    if (datePickerInput) {
        const todayISO = new Date().toISOString().split('T')[0];
        // Set initial value to today (but allow future dates)
        datePickerInput.value = todayISO;

        datePickerInput.addEventListener('change', () => {
            const val = datePickerInput.value; // 'YYYY-MM-DD'
            if (!val) return;
            isAllDates = false;
            // Parse as local date (avoid UTC shift)
            const [y, m, d] = val.split('-').map(Number);
            const picked = new Date(y, m - 1, d);
            picked.setHours(0, 0, 0, 0);

            viewDate = picked;
            currentPage = 1;
            updateDateDisplay();
            fetchInitialIntakes();
        });
    }


    // Status filter tabs
    document.querySelectorAll('.status-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentStatusFilter = tab.getAttribute('data-filter');
            currentPage = 1;
            applyStatusFilter();
        });
    });

    // Floating Back to Top Button
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

    // Clipboard Click-to-Copy event delegation
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
            // Remove text inside dynamic nested badge or clean symbols if any
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
    // Prevent duplicate tooltips
    if (button.querySelector(".copied-tooltip")) return;

    const tooltip = document.createElement("span");
    tooltip.className = "copied-tooltip";
    tooltip.textContent = "Đã chép!";

    button.appendChild(tooltip);

    // Remove tooltip after animation is complete
    setTimeout(() => {
        tooltip.remove();
    }, 1500);
}

// --- Search filtering helper ---
function filterCards(query) {
    currentPage = 1;
    applyStatusFilter();
}

// --- Statistical Summary Calculations ---
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

// --- Date Navigation ---
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
        // Capitalize first letter
        statDateEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    }
    if (labelEl) {
        labelEl.textContent = isToday ? 'Hôm nay' : (viewDate.getTime() > today.getTime() ? 'Kế hoạch tương lai' : 'Ngày đã chọn');
    }
    // Allow selecting future dates (do not disable nextBtn at today)
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
    fetchInitialIntakes(); // Reload data for the new date
}

function syncDatePickerInput() {
    const input = document.getElementById('date-picker-input');
    if (!input) return;
    // Format viewDate as YYYY-MM-DD (local time, not UTC)
    const y = viewDate.getFullYear();
    const m = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(viewDate.getDate()).padStart(2, '0');
    input.value = `${y}-${m}-${d}`;
}


// --- Utility Helpers (legacy stub for backward compat) ---
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
        // Detect date-only strings (like YYYY-MM-DD or YYYY/MM/DD) that don't have time portions
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

function showErrorState(errorMessage) {
    loadingSpinner.style.display = "none";
    noDataPlaceholder.style.display = "flex";
    noDataPlaceholder.querySelector(".empty-icon-wrap").style.color = "var(--danger)";
    noDataPlaceholder.querySelector(".empty-icon-wrap").style.borderColor = "var(--danger)";
    noDataPlaceholder.querySelector("h3").textContent = "Không thể khởi động Dashboard";
    noDataPlaceholder.querySelector("p").innerHTML = `<span style="color: var(--danger); font-weight: 600;">${errorMessage}</span>`;
}
