/* GAIA Animal Hospital Ho Chi Minh City Intake Form Application Logic */

// --- Translation Dictionary ---
const translations = {
    vi: {
        title: "Thông tin Chủ & Thú cưng",
        subtitle: "Vui lòng điền thông tin để phục vụ bé tốt nhất | Owner & Pet Info",
        step_owner: "Chủ nuôi",
        step_pet: "Thú cưng",
        step_medical: "Y tế",
        step_confirm: "Xác nhận",
        section_owner: "Thông tin Chủ thú cưng",
        label_owner_name: "Tên chủ thú cưng",
        label_owner_phone: "Số điện thoại",
        label_owner_address: "Địa chỉ",
        section_pet: "Thông tin Thú cưng",
        label_pet_name: "Tên thú cưng",
        label_pet_breed: "Loài / Giống",
        label_pet_weight: "Cân nặng (kg)",
        label_pet_age_gender: "Tuổi / Giới tính",
        title_neutered: "Trạng thái triệt sản",
        option_neutered_yes: "Đã triệt sản",
        option_neutered_no: "Chưa triệt sản",
        label_pet_color: "Màu sắc / Đặc điểm",
        section_medical: "Y tế & Chế độ ăn",
        label_vaccine_core: "Vaccine bệnh (Core Vaccine)",
        label_vaccine_rabies: "Vaccine dại (Rabies Vaccine)",
        label_parasite: "Phòng Ký sinh trùng",
        choice_yes: "Có",
        choice_no: "Không",
        choice_none: "Không",
        choice_unknown: "Không rõ",
        label_medical_history: "Các vấn đề sức khoẻ",
        label_allergies: "Dị ứng (thức ăn / thuốc)",
        label_current_meds: "Thuốc / Thực phẩm bổ sung đang dùng",
        label_diet: "Chế độ ăn hằng ngày",
        diet_wet: "Thức ăn ướt",
        diet_dry: "Thức ăn khô",
        diet_homemade: "Thức ăn tự làm",
        section_confirm: "Cam kết & Chữ ký",
        consent_accuracy_text: "Tôi xác nhận rằng các thông tin trên là hoàn toàn chính xác.",
        consent_storage_text: "Tôi đồng ý để GAIA lưu trữ thông tin này (bao gồm cả nội dung ghi âm trao đổi chuyên môn) cho mục đích chăm sóc thú cưng và liên hệ.",
        label_signature: "Chữ ký khách hàng",
        btn_clear_signature: "Xóa chữ ký",
        label_date: "Ngày ký",
        btn_prev: "Quay lại",
        btn_next: "Tiếp tục",
        btn_submit: "Gửi thông tin",
        success_title: "Gửi thành công!",
        success_desc: "Cảm ơn bạn. Thông tin của bạn đã được tiếp nhận thành công tại hệ thống GAIA Animal Hospital Ho Chi Minh City.",
        btn_download_pdf: "Tải file PDF / In",
        btn_close: "Đóng",
        error_required: "Vui lòng điền thông tin này",
        error_phone: "Số điện thoại không hợp lệ",
        error_consent: "Bạn cần đồng ý với điều khoản này",
        error_signature: "Vui lòng ký tên của bạn",
        error_photo_required: "Vui lòng tải lên ít nhất 1 hình ảnh thú cưng",
        btn_collapse: "Ẩn bớt",
        btn_expand_more: "Hiển thị thêm",
        voice_tooltip: "Nhập bằng giọng nói",
        voice_listening: "Đang nghe...",
        voice_not_supported: "Trình duyệt không hỗ trợ nhập giọng nói",
        error_invalid_number: "Thông tin không hợp lệ"
    },
    en: {
        title: "Owner & Pet Profile",
        subtitle: "Please provide the details to help us care for your pet",
        step_owner: "Owner",
        step_pet: "Pet",
        step_medical: "Medical",
        step_confirm: "Confirm",
        section_owner: "Owner Information",
        label_owner_name: "Owner's Full Name",
        label_owner_phone: "Phone Number",
        label_owner_address: "Address",
        section_pet: "Pet Information",
        label_pet_name: "Pet's Name",
        label_pet_breed: "Species / Breed",
        label_pet_weight: "Weight (kg)",
        label_pet_age_gender: "Age / Gender",
        title_neutered: "Neutered Status",
        option_neutered_yes: "Neutered / Spayed",
        option_neutered_no: "Intact",
        label_pet_color: "Color / Markings",
        section_medical: "Medical & Daily Diet",
        label_vaccine_core: "Core Vaccine Status",
        label_vaccine_rabies: "Rabies Vaccine Status",
        label_parasite: "Parasite Prevention",
        choice_yes: "Yes",
        choice_no: "No",
        choice_none: "None",
        choice_unknown: "Unknown",
        label_medical_history: "Medical History / Conditions",
        label_allergies: "Allergies (Food / Meds)",
        label_current_meds: "Current Medications / Supplements",
        label_diet: "Daily Diet",
        diet_wet: "Wet Food",
        diet_dry: "Dry Food",
        diet_homemade: "Homemade Diet",
        section_confirm: "Consent & Signature",
        consent_accuracy_text: "I certify that all the provided details are true and accurate.",
        consent_storage_text: "I authorize GAIA to store this profile data (including recorded expert consultations) for care coordination.",
        label_signature: "Owner's Signature",
        btn_clear_signature: "Clear Signature",
        label_date: "Date Signed",
        btn_prev: "Back",
        btn_next: "Next",
        btn_submit: "Submit Profile",
        success_title: "Submission Successful!",
        success_desc: "Thank you. Your pet's profile has been securely recorded at GAIA Animal Hospital Ho Chi Minh City.",
        btn_download_pdf: "Download PDF / Print",
        btn_close: "Close",
        error_required: "This field is required",
        error_phone: "Invalid phone number format",
        error_consent: "You must agree to these terms",
        error_signature: "Your signature is required",
        error_photo_required: "Please upload at least 1 pet photo",
        btn_collapse: "Collapse",
        btn_expand_more: "Show more",
        voice_tooltip: "Voice input",
        voice_listening: "Listening...",
        voice_not_supported: "Voice input is not supported in this browser",
        error_invalid_number: "Invalid number format"
    },
    ja: {
        title: "ペット・飼い主様 登録",
        subtitle: "大切なペットに最高のケアを提供するため、ご記入ください",
        step_owner: "飼い主様",
        step_pet: "ペット",
        step_medical: "医療",
        step_confirm: "確認・署名",
        section_owner: "飼い主様情報",
        label_owner_name: "飼い主様のお名前",
        label_owner_phone: "電話番号",
        label_owner_address: "ご住所",
        section_pet: "ペット情報",
        label_pet_name: "ペットのお名前",
        label_pet_breed: "種類・品種",
        label_pet_weight: "体重 (kg)",
        label_pet_age_gender: "年齢・性別",
        title_neutered: "去勢・避妊手術",
        option_neutered_yes: "去勢・避妊済み",
        option_neutered_no: "未去勢",
        label_pet_color: "毛色・特徴",
        section_medical: "ワクチン接種と普段の食事",
        label_vaccine_core: "混合ワクチン接種状況",
        label_vaccine_rabies: "狂犬病ワクチン接種状況",
        label_parasite: "寄生虫予防対策",
        choice_yes: "接種済み",
        choice_no: "未接種",
        choice_none: "なし",
        choice_unknown: "不明",
        label_medical_history: "既往歴・持病",
        label_allergies: "アレルギー（食物・薬）",
        label_current_meds: "現在服用中の薬・サプリ",
        label_diet: "普段のご飯",
        diet_wet: "ウェットフード",
        diet_dry: "ドライフード",
        diet_homemade: "手作り食",
        section_confirm: "同意とご署名",
        consent_accuracy_text: "上記の内容が正確で事実と相違ないことを確認します。",
        consent_storage_text: "GAIAがペットケアおよび連絡目的で、この情報（専門相談の録音含む）を保存することに同意します。",
        label_signature: "ご署名",
        btn_clear_signature: "署名をクリア",
        label_date: "日付",
        btn_prev: "戻る",
        btn_next: "次へ",
        btn_submit: "情報を送信",
        success_title: "送信が完了しました！",
        success_desc: "ご協力ありがとうございました。GAIA Animal Hospital Ho Chi Minh Cityにペット情報が正常に保存されました。",
        btn_download_pdf: "PDF保存 / 印刷",
        btn_close: "閉じる",
        error_required: "この項目は必須です",
        error_phone: "電話番号が正しくありません",
        error_consent: "同意ボックスにチェックを入れてください",
        error_signature: "署名を入力してください",
        error_photo_required: "ペットの写真を少なくとも1枚アップロードしてください",
        btn_collapse: "折りたたむ",
        btn_expand_more: "もっと見る",
        voice_tooltip: "音声入力",
        voice_listening: "聞いています...",
        voice_not_supported: "このブラウザは音声入力に対応していません",
        error_invalid_number: "数値の形式が正しくありません"
    }
};

