/* ==========================================================================
   GAIA Animal Hospital - Multi-Functional Parent App Logic (menu.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initThemeManager();
    initNavigationManager();
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
            if (targetView === 'tong-quan') {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.showToast === 'function') {
                    window.showToast('error', 'Chưa Hoàn Thiện', '⚠️ View Tổng quan hiện tại đang trong quá trình xây dựng!');
                } else if (typeof showKiemKhoToast === 'function') {
                    showKiemKhoToast('error', 'Chưa Hoàn Thiện', '⚠️ View Tổng quan hiện tại đang trong quá trình xây dựng!');
                } else {
                    alert('⚠️ View Tổng quan hiện tại đang trong quá trình xây dựng!');
                }
                return;
            }
            if (targetView) {
                e.preventDefault();
                window.location.hash = targetView;
            }
        });
    });

    function handleRoute() {
        // Default view is 'lich-kham'
        let currentHash = window.location.hash.replace('#', '');
        
        if (currentHash === 'tong-quan') {
            currentHash = 'lich-kham';
            window.location.hash = 'lich-kham';
            if (typeof window.showToast === 'function') {
                window.showToast('error', 'Chưa Hoàn Thiện', '⚠️ View Tổng quan hiện tại đang trong quá trình xây dựng!');
            }
        }

        // Allowed views
        const validViews = ['lich-kham', 'vat-tu', 'nhan-su', 'nhap-xuat', 'the-kho', 'kiem-kho'];
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

        if (currentHash === 'nhap-xuat' && typeof window.fetchNhapXuatData === 'function') {
            window.fetchNhapXuatData();
        }

        if (currentHash === 'the-kho' && typeof window.fetchTheKhoData === 'function') {
            window.fetchTheKhoData();
        }

        if (currentHash === 'kiem-kho' && typeof window.initKiemKhoView === 'function') {
            window.initKiemKhoView();
        }

        // Scroll to top of main content on view switch
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
