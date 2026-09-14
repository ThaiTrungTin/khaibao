document.addEventListener('DOMContentLoaded', () => {
    initThemeManager();
    initNavigationManager();
    initGlobalEscHandler();
});

function initThemeManager() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    const themeLabel = document.getElementById('theme-toggle-label');

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

function initNavigationManager() {
    const navItems = document.querySelectorAll('.sidebar-nav-item, .sidebar-sub-item');
    const viewPanels = document.querySelectorAll('.view-panel, .app-view');

    window.addEventListener('hashchange', handleRoute);

    handleRoute();

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

        let currentHash = window.location.hash.replace('#', '');

        // Map nhan-su and thong-tin to cai-dat view container
        let routeView = currentHash;
        if (currentHash === 'nhan-su' || currentHash === 'thong-tin') {
            routeView = 'cai-dat';
        }

        const validViews = ['tong-quan', 'lich-kham', 'vat-tu', 'nhan-su', 'thong-tin', 'cai-dat', 'nhap-xuat', 'the-kho', 'kiem-kho', 'can-bang-kho'];
        if (!validViews.includes(currentHash)) {
            currentHash = 'lich-kham'; 
            routeView = 'lich-kham';
        }

        // If directly navigating to cai-dat, default sub-view to nhan-su
        let activeSubView = currentHash;
        if (currentHash === 'cai-dat') {
            activeSubView = 'nhan-su';
        }

        navItems.forEach(item => {
            const viewAttr = item.getAttribute('data-view');
            const isCaiDatGroup = (currentHash === 'nhan-su' || currentHash === 'thong-tin' || currentHash === 'cai-dat');
            const isVatTuGroup = (currentHash === 'nhap-xuat' || currentHash === 'the-kho' || currentHash === 'kiem-kho' || currentHash === 'can-bang-kho' || currentHash === 'vat-tu');

            if (viewAttr === currentHash || 
                (viewAttr === 'cai-dat' && isCaiDatGroup) || 
                (viewAttr === 'vat-tu' && isVatTuGroup) ||
                (viewAttr === activeSubView && isCaiDatGroup)) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        viewPanels.forEach(panel => {
            if (panel.id === `view-${routeView}`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });

        if (currentHash === 'nhan-su' && typeof window.switchCaiDatTab === 'function') {
            window.switchCaiDatTab('nhan-su');
        } else if (currentHash === 'thong-tin' && typeof window.switchCaiDatTab === 'function') {
            window.switchCaiDatTab('thong-tin');
        } else if (currentHash === 'cai-dat') {
            if (typeof window.switchCaiDatTab === 'function') {
                window.switchCaiDatTab('nhan-su');
            }
            if (typeof window.fetchAllCaiDatSettings === 'function') {
                window.fetchAllCaiDatSettings();
            }
        }

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

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function initGlobalEscHandler() {
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        const gsDd = document.getElementById('gs-inline-dropdown');
        const gsInp = document.getElementById('gs-header-input');
        if (gsDd && gsDd.classList.contains('gs-dd-open')) {
            gsDd.classList.remove('gs-dd-open');
            if (gsInp) gsInp.blur();
            return;
        }

        const userDd = document.getElementById('user-profile-dropdown');
        if (userDd && userDd.classList.contains('show')) {
            userDd.classList.remove('show');
            return;
        }

        const openFilterDd = document.querySelector('.column-filter-dropdown.show, .th-filter-dropdown.show');
        if (openFilterDd) {
            openFilterDd.classList.remove('show');
            return;
        }

        const lightbox = document.getElementById('image-lightbox-overlay') || document.querySelector('.image-lightbox-overlay');
        if (lightbox && window.getComputedStyle(lightbox).display !== 'none') {
            lightbox.style.display = 'none';
            return;
        }

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

            const topModal = allModals[allModals.length - 1];

            const closeBtn = topModal.querySelector(
                '.modal-close-btn, .btn-close-modal, .btn-close, .btn-cancel, [data-dismiss="modal"], .btn-secondary, button[onclick*="close"], button[onclick*="Close"], button[onclick*="Hide"], button[onclick*="Cancel"]'
            );

            if (closeBtn) {
                closeBtn.click();
                return;
            }

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