let currentLang = "vi";
let currentStep = 1;
const totalSteps = 4;

// --- DOM Elements ---
const form = document.getElementById("gaia-intake-form");
const steps = document.querySelectorAll(".wizard-step");
const stepDots = document.querySelectorAll(".step-dot");
const progressBarFill = document.querySelector(".progress-bar-fill");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const submitBtn = document.getElementById("submit-btn");
const langButtons = document.querySelectorAll(".lang-btn");
const formDateInput = document.getElementById("form-date");

// Success Modal Elements
const successModal = document.getElementById("success-modal");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalDownloadBtn = document.getElementById("modal-download-btn");

// Canvas Signature Pad Elements
const canvas = document.getElementById("signature-canvas");
const ctx = canvas.getContext("2d");
const clearSigBtn = document.getElementById("clear-sig-btn");
const sigErrorMsg = document.getElementById("sig-error-msg");

let isDrawing = false;
let hasSigned = false;
let petPhotoDataUrl = ""; // Stores JSON stringified array of pet photos
let petPhotosArray = [];  // Array of base64 image strings

// --- Anti-Spam Protection State ---
const SPAM_CONFIG = {
    MIN_FILL_TIME_MS: 15000,       // Min 15 seconds to fill the form (bots are instant)
    MAX_SUBMISSIONS_PER_HOUR: 3,   // Max 3 submissions per hour per device
    COOLDOWN_BETWEEN_SUBMIT_MS: 120000, // 2 minutes mandatory cooldown between submissions
    RATE_LIMIT_WINDOW_MS: 3600000  // 1 hour sliding window for rate limiting
};
let formStartTime = null; // Timestamp when user first interacted with form

// --- Supabase Client Initialization ---
let supabaseClient = null;
if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_PROJECT_URL') {
    try {
        // supabase.createClient comes from the loaded @supabase/supabase-js library CDN
        supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log("GAIA: Supabase Client initialized successfully!");
        initFormPresence();
    } catch (e) {
        console.error("GAIA: Error initializing Supabase client:", e);
    }
} else {
    console.warn("GAIA: Supabase credentials are not configured in env.js. Operating in local Mock Mode.");
}

// Join Supabase real-time presence channel so Admin dashboard shows accurate live form user count
function initFormPresence() {
    if (!supabaseClient) return;
    try {
        const clientId = 'customer_' + Math.random().toString(36).substring(2, 10);
        const presenceChannel = supabaseClient.channel('gaia_form_activity');
        presenceChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await presenceChannel.track({
                    user: clientId,
                    online_at: new Date().toISOString()
                });
            }
        });
    } catch (e) {
        console.warn("Could not start presence tracking:", e);
    }
}

// --- Auto-expanding Textareas with > 3 Lines Expand/Collapse Toggle ---
function updateTextareaResize(textarea) {
    if (!textarea) return;
    const inputGroup = textarea.closest(".input-group");
    if (!inputGroup) return;

    const toggleBtn = inputGroup.querySelector(".btn-textarea-toggle");
    const MAX_3_LINES_HEIGHT = 98; // 3 lines threshold (~98px)
    const COLLAPSED_HEIGHT = 98;

    const isCollapsed = textarea.dataset.collapsed === "true";

    if (!isCollapsed) {
        textarea.style.height = "auto";
    }

    const scrollH = textarea.scrollHeight;

    if (scrollH > MAX_3_LINES_HEIGHT + 6) {
        if (toggleBtn) {
            toggleBtn.style.display = "inline-flex";
            updateToggleButtonState(toggleBtn, !isCollapsed);
        }
        // Add bottom padding so text doesn't overlap the toggle button inside
        textarea.style.paddingBottom = "28px";

        if (isCollapsed) {
            textarea.style.height = COLLAPSED_HEIGHT + "px";
            textarea.style.overflowY = "auto";
        } else {
            textarea.style.height = scrollH + "px";
            textarea.style.overflowY = "hidden";
        }
    } else {
        if (toggleBtn) {
            toggleBtn.style.display = "none";
        }
        textarea.dataset.collapsed = "false";
        textarea.style.paddingBottom = "";
        const minH = textarea.rows === 3 ? 88 : 72;
        textarea.style.height = Math.max(scrollH, minH) + "px";
        textarea.style.overflowY = "hidden";
    }
}

function updateToggleButtonState(toggleBtn, isExpanded) {
    if (!toggleBtn) return;
    const iconSpan = toggleBtn.querySelector(".toggle-icon");
    const textSpan = toggleBtn.querySelector(".toggle-text");
    const dict = (typeof translations !== "undefined" && translations[currentLang]) ? translations[currentLang] : (typeof translations !== "undefined" ? translations.vi : null);
    if (!dict) return;

    if (isExpanded) {
        if (iconSpan) iconSpan.textContent = "▲";
        if (textSpan) {
            textSpan.textContent = dict.btn_collapse || "Ẩn bớt";
            textSpan.setAttribute("data-key", "btn_collapse");
        }
    } else {
        if (iconSpan) iconSpan.textContent = "▼";
        if (textSpan) {
            textSpan.textContent = dict.btn_expand_more || "Hiển thị thêm";
            textSpan.setAttribute("data-key", "btn_expand_more");
        }
    }
}

function initAutoExpandingTextareas() {
    const textareas = document.querySelectorAll("#gaia-intake-form textarea");
    textareas.forEach(textarea => {
        textarea.dataset.collapsed = "false";

        textarea.addEventListener("input", () => {
            textarea.dataset.collapsed = "false";
            updateTextareaResize(textarea);
        });

        textarea.addEventListener("blur", () => {
            updateTextareaResize(textarea);
        });

        const inputGroup = textarea.closest(".input-group");
        const toggleBtn = inputGroup ? inputGroup.querySelector(".btn-textarea-toggle") : null;
        if (toggleBtn) {
            toggleBtn.addEventListener("click", (e) => {
                e.preventDefault();
                const currentlyCollapsed = textarea.dataset.collapsed === "true";
                textarea.dataset.collapsed = currentlyCollapsed ? "false" : "true";

                textarea.style.transition = "height 0.35s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease";
                updateTextareaResize(textarea);
                setTimeout(() => {
                    textarea.style.transition = "";
                }, 360);
            });
        }

        updateTextareaResize(textarea);
    });

    window.addEventListener("resize", () => {
        textareas.forEach(textarea => updateTextareaResize(textarea));
    });
}

// --- Speech-to-Text Voice Input for ALL Text Input Fields ---
let activeVoiceRecognition = null;
let activeVoiceMicBtn = null;
let activeVoiceField = null;
let voiceIsRecording = false;

const MIC_SVG_HTML = `<svg class="mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
</svg><span class="mic-pulse-ring"></span>`;

function getSpeechLang() {
    const langMap = { vi: "vi-VN", en: "en-US", ja: "ja-JP" };
    return langMap[currentLang] || "vi-VN";
}

function stopAllVoiceRecording() {
    voiceIsRecording = false;
    if (activeVoiceRecognition) {
        try { activeVoiceRecognition.stop(); } catch (e) { /* ignore */ }
        activeVoiceRecognition = null;
    }
    if (activeVoiceMicBtn) {
        activeVoiceMicBtn.classList.remove("recording");
        activeVoiceMicBtn.setAttribute("aria-label", translations[currentLang]?.voice_tooltip || "Nhập bằng giọng nói");
    }
    if (activeVoiceField) {
        activeVoiceField.style.borderColor = "";
        activeVoiceField.style.boxShadow = "";
        // Auto-expand if textarea
        if (activeVoiceField.tagName === "TEXTAREA" && typeof updateTextareaResize === "function") {
            updateTextareaResize(activeVoiceField);
        }
    }
    activeVoiceMicBtn = null;
    activeVoiceField = null;

    if (typeof saveDraft === "function") {
        saveDraft();
    }
}

function parseSpeechNumber(text) {
    if (!text) return "";
    let s = text.trim().toLowerCase();

    // Clean up decimals & rưỡi
    s = s.replace(/,/g, ".")
         .replace(/phẩy|chấm|point|dot/g, ".")
         .replace(/\s*\.\s*/g, ".")
         .replace(/rưỡi/g, ".5");

    // Word mapping for Vietnamese & English numbers
    const numMap = {
        "không": "0", "zero": "0",
        "một": "1", "mốt": "1", "one": "1",
        "hai": "2", "two": "2",
        "ba": "3", "three": "3",
        "bốn": "4", "tư": "4", "four": "4",
        "năm": "5", "lăm": "5", "five": "5",
        "sáu": "6", "six": "6",
        "bảy": "7", "bẩy": "7", "seven": "7",
        "tám": "8", "eight": "8",
        "chín": "9", "nine": "9",
        "mười": "10", "chục": "10", "ten": "10"
    };

    for (const [word, digit] of Object.entries(numMap)) {
        const regex = new RegExp(`\\b${word}\\b`, "g");
        s = s.replace(regex, digit);
    }

    // Extract first valid integer or decimal number
    const match = s.match(/(\d+(?:\.\d+)?)/);
    if (match) {
        return match[1];
    }
    return text.trim();
}

