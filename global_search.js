(function () {
    'use strict';

    let gsDebounceTimer = null;
    let gsActiveIndex = -1;
    let gsCurrentResults = [];
    let gsDropdownVisible = false;

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

    function showDropdownHint() {
        const dd = document.getElementById('gs-inline-dropdown');
        if (!dd) return;
        dd.innerHTML = '<div class="gs-dd-hint">&#x1F50D; Gõ để tìm vật tư, đơn kho, ca khám, nhân sự...</div>';
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

    window.openGlobalSearch = function () {
        const inp = document.getElementById('gs-header-input');
        if (inp) { inp.focus(); inp.select(); }
    };

    function performSearch(query) {
        const dd = document.getElementById('gs-inline-dropdown');
        if (!dd) return;
        if (!query || query.length < 1) { showDropdownHint(); return; }

        const q = query.toLowerCase();
        const results = [];

        const rawVatTu = getDataSafe('vatTuData');
        const vatTuHits = rawVatTu.filter(item =>
            strMatch(item.ten_mat_hang, q) || strMatch(item.ma_vach, q) ||
            strMatch(item.danh_muc, q) || strMatch(item.nhom_hang, q)
        ).slice(0, 8);
        if (vatTuHits.length > 0) {
            results.push({ type: 'group', label: 'Vật Tư & Thuốc' });
            vatTuHits.forEach(item => results.push({
                type: 'result',
                title: item.ten_mat_hang || item.ma_vach || '-',
                sub: 'Mã: ' + (item.ma_vach || '-') + ' • ' + (item.danh_muc || item.nhom_hang || 'Chung'),
                tag: 'Vật Tư', tagColor: '#10b981',
                action: () => { closeAndNavigate(); if (typeof window.jumpToVatTuItem === 'function') window.jumpToVatTuItem(item.ma_vach || ''); else window.location.hash = 'vat-tu'; }
            }));
        }

        const rawNx = getDataSafe('nhapXuatData');
        const nxHits = rawNx.filter(ord =>
            strMatch(ord.ma_don, q) || strMatch(ord.muc_dich, q) ||
            strMatch(ord.user_name, q) || strMatch(ord.loai_don, q)
        ).slice(0, 8);
        if (nxHits.length > 0) {
            results.push({ type: 'group', label: 'Đơn Nhập / Xuất Kho' });
            nxHits.forEach(ord => {
                const isNhap = (ord.loai_don || '').toLowerCase().includes('nh');
                results.push({
                    type: 'result',
                    title: ord.ma_don || 'ĐƠN-KHO',
                    sub: (isNhap ? '[Nhập]' : '[Xuất]') + ' • ' + (ord.user_name || '-') + ' • ' + formatGsDate(ord.created_at),
                    tag: isNhap ? 'Nhập' : 'Xuất', tagColor: isNhap ? '#10b981' : '#f59e0b',
                    action: () => { closeAndNavigate(); if (typeof window.jumpToNxOrder === 'function') window.jumpToNxOrder(ord.id || ord.ma_don); else window.location.hash = 'nhap-xuat'; }
                });
            });
        }

        const rawTK = getDataSafe('theKhoData');
        const tkHits = rawTK.filter(tk =>
            strMatch(tk.ten_hang_hoa, q) || strMatch(tk.ma_vach, q) ||
            strMatch(tk.lot, q) || strMatch(tk.user_name, q)
        ).slice(0, 8);
        if (tkHits.length > 0) {
            results.push({ type: 'group', label: 'Thẻ Kho' });
            tkHits.forEach(tk => results.push({
                type: 'result',
                title: tk.ten_hang_hoa || tk.ma_vach || '-',
                sub: (tk.loai || '-') + ' • MV: ' + (tk.ma_vach || '-') + ' • ' + (tk.user_name || '-'),
                tag: 'Thẻ Kho', tagColor: '#38bdf8',
                action: () => { closeAndNavigate(); if (typeof window.navigateToTheKhoFilter === 'function') window.navigateToTheKhoFilter(tk.ma_vach || '', tk.lot || '', ''); else window.location.hash = 'the-kho'; }
            }));
        }

        const rawIntakes = getDataSafe('intakesData');
        const intakeHits = rawIntakes.filter(r =>
            strMatch(r.pet_name, q) || strMatch(r.owner_name, q) ||
            strMatch(r.owner_phone, q) || strMatch(r.bac_si_kham, q)
        ).slice(0, 8);
        if (intakeHits.length > 0) {
            results.push({ type: 'group', label: 'Lịch Khám / Hồ Sơ' });
            intakeHits.forEach(r => results.push({
                type: 'result',
                title: (r.pet_name || 'Thú cưng') + ' - ' + (r.owner_name || '-'),
                sub: (r.pet_breed || '-') + ' • BS: ' + (r.bac_si_kham || '-') + ' • ' + formatGsDate(r.created_at),
                tag: 'Khám', tagColor: '#a78bfa',
                action: () => { closeAndNavigate(); if (typeof window.jumpToIntakeRecord === 'function') window.jumpToIntakeRecord(r.id); else window.location.hash = 'lich-kham'; }
            }));
        }

        const rawStaff = getDataSafe('staffData');
        const staffHits = rawStaff.filter(s =>
            strMatch(s.full_name, q) || strMatch(s.role, q) ||
            strMatch(s.branch, q) || strMatch(s.email, q) || strMatch(s.phone, q)
        ).slice(0, 8);
        if (staffHits.length > 0) {
            results.push({ type: 'group', label: 'Nhân Sự' });
            staffHits.forEach(s => results.push({
                type: 'result',
                title: s.full_name || 'Nhân viên',
                sub: (s.role || '-') + ' • ' + (s.branch || '-') + ' • ' + (s.phone || s.email || '-'),
                tag: 'Nhân Sự', tagColor: '#f97316',
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
            dd.innerHTML = '<div class="gs-dd-empty">Không tìm thấy kết quả nào phù hợp</div>';
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

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGlobalSearch);
    else initGlobalSearch();

})();