(function () {
  'use strict';

  const POLL_INTERVAL = 1500;
  const HOVER_DELAY_MS = 200;
  const POPOVER_ID = 'abt-cti-popover';
  const BAR_CLASS = 'abt-cti-bar';
  const BAR_ATTR = 'data-abt-cti-row';
  const TOGGLE_ATTR = 'data-abt-cti';

  function isEnabled() {
    return document.documentElement.getAttribute(TOGGLE_ATTR) === 'on';
  }

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      for (const k in props) {
        if (k === 'class') node.className = props[k];
        else if (k === 'style') Object.assign(node.style, props[k]);
        else if (k === 'dataset') Object.assign(node.dataset, props[k]);
        else if (k === 'text') node.textContent = props[k];
        else node.setAttribute(k, props[k]);
      }
    }
    if (children) {
      for (const c of children) {
        if (c == null) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  // ── Template parser ───────────────────────────────────────────────────
  // Grammar (verified against Actual's goal-template.pegjs):
  //   #template [-N] [keyword ...]
  // Schedule form: #template [-N] schedule [full] <Name> [modifiers]
  function parseTemplates(note) {
    if (!note) return [];
    const out = [];
    const lines = note.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      const m = line.match(/^#template\b\s*(-\d+)?\s*(.*)$/i);
      if (!m) continue;
      const priority = m[1] ? parseInt(m[1].slice(1), 10) : null;
      const rest = (m[2] || '').trim();

      let scheduleName = null;
      const schedMatch = rest.match(/^schedule\b\s+(?:full\s+)?(.*)$/i);
      if (schedMatch) {
        scheduleName = schedMatch[1].replace(/\s*\[.*$/, '').trim() || null;
      }

      out.push({ priority, raw: line, scheduleName });
    }
    return out;
  }

  // ── AQL data ──────────────────────────────────────────────────────────
  let insights = null;       // Map<categoryId, entry>
  let loading = null;

  // The worker's sqlite db isn't ready immediately on page load. Calling
  // $query before it is throws "Cannot read properties of null (reading
  // 'prepare')" and triggers Actual's global error toast. We detect
  // readiness via a DOM signal: Actual only renders per-category spreadsheet
  // cells (budget{YYYYMM}!sum-amount-<id>) after the worker has hydrated.
  function isBackendReady() {
    if (typeof window.$q !== 'function' || typeof window.$query !== 'function') {
      return false;
    }
    return !!document.querySelector(
      '[data-testid^="budget2"][data-testid*="!sum-amount-"]'
    );
  }

  function waitForBackendReady() {
    return new Promise((resolve) => {
      if (isBackendReady()) { resolve(); return; }
      const tick = () => {
        if (isBackendReady()) { resolve(); return; }
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  async function loadData() {
    if (insights) return insights;
    if (loading) return loading;
    loading = (async () => {
      await waitForBackendReady();
      const q = window.$q, query = window.$query;
      if (!q || !query) return null;
      try {
        const [catsRes, notesRes, schedsRes, txRes, prefsRes] = await Promise.all([
          query(q('categories').select('*')),
          query(q('notes').select('*')),
          query(q('schedules').select('*')),
          query(q('transactions')
            .filter({ schedule: { $ne: null } })
            .filter({ tombstone: false })
            .select(['id', 'date', 'schedule'])),
          query(q('preferences').filter({ id: 'upcomingScheduledTransactionLength' }).select('*')),
        ]);
        const cats = catsRes.data || [];
        const notes = notesRes.data || [];
        const scheds = schedsRes.data || [];
        const txs = txRes.data || [];
        const upcomingPref = (prefsRes.data && prefsRes.data[0] && prefsRes.data[0].value) || '7';

        const notesMap = new Map(notes.map(n => [n.id, n.note || '']));
        const schedsByName = new Map();
        for (const s of scheds) {
          if (s.name) schedsByName.set(s.name.trim().toLowerCase(), s);
        }

        // Paid detection: Actual auto-advances next_date after posting the
        // current occurrence. A schedule is "paid" when (1) it has a linked
        // transaction posted on/before today and (2) its next occurrence is
        // outside the user's "upcoming" window (Schedules page → Change
        // upcoming length). Inside that window, treat as upcoming.
        const today = todayIso();
        const thresholdIso = computeUpcomingThreshold(today, upcomingPref);
        const lastTxBySchedule = new Map();
        for (const tx of txs) {
          if (!tx.schedule || !tx.date) continue;
          const prev = lastTxBySchedule.get(tx.schedule);
          if (!prev || tx.date > prev) lastTxBySchedule.set(tx.schedule, tx.date);
        }
        const paidInfo = new Map();
        for (const s of scheds) {
          const last = lastTxBySchedule.get(s.id);
          if (!last || last > today) continue;
          if (!s.next_date) continue;
          if (s.next_date > thresholdIso) paidInfo.set(s.id, last);
        }

        const next = new Map();
        for (const c of cats) {
          if (c.tombstone) continue;
          const note = notesMap.get(c.id) || '';
          const templates = parseTemplates(note);
          if (templates.length === 0) continue;
          const linkedSchedules = [];
          for (const t of templates) {
            if (!t.scheduleName) continue;
            const s = schedsByName.get(t.scheduleName.toLowerCase());
            if (s) linkedSchedules.push({
              template: t,
              schedule: s,
              paid: paidInfo.has(s.id),
              paidDate: paidInfo.get(s.id) || null,
            });
          }
          next.set(c.id, { id: c.id, name: c.name, templates, linkedSchedules });
        }
        insights = next;
        return insights;
      } catch (err) {
        loading = null;
        console.error('[ABT CTI] Failed to load data:', err);
        return null;
      }
    })();
    return loading;
  }

  // ── DOM scraping & backend reads ──────────────────────────────────────
  const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;
  const SHEET_RE = /^(budget\d{6})!/;

  function getCategoryIdForRow(row) {
    const idSrc = row.querySelector('[data-testid*="sum-amount-"], [data-testid*="leftover-"]');
    if (!idSrc) return null;
    const m = (idSrc.getAttribute('data-testid') || '').match(UUID_RE);
    return m ? m[1] : null;
  }

  function getCurrentSheetName() {
    // Find any testid starting with budgetYYYYMM! — the current month's sheet.
    const el = document.querySelector('[data-testid^="budget2"][data-testid*="!sum-amount-"]');
    if (!el) return null;
    const m = (el.getAttribute('data-testid') || '').match(SHEET_RE);
    return m ? m[1] : null;
  }

  function getBudgetedCents(row) {
    // The budget cell's data-cellname IS the raw cents value (Actual detail).
    const el = row.querySelector('[data-testid="budget"]');
    if (!el) return null;
    const cn = el.getAttribute('data-cellname');
    if (cn != null && /^-?\d+$/.test(cn)) return parseInt(cn, 10);
    // Fallback: parse text
    const text = (el.textContent || '').replace(/[^\d.-]/g, '');
    const n = parseFloat(text);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }

  function getCategoryForRow(row) {
    if (!insights) return null;
    const id = getCategoryIdForRow(row);
    if (!id) return null;
    return insights.get(id) || null;
  }

  // Goal cache: catId → cents. Invalidated on month change.
  const goalCache = new Map();

  async function fetchGoalCents(catId) {
    if (goalCache.has(catId)) return goalCache.get(catId);
    const sheet = getCurrentSheetName();
    if (!sheet || typeof window.$send !== 'function') return null;
    try {
      const res = await window.$send('get-cell', { sheetName: sheet, name: 'goal-' + catId });
      const value = res && typeof res.value === 'number' ? res.value : null;
      goalCache.set(catId, value);
      return value;
    } catch (err) {
      return null;
    }
  }

  async function fetchLeftoverCents(catId) {
    const sheet = getCurrentSheetName();
    if (!sheet || typeof window.$send !== 'function') return null;
    try {
      const res = await window.$send('get-cell', { sheetName: sheet, name: 'leftover-' + catId });
      return res && typeof res.value === 'number' ? res.value : null;
    } catch {
      return null;
    }
  }

  function parseScheduleAmount(schedule) {
    // schedules._amount: number (cents) or JSON blob.
    const raw = schedule._amount;
    if (raw == null) return null;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'number') return parsed;
        if (parsed && typeof parsed.num === 'number') return parsed.num;
      } catch {
        const n = parseFloat(raw);
        if (Number.isFinite(n)) return Math.round(n * 100);
      }
    }
    if (typeof raw === 'object' && typeof raw.num === 'number') return raw.num;
    return null;
  }

  function scheduleTotalCents(entry) {
    let total = 0;
    for (const { schedule } of entry.linkedSchedules) {
      const amt = parseScheduleAmount(schedule);
      if (amt != null) total += Math.abs(amt);
    }
    return total;
  }

  // ── Bar decoration ────────────────────────────────────────────────────
  function getNameColumn(row) {
    // The category column wrapper is the nearest draggable=true ancestor of
    // category-name — stable across builds (category rows are drag-reorderable).
    return row.querySelector('[draggable="true"]');
  }

  function decorateRow(row, entry) {
    if (row.getAttribute(BAR_ATTR) === entry.id) {
      updateRowBar(row, entry);
      return;
    }
    row.setAttribute(BAR_ATTR, entry.id);

    const col = getNameColumn(row);
    if (!col) return;
    if (!col.style.position) col.style.position = 'relative';

    let bar = col.querySelector(':scope > .' + BAR_CLASS);
    if (!bar) {
      bar = el('div', { class: BAR_CLASS });
      col.appendChild(bar);
    }
    updateRowBar(row, entry);

    const nameCell = row.querySelector('[data-testid="category-name"]');
    if (nameCell) nameCell.style.cursor = 'help';

    // Hover target is the category column, not the whole row.
    col.__abtCtiRow = row;
    col.addEventListener('mouseenter', onColMouseEnter);
    col.addEventListener('mouseleave', onColMouseLeave);
  }

  function undecorateRow(row) {
    row.removeAttribute(BAR_ATTR);
    const col = getNameColumn(row);
    if (col) {
      const bar = col.querySelector(':scope > .' + BAR_CLASS);
      if (bar) bar.remove();
      col.removeEventListener('mouseenter', onColMouseEnter);
      col.removeEventListener('mouseleave', onColMouseLeave);
      delete col.__abtCtiRow;
    }
    const nameCell = row.querySelector('[data-testid="category-name"]');
    if (nameCell) nameCell.style.removeProperty('cursor');
  }

  // Returns { numerator, denominator } in cents for the bar / header totals.
  // For schedule-linked categories, the denominator is the total schedule
  // amount and the numerator is the category's current balance — which in
  // Actual's envelope budgeting naturally accumulates across months and
  // resets after a payment. So for an annual AppleCare at $49.99/mo toward
  // a $149.99 total, the bar grows 33% → 66% → 100% through the savings
  // cycle and resets after payment. For non-schedule templates it falls
  // back to budgeted / goal for the current month.
  async function getProgressCents(row, entry) {
    const schedTotal = scheduleTotalCents(entry);
    if (schedTotal > 0) {
      const leftover = await fetchLeftoverCents(entry.id);
      const num = leftover == null ? null : Math.max(0, leftover);
      return { numerator: num, denominator: schedTotal, source: 'schedule' };
    }
    const budgetedCents = getBudgetedCents(row);
    const goalCents = await fetchGoalCents(entry.id);
    return { numerator: budgetedCents, denominator: goalCents, source: 'goal' };
  }

  async function updateRowBar(row, entry) {
    const col = getNameColumn(row);
    if (!col) return;
    const bar = col.querySelector(':scope > .' + BAR_CLASS);
    if (!bar) return;
    const { numerator, denominator } = await getProgressCents(row, entry);
    if (numerator == null || !denominator || denominator <= 0) {
      bar.style.width = '0%';
      bar.dataset.state = 'unknown';
      return;
    }
    const ratio = Math.max(0, numerator / denominator);
    bar.style.width = Math.min(100, ratio * 100) + '%';
    const allPaid = entry.linkedSchedules.length > 0 &&
      entry.linkedSchedules.every((ls) => ls.paid);
    if (allPaid) bar.dataset.state = 'paid';
    else if (ratio >= 1) bar.dataset.state = 'full';
    else if (ratio >= 0.8) bar.dataset.state = 'near';
    else bar.dataset.state = 'under';
  }

  // ── Popover ───────────────────────────────────────────────────────────
  let hoverTimer = null;
  let currentRow = null;
  let currentCol = null;
  let popoverEl = null;

  function onColMouseEnter(e) {
    if (!isEnabled()) return;
    const col = e.currentTarget;
    const row = col.__abtCtiRow;
    if (!row) return;
    currentRow = row;
    currentCol = col;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (currentRow === row) openPopover(row, col);
    }, HOVER_DELAY_MS);
  }

  function onColMouseLeave(e) {
    const col = e.currentTarget;
    clearTimeout(hoverTimer);
    if (currentCol === col) { currentCol = null; currentRow = null; }
    closePopover();
  }

  function fmtCents(cents) {
    if (cents == null) return '—';
    return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  }

  function daysBetween(fromIso, toIso) {
    // Parse as local calendar dates (no timezone shift).
    const [fy, fm, fd] = fromIso.split('-').map(Number);
    const [ty, tm, td] = toIso.split('-').map(Number);
    const a = new Date(fy, fm - 1, fd).getTime();
    const b = new Date(ty, tm - 1, td).getTime();
    return Math.round((b - a) / 86400000);
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Mirrors Actual's getUpcomingDays() grammar for the
  // "upcomingScheduledTransactionLength" preference. Returns an ISO date:
  // schedules whose next_date is strictly after this threshold are "paid";
  // on/before it they're "upcoming".
  function computeUpcomingThreshold(todayIsoStr, pref) {
    const [y, m, d] = todayIsoStr.split('-').map(Number);
    const iso = (dt) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

    const raw = (pref || '7').toString().trim();
    if (raw === 'currentMonth') {
      return iso(new Date(y, m, 0)); // last day of current month
    }
    if (raw === 'oneMonth') {
      return iso(new Date(y, m, d));
    }
    if (raw.includes('-')) {
      const [nStr, unit] = raw.split('-');
      const n = parseInt(nStr, 10);
      if (Number.isFinite(n)) {
        if (unit === 'day') return iso(new Date(y, m - 1, d + n));
        if (unit === 'week') return iso(new Date(y, m - 1, d + n * 7));
        if (unit === 'month') return iso(new Date(y, m - 1 + n, d));
        if (unit === 'year') return iso(new Date(y + n, m - 1, d));
      }
    }
    const n = parseInt(raw, 10);
    const days = Number.isFinite(n) ? n : 7;
    return iso(new Date(y, m - 1, d + days));
  }

  function relativeDay(iso) {
    if (!iso) return '';
    const diff = daysBetween(todayIso(), iso);
    if (diff === 0) return 'today';
    if (diff === 1) return 'tomorrow';
    if (diff === -1) return 'yesterday';
    if (diff > 1) return `in ${diff} days`;
    return `${-diff} days ago`;
  }

  function fmtDateShort(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y.slice(2)}`;
  }

  function buildTemplateRow(t, entry) {
    const priority = el('span', {
      class: t.priority != null ? 'abt-cti-priority' : 'abt-cti-priority abt-cti-priority-none',
      text: t.priority != null ? '#' + t.priority : '—',
    });
    const body = el('div', { class: 'abt-cti-template-body' });

    if (t.scheduleName) {
      const link = entry.linkedSchedules.find(ls => ls.template === t);
      const sched = link && link.schedule;
      if (sched) {
        const amtCents = parseScheduleAmount(sched);
        const status = sched.completed ? 'completed' : (link.paid ? 'paid' : 'upcoming');
        // When paid, the schedule's next_date has already advanced. Show the
        // paid transaction's date so the popover describes the event the user
        // is actually looking at. Otherwise show the upcoming date.
        const displayDate = link.paid ? link.paidDate : sched.next_date;
        const rel = displayDate ? relativeDay(displayDate) : '';
        const row1 = el('div', { class: 'abt-cti-sched-row1' }, [
          el('span', { class: 'abt-cti-sched-name', text: sched.name || t.scheduleName }),
          el('span', { class: 'abt-cti-sched-amt', text: fmtCents(amtCents) }),
          el('span', { class: 'abt-cti-sched-status abt-cti-status-' + status, text: status }),
        ]);
        const row2 = el('div', { class: 'abt-cti-sched-row2' }, [
          el('span', { class: 'abt-cti-sched-date', text: fmtDateShort(displayDate) }),
          rel ? el('span', { class: 'abt-cti-sched-rel', text: rel }) : null,
        ]);
        body.appendChild(row1);
        body.appendChild(row2);
        return el('li', { class: 'abt-cti-template abt-cti-template-schedule' }, [priority, body]);
      }
      body.appendChild(el('div', {
        class: 'abt-cti-schedule-missing',
        text: `Schedule "${t.scheduleName}" not found`,
      }));
      return el('li', { class: 'abt-cti-template abt-cti-template-schedule abt-cti-template-missing' }, [priority, body]);
    }
    // Non-schedule template: show raw directive (no redundant line for schedule ones).
    body.appendChild(el('div', { class: 'abt-cti-template-raw', text: t.raw }));
    return el('li', { class: 'abt-cti-template' }, [priority, body]);
  }

  async function openPopover(row, anchor) {
    const entry = getCategoryForRow(row);
    if (!entry) return;
    closePopover();
    anchor = anchor || row;

    const { numerator, denominator } = await getProgressCents(row, entry);
    // The user may have already moved on during the await.
    if (currentRow !== row) return;
    const ratio = denominator && denominator > 0 ? (numerator ?? 0) / denominator : 0;
    const ratioPct = Math.round(ratio * 100);

    const totals = el('div', { class: 'abt-cti-totals' }, [
      el('span', { text: fmtCents(numerator) }),
      el('span', { class: 'abt-cti-sep', text: '/' }),
      el('span', { text: denominator ? fmtCents(denominator) : '—' }),
      denominator ? el('span', { class: 'abt-cti-ratio', text: ratioPct + '%' }) : null,
    ]);

    const header = el('div', { class: 'abt-cti-header' }, [
      el('div', { class: 'abt-cti-title', text: entry.name }),
      totals,
    ]);
    if (denominator && denominator > 0) {
      const miniFill = el('div', {
        class: 'abt-cti-mini-bar-fill',
        style: { width: Math.min(100, ratio * 100) + '%' },
      });
      header.appendChild(el('div', { class: 'abt-cti-mini-bar' }, [miniFill]));
    }

    const list = el('ul', { class: 'abt-cti-templates' });
    for (const t of entry.templates) list.appendChild(buildTemplateRow(t, entry));

    const pop = el('div', { class: 'abt-cti-popover', id: POPOVER_ID }, [header, list]);
    document.body.appendChild(pop);
    popoverEl = pop;
    positionPopover(pop, anchor);

    // First linked schedule — used for the F hotkey jump/open target.
    const firstSched = entry.linkedSchedules[0] && entry.linkedSchedules[0].schedule;
    const firstSchedId = firstSched && firstSched.id;
    const firstSchedName = firstSched && firstSched.name;

    const onOutside = (ev) => {
      if (pop && !pop.contains(ev.target) && !anchor.contains(ev.target)) closePopover();
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape') { closePopover(); return; }
      if ((ev.key === 'f' || ev.key === 'F') && firstSchedId) {
        const t = ev.target;
        const tag = t && t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        ev.preventDefault();
        closePopover();
        openScheduleModal(firstSchedId);
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', onOutside, true);
      document.addEventListener('keydown', onKey, true);
    }, 0);
    pop.__cleanup = () => {
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
    };

    // Hint chip shown at the bottom of the popover.
    if (firstSchedId) {
      pop.appendChild(el('div', { class: 'abt-cti-hint' }, [
        el('kbd', { class: 'abt-cti-kbd', text: 'F' }),
        el('span', { text: 'Edit ' + (firstSchedName || 'schedule') }),
      ]));
      // Reposition in case the hint changed popover height.
      positionPopover(pop, anchor);
    }
  }

  // Navigate to /schedules and click the row whose data-focus-key matches the
  // schedule id — that's what Actual's own table does for a click, and it
  // opens the schedule-edit modal.
  function openScheduleModal(schedId) {
    if (location.pathname !== '/schedules') {
      if (typeof window.__navigate === 'function') {
        window.__navigate('/schedules');
      } else {
        window.history.pushState({}, '', '/schedules');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
    let tries = 0;
    const maxTries = 40;
    const step = () => {
      const row = document.querySelector(
        `[data-focus-key="${schedId}"] [data-testid="row"]`
      );
      if (row) {
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return;
      }
      if (++tries < maxTries) setTimeout(step, 100);
    };
    setTimeout(step, 120);
  }

  function positionPopover(pop, anchor) {
    const rowRect = anchor.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let top = rowRect.bottom + 6;
    let left = rowRect.left;
    if (top + popRect.height > window.innerHeight - 8) {
      top = Math.max(8, rowRect.top - popRect.height - 6);
    }
    if (left + popRect.width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popRect.width - 8);
    }
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
  }

  function closePopover() {
    if (popoverEl) {
      if (popoverEl.__cleanup) popoverEl.__cleanup();
      popoverEl.remove();
      popoverEl = null;
    }
  }

  // ── Observer / scanning ───────────────────────────────────────────────
  const ROW_SELECTOR = '[data-testid="row"]:has([data-testid="category-name"])';

  function scanAndDecorate() {
    if (!isEnabled()) return;
    if (!insights) return;
    document.querySelectorAll(ROW_SELECTOR).forEach((row) => {
      const entry = getCategoryForRow(row);
      if (!entry) return;
      decorateRow(row, entry);
    });
  }

  function undecorateAll() {
    document.querySelectorAll('[' + BAR_ATTR + ']').forEach((row) => undecorateRow(row));
    closePopover();
  }

  let observer = null;
  let observerPending = false;
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (observerPending) return;
      observerPending = true;
      requestAnimationFrame(() => {
        observerPending = false;
        scanAndDecorate();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  function stopObserver() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  // ── CSS ───────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('abt-cti-styles')) return;
    const style = el('style', { id: 'abt-cti-styles' });
    style.textContent = `
      .${BAR_CLASS} {
        position: absolute;
        left: 0;
        bottom: 0;
        height: 3px;
        width: 0;
        background: var(--color-pageTextPositive, #4caf50);
        transition: width 140ms ease;
        pointer-events: none;
        z-index: 1;
      }
      .${BAR_CLASS}[data-state="under"] { background: var(--color-formInputBorderSelected, #2196f3); }
      .${BAR_CLASS}[data-state="near"] { background: var(--color-formInputBorderSelected, #ffb74d); }
      .${BAR_CLASS}[data-state="full"] { background: var(--color-noticeBackground, #4caf50); }
      .${BAR_CLASS}[data-state="paid"] { background: rgba(156, 156, 156, 0.55); }

      .abt-cti-popover {
        position: fixed;
        z-index: 10000;
        min-width: 280px;
        max-width: 440px;
        background: var(--color-menuBackground, #2a2b2e);
        color: var(--color-menuItemText, #fff);
        border: 1px solid var(--color-menuBorder, rgba(255,255,255,0.1));
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        font-size: 12px;
        font-family: var(--font-sans, system-ui, sans-serif);
        padding: 10px 12px;
      }
      .abt-cti-header { margin-bottom: 8px; }
      .abt-cti-title { font-weight: 600; font-size: 13px; margin-bottom: 4px; }
      .abt-cti-totals { display: flex; align-items: center; gap: 4px; opacity: 0.85; }
      .abt-cti-totals .abt-cti-sep { opacity: 0.5; }
      .abt-cti-ratio { margin-left: auto; font-variant-numeric: tabular-nums; }
      .abt-cti-mini-bar {
        margin-top: 6px;
        height: 4px;
        background: rgba(255,255,255,0.1);
        border-radius: 2px;
        overflow: hidden;
      }
      .abt-cti-mini-bar-fill {
        height: 100%;
        background: var(--color-noticeBackground, #4caf50);
      }
      .abt-cti-templates {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .abt-cti-template {
        display: flex;
        gap: 8px;
        padding: 6px 8px;
        background: rgba(255,255,255,0.04);
        border-radius: 4px;
      }
      .abt-cti-priority {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        color: var(--color-formInputBorderSelected, #6db3f2);
        min-width: 22px;
      }
      .abt-cti-priority-none { opacity: 0.4; font-weight: 400; }
      .abt-cti-template-body { flex: 1; min-width: 0; }
      .abt-cti-template-raw {
        font-family: var(--font-mono, ui-monospace, monospace);
        font-size: 11px;
        opacity: 0.7;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .abt-cti-sched-row1 {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .abt-cti-sched-row2 {
        display: flex;
        align-items: baseline;
        gap: 6px;
        margin-top: 2px;
        font-size: 11px;
        opacity: 0.75;
      }
      .abt-cti-sched-name { font-weight: 600; }
      .abt-cti-sched-amt {
        font-variant-numeric: tabular-nums;
        margin-left: auto;
      }
      .abt-cti-sched-date { }
      .abt-cti-sched-rel:before { content: "· "; opacity: 0.6; }
      .abt-cti-sched-status {
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .abt-cti-status-upcoming { background: rgba(100, 180, 255, 0.2); color: #9ccbff; }
      .abt-cti-status-paid { background: rgba(120, 220, 120, 0.2); color: #9cebc2; }
      .abt-cti-status-completed { background: rgba(160, 160, 160, 0.2); color: #c8c8c8; }
      .abt-cti-schedule-missing {
        margin-top: 3px;
        font-size: 11px;
        color: var(--color-errorText, #e57373);
      }
      .abt-cti-hint {
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px solid rgba(255,255,255,0.08);
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 10px;
        opacity: 0.7;
      }
      .abt-cti-kbd {
        display: inline-block;
        padding: 1px 5px;
        border-radius: 3px;
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.06);
        font-family: var(--font-mono, ui-monospace, monospace);
        font-size: 10px;
        line-height: 1.2;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────
  let toggleObserver = null;

  async function enable() {
    injectStyles();
    startObserver();
    await loadData();
    scanAndDecorate();
  }

  function disable() {
    stopObserver();
    undecorateAll();
  }

  function onToggleChange() {
    if (isEnabled()) enable();
    else disable();
  }

  function watchToggle() {
    if (toggleObserver) return;
    toggleObserver = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'attributes' && m.attributeName === TOGGLE_ATTR) {
          onToggleChange();
        }
      }
    });
    toggleObserver.observe(document.documentElement, { attributes: true, attributeFilter: [TOGGLE_ATTR] });
  }

  // Invalidate cache on URL change or sheet change (month nav).
  let lastUrl = location.href;
  let lastSheet = null;
  setInterval(() => {
    const sheet = getCurrentSheetName();
    if (location.href !== lastUrl || (sheet && sheet !== lastSheet)) {
      lastUrl = location.href;
      lastSheet = sheet;
      goalCache.clear();
      if (isEnabled()) scanAndDecorate();
    } else if (isEnabled()) {
      scanAndDecorate();
    }
  }, POLL_INTERVAL);

  watchToggle();
  onToggleChange();
})();