function startVoiceRecording(field, micBtn) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Stop any existing recording first
    if (voiceIsRecording) {
        stopAllVoiceRecording();
    }

    activeVoiceField = field;
    activeVoiceMicBtn = micBtn;
    activeVoiceRecognition = new SpeechRecognition();
    activeVoiceRecognition.lang = getSpeechLang();
    activeVoiceRecognition.interimResults = true;
    activeVoiceRecognition.continuous = true;
    activeVoiceRecognition.maxAlternatives = 1;

    let finalTranscript = field.value;
    const separator = finalTranscript.length > 0 && !finalTranscript.endsWith(" ") ? " " : "";

    voiceIsRecording = true;
    micBtn.classList.add("recording");
    micBtn.setAttribute("aria-label", translations[currentLang]?.voice_listening || "Đang nghe...");

    // Visual feedback on the field
    field.style.borderColor = "#dc2626";
    field.style.boxShadow = "0 0 0 3px rgba(220, 38, 38, 0.15)";

    activeVoiceRecognition.onresult = (event) => {
        let interimTranscript = "";
        let sessionFinal = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                sessionFinal += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        let rawText = "";
        if (sessionFinal) {
            finalTranscript = finalTranscript + separator + sessionFinal;
            rawText = finalTranscript;
        } else {
            rawText = finalTranscript + separator + interimTranscript;
        }

        const isNumericField = field.id === "pet-weight" || field.id === "pet-age" || field.getAttribute("data-numeric") === "true" || field.type === "number";
        if (isNumericField) {
            field.value = parseSpeechNumber(rawText);
        } else {
            field.value = rawText;
        }

        // Dispatch events so form saves and validates instantly
        field.dispatchEvent(new Event("input", { bubbles: true }));

        // Trigger auto-expand for textareas
        if (field.tagName === "TEXTAREA" && typeof updateTextareaResize === "function") {
            field.dataset.collapsed = "false";
            updateTextareaResize(field);
        }
    };

    activeVoiceRecognition.onerror = (event) => {
        console.warn("Voice recognition error:", event.error);
        stopAllVoiceRecording();
    };

    activeVoiceRecognition.onend = () => {
        if (voiceIsRecording && activeVoiceField === field) {
            try {
                activeVoiceRecognition.start();
            } catch (e) {
                stopAllVoiceRecording();
            }
        }
    };

    try {
        activeVoiceRecognition.start();
    } catch (e) {
        console.error("Failed to start voice recognition:", e);
        stopAllVoiceRecording();
    }
}

function initVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        // Browser does not support Speech Recognition — do nothing
        console.warn("GAIA: Speech Recognition not supported.");
        return;
    }

    // Select all eligible text input fields (not checkboxes, radios, selects, file, date, hidden)
    const eligibleFields = form.querySelectorAll(
        "input[type='text'], input[type='tel'], input[type='number'], textarea"
    );

    eligibleFields.forEach(field => {
        const inputGroup = field.closest(".input-group");
        if (!inputGroup) return;

        // Skip if already has a mic button
        if (inputGroup.querySelector(".btn-voice-input")) return;

        // Add has-voice-input class for CSS padding
        inputGroup.classList.add("has-voice-input");

        // Create mic button
        const micBtn = document.createElement("button");
        micBtn.type = "button";
        micBtn.className = "btn-voice-input";
        micBtn.tabIndex = -1;
        micBtn.setAttribute("aria-label", translations[currentLang]?.voice_tooltip || "Nhập bằng giọng nói");
        micBtn.innerHTML = MIC_SVG_HTML;

        // Insert mic button after the field's label
        const label = inputGroup.querySelector("label");
        if (label) {
            label.insertAdjacentElement("afterend", micBtn);
        } else {
            inputGroup.appendChild(micBtn);
        }

        // Click handler: toggle recording
        micBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (voiceIsRecording && activeVoiceField === field) {
                stopAllVoiceRecording();
            } else {
                startVoiceRecording(field, micBtn);
            }
        });

        // Auto-stop mic when user moves to another field (Tab, click, etc.)
        field.addEventListener("focus", () => {
            if (voiceIsRecording && activeVoiceField !== field) {
                stopAllVoiceRecording();
            }
        });
    });
}

// --- GAIA Daily Intake ID System (STT.DDMMYY.4SốĐuôiSĐT) ---
function getDateStringDDMMYY(dateObj = new Date()) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = String(dateObj.getFullYear()).slice(-2);
    return `${d}${m}${y}`;
}

function getDailySeqNumber() {
    const dateStr = getDateStringDDMMYY();
    let stored = null;
    try {
        stored = JSON.parse(localStorage.getItem("gaia_daily_id_counter"));
    } catch(e) {}
    if (!stored || stored.date !== dateStr) {
        stored = { date: dateStr, count: 1 };
        localStorage.setItem("gaia_daily_id_counter", JSON.stringify(stored));
    }
    return String(stored.count).padStart(2, '0');
}

function incrementDailySeqNumber() {
    const dateStr = getDateStringDDMMYY();
    let stored = null;
    try {
        stored = JSON.parse(localStorage.getItem("gaia_daily_id_counter"));
    } catch(e) {}
    if (!stored || stored.date !== dateStr) {
        stored = { date: dateStr, count: 2 };
    } else {
        stored.count += 1;
    }
    localStorage.setItem("gaia_daily_id_counter", JSON.stringify(stored));
}

function updateIntakeID() {
    const stt = getDailySeqNumber();
    const dateStr = getDateStringDDMMYY();
    const phoneInput = document.getElementById("owner-phone");
    const rawPhone = phoneInput ? phoneInput.value.replace(/\D/g, '') : "";

    let last4 = "____";
    if (rawPhone.length >= 4) {
        last4 = rawPhone.slice(-4);
    } else if (rawPhone.length > 0) {
        last4 = rawPhone.padStart(4, '_');
    }

    const fullId = `${stt}.${dateStr}.${last4}`;

    const screenBadge = document.getElementById("screen-banner-id");
    if (screenBadge) {
        screenBadge.textContent = `ID: ${fullId}`;
    }

    const printBadge = document.getElementById("print-banner-id");
    if (printBadge) {
        printBadge.textContent = `ID: ${fullId}`;
    }

    return fullId;
}

// --- Initialize App ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Autofill today's date
    const today = new Date().toISOString().split('T')[0];
    formDateInput.value = today;

    // 2. Load draft if exists
    loadDraft();

    // 3. Set up event listeners
    setupEventListeners();
    
    // 4. Set up high-DPI signature canvas
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // 5. Apply default language translations
    updateLanguage(currentLang);

    // Initialize auto-expanding textareas and expand/collapse buttons
    initAutoExpandingTextareas();

    // Initialize voice input for address field
    initVoiceInput();

    // Initialize GAIA Intake ID and listen to phone number input changes
    updateIntakeID();
    const ownerPhoneEl = document.getElementById("owner-phone");
    if (ownerPhoneEl) {
        ownerPhoneEl.addEventListener("input", updateIntakeID);
    }

    // 6. Track form start time on first interaction (for bot fill-time check)
    const startTrackingInputs = ["owner-phone", "owner-name", "owner-address", "pet-name"];
    startTrackingInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", () => {
                if (!formStartTime) {
                    formStartTime = Date.now();
                }
            }, { once: false });
        }
    });

    // Inject the spam-block overlay into the DOM if not already present
    injectSpamBlockOverlay();

    // 7. Check and synchronize any pending offline form submissions in the background
    setTimeout(() => {
        sendPendingSubmissions();
    }, 2000); // 2-second delay to avoid blocking initial UI rendering
});

