/* ==========================================================================
   GAIA Animal Hospital - Multi-Functional Parent App Logic (menu.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initThemeManager();
    initNavigationManager();
    initGlobalEscHandler();
});

/* --- 1. Theme Manager (Dark / Light Mode) --- */
function initThemeManager() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    const themeLabel = document.getElementById('theme-toggle-label');
    
    // Read saved preference or default to 'dark'
    const savedTheme = localStorage.getItem('gaia_theme') || 'dark';
    applyTheme(savedTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('gaia_theme', newTheme);
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        if (themeLabel) {
            themeLabel.textContent = theme === 'dark' ? 'Chế độ Tối' : 'Chế độ Sáng';
        }
    }
}

/* --- 2. Navigation Manager (Sidebar Tabs & Hash Routing) --- */
function initNavigationManager() {
    const navItems = document.querySelectorAll('.sidebar-nav-item, .sidebar-sub-item');
    const viewPanels = document.querySelectorAll('.view-panel, .app-view');

    // Handle hash change from URL
    window.addEventListener('hashchange', handleRoute);

    // Initial route load
    handleRoute();

    // Add click listeners to nav items
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetView = item.getAttribute('data-view');
            if (targetView) {
                e.preventDefault();
                window.location.hash = targetView;
            }
        });
    });

    function handleRoute() {
        // Default view is 'lich-kham'
        let currentHash = window.location.hash.replace('#', '');

        // Allowed views
        const validViews = ['tong-quan', 'lich-kham', 'vat-tu', 'nhan-su', 'nhap-xuat', 'the-kho', 'kiem-kho', 'can-bang-kho'];
        if (!validViews.includes(currentHash)) {
            currentHash = 'lich-kham'; // Default to Lịch Khám (Quản lý ca)
        }

        // Update active class on nav items
        navItems.forEach(item => {
            const viewAttr = item.getAttribute('data-view');
            if (viewAttr === currentHash) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update active class on view panels
        viewPanels.forEach(panel => {
            if (panel.id === `view-${currentHash}`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });

        if (currentHash === 'tong-quan' && typeof window.initTongQuanDashboard === 'function') {
            window.initTongQuanDashboard();
        }

        if (currentHash === 'nhap-xuat' && typeof window.fetchNhapXuatData === 'function') {
            window.fetchNhapXuatData();
        }

        if (currentHash === 'the-kho' && typeof window.fetchTheKhoData === 'function') {
            window.fetchTheKhoData();
        }

        if (currentHash === 'kiem-kho' && typeof window.initKiemKhoView === 'function') {
            window.initKiemKhoView();
        }

        if (currentHash === 'can-bang-kho' && typeof window.initCanBangKhoView === 'function') {
            window.initCanBangKhoView();
        }

        // Scroll to top of main content on view switch
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/* --- 3. Global Escape Key Handler (Close All Modals, Overlays, Dropdowns) --- */
function initGlobalEscHandler() {
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        // 1. Close Global Search Dropdown if open
        const gsDd = document.getElementById('gs-inline-dropdown');
        const gsInp = document.getElementById('gs-header-input');
        if (gsDd && gsDd.classList.contains('gs-dd-open')) {
            gsDd.classList.remove('gs-dd-open');
            if (gsInp) gsInp.blur();
            return;
        }

        // 2. Close User Profile Dropdown if open
        const userDd = document.getElementById('user-profile-dropdown');
        if (userDd && userDd.classList.contains('show')) {
            userDd.classList.remove('show');
            return;
        }

        // 3. Close Column Filter Dropdowns if open
        const openFilterDd = document.querySelector('.column-filter-dropdown.show, .th-filter-dropdown.show');
        if (openFilterDd) {
            openFilterDd.classList.remove('show');
            return;
        }

        // 4. Close Image Lightbox / Fullscreen preview
        const lightbox = document.getElementById('image-lightbox-overlay') || document.querySelector('.image-lightbox-overlay');
        if (lightbox && window.getComputedStyle(lightbox).display !== 'none') {
            lightbox.style.display = 'none';
            return;
        }

        // 5. Close visible Modals / Overlays
        const modalSelectors = [
            '.modal-overlay',
            '.custom-modal-overlay',
            '.confirm-modal-overlay',
            '.dialog-overlay',
            '.modal',
            '[id$="-modal"]',
            '[id$="-modal-overlay"]'
        ];

        const allModals = Array.from(document.querySelectorAll(modalSelectors.join(',')))
            .filter(el => {
                if (!el || el.id === 'login-screen' || el.classList.contains('login-screen-overlay')) return false;
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            });

        if (allModals.length > 0) {
            // Pick the topmost modal in DOM order
            const topModal = allModals[allModals.length - 1];

            // A. Try clicking close / cancel button inside the modal
            const closeBtn = topModal.querySelector(
                '.modal-close-btn, .btn-close-modal, .btn-close, .btn-cancel, [data-dismiss="modal"], .btn-secondary, button[onclick*="close"], button[onclick*="Close"], button[onclick*="Hide"], button[onclick*="Cancel"]'
            );

            if (closeBtn) {
                closeBtn.click();
                return;
            }

            // B. Specific modal close function mappings
            const mid = topModal.id || '';
            if (mid === 'vattu-modal' && typeof window.closeVatTuModal === 'function') window.closeVatTuModal();
            else if (mid === 'vattu-delete-modal' && typeof window.closeDeleteVatTuModal === 'function') window.closeDeleteVatTuModal();
            else if (mid === 'vattu-excel-export-modal' && typeof window.closeVatTuExcelExportModal === 'function') window.closeVatTuExcelExportModal();
            else if (mid === 'vattu-notice-modal' && typeof window.closeVatTuNoticeModal === 'function') window.closeVatTuNoticeModal();
            else if (mid === 'vattu-column-config-modal' && typeof window.closeColumnConfigModal === 'function') window.closeColumnConfigModal();
            else if (mid === 'vattu-qr-print-modal' && typeof window.closeVatTuQrPrintModal === 'function') window.closeVatTuQrPrintModal();
            else if (mid === 'thekho-column-config-modal' && typeof window.closeTheKhoColumnConfigModal === 'function') window.closeTheKhoColumnConfigModal();
            else if (mid === 'thekho-excel-export-modal' && typeof window.closeTheKhoExcelExportModal === 'function') window.closeTheKhoExcelExportModal();
            else if (mid === 'staff-modal' && typeof window.closeStaffModal === 'function') window.closeStaffModal();
            else if (mid === 'staff-delete-modal' && typeof window.closeDeleteStaffModal === 'function') window.closeDeleteStaffModal();
            else if (mid === 'profile-edit-modal' && typeof window.closeProfileEditModal === 'function') window.closeProfileEditModal();
            else if (mid === 'details-modal' && typeof window.closeDetailsModal === 'function') window.closeDetailsModal();
            else if (mid === 'qr-modal' && typeof window.closeQrModal === 'function') window.closeQrModal();
            else if (mid === 'kiemkho-item-logs-modal' && typeof window.closeKiemKhoItemLogsModal === 'function') window.closeKiemKhoItemLogsModal();
            else if (mid === 'nx-history-log-modal' && typeof window.closeNxHistoryLogModal === 'function') window.closeNxHistoryLogModal();
            else if (mid === 'generic-confirm-modal' && typeof window.closeGenericConfirmModal === 'function') window.closeGenericConfirmModal();
            else {
                topModal.style.display = 'none';
                topModal.classList.remove('active', 'show', 'open');
            }
        }
    });
}
