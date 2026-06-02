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
        error_signature: "Vui lòng ký tên của bạn"
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
        error_signature: "Your signature is required"
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
        error_signature: "署名を入力してください"
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
    } catch (e) {
        console.error("GAIA: Error initializing Supabase client:", e);
    }
} else {
    console.warn("GAIA: Supabase credentials are not configured in env.js. Operating in local Mock Mode.");
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
});

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Language buttons
    langButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            langButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentLang = btn.getAttribute("data-lang");
            updateLanguage(currentLang);
        });
    });

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
        window.print();
    });

    function populatePrintForm() {
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
                petPhotosArray = petPhotosArray.concat(base64Results);
                
                // Clear file input value to allow re-uploading the same file
                photoInput.value = "";

                renderPetPhotoPreviews();
                saveDraft();
            } catch (err) {
                console.error("Error reading uploaded photos:", err);
            }
        });
    }

    // Drawing Canvas events for both mouse and touch devices
    setupSignatureDrawing();
}

// --- Multi-step Wizard Navigation ---
function goToStep(stepNum) {
    if (stepNum < 1 || stepNum > totalSteps) return;

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

    // 3. Step 4 custom validation (Signature Canvas)
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

    // Checkbox consent validation
    if (input.type === "checkbox") {
        if (!input.checked) {
            isInputValid = false;
        }
    }
    // Text and textarea empty check
    else if (!input.value.trim()) {
        isInputValid = false;
    }
    // Pattern phone validation
    else if (input.type === "tel") {
        const phonePattern = /^[0-9\s\-\+\(\)]{9,15}$/;
        if (!phonePattern.test(input.value.trim())) {
            isInputValid = false;
            // Show custom error msg for phone if defined
            const errorEl = parent.querySelector(".error-msg");
            if (errorEl) {
                errorEl.textContent = translations[currentLang].error_phone;
            }
        }
    }

    if (!isInputValid) {
        parent.classList.add("invalid");
        const errorEl = parent.querySelector(".error-msg");
        if (errorEl) {
            // Pick correct translation for validation error
            if (input.type === "checkbox") {
                errorEl.textContent = translations[currentLang].error_consent;
            } else if (input.type !== "tel") {
                errorEl.textContent = translations[currentLang].error_required;
            }
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
        date_signed: document.getElementById("form-date").value
    };

    if (supabaseClient) {
        try {
            // Send the insert query to Supabase pet_intakes table
            const { data, error } = await supabaseClient
                .from('pet_intakes')
                .insert([formData]);

            if (error) throw error;

            console.log("GAIA: Dữ liệu đã được lưu thành công vào Supabase!", data);
            
            // Record this submission for rate limiting
            recordSpamSubmission();

            // Clean up and show success modal
            finalizeSubmission(originalText);
        } catch (e) {
            console.error("GAIA: Lỗi lưu dữ liệu vào Supabase:", e);
            alert(currentLang === "vi" 
                ? `Có lỗi xảy ra khi lưu dữ liệu lên hệ thống: ${e.message || e}`
                : (currentLang === "en" 
                    ? `An error occurred while saving data to the server: ${e.message || e}`
                    : `データの保存中にエラーが発生しました: ${e.message || e}`)
            );
            
            // Restore submit button state
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";
            submitTextSpan.textContent = originalText;
        }
    } else {
        // Fallback mock mode if Supabase is not configured
        console.warn("GAIA: Chạy chế độ giả lập (Mock Mode) vì chưa có Supabase. Dữ liệu giả lập:", formData);
        setTimeout(() => {
            recordSpamSubmission(); // Also record in mock mode
            finalizeSubmission(originalText);
        }, 1500);
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