// --- Event Listeners Setup ---
function setupEventListeners() {
    const fabLang = document.getElementById("fab-lang");
    const fabTrigger = document.getElementById("fab-lang-trigger");

    if (fabTrigger && fabLang) {
        let isDragging = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;

        function onPointerDown(e) {
            isDragging = false;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;

            const rect = fabLang.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            function onPointerMove(moveEvent) {
                const curX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const curY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
                const dx = curX - startX;
                const dy = curY - startY;

                if (Math.hypot(dx, dy) > 5) {
                    isDragging = true;
                    fabLang.classList.add("dragging");
                    fabLang.style.right = "auto";
                    fabLang.style.bottom = "auto";
                    const newLeft = Math.max(0, Math.min(window.innerWidth - rect.width, initialLeft + dx));
                    const newTop = Math.max(0, Math.min(window.innerHeight - rect.height, initialTop + dy));
                    fabLang.style.left = `${newLeft}px`;
                    fabLang.style.top = `${newTop}px`;
                }
            }

            function onPointerUp() {
                fabLang.classList.remove("dragging");
                window.removeEventListener("mousemove", onPointerMove);
                window.removeEventListener("mouseup", onPointerUp);
                window.removeEventListener("touchmove", onPointerMove);
                window.removeEventListener("touchend", onPointerUp);
            }

            window.addEventListener("mousemove", onPointerMove);
            window.addEventListener("mouseup", onPointerUp);
            window.addEventListener("touchmove", onPointerMove);
            window.addEventListener("touchend", onPointerUp);
        }

        fabTrigger.addEventListener("mousedown", onPointerDown);
        fabTrigger.addEventListener("touchstart", onPointerDown, { passive: true });

        fabTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            if (isDragging) {
                e.preventDefault();
                isDragging = false;
                return;
            }
            fabLang.classList.toggle("open");
        });

        document.addEventListener("click", (e) => {
            if (!fabLang.contains(e.target)) {
                fabLang.classList.remove("open");
            }
        });
    }

    // Language buttons
    langButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            langButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentLang = btn.getAttribute("data-lang");
            updateLanguage(currentLang);
            if (fabLang) fabLang.classList.remove("open");
        });
    });

    // Floating scroll buttons
    const scrollTopBtn = document.getElementById("fab-scroll-top");
    const scrollBottomBtn = document.getElementById("fab-scroll-bottom");

    function updateScrollButtons() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = window.innerHeight;

        if (scrollTopBtn) {
            if (scrollTop > 200) {
                scrollTopBtn.classList.add("visible");
            } else {
                scrollTopBtn.classList.remove("visible");
            }
        }

        if (scrollBottomBtn) {
            if (scrollTop + clientHeight < scrollHeight - 80) {
                scrollBottomBtn.classList.add("visible");
            } else {
                scrollBottomBtn.classList.remove("visible");
            }
        }
    }

    window.addEventListener("scroll", updateScrollButtons, { passive: true });
    updateScrollButtons();

    if (scrollTopBtn) {
        scrollTopBtn.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    if (scrollBottomBtn) {
        scrollBottomBtn.addEventListener("click", () => {
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
        });
    }

    // Step dots navigation (only allow moving to completed or current steps)
    stepDots.forEach(dot => {
        dot.addEventListener("click", () => {
            const clickedStep = parseInt(dot.getAttribute("data-step"));
            if (clickedStep < currentStep) {
                goToStep(clickedStep);
            } else if (clickedStep > currentStep) {
                // If moving forward, validate current step first
                if (validateStep(currentStep)) {
                    // Check if steps in-between are valid
                    let allValid = true;
                    for (let s = currentStep; s < clickedStep; s++) {
                        if (!validateStep(s)) {
                            goToStep(s);
                            allValid = false;
                            break;
                        }
                    }
                    if (allValid) {
                        goToStep(clickedStep);
                    }
                }
            }
        });
    });

    // Navigation buttons
    prevBtn.addEventListener("click", () => {
        if (currentStep > 1) {
            goToStep(currentStep - 1);
        }
    });

    nextBtn.addEventListener("click", () => {
        if (validateStep(currentStep)) {
            if (currentStep < totalSteps) {
                goToStep(currentStep + 1);
            }
        }
    });

    // Form submit
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        
        // Final validation
        let allStepsValid = true;
        for (let s = 1; s <= totalSteps; s++) {
            if (!validateStep(s)) {
                goToStep(s);
                allStepsValid = false;
                break;
            }
        }

        if (allStepsValid) {
            submitForm();
        }
    });

    // Inputs value change listeners for autosave and instant validation reset
    form.querySelectorAll("input, textarea").forEach(input => {
        input.addEventListener("input", () => {
            saveDraft();
            clearValidationError(input);
        });
        input.addEventListener("change", () => {
            saveDraft();
            clearValidationError(input);
        });
    });

    // Clear validation error instantly when any radio button is checked
    form.querySelectorAll("input[type='radio']").forEach(radio => {
        radio.addEventListener("change", () => {
            const container = radio.closest(".segmented-control, .radio-cards");
            const parentGroup = radio.closest(".radio-card-group, .segmented-control-group");
            if (container) container.classList.remove("invalid");
            if (parentGroup) {
                const errorMsg = parentGroup.querySelector(".error-msg");
                if (errorMsg) errorMsg.style.display = "none";
            }
        });
    });

    // Click delegation for Autofill buttons (btn-autofill-unknown & btn-autofill-none)
    form.addEventListener("click", (e) => {
        const btnUnknown = e.target.closest(".btn-autofill-unknown");
        const btnNone = e.target.closest(".btn-autofill-none");
        
        if (btnUnknown || btnNone) {
            e.preventDefault();
            const btn = btnUnknown || btnNone;
            const inputGroup = btn.closest(".input-group");
            if (inputGroup) {
                const input = inputGroup.querySelector("input, textarea");
                if (input) {
                    // Get translated value based on which button was clicked
                    const fillText = btnUnknown 
                        ? ((translations[currentLang] && translations[currentLang].choice_unknown) ? translations[currentLang].choice_unknown : "Không rõ")
                        : ((translations[currentLang] && translations[currentLang].choice_none) ? translations[currentLang].choice_none : "Không");
                    input.value = fillText;
                    
                    // Trigger input and change events to save draft and clear validation error
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                    
                    // Trigger dynamic pulse effect
                    triggerAutofillEffect(input);
                }
            }
        }
    });

    // Phone Number Autocomplete from past registrations (using 'input' for instant keystroke feedback!)
    const ownerPhoneInput = document.getElementById("owner-phone");
    if (ownerPhoneInput) {
        let fetchTimeout = null;
        
        ownerPhoneInput.addEventListener("input", () => {
            const phone = ownerPhoneInput.value.trim();
            const ownerNameInput = document.getElementById("owner-name");
            const ownerAddressInput = document.getElementById("owner-address");
            
            // Instantly clear the name and address the moment they modify the phone number
            if (ownerNameInput) ownerNameInput.value = "";
            if (ownerAddressInput) ownerAddressInput.value = "";
            saveDraft();
            
            // Clear any pending database queries to debounce keystrokes
            if (fetchTimeout) clearTimeout(fetchTimeout);
            
            // If the phone number reaches a valid length (9 to 15 digits), query Supabase after a short debounce (300ms)
            if (/^[0-9\s\-\+\(\)]{9,15}$/.test(phone)) {
                fetchTimeout = setTimeout(async () => {
                    if (supabaseClient) {
                        try {
                            const { data, error } = await supabaseClient
                                .from('pet_intakes')
                                .select('owner_name, owner_address')
                                .eq('owner_phone', phone)
                                .order('created_at', { ascending: false })
                                .limit(1);
                            
                            if (error) throw error;
                            
                            // Race-condition guard: check if the phone input hasn't changed since the query started
                            if (ownerPhoneInput.value.trim() === phone && data && data.length > 0) {
                                const match = data[0];
                                if (ownerNameInput) {
                                    ownerNameInput.value = match.owner_name || "";
                                    triggerAutofillEffect(ownerNameInput);
                                }
                                if (ownerAddressInput) {
                                    ownerAddressInput.value = match.owner_address || "";
                                    triggerAutofillEffect(ownerAddressInput);
                                }
                                saveDraft();
                            }
                        } catch (err) {
                            console.error("Error auto-fetching owner data:", err);
                        }
                    }
                }, 300); // 300ms debounce to prevent spamming database on every keystroke
            }
        });
    }

    function triggerAutofillEffect(element) {
        if (element && element.tagName === "TEXTAREA" && typeof updateTextareaResize === "function") {
            updateTextareaResize(element);
        }
        // Subtle and gorgeous emerald-green pulse on autofilled fields
        element.style.transition = "none";
        element.style.boxShadow = "0 0 0 4px rgba(16, 185, 129, 0.4)";
        element.style.borderColor = "#10b981";
        element.style.backgroundColor = "rgba(16, 185, 129, 0.05)";
        
        setTimeout(() => {
            element.style.transition = "all 0.3s ease";
            element.style.boxShadow = "";
            element.style.borderColor = "";
            element.style.backgroundColor = "";
        }, 1500);
    }

    // Clear signature button
    clearSigBtn.addEventListener("click", clearSignature);

    // Modal action buttons
    modalCloseBtn.addEventListener("click", () => {
        successModal.classList.remove("show");
        resetForm();
    });

    modalDownloadBtn.addEventListener("click", () => {
        populatePrintForm();
        
        const petName = document.getElementById("pet-name").value.trim() || "Pet";
        const rawDate = document.getElementById("form-date").value || new Date().toISOString().split("T")[0];
        const dateParts = rawDate.split("-");
        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : rawDate;
        
        const originalTitle = document.title;
        document.title = `Tờ Khai Khám Bệnh - ${petName} - ${formattedDate} _ GAIA Animal Hospital Ho Chi Minh City`;
        
        window.print();
        
        // Restore title after print dialog closes
        setTimeout(() => { document.title = originalTitle; }, 1000);
    });

    window.addEventListener("beforeprint", populatePrintForm);

    function populatePrintForm() {
        updateIntakeID();
        document.getElementById("print-owner-name").textContent = document.getElementById("owner-name").value.trim() || "-";
        document.getElementById("print-owner-phone").textContent = document.getElementById("owner-phone").value.trim() || "-";
        document.getElementById("print-owner-address").textContent = document.getElementById("owner-address").value.trim() || "-";
        
        document.getElementById("print-pet-name").textContent = document.getElementById("pet-name").value.trim() || "-";
        const weightVal = document.getElementById("pet-weight").value.trim();
        document.getElementById("print-pet-weight").textContent = weightVal ? `${weightVal} kg` : "-";
        document.getElementById("print-pet-breed").textContent = document.getElementById("pet-breed").value.trim() || "-";
        document.getElementById("print-pet-color").textContent = document.getElementById("pet-color").value.trim() || "-";
        const petAgeVal = document.getElementById("pet-age")?.value.trim() || "";
        const petGenderVal = document.querySelector('input[name="petGender"]:checked')?.value || "";
        document.getElementById("print-pet-age-gender").textContent = petAgeVal && petGenderVal ? `${petAgeVal} tuổi / ${petGenderVal}` : "-";
        
        // Neutered representation
        const neuteredVal = document.querySelector('input[name="petNeutered"]:checked')?.value || 'unknown';
        document.getElementById("print-pet-neutered-yes").textContent = neuteredVal === "yes" ? "☑" : "☐";
        document.getElementById("print-pet-neutered-no").textContent = neuteredVal === "no" ? "☑" : "☐";
        
        // Vaccine Core
        const vacCoreVal = document.querySelector('input[name="vaccineCore"]:checked')?.value || 'unknown';
        document.getElementById("print-vac-core-yes").textContent = vacCoreVal === "yes" ? "☑" : "☐";
        document.getElementById("print-vac-core-no").textContent = vacCoreVal === "no" ? "☑" : "☐";
        document.getElementById("print-vac-core-unknown").textContent = vacCoreVal === "unknown" ? "☑" : "☐";
        
        // Vaccine Rabies
        const vacRabiesVal = document.querySelector('input[name="vaccineRabies"]:checked')?.value || 'unknown';
        document.getElementById("print-vac-rabies-yes").textContent = vacRabiesVal === "yes" ? "☑" : "☐";
        document.getElementById("print-vac-rabies-no").textContent = vacRabiesVal === "no" ? "☑" : "☐";
        document.getElementById("print-vac-rabies-unknown").textContent = vacRabiesVal === "unknown" ? "☑" : "☐";
        
        // Parasite
        const parasiteVal = document.querySelector('input[name="parasitePrev"]:checked')?.value || 'unknown';
        document.getElementById("print-parasite-yes").textContent = parasiteVal === "yes" ? "☑" : "☐";
        document.getElementById("print-parasite-no").textContent = parasiteVal === "no" ? "☑" : "☐";
        document.getElementById("print-parasite-unknown").textContent = parasiteVal === "unknown" ? "☑" : "☐";
        
        // Medical
        const medHistory = document.getElementById("medical-history").value.trim();
        const allergies = document.getElementById("allergies").value.trim();
        const currentMeds = document.getElementById("current-meds").value.trim();
        
        document.getElementById("print-med-history").textContent = medHistory || "Không ghi nhận";
        document.getElementById("print-allergies").textContent = allergies || "Không ghi nhận";
        document.getElementById("print-meds").textContent = currentMeds || "Không ghi nhận";
        
        // Diet
        document.getElementById("print-diet-wet").textContent = document.getElementById("diet-wet").checked ? "☑" : "☐";
        document.getElementById("print-diet-dry").textContent = document.getElementById("diet-dry").checked ? "☑" : "☐";
        document.getElementById("print-diet-homemade").textContent = document.getElementById("diet-homemade").checked ? "☑" : "☐";
        
        // Consent
        document.getElementById("print-consent-accuracy").textContent = document.getElementById("consent-accuracy").checked ? "☑" : "☐";
        document.getElementById("print-consent-storage").textContent = document.getElementById("consent-storage").checked ? "☑" : "☐";
        
        // Signature
        const printSigImg = document.getElementById("print-sig-img");
        if (printSigImg) {
            printSigImg.src = canvas.toDataURL();
        }
        
        // Date
        const printDate = document.getElementById("print-date");
        if (printDate) {
            printDate.textContent = new Date().toLocaleDateString('vi-VN', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
            });
        }
        
        // Photos
        const printPhotosSection = document.getElementById("print-photos-section");
        const printPhotosGrid = document.getElementById("print-photos-grid");
        if (printPhotosSection && printPhotosGrid) {
            if (petPhotosArray && petPhotosArray.length > 0) {
                printPhotosSection.style.display = "block";
                printPhotosGrid.innerHTML = "";
                petPhotosArray.forEach(photoSrc => {
                    const item = document.createElement("div");
                    item.className = "print-photo-item";
                    item.innerHTML = `<img src="${photoSrc}" alt="Attached Photo">`;
                    printPhotosGrid.appendChild(item);
                });
            } else {
                printPhotosSection.style.display = "none";
            }
        }
    }

    // Client-side Image Compression Helper using HTML5 Canvas
    function compressImage(base64Str, maxWidth = 900, maxHeight = 900, quality = 0.7) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Scale keeping aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to compressed JPEG format
                const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
                resolve(compressedBase64);
            };
            img.onerror = () => resolve(base64Str); // Fallback to original
        });
    }

    // Pet Photo Upload Events (Supports multiple photos up to 5)
    const photoInput = document.getElementById("pet-photo-input");
    const photoUploadBox = document.getElementById("photo-upload-box");
    const previewsGrid = document.getElementById("photo-previews-grid");

    if (photoInput && photoUploadBox && previewsGrid) {
        photoInput.addEventListener("change", async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            if (petPhotosArray.length + files.length > 5) {
                alert(currentLang === "vi" 
                    ? "Bạn chỉ có thể tải lên tối đa 5 hình ảnh!" 
                    : (currentLang === "en" ? "You can only upload up to 5 photos!" : "最大5枚の写真しかアップロードできません！")
                );
                return;
            }

            const hasNonImage = files.some(file => !file.type.startsWith("image/"));
            if (hasNonImage) {
                alert(currentLang === "vi" 
                    ? "Vui lòng chọn các tệp hình ảnh!" 
                    : (currentLang === "en" ? "Please select image files only!" : "画像ファイルのみを選択してください！")
                );
                return;
            }

            // Read all selected files in parallel as Base64 strings
            const readPromises = files.map(file => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve(event.target.result);
                    reader.readAsDataURL(file);
                });
            });

            try {
                const base64Results = await Promise.all(readPromises);
                
                // Compress each image to save bandwidth and storage, speeding up submit times 10x-50x!
                const compressPromises = base64Results.map(base64 => compressImage(base64, 900, 900, 0.7));
                const compressedResults = await Promise.all(compressPromises);
                
                petPhotosArray = petPhotosArray.concat(compressedResults);
                
                // Clear file input value to allow re-uploading the same file
                photoInput.value = "";

                renderPetPhotoPreviews();
                saveDraft();
            } catch (err) {
                console.error("Error reading and compressing uploaded photos:", err);
            }
        });
    }

    // Drawing Canvas events for both mouse and touch devices
    setupSignatureDrawing();
}

