/* ==========================================================================
   GAIA Animal Hospital - Global Search Module (global_search.js)
   Ctrl+K spotlight-style search across all data sources in the app.
   ========================================================================== */

(function () {
    'use strict';

    let gsIsOpen = false;
    let gsDebounceTimer = null;
    let gsActiveIndex = -1;
    let gsCurrentResults = [];

    // ── Init ──────────────────────────────────────────────────────────────────
    function initGlobalSearch() {
        renderGlobalSearchModal();
        bindGlobalSearchEvents();
    }

    // ── Render Modal HTML ──────────────────────────────────────────────────────
    function renderGlobalSearchModal() {
        if (document.getElementById('gs-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'gs-modal';
        modal.className = 'gs-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Tim kiem toan cuc');
        modal.innerHTML = `
            <div class="gs-backdrop" id="gs-backdrop"></div>
            <div class="gs-panel" id="gs-panel">
                <div class="gs-input-wrap">
                    <svg class="gs-icon-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                        type="text"
                        id="gs-input"
                        class="gs-input"
                        placeholder="Tim kiem vat tu, don kho, ca kham, nhan su..."
                        autocomplete="off"
                        spellcheck="false"
                    >
                    <kbd class="gs-kbd-hint">ESC</kbd>
                    <button type="button" class="gs-close-btn" id="gs-close-btn" title="Dong">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="gs-results" id="gs-results">
                    <div class="gs-hint-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <span>Go de tim vat tu, don nhap xuat, ca kham, nhan su...</span>
                    </div>
                </div>
                <div class="gs-footer">
                    <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> Di chuyen</span>
                    <span><kbd>Enter</kbd> Chon</span>
                    <span><kbd>Esc</kbd> Dong</span>
                    <span class="gs-footer-sep"></span>
                    <span><kbd>Ctrl</kbd><kbd>K</kbd> Mo tim kiem</span>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // ── Event Bindings ─────────────────────────────────────────────────────────
    function bindGlobalSearchEvents() {
        // Ctrl+K shortcut
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                toggleGlobalSearch();
            }
            if (e.key === 'Escape' && gsIsOpen) {
                closeGlobalSearch();
            }
        });

        // Input typing
        document.addEventListener('input', function (e) {
            if (e.target && e.target.id === 'gs-input') {
                onGsInput(e.target.value);
            }
        });

        // Keyboard navigation within results
        document.addEventListener('keydown', function (e) {
            if (!gsIsOpen) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); moveGsSelection(1); }
            if (e.key === 'ArrowUp') { e.preventDefault(); moveGsSelection(-1); }
            if (e.key === 'Enter') { e.preventDefault(); selectActiveResult(); }
        });

        // Close on backdrop click
        document.addEventListener('click', function (e) {
            if (e.target && e.target.id === 'gs-backdrop') closeGlobalSearch();
            if (e.target && e.target.id === 'gs-close-btn') closeGlobalSearch();
            if (e.target && e.target.closest && e.target.closest('#gs-close-btn')) closeGlobalSearch();
        });
    }

    // ── Open / Close ───────────────────────────────────────────────────────────
    window.openGlobalSearch = function () {
        const modal = document.getElementById('gs-modal');
        if (!modal) return;
        gsIsOpen = true;
        gsActiveIndex = -1;
        modal.classList.add('gs-open');
        setTimeout(() => {
            const inp = document.getElementById('gs-input');
            if (inp) { inp.focus(); inp.value = ''; }
            resetGsResults();
        }, 50);
    };

    function closeGlobalSearch() {
        const modal = document.getElementById('gs-modal');
        if (!modal) return;
        gsIsOpen = false;
        modal.classList.remove('gs-open');
        gsActiveIndex = -1;
        gsCurrentResults = [];
    }

    function toggleGlobalSearch() {
        if (gsIsOpen) closeGlobalSearch();
        else window.openGlobalSearch();
    }

    // ── Search Logic ───────────────────────────────────────────────────────────
    function onGsInput(query) {
        clearTimeout(gsDebounceTimer);
        gsDebounceTimer = setTimeout(() => performSearch(query.trim()), 150);
    }

    function performSearch(query) {
        const container = document.getElementById('gs-results');
        if (!container) return;

        if (!query || query.length < 1) {
            resetGsResults();
            return;
        }

        const q = query.toLowerCase();
        const results = [];

        // --- 1. Vat Tu / Thuoc ---
        const rawVatTu = getDataSafe('vatTuData');
        const vatTuHits = rawVatTu.filter(item =>
            strMatch(item.ten_mat_hang, q) ||
            strMatch(item.ma_vach, q) ||
            strMatch(item.danh_muc, q) ||
            strMatch(item.nhom_hang, q)
        ).slice(0, 5);

        if (vatTuHits.length > 0) {
            results.push({ type: 'group', label: '&#x1F9EA; V&#7853;t T&#432; / Thu&#7889;c' });
            vatTuHits.forEach(item => results.push({
                type: 'vattu',
                title: item.ten_mat_hang || item.ma_vach || '-',
                sub: 'Ma: ' + (item.ma_vach || '-') + ' \u2022 ' + (item.danh_muc || item.nhom_hang || 'Chung'),
                tag: '\u2192 V&#7853;t T&#432;',
                tagColor: '#10b981',
                action: () => {
                    closeGlobalSearch();
                    if (typeof window.jumpToVatTuItem === 'function') window.jumpToVatTuItem(item.ma_vach || '');
                    else { window.location.hash = 'vat-tu'; }
                }
            }));
        }

        // --- 2. Don Nhap / Xuat ---
        const rawNx = getDataSafe('nhapXuatData');
        const nxHits = rawNx.filter(ord =>
            strMatch(ord.ma_don, q) ||
            strMatch(ord.muc_dich, q) ||
            strMatch(ord.user_name, q) ||
            strMatch(ord.loai_don, q)
        ).slice(0, 5);

        if (nxHits.length > 0) {
            results.push({ type: 'group', label: '&#x1F4E6; &#272;&#417;n Nh&#7853;p / Xu&#7845;t Kho' });
            nxHits.forEach(ord => {
                const isNhap = (ord.loai_don || '').includes('Nh');
                results.push({
                    type: 'nhapxuat',
                    title: ord.ma_don || 'DON-KHO',
                    sub: (isNhap ? '[Nhap]' : '[Xuat]') + ' \u2022 ' + (ord.user_name || '-') + ' \u2022 ' + formatGsDate(ord.created_at),
                    tag: '\u2192 Nh&#7853;p Xu&#7845;t',
                    tagColor: isNhap ? '#10b981' : '#f59e0b',
                    action: () => {
                        closeGlobalSearch();
                        if (typeof window.jumpToNxOrder === 'function') window.jumpToNxOrder(ord.id || ord.ma_don);
                        else { window.location.hash = 'nhap-xuat'; }
                    }
                });
            });
        }

        // --- 3. The Kho ---
        const rawTK = getDataSafe('theKhoData');
        const tkHits = rawTK.filter(tk =>
            strMatch(tk.ten_hang_hoa, q) ||
            strMatch(tk.ma_vach, q) ||
            strMatch(tk.ma_qr, q) ||
            strMatch(tk.lot, q) ||
            strMatch(tk.user_name, q)
        ).slice(0, 5);

        if (tkHits.length > 0) {
            results.push({ type: 'group', label: '&#x1F4CB; Th&#7867; Kho' });
            tkHits.forEach(tk => results.push({
                type: 'thekho',
                title: tk.ten_hang_hoa || tk.ma_vach || '-',
                sub: (tk.loai || '-') + ' \u2022 MV: ' + (tk.ma_vach || '-') + ' \u2022 ' + (tk.user_name || '-'),
                tag: '\u2192 Th&#7867; Kho',
                tagColor: '#38bdf8',
                action: () => {
                    closeGlobalSearch();
                    if (typeof window.navigateToTheKhoFilter === 'function')
                        window.navigateToTheKhoFilter(tk.ma_vach || '', tk.lot || '', '');
                    else { window.location.hash = 'the-kho'; }
                }
            }));
        }

        // --- 4. Ca Kham ---
        const rawIntakes = getDataSafe('intakesData');
        const intakeHits = rawIntakes.filter(r =>
            strMatch(r.pet_name, q) ||
            strMatch(r.owner_name, q) ||
            strMatch(r.owner_phone, q) ||
            strMatch(r.bac_si_kham, q) ||
            strMatch(r.pet_breed, q)
        ).slice(0, 5);

        if (intakeHits.length > 0) {
            results.push({ type: 'group', label: '&#x1F43E; Ca Kh&#225;m' });
            intakeHits.forEach(r => results.push({
                type: 'intake',
                title: (r.pet_name || 'Thu cung') + ' \u2014 ' + (r.owner_name || 'Chu khong ro'),
                sub: (r.pet_breed || '-') + ' \u2022 BS: ' + (r.bac_si_kham || '-') + ' \u2022 ' + formatGsDate(r.created_at || r.date_signed),
                tag: '\u2192 L&#7883;ch Kh&#225;m',
                tagColor: '#a78bfa',
                action: () => {
                    closeGlobalSearch();
                    if (typeof window.jumpToIntakeRecord === 'function') window.jumpToIntakeRecord(r.id);
                    else { window.location.hash = 'lich-kham'; }
                }
            }));
        }

        // --- 5. Nhan Su ---
        const rawStaff = getDataSafe('staffData');
        const staffHits = rawStaff.filter(s =>
            strMatch(s.full_name, q) ||
            strMatch(s.role, q) ||
            strMatch(s.branch, q) ||
            strMatch(s.email, q) ||
            strMatch(s.phone, q)
        ).slice(0, 5);

        if (staffHits.length > 0) {
            results.push({ type: 'group', label: '&#x1F464; Nh&#226;n S&#7921;' });
            staffHits.forEach(s => results.push({
                type: 'staff',
                title: s.full_name || 'Nhan vien',
                sub: (s.role || '-') + ' \u2022 ' + (s.branch || '-') + ' \u2022 ' + (s.phone || s.email || '-'),
                tag: '\u2192 Nh&#226;n S&#7921;',
                tagColor: '#f97316',
                action: () => {
                    closeGlobalSearch();
                    window.location.hash = 'nhan-su';
                    const navEl = document.querySelector('[data-view="nhan-su"], [href="#nhan-su"]');
                    if (navEl) navEl.click();
                }
            }));
        }

        gsCurrentResults = results.filter(r => r.type !== 'group');
        gsActiveIndex = -1;
        renderGsResults(results, query);
    }

    // ── Render Results ─────────────────────────────────────────────────────────
    function renderGsResults(results, query) {
        const container = document.getElementById('gs-results');
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = '<div class="gs-empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><span>Khong tim thay ket qua cho "<strong>' + escapeGsHtml(query) + '</strong>"</span></div>';
            return;
        }

        let html = '';
        let resultIndex = 0;
        results.forEach(item => {
            if (item.type === 'group') {
                html += '<div class="gs-group-label">' + item.label + '</div>';
            } else {
                const idx = resultIndex++;
                html += '<div class="gs-result-item" data-idx="' + idx + '" onclick="gsSelectItem(' + idx + ')">' +
                    '<div class="gs-result-main">' +
                    '<div class="gs-result-title">' + highlightGsMatch(escapeGsHtml(item.title), query) + '</div>' +
                    '<div class="gs-result-sub">' + escapeGsHtml(item.sub) + '</div>' +
                    '</div>' +
                    '<span class="gs-result-tag" style="border-color:' + item.tagColor + '20; color:' + item.tagColor + '; background:' + item.tagColor + '15;">' + item.tag + '</span>' +
                    '</div>';
            }
        });

        container.innerHTML = html;
    }

    function resetGsResults() {
        gsCurrentResults = [];
        gsActiveIndex = -1;
        const container = document.getElementById('gs-results');
        if (container) container.innerHTML = '<div class="gs-hint-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><span>Go de tim vat tu, don nhap xuat, ca kham, nhan su...</span></div>';
    }

    // ── Keyboard Navigation ────────────────────────────────────────────────────
    function moveGsSelection(dir) {
        const items = document.querySelectorAll('.gs-result-item');
        if (!items.length) return;
        if (gsActiveIndex >= 0 && items[gsActiveIndex]) items[gsActiveIndex].classList.remove('gs-active');
        gsActiveIndex = Math.max(0, Math.min(items.length - 1, gsActiveIndex + dir));
        const el = items[gsActiveIndex];
        if (el) { el.classList.add('gs-active'); el.scrollIntoView({ block: 'nearest' }); }
    }

    function selectActiveResult() {
        if (gsActiveIndex >= 0 && gsCurrentResults[gsActiveIndex]) {
            gsCurrentResults[gsActiveIndex].action();
        }
    }

    window.gsSelectItem = function (idx) {
        if (gsCurrentResults[idx]) gsCurrentResults[idx].action();
    };

    // ── Helpers ────────────────────────────────────────────────────────────────
    function getDataSafe(key) {
        try { const v = window[key]; return Array.isArray(v) ? v : []; } catch { return []; }
    }

    function strMatch(val, q) {
        if (!val) return false;
        return String(val).toLowerCase().includes(q);
    }

    function escapeGsHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function highlightGsMatch(escaped, query) {
        if (!query) return escaped;
        const q = escapeGsHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return escaped.replace(new RegExp('(' + q + ')', 'gi'), '<mark class="gs-highlight">$1</mark>');
    }

    function formatGsDate(iso) {
        if (!iso) return '-';
        try { const d = new Date(iso); return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0'); } catch { return '-'; }
    }

    // ── Boot ───────────────────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalSearch);
    } else {
        initGlobalSearch();
    }

})();
