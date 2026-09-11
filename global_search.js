/* ==========================================================================
   GAIA Animal Hospital - Global Search Module (global_search.js)
   Inline dropdown search attached to header input. No modal.
   ========================================================================== */

(function () {
    'use strict';

    let gsDebounceTimer = null;
    let gsActiveIndex = -1;
    let gsCurrentResults = [];
    let gsDropdownVisible = false;

    // ── Init ──────────────────────────────────────────────────────────────────
    function initGlobalSearch() {
        const tryAttach = () => {
            const input = document.getElementById('gs-header-input');
            if (!input) { setTimeout(tryAttach, 100); return; }
            attachInlineSearch(input);
        };
        tryAttach();
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const inp = document.getElementById('gs-header-input');
                if (inp) { inp.focus(); inp.select(); }
            }
        });
    }

    function attachInlineSearch(input) {
        input.addEventListener('focus', function () {
            if (input.value.trim().length > 0) performSearch(input.value.trim());
            else showDropdownHint();
        });
        input.addEventListener('input', function () {
            clearTimeout(gsDebounceTimer);
            gsDebounceTimer = setTimeout(() => performSearch(input.value.trim()), 150);
        });
        input.addEventListener('keydown', function (e) {
            if (!gsDropdownVisible) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); moveGsSelection(1); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); moveGsSelection(-1); }
            if (e.key === 'Enter')     { e.preventDefault(); selectActiveResult(); }
            if (e.key === 'Escape')    { hideDropdown(); input.blur(); }
        });
        document.addEventListener('mousedown', function (e) {
            const wrap = document.getElementById('gs-inline-wrap');
            if (wrap && !wrap.contains(e.target)) hideDropdown();
        });
    }

    // ── Dropdown visibility ────────────────────────────────────────────────────
    function showDropdownHint() {
        const dd = document.getElementById('gs-inline-dropdown');
        if (!dd) return;
        dd.innerHTML = '<div class="gs-dd-hint">&#x1F50D; Go de tim vat tu, don kho, ca kham, nhan su...</div>';
        dd.classList.add('gs-dd-open');
        gsDropdownVisible = true;
    }

    function hideDropdown() {
        const dd = document.getElementById('gs-inline-dropdown');
        if (dd) dd.classList.remove('gs-dd-open');
        gsDropdownVisible = false;
        gsActiveIndex = -1;
        gsCurrentResults = [];
    }

    // Legacy compat
    window.openGlobalSearch = function () {
        const inp = document.getElementById('gs-header-input');
        if (inp) { inp.focus(); inp.select(); }
    };

    // ── Search Logic ───────────────────────────────────────────────────────────
    function performSearch(query) {
        const dd = document.getElementById('gs-inline-dropdown');
        if (!dd) return;
        if (!query || query.length < 1) { showDropdownHint(); return; }

        const q = query.toLowerCase();
        const results = [];

        // 1. Vat Tu
        const rawVatTu = getDataSafe('vatTuData');
        const vatTuHits = rawVatTu.filter(item =>
            strMatch(item.ten_mat_hang, q) || strMatch(item.ma_vach, q) ||
            strMatch(item.danh_muc, q) || strMatch(item.nhom_hang, q)
        ).slice(0, 8);
        if (vatTuHits.length > 0) {
            results.push({ type: 'group', label: 'Vat Tu / Thuoc' });
            vatTuHits.forEach(item => results.push({
                type: 'result',
                title: item.ten_mat_hang || item.ma_vach || '-',
                sub: 'Ma: ' + (item.ma_vach || '-') + ' - ' + (item.danh_muc || item.nhom_hang || 'Chung'),
                tag: 'Vat Tu', tagColor: '#10b981',
                action: () => { closeAndNavigate(); if (typeof window.jumpToVatTuItem === 'function') window.jumpToVatTuItem(item.ma_vach || ''); else window.location.hash = 'vat-tu'; }
            }));
        }

        // 2. Nhap Xuat
        const rawNx = getDataSafe('nhapXuatData');
        const nxHits = rawNx.filter(ord =>
            strMatch(ord.ma_don, q) || strMatch(ord.muc_dich, q) ||
            strMatch(ord.user_name, q) || strMatch(ord.loai_don, q)
        ).slice(0, 8);
        if (nxHits.length > 0) {
            results.push({ type: 'group', label: 'Don Nhap / Xuat Kho' });
            nxHits.forEach(ord => {
                const isNhap = (ord.loai_don || '').toLowerCase().includes('nh');
                results.push({
                    type: 'result',
                    title: ord.ma_don || 'DON-KHO',
                    sub: (isNhap ? '[Nhap]' : '[Xuat]') + ' - ' + (ord.user_name || '-') + ' - ' + formatGsDate(ord.created_at),
                    tag: isNhap ? 'Nhap' : 'Xuat', tagColor: isNhap ? '#10b981' : '#f59e0b',
                    action: () => { closeAndNavigate(); if (typeof window.jumpToNxOrder === 'function') window.jumpToNxOrder(ord.id || ord.ma_don); else window.location.hash = 'nhap-xuat'; }
                });
            });
        }

        // 3. The Kho
        const rawTK = getDataSafe('theKhoData');
        const tkHits = rawTK.filter(tk =>
            strMatch(tk.ten_hang_hoa, q) || strMatch(tk.ma_vach, q) ||
            strMatch(tk.lot, q) || strMatch(tk.user_name, q)
        ).slice(0, 8);
        if (tkHits.length > 0) {
            results.push({ type: 'group', label: 'The Kho' });
            tkHits.forEach(tk => results.push({
                type: 'result',
                title: tk.ten_hang_hoa || tk.ma_vach || '-',
                sub: (tk.loai || '-') + ' - MV: ' + (tk.ma_vach || '-') + ' - ' + (tk.user_name || '-'),
                tag: 'The Kho', tagColor: '#38bdf8',
                action: () => { closeAndNavigate(); if (typeof window.navigateToTheKhoFilter === 'function') window.navigateToTheKhoFilter(tk.ma_vach || '', tk.lot || '', ''); else window.location.hash = 'the-kho'; }
            }));
        }

        // 4. Ca Kham
        const rawIntakes = getDataSafe('intakesData');
        const intakeHits = rawIntakes.filter(r =>
            strMatch(r.pet_name, q) || strMatch(r.owner_name, q) ||
            strMatch(r.owner_phone, q) || strMatch(r.bac_si_kham, q)
        ).slice(0, 8);
        if (intakeHits.length > 0) {
            results.push({ type: 'group', label: 'Ca Kham' });
            intakeHits.forEach(r => results.push({
                type: 'result',
                title: (r.pet_name || 'Thu cung') + ' - ' + (r.owner_name || '-'),
                sub: (r.pet_breed || '-') + ' - BS: ' + (r.bac_si_kham || '-') + ' - ' + formatGsDate(r.created_at),
                tag: 'Lich Kham', tagColor: '#a78bfa',
                action: () => { closeAndNavigate(); if (typeof window.jumpToIntakeRecord === 'function') window.jumpToIntakeRecord(r.id); else window.location.hash = 'lich-kham'; }
            }));
        }

        // 5. Nhan Su
        const rawStaff = getDataSafe('staffData');
        const staffHits = rawStaff.filter(s =>
            strMatch(s.full_name, q) || strMatch(s.role, q) ||
            strMatch(s.branch, q) || strMatch(s.email, q) || strMatch(s.phone, q)
        ).slice(0, 8);
        if (staffHits.length > 0) {
            results.push({ type: 'group', label: 'Nhan Su' });
            staffHits.forEach(s => results.push({
                type: 'result',
                title: s.full_name || 'Nhan vien',
                sub: (s.role || '-') + ' - ' + (s.branch || '-') + ' - ' + (s.phone || s.email || '-'),
                tag: 'Nhan Su', tagColor: '#f97316',
                action: () => { closeAndNavigate(); window.location.hash = 'nhan-su'; }
            }));
        }

        gsCurrentResults = results.filter(r => r.type === 'result');
        gsActiveIndex = -1;
        renderDropdown(results, query);
        dd.classList.add('gs-dd-open');
        gsDropdownVisible = true;
    }

    function renderDropdown(results, query) {
        const dd = document.getElementById('gs-inline-dropdown');
        if (!dd) return;
        if (results.length === 0) {
            dd.innerHTML = '<div class="gs-dd-empty">Khong tim thay ket qua nao</div>';
            return;
        }
        let html = '';
        let idx = 0;
        results.forEach(item => {
            if (item.type === 'group') {
                html += '<div class="gs-dd-group">' + escH(item.label) + '</div>';
            } else {
                const i = idx++;
                html += '<div class="gs-dd-item" data-idx="' + i + '" onmousedown="event.preventDefault();gsInlineSelect(' + i + ')">' +
                    '<div class="gs-dd-item-body">' +
                    '<div class="gs-dd-title">' + highlightMatch(escH(item.title), query) + '</div>' +
                    '<div class="gs-dd-sub">' + escH(item.sub) + '</div>' +
                    '</div>' +
                    '<span class="gs-dd-tag" style="color:' + item.tagColor + ';background:' + item.tagColor + '18;border-color:' + item.tagColor + '30;">' + escH(item.tag) + '</span>' +
                    '</div>';
            }
        });
        dd.innerHTML = html;
    }

    function closeAndNavigate() {
        const inp = document.getElementById('gs-header-input');
        if (inp) inp.value = '';
        hideDropdown();
    }

    // ── Keyboard nav ──────────────────────────────────────────────────────────
    function moveGsSelection(dir) {
        const dd = document.getElementById('gs-inline-dropdown');
        if (!dd) return;
        const items = dd.querySelectorAll('.gs-dd-item');
        if (!items.length) return;
        if (gsActiveIndex >= 0 && items[gsActiveIndex]) items[gsActiveIndex].classList.remove('gs-dd-active');
        gsActiveIndex = Math.max(0, Math.min(items.length - 1, gsActiveIndex + dir));
        const el = items[gsActiveIndex];
        if (el) { el.classList.add('gs-dd-active'); el.scrollIntoView({ block: 'nearest' }); }
    }

    function selectActiveResult() {
        if (gsActiveIndex >= 0 && gsCurrentResults[gsActiveIndex]) gsCurrentResults[gsActiveIndex].action();
    }

    window.gsInlineSelect = function (idx) {
        if (gsCurrentResults[idx]) gsCurrentResults[idx].action();
    };

    // ── Helpers ────────────────────────────────────────────────────────────────
    function getDataSafe(key) { try { const v = window[key]; return Array.isArray(v) ? v : []; } catch { return []; } }
    function strMatch(val, q) { if (!val) return false; return String(val).toLowerCase().includes(q); }
    function escH(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function highlightMatch(esc, q) {
        if (!q) return esc;
        const safe = escH(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        return esc.replace(new RegExp('('+safe+')', 'gi'), '<mark class="gs-hl">$1</mark>');
    }
    function formatGsDate(iso) {
        if (!iso) return '-';
        try { const d = new Date(iso); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); } catch { return '-'; }
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGlobalSearch);
    else initGlobalSearch();

})();