// --- Multi-step Wizard Navigation ---
function goToStep(stepNum) {
    if (stepNum < 1 || stepNum > totalSteps) return;

    // Stop any active voice recording when switching steps
    if (typeof stopAllVoiceRecording === "function" && voiceIsRecording) {
        stopAllVoiceRecording();
    }

    // Slide transition classes handled by CSS animation
    steps.forEach(step => step.classList.remove("active"));
    document.getElementById(`step-${stepNum}`).classList.add("active");

    // Update steps state tracker
    currentStep = stepNum;

    // Update steps dots
    stepDots.forEach(dot => {
        const dStep = parseInt(dot.getAttribute("data-step"));
        dot.classList.remove("active");
        if (dStep === stepNum) {
            dot.classList.add("active");
        }
        if (dStep < stepNum) {
            dot.classList.add("completed");
        } else {
            dot.classList.remove("completed");
        }
    });

    // Update progress bar
    const progressPercent = (stepNum / totalSteps) * 100;
    progressBarFill.style.width = `${progressPercent}%`;

    // Button states
    if (stepNum === 1) {
        prevBtn.style.display = "none";
        nextBtn.style.display = "flex";
        submitBtn.style.display = "none";
    } else if (stepNum === totalSteps) {
        prevBtn.style.display = "flex";
        nextBtn.style.display = "none";
        submitBtn.style.display = "flex";
    } else {
        prevBtn.style.display = "flex";
        nextBtn.style.display = "flex";
        submitBtn.style.display = "none";
    }

    // Special handling for Step 4: Signature Canvas needs to resize/initialize when it becomes display: block
    if (stepNum === 4) {
        setTimeout(() => {
            resizeCanvas();
        }, 80);
    }

    // Update auto-expanding textareas when switching steps
    setTimeout(() => {
        const currentStepEl = document.getElementById(`step-${stepNum}`);
        if (currentStepEl) {
            currentStepEl.querySelectorAll("textarea").forEach(textarea => {
                if (typeof updateTextareaResize === "function") {
                    updateTextareaResize(textarea);
                }
            });
        }
    }, 40);

    // Scroll top with smooth behavior
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Interactive Signature Drawing Pad ---
function setupSignatureDrawing() {
    // Get mouse/touch coordinate relative to canvas in CSS pixels
    function getCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDrawing(e) {
        isDrawing = true;
        hasSigned = true;
        sigErrorMsg.style.display = "none";
        document.querySelector(".signature-pad-wrap").classList.remove("invalid");
        
        const coords = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        
        // Prevent touch scroll on mobile while signing
        if (e.cancelable) e.preventDefault();
    }

    function draw(e) {
        if (!isDrawing) return;
        
        const coords = getCoordinates(e);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        
        if (e.cancelable) e.preventDefault();
    }

    function stopDrawing() {
        isDrawing = false;
        ctx.closePath();
    }

    // Desktop Mouse Events
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    window.addEventListener("mouseup", stopDrawing);

    // Mobile Touch Events
    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    window.addEventListener("touchend", stopDrawing);
}

function clearSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSigned = false;
    document.querySelector(".signature-pad-wrap").classList.remove("invalid");
    sigErrorMsg.style.display = "none";
}

