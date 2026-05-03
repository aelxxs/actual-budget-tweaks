(function () {
  'use strict';

  const TOGGLE_ATTR = 'data-abt-tab';
  const PANEL_ID = 'abt-tab-panel';
  // Menu-item button labels we hook. The app's React layer calls the backend
  // via an internal `send()` (not window.$send), so wrapping window.$send
  // misses these — we hook the click instead.
  const TRIGGER_LABELS = new Map([
    ['apply budget template', 'apply'],
    ['overwrite with budget template', 'overwrite'],
    ['apply template', 'apply-single'], // single-category context menu
  ]);

  function isEnabled() {
    return document.documentElement.getAttribute(TOGGLE_ATTR) === 'on';
  }

  // ── DOM helper ────────────────────────────────────────────────────────
  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      for (const k in props) {
        if (k === 'class') node.className = props[k];
        else if (k === 'style') Object.assign(node.style, props[k]);
        else if (k === 'dataset') Object.assign(node.dataset, props[k]);
        else if (k === 'text') node.textContent = props[k];
        else if (k === 'on') {
          for (const ev in props.on) node.addEventListener(ev, props.on[ev]);
        } else node.setAttribute(k, props[k]);
      }
    }
    if (children) {
      for (const c of children) {
        if (c == null || c === false) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  // ── Currency formatting ───────────────────────────────────────────────
  // Use Actual's preference if discoverable; fall back to en-US/USD.
  function fmtMoney(cents, opts) {
    const sign = opts && opts.sign;
    const n = (cents || 0) / 100;
    const abs = Math.abs(n);
    const str = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);
    if (sign && cents > 0) return '+' + str;
    if (n < 0) return '−' + str;
    return str;
  }

  // ── Backend readiness ────────────────────────────────────────────────
  function isBackendReady() {
    if (typeof window.$send !== 'function') return false;
    if (typeof window.$query !== 'function' || typeof window.$q !== 'function') return false;
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

  // ── Categories cache ─────────────────────────────────────────────────
  // { id, name, group_id, group_name, sort_order, group_sort_order, hidden }
  let categoriesCache = null;
  let categoriesPromise = null;

  async function loadCategories() {
    if (categoriesCache) return categoriesCache;
    if (categoriesPromise) return categoriesPromise;
    categoriesPromise = (async () => {
      try {
        const [catsRes, groupsRes] = await Promise.all([
          window.$query(window.$q('categories').select('*')),
          window.$query(window.$q('category_groups').select('*')),
        ]);
        const cats = (catsRes && catsRes.data) || [];
        const groups = (groupsRes && groupsRes.data) || [];
        const groupMap = new Map();
        for (const g of groups) groupMap.set(g.id, g);
        categoriesCache = cats.map((c) => {
          const gid = c.cat_group || c.group;
          const g = groupMap.get(gid) || {};
          return {
            id: c.id,
            name: c.name,
            sort_order: c.sort_order || 0,
            hidden: !!c.hidden,
            tombstone: !!c.tombstone,
            group_id: gid || '__none__',
            group_name: g.name || 'Uncategorized',
            group_sort_order: g.sort_order || 0,
          };
        }).filter((c) => !c.tombstone);
      } catch (e) {
        console.warn('[ABT TAB] categories query failed', e);
        categoriesCache = [];
      }
      return categoriesCache;
    })();
    return categoriesPromise;
  }

  function invalidateCategoriesCache() {
    categoriesCache = null;
    categoriesPromise = null;
  }

  // ── Cell snapshot ────────────────────────────────────────────────────
  async function getCell(sheet, name) {
    try {
      const res = await window.$send('get-cell', { sheetName: sheet, name });
      const v = res && res.value;
      return typeof v === 'number' ? v : 0;
    } catch {
      return 0;
    }
  }

  // SYNC: posts all get-cell messages immediately and returns a descriptor
  // with the in-flight promises. Must be callable from a click capture
  // handler so the worker queues these reads BEFORE React's bubble-phase
  // onClick posts the apply-template message.
  function startSnapshotMonth(sheet, cats) {
    const ids = cats.filter((c) => !c.hidden).map((c) => c.id);
    const promises = [
      window.$send('get-cell', { sheetName: sheet, name: 'available-funds' }),
      window.$send('get-cell', { sheetName: sheet, name: 'to-budget' }),
      ...ids.map((id) =>
        window.$send('get-cell', { sheetName: sheet, name: 'budget-' + id })
      ),
    ];
    return { sheet, ids, promises };
  }

  async function awaitSnapshotMonth(start) {
    const vals = await Promise.all(
      start.promises.map((p) => p.catch(() => null))
    );
    const v = (cell) =>
      cell && typeof cell.value === 'number' ? cell.value : 0;
    const availableFunds = v(vals[0]);
    const toBudget = v(vals[1]);
    const budgets = new Map();
    start.ids.forEach((id, i) => budgets.set(id, v(vals[i + 2])));
    return { sheet: start.sheet, availableFunds, toBudget, budgets };
  }

  // Discover all sheets currently rendered in the DOM (one per visible month).
  function getVisibleSheets() {
    const cells = document.querySelectorAll(
      '[data-testid^="budget2"][data-testid*="!sum-amount-"]'
    );
    const sheets = new Set();
    for (const c of cells) {
      const m = c.getAttribute('data-testid').match(/^(budget\d{6})/);
      if (m) sheets.add(m[1]);
    }
    return Array.from(sheets);
  }

  function sheetToMonthString(sheet) {
    // sheet = "budget202604" → "2026-04"
    const m = sheet && sheet.match(/^budget(\d{4})(\d{2})/);
    return m ? `${m[1]}-${m[2]}` : null;
  }

  // SYNC: kicks off snapshot reads for every visible month. Returns an
  // array of in-flight descriptors to be awaited via finishSnapshots().
  function startSnapshotAllVisible() {
    if (!categoriesCache) return [];
    const sheets = getVisibleSheets();
    return sheets.map((s) => startSnapshotMonth(s, categoriesCache));
  }

  async function finishSnapshots(starts) {
    const snaps = await Promise.all(starts.map(awaitSnapshotMonth));
    const map = new Map();
    snaps.forEach((s) => map.set(s.sheet, s));
    return map;
  }

  // ── DOM quiescence ───────────────────────────────────────────────────
  // Wait for budget-table cell mutations to settle before snapshotting after.
  function waitForQuiescence(idleMs, maxMs) {
    idleMs = idleMs || 250;
    maxMs = maxMs || 3000;
    return new Promise((resolve) => {
      let idleTimer = null;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(idleTimer);
        clearTimeout(hardStop);
        obs.disconnect();
        resolve();
      };
      const arm = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(finish, idleMs);
      };
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === 'attributes' && m.attributeName === 'data-cellname') {
            arm();
            return;
          }
          if (m.type === 'characterData' || m.type === 'childList') {
            arm();
            return;
          }
        }
      });
      obs.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-cellname'],
        characterData: true,
        childList: true,
      });
      const hardStop = setTimeout(finish, maxMs);
      // Always arm at least once so we wait the idle window even if no muts arrive.
      arm();
    });
  }

  // ── Diff ─────────────────────────────────────────────────────────────
  function diffSnapshots(before, after) {
    const cats = categoriesCache || [];
    const groups = new Map(); // group_id -> { id, name, sort_order, rows: [] }
    let totalAllocated = 0;
    for (const c of cats) {
      const b = before.budgets.get(c.id) || 0;
      const a = after.budgets.get(c.id) || 0;
      const delta = a - b;
      totalAllocated += delta;
      const gid = c.group_id || '__none__';
      if (!groups.has(gid)) {
        groups.set(gid, {
          id: gid,
          name: c.group_name || 'Uncategorized',
          sort_order: c.group_sort_order || 0,
          rows: [],
        });
      }
      groups.get(gid).rows.push({
        id: c.id,
        name: c.name,
        sort_order: c.sort_order || 0,
        before: b,
        after: a,
        delta,
      });
    }
    const groupList = Array.from(groups.values()).sort(
      (a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name)
    );
    for (const g of groupList) {
      g.rows.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
    }
    return {
      groups: groupList,
      totalAllocated,
      availableBefore: before.availableFunds,
      availableAfter: after.availableFunds,
      toBudgetBefore: before.toBudget,
      toBudgetAfter: after.toBudget,
    };
  }

  // ── Panel rendering ──────────────────────────────────────────────────
  let showAllRows = false;
  // Persistent panel UI state (preserved across re-renders within a session)
  const panelState = {
    collapsed: false,
    x: null, // left px (null = default top-left)
    y: null, // top px
  };

  function applyPanelPosition(panel) {
    if (panelState.x != null) panel.style.left = panelState.x + 'px';
    if (panelState.y != null) panel.style.top = panelState.y + 'px';
    if (panelState.collapsed) panel.setAttribute('data-collapsed', 'true');
  }

  function clampPosition(x, y, w, h) {
    const pad = 4;
    return {
      x: Math.max(pad, Math.min(window.innerWidth - w - pad, x)),
      y: Math.max(pad, Math.min(window.innerHeight - h - pad, y)),
    };
  }

  function attachDrag(panel, handle) {
    let dragging = false;
    let startX = 0, startY = 0, originX = 0, originY = 0;
    handle.addEventListener('pointerdown', (e) => {
      // Don't start drag from button clicks
      if (e.target.closest('button')) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      handle.setPointerCapture(e.pointerId);
      panel.setAttribute('data-dragging', 'true');
      e.preventDefault();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const rect = panel.getBoundingClientRect();
      const pos = clampPosition(originX + dx, originY + dy, rect.width, rect.height);
      panel.style.left = pos.x + 'px';
      panel.style.top = pos.y + 'px';
      panelState.x = pos.x;
      panelState.y = pos.y;
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      panel.removeAttribute('data-dragging');
      try { handle.releasePointerCapture(e.pointerId); } catch {}
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function actionLabel(kind) {
    switch (kind) {
      case 'overwrite': return 'Overwrote with template';
      case 'apply-single': return 'Applied template (single)';
      default: return 'Applied template';
    }
  }

  function fmtMonth() {
    // Show the timestamp of when the apply ran, not the target month.
    try {
      return new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  function removePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();
  }

  function renderPanel(diff, ctx) {
    removePanel();
    if (!isEnabled()) return;

    const changedGroups = diff.groups
      .map((g) => ({ ...g, rows: g.rows.filter((r) => r.delta !== 0) }))
      .filter((g) => g.rows.length > 0);

    const allEmpty = changedGroups.length === 0;

    const body = el('div', { class: 'abt-tab-body' });

    // Notification surfacing
    const note = ctx.notification;
    if (note && note.message && (note.type === 'error' || note.type === 'warning')) {
      body.appendChild(
        el('div', {
          class: 'abt-tab-notice',
          dataset: { type: note.type },
          text: note.message,
        })
      );
    }

    const groupsToShow = showAllRows ? diff.groups : changedGroups;

    if (groupsToShow.length === 0) {
      body.appendChild(
        el('div', {
          class: 'abt-tab-empty',
          text: allEmpty ? 'No category budgets changed.' : 'No categories to show.',
        })
      );
    } else {
      for (const g of groupsToShow) {
        const groupEl = el('div', { class: 'abt-tab-group' });
        groupEl.appendChild(el('div', { class: 'abt-tab-group-name', text: g.name }));
        const rows = showAllRows ? g.rows : g.rows.filter((r) => r.delta !== 0);
        for (const r of rows) {
          const sign = r.delta > 0 ? 'pos' : r.delta < 0 ? 'neg' : 'zero';
          groupEl.appendChild(
            el('div', {
              class: 'abt-tab-row',
              dataset: { changed: String(r.delta !== 0) },
            }, [
              el('span', { class: 'abt-tab-row-name', text: r.name }),
              el('span', {
                class: 'abt-tab-row-delta',
                dataset: { sign },
                text: r.delta === 0 ? fmtMoney(r.after) : fmtMoney(r.delta, { sign: true }),
              }),
            ])
          );
        }
        body.appendChild(groupEl);
      }
    }

    const footer = el('div', { class: 'abt-tab-footer' }, [
      el('span', { class: 'abt-tab-footer-label', text: 'Total allocated' }),
      el('span', {
        class: 'abt-tab-footer-value',
        text: fmtMoney(diff.totalAllocated, { sign: true }),
      }),
    ]);

    const toggleRow = el('div', {
      class: 'abt-tab-toggle',
      on: {
        click: () => {
          showAllRows = !showAllRows;
          renderPanel(diff, ctx);
        },
      },
      text: showAllRows ? 'Show only changed' : 'Show unchanged categories',
    });

    const closeBtn = el('button', {
      class: 'abt-tab-iconbtn',
      'aria-label': 'Dismiss',
      title: 'Dismiss',
      text: '×',
      on: { click: removePanel },
    });

    const collapseBtn = el('button', {
      class: 'abt-tab-iconbtn',
      'aria-label': panelState.collapsed ? 'Expand' : 'Collapse',
      title: panelState.collapsed ? 'Expand' : 'Collapse',
      text: panelState.collapsed ? '▾' : '▴',
    });

    const header = el('div', { class: 'abt-tab-header' }, [
      el('div', { class: 'abt-tab-title' }, [
        document.createTextNode(actionLabel(ctx.kind)),
        ctx.month ? el('span', { class: 'abt-tab-month', text: fmtMonth(ctx.month) }) : null,
      ]),
      collapseBtn,
      closeBtn,
    ]);

    const panel = el('div', { id: PANEL_ID, class: 'abt-tab-panel' }, [
      header,
      body,
      footer,
      toggleRow,
    ]);

    collapseBtn.addEventListener('click', () => {
      panelState.collapsed = !panelState.collapsed;
      if (panelState.collapsed) panel.setAttribute('data-collapsed', 'true');
      else panel.removeAttribute('data-collapsed');
      collapseBtn.textContent = panelState.collapsed ? '▾' : '▴';
      collapseBtn.setAttribute('aria-label', panelState.collapsed ? 'Expand' : 'Collapse');
      collapseBtn.title = panelState.collapsed ? 'Expand' : 'Collapse';
    });

    applyPanelPosition(panel);
    attachDrag(panel, header);
    document.body.appendChild(panel);
  }

  function renderLoading(kind, month) {
    removePanel();
    if (!isEnabled()) return;
    const closeBtn = el('button', {
      class: 'abt-tab-iconbtn',
      'aria-label': 'Dismiss',
      title: 'Dismiss',
      text: '×',
      on: { click: removePanel },
    });
    const header = el('div', { class: 'abt-tab-header' }, [
      el('div', { class: 'abt-tab-title' }, [
        document.createTextNode(actionLabel(kind)),
        month ? el('span', { class: 'abt-tab-month', text: fmtMonth(month) }) : null,
      ]),
      closeBtn,
    ]);
    const panel = el('div', { id: PANEL_ID, class: 'abt-tab-panel' }, [
      header,
      el('div', { class: 'abt-tab-loading' }, [
        el('span', { class: 'abt-tab-spinner' }),
        document.createTextNode('Computing breakdown…'),
      ]),
    ]);
    applyPanelPosition(panel);
    attachDrag(panel, header);
    document.body.appendChild(panel);
  }

  // ── Click interception ───────────────────────────────────────────────
  // Hook clicks on the menu-item buttons. Snapshot every visible month
  // before, wait for cell mutations to settle, snapshot again, and pick
  // the month whose budgets actually changed.
  let runSeq = 0;
  let clickListenerInstalled = false;

  function classifyTrigger(target) {
    if (!target) return null;
    const btn = target.closest && target.closest('button');
    if (!btn) return null;
    const text = (btn.textContent || '').trim().toLowerCase();
    if (!text) return null;
    if (TRIGGER_LABELS.has(text)) return TRIGGER_LABELS.get(text);
    return null;
  }

  async function handleTrigger(kind, beforeStarts) {
    const seq = ++runSeq;
    renderLoading(kind, null);
    let beforeMap;
    try {
      beforeMap = await finishSnapshots(beforeStarts);
    } catch (e) {
      console.warn('[ABT TAB] snapshot before failed', e);
      removePanel();
      return;
    }

    // Wait for cell mutations to settle before re-snapshotting.
    try {
      await waitForQuiescence();
    } catch (e) {
      // ignore
    }
    if (seq !== runSeq) return;

    let afterMap;
    try {
      afterMap = await finishSnapshots(startSnapshotAllVisible());
    } catch (e) {
      console.warn('[ABT TAB] snapshot after failed', e);
      removePanel();
      return;
    }
    if (seq !== runSeq) return;

    // Diff per sheet; pick the sheet with the largest absolute change.
    let bestDiff = null;
    let bestSheet = null;
    let bestScore = 0;
    const sheets = new Set([
      ...beforeMap.keys(),
      ...afterMap.keys(),
    ]);
    for (const sheet of sheets) {
      const before = beforeMap.get(sheet);
      const after = afterMap.get(sheet);
      if (!before || !after) continue;
      const d = diffSnapshots(before, after);
      const score = d.groups.reduce(
        (acc, g) => acc + g.rows.reduce((a, r) => a + Math.abs(r.delta), 0),
        0
      );
      if (score > bestScore) {
        bestScore = score;
        bestDiff = d;
        bestSheet = sheet;
      }
    }

    if (!bestDiff || bestScore === 0) {
      // Nothing changed — surface an empty-state panel using any sheet
      // (just for the month label).
      const fallbackSheet = afterMap.keys().next().value;
      const empty = bestDiff || {
        groups: [],
        totalAllocated: 0,
        availableBefore: 0,
        availableAfter: 0,
        toBudgetBefore: 0,
        toBudgetAfter: 0,
      };
      renderPanel(empty, {
        kind,
        month: sheetToMonthString(fallbackSheet),
        notification: null,
      });
      return;
    }

    renderPanel(bestDiff, {
      kind,
      month: sheetToMonthString(bestSheet),
      notification: null,
    });
  }

  function installClickListener() {
    if (clickListenerInstalled) return;
    clickListenerInstalled = true;
    document.addEventListener(
      'click',
      (ev) => {
        if (!isEnabled()) return;
        const kind = classifyTrigger(ev.target);
        if (!kind) return;
        if (!categoriesCache) return; // not yet ready
        // Capture phase fires before React's bubble-phase onClick. Start
        // get-cell postMessages NOW, synchronously, so the worker queues
        // them ahead of the impending apply-template message. The Promises
        // are awaited inside handleTrigger.
        const beforeStarts = startSnapshotAllVisible();
        handleTrigger(kind, beforeStarts);
      },
      true // capture
    );
  }

  // ── Toggle observation ───────────────────────────────────────────────
  function watchToggle() {
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'attributes' && m.attributeName === TOGGLE_ATTR) {
          if (!isEnabled()) removePanel();
        }
      }
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [TOGGLE_ATTR],
    });
  }

  // ── URL change → invalidate categories cache ─────────────────────────
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      invalidateCategoriesCache();
    }
  }, 1500);

  // ── Boot ─────────────────────────────────────────────────────────────
  (async function boot() {
    watchToggle();
    await waitForBackendReady();
    // Pre-load categories so the click handler can start get-cell calls
    // synchronously without an await delay (which would let React's
    // onClick post the apply-template message first and corrupt the
    // "before" snapshot).
    await loadCategories();
    installClickListener();
  })();
})();