function resizeCanvas() {
    // Keep canvas drawing crisp on retina and pixel-dense mobile screens
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Ignore resizing if dimensions are 0 (e.g. element is display: none)
    if (rect.width === 0 || rect.height === 0) return;
    
    const newWidth = rect.width * dpr;
    const newHeight = rect.height * dpr;
    
    // Only apply resize if dimensions actually changed (prevents clearing when re-opening Step 4)
    if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        ctx.scale(dpr, dpr);
        
        // Style line parameters
        ctx.strokeStyle = "#1b4332"; // Deep Forest Green ink
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        // Clear signed flag since canvas backing store was rebuilt
        hasSigned = false;
    }
}

// --- Validation Logic ---
function validateStep(stepNum) {
    let isValid = true;
    const stepEl = document.getElementById(`step-${stepNum}`);
    
    // 1. Validate required standard inputs (text, number, tel, textarea, checkbox)
    const standardInputs = stepEl.querySelectorAll("input[required]:not([type='radio']), textarea[required]");
    standardInputs.forEach(input => {
        if (!validateInput(input)) {
            isValid = false;
        }
    });

    // 2. Validate required radio button groups (segmented controls, radio cards)
    const radioNames = new Set();
    stepEl.querySelectorAll("input[type='radio'][required]").forEach(radio => {
        radioNames.add(radio.name);
    });

    radioNames.forEach(name => {
        const groupChecked = stepEl.querySelector(`input[name="${name}"]:checked`);
        const groupParent = stepEl.querySelector(`input[name="${name}"]`)?.closest(".radio-card-group, .segmented-control-group");
        const container = stepEl.querySelector(`input[name="${name}"]`)?.closest(".segmented-control, .radio-cards");
        const errorMsg = groupParent?.querySelector(".error-msg");
        
        if (!groupChecked) {
            isValid = false;
            if (container) {
                container.classList.add("invalid");
            }
            if (errorMsg) {
                errorMsg.style.display = "block";
            }
        } else {
            if (container) {
                container.classList.remove("invalid");
            }
            if (errorMsg) {
                errorMsg.style.display = "none";
            }
        }
    });

    // 3. Step 2 custom validation (Pet Photos - at least 1 photo required)
    if (stepNum === 2) {
        const photoGroup = document.querySelector(".input-photo-group");
        const photoError = document.getElementById("photo-error-msg");
        if (petPhotosArray.length === 0) {
            isValid = false;
            if (photoGroup) photoGroup.classList.add("invalid");
            if (photoError) {
                photoError.textContent = translations[currentLang].error_photo_required || "Vui lòng tải lên ít nhất 1 hình ảnh";
                photoError.style.display = "block";
            }
        } else {
            if (photoGroup) photoGroup.classList.remove("invalid");
            if (photoError) photoError.style.display = "none";
        }
    }

    // 4. Step 4 custom validation (Signature Canvas)
    if (stepNum === 4) {
        if (!hasSigned) {
            isValid = false;
            document.querySelector(".signature-pad-wrap").classList.add("invalid");
            sigErrorMsg.style.display = "block";
        } else {
            document.querySelector(".signature-pad-wrap").classList.remove("invalid");
            sigErrorMsg.style.display = "none";
        }
    }

    return isValid;
}

function validateInput(input) {
    const parent = input.closest(".input-group") || input.closest(".consent-checkbox-wrap");
    if (!parent) return true;

    let isInputValid = true;
    let customErrorMsg = null;

    // Checkbox consent validation
    if (input.type === "checkbox") {
        if (!input.checked) {
            isInputValid = false;
            customErrorMsg = translations[currentLang].error_consent;
        }
    }
    // Text and textarea empty check
    else if (!input.value.trim()) {
        isInputValid = false;
        customErrorMsg = translations[currentLang].error_required;
    }
    // Pattern phone validation
    else if (input.type === "tel") {
        const phonePattern = /^[0-9\s\-\+\(\)]{9,15}$/;
        if (!phonePattern.test(input.value.trim())) {
            isInputValid = false;
            customErrorMsg = translations[currentLang].error_phone;
        }
    }
    // Numeric fields check (Weight, Age)
    else if (input.id === "pet-weight" || input.id === "pet-age" || input.getAttribute("data-numeric") === "true" || input.type === "number") {
        const cleanVal = input.value.trim().replace(/,/g, ".");
        const numVal = Number(cleanVal);
        if (isNaN(numVal) || !isFinite(numVal) || numVal < 0 || !/^\d+(?:\.\d+)?$/.test(cleanVal)) {
            isInputValid = false;
            customErrorMsg = translations[currentLang].error_invalid_number || "Thông tin không hợp lệ";
        }
    }

    if (!isInputValid) {
        parent.classList.add("invalid");
        const errorEl = parent.querySelector(".error-msg");
        if (errorEl && customErrorMsg) {
            errorEl.textContent = customErrorMsg;
        }
    } else {
        parent.classList.remove("invalid");
    }

    return isInputValid;
}

function clearValidationError(input) {
    const parent = input.closest(".input-group") || input.closest(".consent-checkbox-wrap");
    if (parent) {
        parent.classList.remove("invalid");
    }
}

// --- Multilingual Switching Manager ---
function updateLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;

    const fabCurrent = document.getElementById("fab-lang-current");
    if (fabCurrent) {
        const flagSVGs = {
            vi: `<svg class="flag-icon" viewBox="0 0 24 16" width="18" height="12"><rect width="24" height="16" fill="#da251d" rx="2"/><polygon points="12,3.5 14.6,11.5 7.7,6.4 16.3,6.4 9.4,11.5" fill="#ffff00"/></svg>`,
            en: `<svg class="flag-icon" viewBox="0 0 24 16" width="18" height="12"><rect width="24" height="16" fill="#012169" rx="2"/><path d="M0,0 L24,16 M24,0 L0,16" stroke="#ffffff" stroke-width="2.6"/><path d="M0,0 L24,16 M24,0 L0,16" stroke="#C8102E" stroke-width="1.4"/><path d="M12,0 V16 M0,8 H24" stroke="#ffffff" stroke-width="4"/><path d="M12,0 V16 M0,8 H24" stroke="#C8102E" stroke-width="2.4"/></svg>`,
            ja: `<svg class="flag-icon" viewBox="0 0 24 16" width="18" height="12"><rect width="24" height="16" fill="#ffffff" stroke="#e0e0e0" stroke-width="0.8" rx="2"/><circle cx="12" cy="8" r="4.8" fill="#bc002d"/></svg>`
        };
        fabCurrent.innerHTML = `${flagSVGs[lang] || flagSVGs.vi} <span>${lang.toUpperCase()}</span>`;
    }

    // Update all components containing data-key
    const transElements = document.querySelectorAll("[data-key]");
    transElements.forEach(el => {
        const key = el.getAttribute("data-key");
        if (translations[lang] && translations[lang][key]) {
            // If the element has active elements like input or button inside, handle carefully
            if (el.tagName === "INPUT" && el.type === "button") {
                el.value = translations[lang][key];
            } else {
                // Keep inline children (like icons/SVG) if we are replacing text nodes
                const svgIcon = el.querySelector("svg");
                if (svgIcon) {
                    const iconHTML = svgIcon.outerHTML;
                    // Replace label
                    const textNode = translations[lang][key];
                    el.innerHTML = iconHTML + ` <span>${textNode}</span>`;
                } else {
                    el.textContent = translations[lang][key];
                }
            }
        }
    });

    // Update dynamic error labels for invalid inputs
    document.querySelectorAll(".input-group.invalid, .consent-checkbox-wrap.invalid").forEach(parent => {
        const input = parent.querySelector("input, textarea");
        const errorEl = parent.querySelector(".error-msg");
        if (input && errorEl) {
            if (input.type === "checkbox") {
                errorEl.textContent = translations[lang].error_consent;
            } else if (input.type === "tel") {
                errorEl.textContent = translations[lang].error_phone;
            } else {
                errorEl.textContent = translations[lang].error_required;
            }
        }
    });

    if (sigErrorMsg && !hasSigned) {
        sigErrorMsg.textContent = translations[lang].error_signature;
    }
}

// --- Autosave & Load Draft System ---
function saveDraft() {
    const formData = {};
    // Extract textual data including numbers
    form.querySelectorAll("input[type='text'], input[type='tel'], input[type='number'], input[type='date'], textarea").forEach(el => {
        formData[el.name] = el.value;
    });

    // Extract radio selections
    form.querySelectorAll("input[type='radio']:checked").forEach(el => {
        formData[el.name] = el.value;
    });

    // Extract checkboxes
    const checkboxes = {};
    form.querySelectorAll("input[type='checkbox']").forEach(el => {
        checkboxes[el.id] = el.checked;
    });
    formData["checkboxes"] = checkboxes;
    formData["petPhotoDataUrl"] = petPhotoDataUrl;

    localStorage.setItem("gaia_form_draft", JSON.stringify(formData));
}

function loadDraft() {
    const draftData = localStorage.getItem("gaia_form_draft");
    if (!draftData) return;

    try {
        const formData = JSON.parse(draftData);
        
        // Populate text fields
        for (const [name, value] of Object.entries(formData)) {
            if (name === "checkboxes") continue;

            const input = form.querySelector(`[name="${name}"]`);
            if (input) {
                if (input.type === "radio") {
                    const matchingRadio = form.querySelector(`[name="${name}"][value="${value}"]`);
                    if (matchingRadio) matchingRadio.checked = true;
                } else {
                    input.value = value;
                }
            }
        }

        // Populate checkboxes
        if (formData.checkboxes) {
            for (const [id, checked] of Object.entries(formData.checkboxes)) {
                const checkbox = document.getElementById(id);
                if (checkbox) checkbox.checked = checked;
            }
        }

        // Restore pet photos previews from draft
        if (formData.petPhotoDataUrl) {
            petPhotoDataUrl = formData.petPhotoDataUrl;
            try {
                petPhotosArray = JSON.parse(petPhotoDataUrl);
                renderPetPhotoPreviews();
            } catch (err) {
                console.error("Error parsing pet photo draft array:", err);
            }
        }

        setTimeout(() => {
            form.querySelectorAll("textarea").forEach(textarea => {
                if (typeof updateTextareaResize === "function") {
                    updateTextareaResize(textarea);
                }
            });
        }, 50);
    } catch (e) {
        console.error("Error parsing autosaved draft", e);
    }
}

// ============================================================
// ANTI-SPAM PROTECTION SYSTEM
// ============================================================

function injectSpamBlockOverlay() {
    if (document.getElementById("spam-block-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "spam-block-overlay";
    overlay.innerHTML = `
        <div class="spam-block-card">
            <div class="spam-block-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <h3 id="spam-block-title">Bảo vệ hệ thống</h3>
            <p id="spam-block-message">Vui lòng chờ một chút trước khi thử lại.</p>
            <div class="spam-countdown-wrap" id="spam-countdown-wrap" style="display:none">
                <div class="spam-countdown-bar-bg">
                    <div class="spam-countdown-bar" id="spam-countdown-bar"></div>
                </div>
                <span id="spam-countdown-text">0s</span>
            </div>
            <button class="spam-block-dismiss" id="spam-block-dismiss">Đã hiểu</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("spam-block-dismiss").addEventListener("click", () => {
        overlay.classList.remove("show");
    });
}

function showSpamBlock(titleVi, messageVi, titleEn, messageEn, cooldownMs = 0) {
    const overlay = document.getElementById("spam-block-overlay");
    if (!overlay) return;

    const title = currentLang === "en" ? titleEn : titleVi;
    const message = currentLang === "en" ? messageEn : messageVi;

    document.getElementById("spam-block-title").textContent = title;
    document.getElementById("spam-block-message").textContent = message;
    document.getElementById("spam-block-dismiss").textContent = currentLang === "en" ? "Understood" : "Đã hiểu";

    const wrapEl = document.getElementById("spam-countdown-wrap");
    const barEl = document.getElementById("spam-countdown-bar");
    const textEl = document.getElementById("spam-countdown-text");

    if (cooldownMs > 0) {
        wrapEl.style.display = "flex";
        const endTime = Date.now() + cooldownMs;
        barEl.style.width = "100%";
        barEl.style.transition = `width ${cooldownMs}ms linear`;
        setTimeout(() => { barEl.style.width = "0%"; }, 50);

        const tick = setInterval(() => {
            const remaining = Math.max(0, endTime - Date.now());
            const secs = Math.ceil(remaining / 1000);
            textEl.textContent = secs > 0 ? `${secs}s` : "";
            if (remaining <= 0) clearInterval(tick);
        }, 500);
    } else {
        wrapEl.style.display = "none";
    }

    overlay.classList.add("show");
}

function getSpamHistory() {
    try {
        return JSON.parse(localStorage.getItem("gaia_submit_history") || "[]");
    } catch { return []; }
}

function recordSpamSubmission() {
    const now = Date.now();
    const history = getSpamHistory().filter(t => now - t < SPAM_CONFIG.RATE_LIMIT_WINDOW_MS);
    history.push(now);
    localStorage.setItem("gaia_submit_history", JSON.stringify(history));
}

function checkAntiSpam() {
    const now = Date.now();

    // --- 1. HONEYPOT CHECK: bot filled invisible fields ---
    const hpWebsite = document.getElementById("hp-website");
    const hpEmail = document.getElementById("hp-email");
    if ((hpWebsite && hpWebsite.value.trim() !== "") || (hpEmail && hpEmail.value.trim() !== "")) {
        console.warn("GAIA Anti-Spam: Honeypot triggered — bot detected.");
        showSpamBlock(
            "Phát hiện hoạt động bất thường",
            "Hệ thống phát hiện hoạt động đáng ngờ. Nếu bạn là người thật, vui lòng tải lại trang và thử lại.",
            "Suspicious activity detected",
            "Unusual activity was detected. If you are a real user, please reload the page and try again."
        );
        return false;
    }

    // --- 2. MINIMUM FILL TIME CHECK: form filled too quickly ---
    if (formStartTime && (now - formStartTime) < SPAM_CONFIG.MIN_FILL_TIME_MS) {
        const remainMs = SPAM_CONFIG.MIN_FILL_TIME_MS - (now - formStartTime);
        const remainSecs = Math.ceil(remainMs / 1000);
        showSpamBlock(
            "Điền form quá nhanh",
            `Bạn đã điền form quá nhanh. Vui lòng kiểm tra lại thông tin. Thử lại sau ${remainSecs} giây.`,
            "Form filled too quickly",
            `The form was filled too fast. Please review your information and try again in ${remainSecs} seconds.`,
            remainMs
        );
        return false;
    }

    // --- 3. COOLDOWN CHECK: too soon after previous submission ---
    const history = getSpamHistory();
    if (history.length > 0) {
        const lastSubmit = history[history.length - 1];
        const timeSinceLast = now - lastSubmit;
        if (timeSinceLast < SPAM_CONFIG.COOLDOWN_BETWEEN_SUBMIT_MS) {
            const waitMs = SPAM_CONFIG.COOLDOWN_BETWEEN_SUBMIT_MS - timeSinceLast;
            const waitSecs = Math.ceil(waitMs / 1000);
            const waitMin = Math.ceil(waitSecs / 60);
            showSpamBlock(
                "Gửi quá nhanh",
                `Bạn vừa gửi form. Vui lòng chờ ${waitSecs > 60 ? waitMin + ' phút' : waitSecs + ' giây'} trước khi gửi lại.`,
                "Submitted too recently",
                `You just submitted a form. Please wait ${waitSecs > 60 ? waitMin + ' minute(s)' : waitSecs + ' second(s)'} before submitting again.`,
                waitMs
            );
            return false;
        }
    }

    // --- 4. RATE LIMIT CHECK: too many submissions this hour ---
    const recentHistory = history.filter(t => now - t < SPAM_CONFIG.RATE_LIMIT_WINDOW_MS);
    if (recentHistory.length >= SPAM_CONFIG.MAX_SUBMISSIONS_PER_HOUR) {
        const oldestInWindow = recentHistory[0];
        const resetMs = SPAM_CONFIG.RATE_LIMIT_WINDOW_MS - (now - oldestInWindow);
        const resetMin = Math.ceil(resetMs / 60000);
        showSpamBlock(
            "Đã đạt giới hạn gửi form",
            `Bạn đã gửi quá ${SPAM_CONFIG.MAX_SUBMISSIONS_PER_HOUR} lần trong 1 giờ. Vui lòng thử lại sau ${resetMin} phút. Nếu cần hỗ trợ, liên hệ trực tiếp GAIA.`,
            "Submission limit reached",
            `You have submitted more than ${SPAM_CONFIG.MAX_SUBMISSIONS_PER_HOUR} times in one hour. Please try again in ${resetMin} minutes or contact GAIA directly.`,
            resetMs
        );
        return false;
    }

    return true; // All checks passed ✓
}

// --- Form Submit and Reset ---
async function submitForm() {
    // --- Anti-Spam Gate: Run all 4 checks before allowing submission ---
    if (!checkAntiSpam()) {
        return; // Blocked by spam protection
    }

    // Show spinner loading state
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.7";
    const submitTextSpan = submitBtn.querySelector("span");
    const originalText = submitTextSpan.textContent;
    submitTextSpan.textContent = currentLang === "vi" ? "Đang gửi..." : (currentLang === "en" ? "Submitting..." : "送信中...");

    // Gather form data
    const formData = {
        intake_id: updateIntakeID(),
        owner_name: document.getElementById("owner-name").value.trim(),
        owner_phone: document.getElementById("owner-phone").value.trim(),
        owner_address: document.getElementById("owner-address").value.trim(),
        pet_name: document.getElementById("pet-name").value.trim(),
        pet_breed: document.getElementById("pet-breed").value.trim(),
        pet_weight: document.getElementById("pet-weight").value.trim(),
        pet_age_gender: `${document.getElementById("pet-age")?.value.trim() || "-"} tuổi / ${document.querySelector('input[name="petGender"]:checked')?.value || "-"}`,
        pet_neutered: document.querySelector('input[name="petNeutered"]:checked')?.value || 'no',
        pet_color: document.getElementById("pet-color").value.trim(),
        vaccine_core: document.querySelector('input[name="vaccineCore"]:checked')?.value || 'unknown',
        vaccine_rabies: document.querySelector('input[name="vaccineRabies"]:checked')?.value || 'unknown',
        parasite_prevention: document.querySelector('input[name="parasitePrev"]:checked')?.value || 'unknown',
        medical_history: document.getElementById("medical-history").value.trim(),
        allergies: document.getElementById("allergies").value.trim(),
        current_meds: document.getElementById("current-meds").value.trim(),
        diet_wet: document.getElementById("diet-wet").checked,
        diet_dry: document.getElementById("diet-dry").checked,
        diet_homemade: document.getElementById("diet-homemade").checked,
        consent_accuracy: document.getElementById("consent-accuracy").checked,
        consent_storage: document.getElementById("consent-storage").checked,
        signature_data: canvas.toDataURL(), // Base64 data URI of the customer's signature
        pet_photo: petPhotoDataUrl || "", // Base64 image data of the pet's photo
        date_signed: document.getElementById("form-date").value,
        id_local: Date.now() // Unique timestamp for background queue tracking
    };

    // 1. Instantly show success message to the client (high-fidelity UX, no waiting)
    finalizeSubmission(originalText);

    // 2. Add to localStorage backup queue to prevent any data loss
    addToPendingQueue(formData);

    // 3. Initiate silent background synchronization in parallel
    sendPendingSubmissions();
}

// --- Background Sync Queue Helpers ---

function addToPendingQueue(data) {
    try {
        const queue = JSON.parse(localStorage.getItem("gaia_pending_queue") || "[]");
        queue.push(data);
        localStorage.setItem("gaia_pending_queue", JSON.stringify(queue));
        console.log("GAIA Queue: Form added locally to pending sync queue.");
    } catch (e) {
        console.error("GAIA Queue: Error saving pending form data to localStorage:", e);
    }
}

let isSendingQueue = false;
async function sendPendingSubmissions() {
    if (isSendingQueue) return;
    
    try {
        const queue = JSON.parse(localStorage.getItem("gaia_pending_queue") || "[]");
        if (queue.length === 0) return;

        isSendingQueue = true;
        console.log(`GAIA Queue: Background synch active. Syncing ${queue.length} forms...`);

        const remainingQueue = [...queue];

        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];
            
            // Clean local metadata before sending to Supabase
            const dataToInsert = { ...item };
            delete dataToInsert.id_local;
            delete dataToInsert.intake_id;

            if (supabaseClient) {
                try {
                    const { error } = await supabaseClient
                        .from('pet_intakes')
                        .insert([dataToInsert]);

                    if (error) throw error;

                    console.log(`GAIA Queue: Silent sync successful for pet: ${item.pet_name}`);
                    
                    // Remove from local tracking queue after successful database insert
                    const idx = remainingQueue.findIndex(r => r.id_local === item.id_local);
                    if (idx !== -1) {
                        remainingQueue.splice(idx, 1);
                    }
                    localStorage.setItem("gaia_pending_queue", JSON.stringify(remainingQueue));
                    
                    // Mark rate limiting
                    recordSpamSubmission();
                } catch (err) {
                    console.error(`GAIA Queue: Failed to sync pet ${item.pet_name}:`, err);
                    // Network down or write failure, halt synchronization pipeline to try later
                    break;
                }
            } else {
                // Mock Mode fallback: instantly resolve the queue
                console.warn("GAIA Queue: Operating in Mock Mode. Resolving submission instantly.", item);
                const idx = remainingQueue.findIndex(r => r.id_local === item.id_local);
                if (idx !== -1) {
                    remainingQueue.splice(idx, 1);
                }
                localStorage.setItem("gaia_pending_queue", JSON.stringify(remainingQueue));
                recordSpamSubmission();
            }
        }
    } catch (e) {
        console.error("GAIA Queue: Sync pipeline error:", e);
    } finally {
        isSendingQueue = false;
    }
}

// Helper to finish form state changes and trigger success modal
function finalizeSubmission(originalBtnText) {
    submitBtn.disabled = false;
    submitBtn.style.opacity = "1";
    const submitTextSpan = submitBtn.querySelector("span");
    if (submitTextSpan) submitTextSpan.textContent = originalBtnText;

    // Clear local storage draft
    localStorage.removeItem("gaia_form_draft");

    // Increment daily sequence number for the next customer
    incrementDailySeqNumber();
    updateIntakeID();

    // Trigger Success Modal
    successModal.classList.add("show");
}

function resetForm() {
    form.reset();
    clearSignature();
    
    // Reset pet photo upload elements
    petPhotosArray = [];
    renderPetPhotoPreviews();
    const photoInput = document.getElementById("pet-photo-input");
    if (photoInput) photoInput.value = "";

    // Autofill date again
    const today = new Date().toISOString().split('T')[0];
    formDateInput.value = today;

    // Refresh Intake ID for new form
    updateIntakeID();

    // Reset form start time so next fill is fresh
    formStartTime = null;

    // Clear honeypot fields
    const hpWebsite = document.getElementById("hp-website");
    const hpEmail = document.getElementById("hp-email");
    if (hpWebsite) hpWebsite.value = "";
    if (hpEmail) hpEmail.value = "";

    // Scroll to step 1
    goToStep(1);
}

// Render multiple photo previews grid in Step 2 of the form
function renderPetPhotoPreviews() {
    const previewsGrid = document.getElementById("photo-previews-grid");
    const uploadBox = document.getElementById("photo-upload-box");
    if (!previewsGrid || !uploadBox) return;

    previewsGrid.innerHTML = "";

    // Clear validation error instantly if photos exist
    const photoGroup = document.querySelector(".input-photo-group");
    const photoError = document.getElementById("photo-error-msg");
    if (petPhotosArray.length > 0) {
        if (photoGroup) photoGroup.classList.remove("invalid");
        if (photoError) photoError.style.display = "none";
    }

    if (petPhotosArray.length === 0) {
        previewsGrid.style.display = "none";
        uploadBox.style.display = "flex";
        petPhotoDataUrl = "";
        return;
    }

    previewsGrid.style.display = "grid";
    
    // Limit to max 5 photos
    if (petPhotosArray.length >= 5) {
        uploadBox.style.display = "none";
    } else {
        uploadBox.style.display = "flex";
    }

    // Set serialized JSON string to send to database
    petPhotoDataUrl = JSON.stringify(petPhotosArray);

    petPhotosArray.forEach((photoSrc, index) => {
        const item = document.createElement("div");
        item.className = "photo-preview-item";
        item.innerHTML = `
            <img src="${photoSrc}" alt="Preview">
            <button type="button" class="btn-delete-photo-item" title="Xoá ảnh">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>
            </button>
        `;
        
        item.querySelector(".btn-delete-photo-item").addEventListener("click", () => {
            petPhotosArray.splice(index, 1);
            renderPetPhotoPreviews();
            saveDraft();
        });

        previewsGrid.appendChild(item);
    });
}
