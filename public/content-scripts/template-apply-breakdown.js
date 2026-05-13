(function () {
  'use strict';

  const TOGGLE_ATTR = 'data-abt-tab';
  const PANEL_ID = 'abt-template-drawer';
  const TRIGGER_ID = 'abt-template-drawer-trigger';
  const LEGACY_PANEL_ID = 'abt-tab-panel';
  const STORAGE_KEY = 'abt-tab-data';
  const TAB_STORAGE_KEY = 'abt-tab-active';
  const DRAWER_STORAGE_KEY = 'abt-tab-drawer-open';
  const PRIO_COLLAPSE_STORAGE_KEY = 'abt-tab-prio-collapse';
  // Menu-item button labels we hook. The app's React layer calls the backend
  // via an internal `send()` (not window.$send), so wrapping window.$send
  // misses these — we hook the click instead.
  const TRIGGER_LABELS = new Map([
    ['apply budget template', 'apply'],
    ['apply budget templates', 'apply'],
    ['overwrite with budget template', 'overwrite'],
    ['overwrite with budget templates', 'overwrite'],
    ['apply template', 'apply-single'], // single-category context menu
    ['overwrite with template', 'apply-single'],
    ['overwrite with templates', 'apply-group'],
  ]);

  // Priority cache TTL. Goal/budget cells only change via apply/overwrite
  // (handled explicitly) or manual budget edits (which we can't easily
  // detect). 60s balances freshness against redundant recomputes.
  const PRIORITY_CACHE_MS = 60000;
  const REMAINDER_PRIORITY = null;
  const PRIORITY_MODE = 'overwrite';

  let currencyCode = 'USD';
  let currencyScale = 100;

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
  function configureCurrency(code) {
    if (!code || typeof code !== 'string') return;
    currencyCode = code;
    try {
      const opts = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
      }).resolvedOptions();
      const digits = Number.isFinite(opts.maximumFractionDigits)
        ? opts.maximumFractionDigits
        : 2;
      currencyScale = Math.pow(10, digits);
    } catch {
      currencyCode = 'USD';
      currencyScale = 100;
    }
  }

  async function loadCurrencyPreference() {
    try {
      const res = await window.$query(
        window.$q('preferences')
          .filter({ id: 'defaultCurrencyCode' })
          .select('*')
      );
      const row = res && res.data && res.data[0];
      configureCurrency(row && row.value);
    } catch {
      configureCurrency('USD');
    }
  }

  function fmtMoney(cents, opts) {
    const sign = opts && opts.sign;
    const n = (cents || 0) / currencyScale;
    const abs = Math.abs(n);
    const str = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: Math.round(currencyScale) === 1 ? 0 : undefined,
      maximumFractionDigits: Math.round(currencyScale) === 1 ? 0 : undefined,
    }).format(abs);
    if (sign && cents > 0) return '+' + str;
    if (n < 0) return '−' + str;
    return str;
  }

  // ── Storage ──────────────────────────────────────────────────────────
  function saveBreakdown(diff, ctx) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ diff, ctx })); } catch {}
  }

  function loadBreakdown() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function saveActiveTab() {
    try { localStorage.setItem(TAB_STORAGE_KEY, activeTab); } catch {}
  }

  function loadActiveTab() {
    try {
      const v = localStorage.getItem(TAB_STORAGE_KEY);
      if (v === 'breakdown' || v === 'priority') activeTab = v;
    } catch {}
  }

  function saveDrawerOpen() {
    try { localStorage.setItem(DRAWER_STORAGE_KEY, drawerOpen ? '1' : '0'); } catch {}
  }

  function loadDrawerOpen() {
    try {
      const v = localStorage.getItem(DRAWER_STORAGE_KEY);
      drawerOpen = v === '1';
    } catch {}
  }

  function priorityKey(priority) {
    return priority == null ? 'remainder' : String(priority);
  }

  function priorityLabel(priority) {
    return priority == null ? 'Remainder' : `Priority ${priority}`;
  }

  function comparePriority(a, b) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
  }

  // Per-priority explicit collapse overrides. Map<priority-key, collapsed:boolean>.
  // Absence = "use default" (full → collapsed, otherwise → expanded).
  function savePrioCollapse() {
    try {
      const obj = {};
      for (const [k, v] of prioCollapseOverrides.entries()) obj[k] = v;
      localStorage.setItem(PRIO_COLLAPSE_STORAGE_KEY, JSON.stringify(obj));
    } catch {}
  }

  function loadPrioCollapse() {
    try {
      const raw = localStorage.getItem(PRIO_COLLAPSE_STORAGE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      for (const k in obj) {
        if (typeof obj[k] === 'boolean') prioCollapseOverrides.set(String(k), obj[k]);
      }
    } catch {}
  }

  function isTierCollapsed(tier) {
    const override = prioCollapseOverrides.get(priorityKey(tier.priority));
    if (override != null) return override;
    return tier.status === 'full';
  }

  function toggleTierCollapsed(tier) {
    const next = !isTierCollapsed(tier);
    prioCollapseOverrides.set(priorityKey(tier.priority), next);
    savePrioCollapse();
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
  // { id, name, group_id, group_name, sort_order, group_sort_order, hidden, is_income }
  let categoriesCache = null;
  let categoriesPromise = null;

  async function loadCategories(force) {
    if (!force && categoriesCache) return categoriesCache;
    if (!force && categoriesPromise) return categoriesPromise;
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
            is_income: !!g.is_income,
            group_id: gid || '__none__',
            group_name: g.name || 'Uncategorized',
            group_sort_order: g.sort_order || 0,
          };
        }).filter((c) => !c.tombstone);
      } catch (e) {
        console.warn('[ABT TAB] categories query failed', e);
        if (!categoriesCache) categoriesCache = [];
      }
      return categoriesCache;
    })();
    return categoriesPromise;
  }

  function invalidateCategoriesCache() {
    categoriesPromise = null;
    loadCategories(true);
    // Note: deliberately does NOT invalidate priorityCache — category metadata
    // (names/groups) changing doesn't affect goal/budget cell values. Priority
    // cache is invalidated on apply/overwrite and by its TTL.
  }

  // ── Cell reads ───────────────────────────────────────────────────────
  async function getCells(sheet, names) {
    const results = await Promise.all(
      names.map((n) =>
        window.$send('get-cell', { sheetName: sheet, name: n }).catch(() => null)
      )
    );
    const map = new Map();
    names.forEach((n, i) => {
      const r = results[i];
      map.set(n, r && typeof r.value === 'number' ? r.value : 0);
    });
    return map;
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

  function sheetToMonthKey(sheet) {
    const m = sheet && sheet.match(/^budget(\d{4})(\d{2})/);
    return m ? `${m[1]}-${m[2]}` : null;
  }

  function sheetToMonthLabel(sheet) {
    const key = sheetToMonthKey(sheet);
    return formatMonthLabel(key);
  }

  function formatMonthLabel(value) {
    if (!value) return null;
    const key = String(value);
    const m = key.match(/^(\d{4})-(\d{2})$/);
    if (!m) return key;
    const month = Number(m[2]);
    if (month < 1 || month > 12) return key;
    const date = new Date(Number(m[1]), month - 1, 1);
    return new Intl.DateTimeFormat(undefined, {
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  function activeMonthLabel() {
    return sheetToMonthLabel(getCurrentSheet());
  }

  function monthLabelForHeader(value) {
    return formatMonthLabel(value) || activeMonthLabel();
  }

  function priorityCacheIsFreshForSheet(sheet) {
    return sheet && priorityCache && priorityCache.sheet === sheet &&
      Date.now() - priorityCache.computedAt < PRIORITY_CACHE_MS;
  }

  function priorityCacheMatchesSheet(sheet) {
    return sheet && priorityCache && priorityCache.sheet === sheet;
  }

  function invalidatePriorityStatus() {
    priorityCache = null;
    priorityPromise = null;
  }

  function setActiveSheet(sheet) {
    if (sheet === lastSheet) return false;
    lastSheet = sheet;
    invalidatePriorityStatus();
    return true;
  }

  function getCurrentSheet() {
    // Prefer a sheet whose URL/focus matches, fall back to first visible.
    return getVisibleSheets()[0] || null;
  }

  // True when the user is on Actual's Budget page. On other pages (reports,
  // schedules, accounts, …) the budget cells aren't relevant and the priority
  // status should auto-collapse.
  function isBudgetPage() {
    return location.pathname === '/budget';
  }

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
      arm();
    });
  }

  // ── Diff ─────────────────────────────────────────────────────────────
  function diffSnapshots(before, after) {
    const cats = categoriesCache || [];
    const groups = new Map();
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

  // ── Template parser ──────────────────────────────────────────────────
  function parseAmountToken(text) {
    const s = (text || '').trim();
    const m = s.match(/^(?:\p{Sc}\s*)?(-?\d+(?:\.\d{1,2})?)(?=\s|$)(.*)$/u);
    if (!m) return null;
    return { amount: parseFloat(m[1]), rest: (m[2] || '').trim() };
  }

  function parseLimit(text) {
    const parsed = parseAmountToken((text || '').replace(/^up\s+to\b/i, '').trim());
    if (!parsed) return null;
    let tail = parsed.rest;
    const hold = /\bhold\b/i.test(tail);
    tail = tail.replace(/\bhold\b/ig, '').trim();

    let period = 'monthly';
    let start = null;
    if (tail) {
      const weekly = tail.match(/^per\s+week\s+starting\s+(\d{4}-\d{2}-\d{2})$/i);
      const daily = tail.match(/^per\s+day$/i);
      if (weekly) {
        period = 'weekly';
        start = weekly[1];
      } else if (daily) {
        period = 'daily';
      } else {
        return null;
      }
    }

    return {
      amount: parsed.amount,
      hold,
      period,
      ...(start ? { start } : {}),
    };
  }

  function parseAdjustment(text) {
    if (!text) return null;
    const m = text.match(/^\[\s*(increase|decrease)\s+(\d+(?:\.\d+)?)(%)?\s*\]$/i);
    if (!m) return null;
    const sign = m[1].toLowerCase() === 'increase' ? 1 : -1;
    return {
      adjustment: sign * parseFloat(m[2]),
      adjustmentType: m[3] ? 'percent' : 'fixed',
    };
  }

  function parseRepeat(text) {
    const s = (text || '').trim().toLowerCase();
    if (s === 'month') return { annual: false };
    if (s === 'year') return { annual: true };
    let m = s.match(/^(\d+)\s+months?$/);
    if (m) return { annual: false, repeat: parseInt(m[1], 10) };
    m = s.match(/^(\d+)\s+years?$/);
    if (m) return { annual: true, repeat: parseInt(m[1], 10) };
    return null;
  }

  function parsePeriodCount(text) {
    const s = (text || '').trim().toLowerCase();
    if (s === 'day') return { period: 'day', amount: 1 };
    if (s === 'week') return { period: 'week', amount: 1 };
    if (s === 'month') return { period: 'month', amount: 1 };
    if (s === 'year') return { period: 'year', amount: 1 };
    const m = s.match(/^(\d+)\s+(days?|weeks?|months?|years?)$/);
    if (!m) return null;
    const unit = m[2].replace(/s$/, '');
    return { period: unit, amount: parseInt(m[1], 10) };
  }

  function makeTemplateLine(kind, priority, raw, engineTemplate, extra) {
    return Object.assign({
      kind,
      priority,
      raw,
      engineTemplate: engineTemplate || null,
    }, extra || {});
  }

  // Parse a single note line. Returns null for non-template lines.
  // Mirrors Actual's notes parser by considering text after the first '#'.
  function parseTemplateLine(rawLine) {
    const raw = rawLine || '';
    const hashIndex = raw.indexOf('#');
    if (hashIndex < 0) return null;
    const line = raw.slice(hashIndex).trim();
    if (!line) return null;

    // #goal N — indicator only (no budgeting)
    const gm = line.match(/^#goal\b\s*(-?\d+(?:\.\d{1,2})?)?\s*$/i);
    if (gm) {
      const amount = gm[1] ? parseFloat(gm[1]) : null;
      return makeTemplateLine(
        'goal',
        REMAINDER_PRIORITY,
        line,
        amount == null ? null : { type: 'goal', directive: 'goal', amount },
        { amount }
      );
    }

    const prefix = line.match(/^#template\b/i);
    if (!prefix) return null;
    let rest = line.slice(prefix[0].length).trim();
    let priority = 0;
    const prioMatch = rest.match(/^-(\d+)\b\s*/);
    if (prioMatch) {
      priority = parseInt(prioMatch[1], 10);
      rest = rest.slice(prioMatch[0].length).trim();
    }
    const base = { directive: 'template', priority };
    if (!rest) return makeTemplateLine('unknown', priority, line, null);

    // schedule [full] NAME [adjustments]
    const sm = rest.match(/^schedule\s+(?:(full)\s+)?(.+?)(?:\s+(\[(?:increase|decrease)\s+\d+(?:\.\d+)?%?\]))?\s*$/i);
    if (sm) {
      const adjust = parseAdjustment(sm[3]);
      const engineTemplate = Object.assign({
        type: 'schedule',
        name: sm[2].trim(),
        full: !!sm[1],
      }, base, adjust || {});
      return makeTemplateLine('schedule', priority, line, engineTemplate, {
        full: !!sm[1],
        name: sm[2].trim(),
        adjust: sm[3] ? sm[3].trim() : null,
      });
    }

    // remainder always runs after normal priority passes in Actual.
    if (/^remainder\b/i.test(rest)) {
      const rem = rest.replace(/^remainder\b/i, '').trim();
      const weightMatch = rem.match(/^(\d+)?\s*(.*)$/);
      const weight = weightMatch && weightMatch[1] ? parseInt(weightMatch[1], 10) : 1;
      const limitText = weightMatch ? (weightMatch[2] || '').trim() : '';
      const limit = limitText ? parseLimit(limitText) : null;
      if (limitText && !limit) {
        return makeTemplateLine('unknown', REMAINDER_PRIORITY, line, null);
      }
      return makeTemplateLine(
        'remainder',
        REMAINDER_PRIORITY,
        line,
        Object.assign({
          type: 'remainder',
          directive: 'template',
          priority: null,
          weight,
        }, limit ? { limit } : {}),
        { weight, limit }
      );
    }

    // up to N [per day/week] [hold] — pure cap/refill template.
    if (/^up to\b/i.test(rest)) {
      const limit = parseLimit(rest);
      if (!limit) return makeTemplateLine('unknown', priority, line, null);
      return makeTemplateLine(
        'upto',
        priority,
        line,
        { type: 'simple', monthly: null, limit, ...base },
        { cap: limit.amount, hold: limit.hold, per: limit.period }
      );
    }

    const avg = rest.match(/^average\s+(\d+)\s+months?\s*(\[(?:increase|decrease)\s+\d+(?:\.\d+)?%?\])?\s*$/i);
    if (avg) {
      const adjust = parseAdjustment(avg[2]);
      return makeTemplateLine(
        'average',
        priority,
        line,
        Object.assign({ type: 'average', numMonths: parseInt(avg[1], 10) }, base, adjust || {})
      );
    }
    const copy = rest.match(/^copy\s+from\s+(\d+)\s+months\s+ago(?:\s+(up\s+to\b.*))?\s*$/i);
    if (copy) {
      const limit = copy[2] ? parseLimit(copy[2]) : null;
      if (copy[2] && !limit) return makeTemplateLine('unknown', priority, line, null);
      return makeTemplateLine(
        'copy',
        priority,
        line,
        Object.assign({ type: 'copy', lookBack: parseInt(copy[1], 10) }, base, limit ? { limit } : {})
      );
    }

    // N% of X  or  N% of previous X
    const pm = rest.match(/^([\d.]+)%\s+of\s+(previous\s+)?(.+?)\s*$/i);
    if (pm) {
      return makeTemplateLine('percentage', priority, line, {
        type: 'percentage',
        percent: parseFloat(pm[1]),
        previous: !!pm[2],
        category: pm[3].trim(),
        ...base,
      }, {
        percent: parseFloat(pm[1]),
        previous: !!pm[2],
        source: pm[3].trim(),
      });
    }

    // N ... (simple, simple+cap, by-date, periodic)
    const amountParsed = parseAmountToken(rest);
    if (amountParsed) {
      const amount = amountParsed.amount;
      const modifier = amountParsed.rest;
      if (!modifier) {
        return makeTemplateLine(
          'simple',
          priority,
          line,
          { type: 'simple', monthly: amount, ...base },
          { amount }
        );
      }

      if (/^up to\b/i.test(modifier)) {
        const limit = parseLimit(modifier);
        if (!limit) return makeTemplateLine('unknown', priority, line, null);
        return makeTemplateLine(
          'simple',
          priority,
          line,
          { type: 'simple', monthly: amount, limit, ...base },
          { amount, cap: limit.amount }
        );
      }

      const periodic = modifier.match(/^repeat\s+every\s+(.+?)\s+starting\s+(\d{4}-\d{2}-\d{2})(?:\s+(up\s+to\b.*))?\s*$/i);
      if (periodic) {
        const period = parsePeriodCount(periodic[1]);
        const limit = periodic[3] ? parseLimit(periodic[3]) : null;
        if (!period || (periodic[3] && !limit)) return makeTemplateLine('unknown', priority, line, null);
        return makeTemplateLine(
          'periodic',
          priority,
          line,
          Object.assign({
            type: 'periodic',
            amount,
            period,
            starting: periodic[2],
          }, base, limit ? { limit } : {}),
          { amount }
        );
      }

      const by = modifier.match(/^by\s+(\d{4}-\d{2})(?:\s+spend\s+from\s+(\d{4}-\d{2}))?(?:\s+repeat\s+every\s+(.+))?\s*$/i);
      if (by) {
        const repeat = by[3] ? parseRepeat(by[3]) : null;
        if (by[3] && !repeat) return makeTemplateLine('unknown', priority, line, null);
        const type = by[2] ? 'spend' : 'by';
        return makeTemplateLine(
          type,
          priority,
          line,
          Object.assign({
            type,
            amount,
            month: by[1],
          }, base, by[2] ? { from: by[2] } : {}, repeat || {}),
          { amount, targetMonth: by[1], repeat }
        );
      }

      return makeTemplateLine('unknown', priority, line, null);
    }

    return makeTemplateLine('unknown', priority, line, null);
  }

  function parseNoteTemplates(note) {
    if (!note) return [];
    const out = [];
    for (const line of note.split(/\r?\n/)) {
      const t = parseTemplateLine(line);
      if (t) out.push(t);
    }
    return out;
  }

  // ── Loader for notes + schedules ─────────────────────────────────────
  async function loadTemplatesByCategoryId() {
    const byCat = new Map();
    try {
      const res = await window.$query(window.$q('notes').select('*'));
      const notes = (res && res.data) || [];
      const catIds = new Set((categoriesCache || []).map((c) => c.id));
      for (const n of notes) {
        if (!n.note) continue;
        if (catIds.size && !catIds.has(n.id)) continue;
        const tpls = parseNoteTemplates(n.note);
        const budgetTpls = tpls.filter((t) => t.kind !== 'goal');
        if (budgetTpls.length) byCat.set(n.id, budgetTpls);
      }
    } catch (e) {
      console.warn('[ABT TAB] notes query failed', e);
    }
    return byCat;
  }

  function isBudgetTemplate(t) {
    return t && t.kind !== 'goal';
  }

  function isRemainderTemplate(t) {
    return t && t.kind === 'remainder';
  }

  function rowSort(a, b) {
    return (a.groupSortOrder - b.groupSortOrder) ||
      a.groupName.localeCompare(b.groupName) ||
      (a.sortOrder - b.sortOrder) ||
      a.catName.localeCompare(b.catName);
  }

  function statusFor(requestedCents, allocatedCents) {
    if (requestedCents == null) return allocatedCents > 0 ? 'partial' : 'none';
    if (requestedCents <= 0) return 'full';
    if (allocatedCents >= requestedCents) return 'full';
    if (allocatedCents > 0) return 'partial';
    return 'none';
  }

  function addDemandRow(rowMap, row) {
    const key = `${priorityKey(row.priority)}:${row.catId}`;
    const existing = rowMap.get(key);
    if (existing) {
      existing.requestedCents += row.requestedCents;
      existing.templateCount += row.templateCount || 1;
      existing.rawTemplates.push(...(row.rawTemplates || []));
      existing.priorities = Array.from(new Set([
        ...existing.priorities,
        ...(row.priorities || [row.priority]),
      ])).sort(comparePriority);
      return existing;
    }
    row.rawTemplates = row.rawTemplates || [];
    row.priorities = row.priorities || [row.priority];
    row.templateCount = row.templateCount || 1;
    rowMap.set(key, row);
    return row;
  }

  function amountToCents(amount) {
    if (!Number.isFinite(amount)) return 0;
    return Math.max(0, Math.round(amount * currencyScale));
  }

  function parsedTemplateDemandCents(entry) {
    if (!entry) return null;
    if (entry.kind === 'simple' && Number.isFinite(entry.amount)) {
      return amountToCents(entry.amount);
    }
    return null;
  }

  function breakdownTemplateDemandCents(entry, runningBudgetCents, dryRunCents) {
    if (!entry) return null;
    if (Number.isFinite(dryRunCents) && dryRunCents > 0) {
      return Math.max(0, Math.round(dryRunCents));
    }
    if (entry.kind === 'upto' && Number.isFinite(entry.cap)) {
      return Math.max(0, amountToCents(entry.cap) - runningBudgetCents);
    }
    if (entry.kind === 'simple' && Number.isFinite(entry.amount)) {
      const amountCents = amountToCents(entry.amount);
      if (Number.isFinite(entry.cap)) {
        return Math.min(
          amountCents,
          Math.max(0, amountToCents(entry.cap) - runningBudgetCents)
        );
      }
      return amountCents;
    }
    if ((entry.kind === 'periodic' || entry.kind === 'by' || entry.kind === 'spend') &&
        Number.isFinite(entry.amount)) {
      return amountToCents(entry.amount);
    }
    return null;
  }

  function capDemandRowsToGoal(rows, goalCents) {
    if (!goalCents || goalCents <= 0) return rows;
    const targetCents = Math.max(0, Math.round(goalCents));
    const knownTotal = rows.reduce((sum, row) => {
      return row.requestedCents == null ? sum : sum + Math.max(0, row.requestedCents);
    }, 0);
    const unknownRows = rows.filter((row) => row.requestedCents == null);
    if (unknownRows.length > 0 && knownTotal < targetCents) {
      const unknownTarget = targetCents - knownTotal;
      let remainingUnknownTarget = unknownTarget;
      let unknownIndex = 0;
      const withResiduals = [];
      for (const row of rows) {
        if (row.requestedCents == null) {
          const isLastUnknown = unknownIndex === unknownRows.length - 1;
          const requested = isLastUnknown
            ? remainingUnknownTarget
            : Math.round(unknownTarget / unknownRows.length);
          const capped = Math.min(requested, remainingUnknownTarget);
          unknownIndex += 1;
          remainingUnknownTarget -= capped;
          if (capped > 0) {
            withResiduals.push(Object.assign({}, row, { requestedCents: capped }));
          }
          continue;
        }
        if (row.requestedCents > 0) withResiduals.push(row);
      }
      return withResiduals;
    }

    let remainingGoal = targetCents;
    const capped = [];
    for (const row of rows) {
      if (remainingGoal <= 0) break;
      if (row.requestedCents == null) continue;
      const requested = Math.min(row.requestedCents, remainingGoal);
      if (requested <= 0) continue;
      capped.push(Object.assign({}, row, { requestedCents: requested }));
      remainingGoal -= requested;
    }
    return capped;
  }

  function addBreakdownPriorityTier(tierMap, item) {
    const key = priorityKey(item.priority);
    if (!tierMap.has(key)) {
      tierMap.set(key, {
        priority: item.priority,
        requestedCents: 0,
        hasUnknownDemand: false,
        allocatedCents: 0,
        rows: [],
      });
    }
    const tier = tierMap.get(key);
    tier.allocatedCents += item.allocatedCents;
    if (item.requestedCents == null) tier.hasUnknownDemand = true;
    else tier.requestedCents += item.requestedCents;
    tier.rows.push(item);
  }

  async function buildBreakdownPrioritySummary(sheet, diff) {
    if (!sheet || !diff) return null;
    const monthKey = sheetToMonthKey(sheet);
    const positiveRows = [];
    for (const group of diff.groups || []) {
      for (const row of group.rows || []) {
        if (row.delta > 0) positiveRows.push(row);
      }
    }
    if (positiveRows.length === 0) return null;

    let templatesByCat;
    try {
      templatesByCat = await loadTemplatesByCategoryId();
    } catch {
      return null;
    }

    const tierMap = new Map();
    let mappedCents = 0;
    const categories = await loadCategories();
    const catMap = new Map(categories.map((cat) => [cat.id, cat]));
    const goalCells = await getCells(sheet, positiveRows.map((row) => 'goal-' + row.id));

    await mapWithConcurrency(positiveRows, 6, async (row) => {
      const templates = (templatesByCat.get(row.id) || []).filter(isBudgetTemplate);
      if (templates.length === 0) return;

      const regularTemplates = templates.filter((t) => !isRemainderTemplate(t));
      const remainderTemplates = templates.filter(isRemainderTemplate);
      const monthGoalCents = goalCells.get('goal-' + row.id) || 0;
      const cat = catMap.get(row.id) || {
        id: row.id,
        name: row.name,
        group_name: '',
        sort_order: 0,
        group_sort_order: 0,
      };
      let dryAmounts = new Map();
      const dry = await dryRunCategory(monthKey, row.id, templates);
      if (dry) {
        dry.engineEntries.forEach((entry, index) => {
          dryAmounts.set(entry, Math.max(0, dry.result.perTemplate[index] || 0));
        });
      }

      let lineItems = regularTemplates
        .map((entry, index) => ({
          entry,
          index,
          priority: entry.priority,
          requestedCents: breakdownTemplateDemandCents(
            entry,
            Math.max(0, row.before || 0),
            dryAmounts.get(entry)
          ),
        }))
        .sort((a, b) => comparePriority(a.priority, b.priority) || (a.index - b.index));

      if (!dry) {
        const fallbackRows = new Map();
        const priorities = Array.from(new Set(
          regularTemplates.map((t) => t.priority).filter((p) => p != null)
        )).sort(comparePriority);
        addFallbackDemandRows(
          fallbackRows,
          cat,
          templates,
          monthGoalCents,
          Math.max(0, row.before || 0),
          priorities
        );
        lineItems = [...fallbackRows.values()]
          .map((fallback, index) => ({
            entry: null,
            index,
            priority: fallback.priority,
            requestedCents: fallback.requestedCents,
          }))
          .sort((a, b) => comparePriority(a.priority, b.priority) || (a.index - b.index));
      }

      lineItems = capDemandRowsToGoal(lineItems, monthGoalCents);

      let remainingDelta = row.delta;
      let alreadyFundedCents = Math.max(0, row.before || 0);
      for (const item of lineItems) {
        if (remainingDelta <= 0) break;
        let requested = item.requestedCents;
        if (requested != null) {
          const fundedBefore = Math.min(alreadyFundedCents, requested);
          alreadyFundedCents -= fundedBefore;
          requested = Math.max(0, requested - fundedBefore);
        }
        if (requested === 0) continue;
        const allocated = requested == null
          ? remainingDelta
          : Math.min(requested, remainingDelta);
        if (allocated <= 0) continue;
        remainingDelta -= allocated;
        mappedCents += allocated;
        addBreakdownPriorityTier(tierMap, {
          priority: item.priority,
          catId: row.id,
          catName: row.name,
          requestedCents: requested,
          allocatedCents: allocated,
          status: statusFor(requested, allocated),
        });
      }

      if (remainingDelta > 0 && remainderTemplates.length > 0) {
        mappedCents += remainingDelta;
        addBreakdownPriorityTier(tierMap, {
          priority: REMAINDER_PRIORITY,
          catId: row.id,
          catName: row.name,
          requestedCents: null,
          allocatedCents: remainingDelta,
          status: 'partial',
        });
      }
    });

    const tiers = [...tierMap.values()]
      .filter((tier) => tier.allocatedCents > 0)
      .sort((a, b) => comparePriority(a.priority, b.priority));
    for (const tier of tiers) {
      tier.rows.sort((a, b) => a.catName.localeCompare(b.catName));
      tier.status = tier.hasUnknownDemand
        ? 'partial'
        : statusFor(tier.requestedCents, tier.allocatedCents);
    }

    if (tiers.length === 0) return null;
    return {
      sheet,
      month: sheetToMonthLabel(sheet),
      totalAllocatedCents: mappedCents,
      tiers,
    };
  }

  function addFallbackDemandRow(rowMap, cat, entry, requestedCents, currentCents, priorities, source) {
    if (requestedCents <= 0) return;
    addDemandRow(rowMap, {
      catId: cat.id,
      catName: cat.name,
      groupName: cat.group_name,
      sortOrder: cat.sort_order,
      groupSortOrder: cat.group_sort_order,
      priority: entry.priority,
      requestedCents,
      allocatedCents: 0,
      currentCents,
      gapCents: 0,
      priorities,
      templateCount: 1,
      rawTemplates: [entry.raw],
      source,
    });
  }

  function addFallbackDemandRows(rowMap, cat, templates, goalCents, currentCents, priorities) {
    const regular = templates
      .filter((t) => !isRemainderTemplate(t))
      .map((entry, index) => ({
        entry,
        index,
        estimateCents: parsedTemplateDemandCents(entry),
      }))
      .sort((a, b) =>
        comparePriority(a.entry.priority, b.entry.priority) || (a.index - b.index)
      );
    if (regular.length === 0) return;

    const targetCents = Math.max(0, goalCents || 0);
    let remainingTarget = targetCents;
    let knownTotalCents = 0;
    let lastKnown = null;
    const unknown = [];

    for (const item of regular) {
      const estimateCents = item.estimateCents;
      if (estimateCents == null || estimateCents <= 0) {
        unknown.push(item);
        continue;
      }

      const requestedCents = targetCents > 0
        ? Math.min(estimateCents, remainingTarget)
        : estimateCents;
      addFallbackDemandRow(
        rowMap,
        cat,
        item.entry,
        requestedCents,
        currentCents,
        priorities,
        'parsed-amount'
      );
      knownTotalCents += requestedCents;
      remainingTarget = Math.max(0, remainingTarget - requestedCents);
      lastKnown = item;
    }

    if (targetCents <= 0) return;

    const residualCents = Math.max(0, targetCents - knownTotalCents);
    if (residualCents <= 0) return;

    if (unknown.length > 0) {
      let remainingResidual = residualCents;
      for (let i = 0; i < unknown.length; i++) {
        const isLast = i === unknown.length - 1;
        const requestedCents = isLast
          ? remainingResidual
          : Math.round(residualCents / unknown.length);
        addFallbackDemandRow(
          rowMap,
          cat,
          unknown[i].entry,
          Math.min(requestedCents, remainingResidual),
          currentCents,
          priorities,
          'goal-residual'
        );
        remainingResidual -= requestedCents;
      }
      return;
    }

    if (lastKnown) {
      addFallbackDemandRow(
        rowMap,
        cat,
        lastKnown.entry,
        residualCents,
        currentCents,
        priorities,
        'goal-residual'
      );
      return;
    }

    addFallbackDemandRow(
      rowMap,
      cat,
      regular[0].entry,
      targetCents,
      currentCents,
      priorities,
      'goal-cell'
    );
  }

  async function dryRunCategory(month, catId, entries) {
    const engineEntries = entries.filter((t) => t.engineTemplate);
    if (engineEntries.length === 0) return null;
    try {
      const result = await window.$send('budget/dry-run-category-template', {
        month,
        categoryId: catId,
        templates: engineEntries.map((t) => t.engineTemplate),
      });
      if (!result || !Array.isArray(result.perTemplate)) return null;
      return { result, engineEntries };
    } catch {
      return null;
    }
  }

  async function mapWithConcurrency(items, limit, fn) {
    let index = 0;
    const workerCount = Math.min(limit, items.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (index < items.length) {
        const item = items[index++];
        await fn(item);
      }
    });
    await Promise.all(workers);
  }

  function allocateRemainderRows(remainderRows, startingFunds) {
    let funds = Math.max(0, startingFunds);
    const active = remainderRows.map((row) => ({
      row,
      weight: row.remainderWeight || 1,
      cap: row.remainderCapCents,
      allocated: 0,
    }));

    while (funds > 0 && active.length > 0) {
      const available = active.filter((item) =>
        item.cap == null || item.allocated < item.cap
      );
      if (available.length === 0) break;
      const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight <= 0) break;
      const before = funds;
      for (let i = 0; i < available.length && funds > 0; i++) {
        const item = available[i];
        const isLast = i === available.length - 1;
        let share = isLast
          ? funds
          : Math.round((before * item.weight) / totalWeight);
        if (item.cap != null) {
          share = Math.min(share, Math.max(0, item.cap - item.allocated));
        }
        share = Math.max(0, Math.min(share, funds));
        item.allocated += share;
        item.row.allocatedCents += share;
        item.row.requestedCents += share;
        funds -= share;
      }
      if (funds === before) break;
    }

    return funds;
  }

  // ── Priority computation ─────────────────────────────────────────────
  // Builds an overwrite-style plan: start with To Budget plus the current
  // budgets for templated categories, then run requested template demand by
  // priority. Actual's category dry-run endpoint supplies per-template demand
  // where available; older Actual builds fall back to goal-cell rollups.
  //
  // Tier shape:
  //   { priority, requestedCents, allocatedCents, gapCents,
  //     status: 'full'|'partial'|'none', rows: [...] }
  // Row shape:
  //   { catId, catName, groupName, sortOrder, groupSortOrder,
  //     requestedCents, allocatedCents, gapCents, priorities: number[] }
  let priorityCache = null;
  let priorityPromise = null;
  let priorityPromiseSheet = null;
  let priorityLoading = false;

  async function computePriorityStatus(force) {
    const sheet = isBudgetPage() ? getCurrentSheet() : null;
    if (!force && priorityCacheIsFreshForSheet(sheet)) {
      return priorityCache;
    }
    if (!force && priorityPromise && priorityPromiseSheet === sheet) return priorityPromise;
    priorityPromiseSheet = sheet;
    priorityPromise = (async () => {
      try {
        if (!isBudgetPage()) {
          return { ok: false, reason: 'not on budget page', computedAt: Date.now() };
        }
        if (!sheet) {
          return { ok: false, reason: 'no visible sheet', computedAt: Date.now() };
        }
        await loadCategories();
        const cats = categoriesCache || [];
        const templatesByCat = await loadTemplatesByCategoryId();

        const catById = new Map(cats.map((c) => [c.id, c]));
        const eligibleCats = [];
        for (const [catId, tpls] of templatesByCat.entries()) {
          const cat = catById.get(catId);
          if (!cat || cat.hidden) continue;
          const budgetTpls = tpls.filter(isBudgetTemplate);
          if (budgetTpls.length === 0) continue;
          eligibleCats.push({ cat, templates: budgetTpls });
        }

        // Batch-read funds + goal/budget for every templated cat. To Budget is
        // what Actual's template engine starts from; available-funds is kept
        // only as context for the summary.
        const cellNames = ['available-funds', 'to-budget'];
        for (const { cat } of eligibleCats) {
          cellNames.push('goal-' + cat.id);
          cellNames.push('budget-' + cat.id);
        }
        const cellMap = await getCells(sheet, cellNames);
        const availableCents = cellMap.get('available-funds') || 0;
        const toBudgetCents = cellMap.get('to-budget') || 0;

        const rowMap = new Map();
        const remainderMap = new Map();
        let currentTemplateBudgetCents = 0;
        let usedDryRun = false;
        let fallbackCount = 0;

        await mapWithConcurrency(eligibleCats, 8, async ({ cat, templates }) => {
          const catId = cat.id;
          const currentCents = cellMap.get('budget-' + catId) || 0;
          const goalCents = cellMap.get('goal-' + catId) || 0;
          currentTemplateBudgetCents += currentCents;
          const priorities = Array.from(
            new Set(
              templates
                .filter((t) => !isRemainderTemplate(t))
                .map((t) => t.priority)
            )
          ).sort(comparePriority);

          const dry = await dryRunCategory(sheetToMonthKey(sheet), catId, templates);
          if (dry) {
            usedDryRun = true;
            const dryDemandRows = [];
            dry.engineEntries.forEach((entry, i) => {
              const amount = Math.max(0, dry.result.perTemplate[i] || 0);
              if (isRemainderTemplate(entry)) {
                const key = `${catId}:remainder`;
                const existing = remainderMap.get(key);
                const cap = amount > 0 ? amount : null;
                if (existing) {
                  existing.remainderWeight += entry.weight || 1;
                  if (cap != null) {
                    existing.remainderCapCents = existing.remainderCapCents == null
                      ? cap
                      : existing.remainderCapCents + cap;
                  }
                  existing.rawTemplates.push(entry.raw);
                  existing.templateCount += 1;
                } else {
                  remainderMap.set(key, {
                    catId,
                    catName: cat.name,
                    groupName: cat.group_name,
                    sortOrder: cat.sort_order,
                    groupSortOrder: cat.group_sort_order,
                    priority: REMAINDER_PRIORITY,
                    requestedCents: 0,
                    allocatedCents: 0,
                    currentCents,
                    gapCents: 0,
                    priorities: [REMAINDER_PRIORITY],
                    templateCount: 1,
                    rawTemplates: [entry.raw],
                    remainderWeight: entry.weight || 1,
                    remainderCapCents: cap,
                    source: 'dry-run',
                  });
                }
                return;
              }
              if (amount <= 0) return;
              dryDemandRows.push({
                entry,
                index: i,
                priority: entry.priority,
                requestedCents: amount,
              });
            });

            const cappedDemandRows = capDemandRowsToGoal(
              dryDemandRows.sort((a, b) =>
                comparePriority(a.priority, b.priority) || (a.index - b.index)
              ),
              goalCents
            );
            for (const demand of cappedDemandRows) {
              addDemandRow(rowMap, {
                catId,
                catName: cat.name,
                groupName: cat.group_name,
                sortOrder: cat.sort_order,
                groupSortOrder: cat.group_sort_order,
                priority: demand.priority,
                requestedCents: demand.requestedCents,
                allocatedCents: 0,
                currentCents,
                gapCents: 0,
                priorities,
                templateCount: 1,
                rawTemplates: [demand.entry.raw],
                source: 'dry-run',
              });
            }
            return;
          }

          fallbackCount += 1;
          addFallbackDemandRows(rowMap, cat, templates, goalCents, currentCents, priorities);
          for (const entry of templates.filter(isRemainderTemplate)) {
            remainderMap.set(`${catId}:remainder`, {
              catId,
              catName: cat.name,
              groupName: cat.group_name,
              sortOrder: cat.sort_order,
              groupSortOrder: cat.group_sort_order,
              priority: REMAINDER_PRIORITY,
              requestedCents: 0,
              allocatedCents: 0,
              currentCents,
              gapCents: 0,
              priorities: [REMAINDER_PRIORITY],
              templateCount: 1,
              rawTemplates: [entry.raw],
              remainderWeight: entry.weight || 1,
              remainderCapCents: null,
              source: 'parsed',
            });
          }
        });

        const regularRows = [...rowMap.values()].sort((a, b) =>
          comparePriority(a.priority, b.priority) || rowSort(a, b)
        );

        let budgetableCents = toBudgetCents;
        if (PRIORITY_MODE === 'overwrite') {
          budgetableCents += currentTemplateBudgetCents;
        }

        let remainingCents = budgetableCents;
        for (const row of regularRows) {
          if (row.priority === 0) {
            row.allocatedCents = row.requestedCents;
          } else {
            row.allocatedCents = Math.max(
              0,
              Math.min(row.requestedCents, remainingCents)
            );
          }
          row.gapCents = Math.max(0, row.requestedCents - row.allocatedCents);
          remainingCents -= row.allocatedCents;
        }

        const remainderRows = [...remainderMap.values()].sort(rowSort);
        remainingCents = allocateRemainderRows(remainderRows, remainingCents);

        const tierMap = new Map();
        for (const row of [...regularRows, ...remainderRows]) {
          const key = priorityKey(row.priority);
          if (!tierMap.has(key)) {
            tierMap.set(key, {
              priority: row.priority,
              requestedCents: 0,
              allocatedCents: 0,
              gapCents: 0,
              rows: [],
            });
          }
          const tier = tierMap.get(key);
          tier.rows.push(row);
          tier.requestedCents += row.requestedCents;
          tier.allocatedCents += row.allocatedCents;
          tier.gapCents += row.gapCents;
        }

        const sortedTiers = [...tierMap.values()].sort((a, b) =>
          comparePriority(a.priority, b.priority)
        );
        for (const tier of sortedTiers) {
          tier.status = statusFor(tier.requestedCents, tier.allocatedCents);
          tier.rows.sort(rowSort);
        }

        const watermarkTier = sortedTiers.find((t) => t.gapCents > 0);
        const highestFunded = [...sortedTiers]
          .reverse()
          .find((t) => t.status === 'full' && t.requestedCents > 0 && t.priority != null);

        const totalRequestedCents = sortedTiers.reduce((a, t) => a + t.requestedCents, 0);
        const totalAllocatedCents = sortedTiers.reduce(
          (a, t) => a + t.allocatedCents,
          0
        );
        const totalGapCents = sortedTiers.reduce((a, t) => a + t.gapCents, 0);

        if (getCurrentSheet() !== sheet) {
          return { ok: false, reason: 'month changed', sheet, computedAt: Date.now() };
        }

        priorityCache = {
          ok: true,
          sheet,
          month: sheetToMonthLabel(sheet),
          availableCents,
          toBudgetCents,
          budgetableCents,
          currentTemplateBudgetCents,
          tiers: sortedTiers,
          totalRequestedCents,
          totalAllocatedCents,
          gapCents: totalGapCents,
          remainingCents,
          mode: PRIORITY_MODE,
          usedDryRun,
          fallbackCount,
          watermark: watermarkTier ? watermarkTier.priority : undefined,
          highestFundedPriority: highestFunded ? highestFunded.priority : null,
          computedAt: Date.now(),
        };
        return priorityCache;
      } finally {
        priorityPromise = null;
        priorityPromiseSheet = null;
      }
    })();
    return priorityPromise;
  }

  // ── Drawer UI ────────────────────────────────────────────────────────
  let activeTab = 'priority'; // 'breakdown' | 'priority'
  let drawerOpen = false;
  let showAllRows = false;
  const prioCollapseOverrides = new Map();

  // Track the latest breakdown context (for header month label, etc.)
  let breakdownState = null; // { diff, ctx } | null
  let breakdownLoading = false;

  function actionLabel(kind) {
    switch (kind) {
      case 'overwrite': return 'Overwrote with template';
      case 'apply-single': return 'Applied template (single)';
      case 'apply-group': return 'Applied templates (group)';
      default: return 'Applied template';
    }
  }

  function removePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();
    const trigger = document.getElementById(TRIGGER_ID);
    if (trigger) trigger.remove();
    removeLegacyPanel();
  }

  function removeLegacyPanel() {
    const legacy = document.getElementById(LEGACY_PANEL_ID);
    if (legacy) legacy.remove();
  }

  function setDrawerOpen(open) {
    drawerOpen = !!open;
    saveDrawerOpen();
    renderPanel();
  }

  // ── Priority body rendering ──────────────────────────────────────────
  function renderPriorityBody(body, data) {
    if (!data) {
      body.appendChild(
        el('div', { class: 'abt-tab-loading' }, [
          el('span', { class: 'abt-tab-spinner' }),
          document.createTextNode('Computing template plan…'),
        ])
      );
      return;
    }
    if (!data.ok) {
      body.appendChild(
        el('div', { class: 'abt-tab-empty', text: data.reason || 'Unavailable' })
      );
      return;
    }

    // Summary block
    const summary = el('div', { class: 'abt-tab-prio-summary' });
    summary.appendChild(el('div', { class: 'abt-tab-prio-summary-label', text: 'Template demand' }));
    summary.appendChild(el('div', { class: 'abt-tab-prio-summary-value', text: fmtMoney(data.totalRequestedCents) }));

    summary.appendChild(el('div', { class: 'abt-tab-prio-summary-label', text: 'Will allocate' }));
    summary.appendChild(
      el('div', {
        class: 'abt-tab-prio-summary-value',
        dataset: { status: data.totalAllocatedCents > 0 ? 'ok' : 'gap' },
        text: fmtMoney(data.totalAllocatedCents),
      })
    );

    summary.appendChild(el('div', { class: 'abt-tab-prio-summary-label', text: 'Gap remaining' }));
    summary.appendChild(
      el('div', {
        class: 'abt-tab-prio-summary-value',
        dataset: { status: data.gapCents > 0 ? 'gap' : 'ok' },
        text: fmtMoney(data.gapCents),
      })
    );

    summary.appendChild(el('div', { class: 'abt-tab-prio-summary-label', text: 'Budgetable funds' }));
    summary.appendChild(
      el('div', {
        class: 'abt-tab-prio-summary-value',
        dataset: { status: data.budgetableCents < 0 ? 'gap' : 'ok' },
        text: fmtMoney(data.budgetableCents),
      })
    );

    // Watermark
    let watermarkText = '';
    let watermarkStatus = 'full';
    if (data.tiers.length === 0) {
      watermarkText = 'No templates found.';
    } else if (data.watermark == null) {
      watermarkText = `All ${data.tiers.length} tier${data.tiers.length === 1 ? '' : 's'} funded by the overwrite plan.`;
      watermarkStatus = 'full';
    } else {
      const watermarkTier = data.tiers.find((t) => t.priority === data.watermark);
      const hf = data.highestFundedPriority;
      if (watermarkTier && watermarkTier.status === 'partial') {
        watermarkText =
          (hf != null ? `Funded through priority ${hf}. ` : '') +
          `${priorityLabel(data.watermark)} partially allocated.`;
        watermarkStatus = 'partial';
      } else {
        watermarkText =
          (hf != null ? `Funded through priority ${hf}. ` : '') +
          `${priorityLabel(data.watermark)}+ unfunded.`;
        watermarkStatus = 'none';
      }
    }
    summary.appendChild(
      el('div', {
        class: 'abt-tab-prio-watermark',
        dataset: { status: watermarkStatus },
        text: watermarkText,
      })
    );
    summary.appendChild(
      el('div', {
        class: 'abt-tab-prio-mode',
        text: data.usedDryRun
          ? (
              data.fallbackCount > 0
                ? `Assumes month-wide overwrite; ${data.fallbackCount} categor${data.fallbackCount === 1 ? 'y uses' : 'ies use'} goal-cell estimates.`
                : 'Assumes month-wide overwrite with budget template.'
            )
          : 'Estimate uses goal cells because dry-run data was unavailable.',
      })
    );
    body.appendChild(summary);

    if (data.tiers.length === 0) {
      body.appendChild(
        el('div', { class: 'abt-tab-empty', text: 'No #template lines detected in category notes.' })
      );
      return;
    }

    // Per-tier rows
    for (const tier of data.tiers) {
      const collapsed = isTierCollapsed(tier);
      const tierEl = el('div', {
        class: 'abt-tab-prio-tier',
        dataset: {
          status: tier.status,
          priority: priorityKey(tier.priority),
          collapsed: String(collapsed),
        },
      });

      const badgeChar = tier.status === 'full' ? '✓' : tier.status === 'partial' ? '◐' : '○';
      const header = el('button', {
        class: 'abt-tab-prio-tier-header',
        type: 'button',
        'aria-expanded': String(!collapsed),
        on: {
          click: () => {
            toggleTierCollapsed(tier);
            const nowCollapsed = isTierCollapsed(tier);
            tierEl.dataset.collapsed = String(nowCollapsed);
            header.setAttribute('aria-expanded', String(!nowCollapsed));
          },
        },
      }, [
        el('span', { class: 'abt-tab-prio-chevron', text: '▸' }),
        el('span', {
          class: 'abt-tab-prio-badge',
          dataset: { status: tier.status },
          text: badgeChar,
        }),
        el('span', {
          class: 'abt-tab-prio-tier-label',
          text: priorityLabel(tier.priority),
        }),
        el('span', {
          class: 'abt-tab-prio-tier-meta',
          text: `${tier.rows.length} cat${tier.rows.length === 1 ? '' : 's'}`,
        }),
        el('span', {
          class: 'abt-tab-prio-tier-amount',
          text: tier.allocatedCents === tier.requestedCents
            ? fmtMoney(tier.requestedCents)
            : `${fmtMoney(tier.allocatedCents)} / ${fmtMoney(tier.requestedCents)}`,
        }),
      ]);
      tierEl.appendChild(header);

      const rowsWrap = el('div', { class: 'abt-tab-prio-tier-rows' });
      for (const row of tier.rows) {
        const otherPriorities = row.priorities.filter((p) => p !== tier.priority && p != null);
        const multiPrio = otherPriorities.length > 0;
        const metaText = multiPrio
          ? `also @ ${otherPriorities.join(', ')}`
          : row.source === 'goal-cell'
            ? 'goal-cell estimate'
            : row.source === 'goal-residual'
              ? 'goal residual'
              : row.source === 'parsed-amount'
                ? 'parsed estimate'
                : row.templateCount > 1
                  ? `${row.templateCount} templates`
                  : null;
        const amountText = row.allocatedCents === row.requestedCents
          ? fmtMoney(row.requestedCents)
          : `${fmtMoney(row.allocatedCents)} / ${fmtMoney(row.requestedCents)}`;
        const rowEl = el('div', {
          class: 'abt-tab-prio-row',
          dataset: { status: statusFor(row.requestedCents, row.allocatedCents) },
        }, [
          el('span', { class: 'abt-tab-prio-row-name' }, [
            document.createTextNode(row.catName),
            metaText
              ? el('span', { class: 'abt-tab-prio-row-meta', text: metaText })
              : null,
          ]),
          el('span', {
            class: 'abt-tab-prio-row-amount',
            text: amountText,
          }),
        ]);
        rowsWrap.appendChild(rowEl);
      }
      tierEl.appendChild(rowsWrap);

      body.appendChild(tierEl);
    }
  }

  // ── Breakdown body rendering ─────────────────────────────────────────
  function renderBreakdownBody(body) {
    if (breakdownLoading) {
      body.appendChild(
        el('div', { class: 'abt-tab-loading' }, [
          el('span', { class: 'abt-tab-spinner' }),
          document.createTextNode('Computing breakdown…'),
        ])
      );
      return;
    }
    if (!breakdownState) {
      body.appendChild(
        el('div', {
          class: 'abt-tab-empty',
          text: 'Apply or overwrite a template to see a breakdown here.',
        })
      );
      return;
    }

    const { diff, ctx } = breakdownState;
    const changedGroups = diff.groups
      .map((g) => ({ ...g, rows: g.rows.filter((r) => r.delta !== 0) }))
      .filter((g) => g.rows.length > 0);
    const allEmpty = changedGroups.length === 0;

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

    renderBreakdownPrioritySummary(body, ctx.priorityBreakdown);

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
  }

  function formatAllocatedVsRequested(allocatedCents, requestedCents) {
    if (requestedCents == null || allocatedCents === requestedCents) {
      return fmtMoney(allocatedCents);
    }
    return `${fmtMoney(allocatedCents)} / ${fmtMoney(requestedCents)}`;
  }

  function renderBreakdownPrioritySummary(body, summary) {
    if (!summary || !Array.isArray(summary.tiers) || summary.tiers.length === 0) return;
    const wrap = el('div', { class: 'abt-tab-breakdown-priority' });
    wrap.appendChild(
      el('div', { class: 'abt-tab-breakdown-priority-title' }, [
        el('span', { text: 'Priority movement' }),
        el('span', {
          class: 'abt-tab-breakdown-priority-total',
          text: fmtMoney(summary.totalAllocatedCents, { sign: true }),
        }),
      ])
    );

    for (const tier of summary.tiers) {
      const badgeChar = tier.status === 'full' ? '✓' : tier.status === 'partial' ? '◐' : '○';
      const tierEl = el('div', {
        class: 'abt-tab-breakdown-priority-tier',
        dataset: { status: tier.status },
      });
      tierEl.appendChild(
        el('div', { class: 'abt-tab-breakdown-priority-tier-header' }, [
          el('span', {
            class: 'abt-tab-prio-badge',
            dataset: { status: tier.status },
            text: badgeChar,
          }),
          el('span', {
            class: 'abt-tab-breakdown-priority-tier-label',
            text: priorityLabel(tier.priority),
          }),
          el('span', {
            class: 'abt-tab-breakdown-priority-tier-amount',
            text: formatAllocatedVsRequested(
              tier.allocatedCents,
              tier.hasUnknownDemand ? null : tier.requestedCents
            ),
          }),
        ])
      );

      const rows = el('div', { class: 'abt-tab-breakdown-priority-rows' });
      for (const row of tier.rows) {
        rows.appendChild(
          el('div', {
            class: 'abt-tab-breakdown-priority-row',
            dataset: { status: row.status },
          }, [
            el('span', { class: 'abt-tab-breakdown-priority-row-name', text: row.catName }),
            el('span', {
              class: 'abt-tab-breakdown-priority-row-amount',
              text: formatAllocatedVsRequested(row.allocatedCents, row.requestedCents),
            }),
          ])
        );
      }
      tierEl.appendChild(rows);
      wrap.appendChild(tierEl);
    }
    body.appendChild(wrap);
  }

  function renderFooter(footer) {
    // Clear
    footer.textContent = '';
    if (activeTab === 'breakdown' && breakdownState) {
      footer.appendChild(el('span', { class: 'abt-tab-footer-label', text: 'Total allocated' }));
      footer.appendChild(
        el('span', {
          class: 'abt-tab-footer-value',
          text: fmtMoney(breakdownState.diff.totalAllocated, { sign: true }),
        })
      );
      footer.style.display = '';
    } else {
      footer.style.display = 'none';
    }
  }

  function renderToggle(toggle) {
    toggle.textContent = '';
    if (activeTab === 'breakdown' && breakdownState) {
      toggle.textContent = showAllRows ? 'Show only changed' : 'Show unchanged categories';
      toggle.style.display = '';
    } else {
      toggle.style.display = 'none';
    }
  }

  function drawerTriggerStatus() {
    const sheet = getCurrentSheet();
    if (breakdownLoading || priorityLoading) return 'loading';
    if (priorityCacheMatchesSheet(sheet) && priorityCache.ok) {
      return priorityCache.gapCents > 0 ? 'gap' : 'ok';
    }
    return 'idle';
  }

  function drawerTriggerTitle() {
    if (drawerOpen) return 'Close template plan';
    const sheet = getCurrentSheet();
    if (breakdownLoading || priorityLoading) return 'Template plan is updating';
    if (priorityCacheMatchesSheet(sheet) && priorityCache.ok) {
      return `Template plan: ${fmtMoney(priorityCache.totalAllocatedCents)} allocated, ${fmtMoney(priorityCache.gapCents)} gap`;
    }
    if (breakdownState) {
      return `${actionLabel(breakdownState.ctx.kind)}: ${fmtMoney(breakdownState.diff.totalAllocated, { sign: true })}`;
    }
    return 'Open template plan';
  }

  function applyDrawerTriggerState(trigger) {
    trigger.setAttribute('aria-label', drawerOpen ? 'Close template plan' : 'Open template plan');
    trigger.setAttribute('aria-pressed', String(drawerOpen));
    trigger.title = drawerTriggerTitle();
    trigger.dataset.open = String(drawerOpen);
    trigger.dataset.status = drawerTriggerStatus();
  }

  function updateDrawerTrigger() {
    const trigger = document.getElementById(TRIGGER_ID);
    if (trigger) applyDrawerTriggerState(trigger);
  }

  function renderDrawerTrigger() {
    const trigger = el('button', {
      id: TRIGGER_ID,
      class: 'abt-template-drawer-trigger',
      on: { click: () => setDrawerOpen(!drawerOpen) },
    }, [
      el('span', { class: 'abt-template-drawer-trigger-text', text: 'Plan' }),
    ]);
    applyDrawerTriggerState(trigger);
    document.body.appendChild(trigger);
  }

  // ── Drawer mount ─────────────────────────────────────────────────────
  function renderPanel() {
    removePanel();
    if (!isEnabled() || !isBudgetPage()) return;

    renderDrawerTrigger();

    if (!drawerOpen) {
      return;
    }

    const body = el('div', { class: 'abt-tab-body' });
    const footer = el('div', { class: 'abt-tab-footer' });
    const toggle = el('div', { class: 'abt-tab-toggle' });

    // Header: title with month when available.
    const rawHeaderMonth = activeTab === 'breakdown'
      ? (breakdownState && breakdownState.ctx && breakdownState.ctx.month)
      : (priorityCache && priorityCache.month);
    const headerMonth = monthLabelForHeader(rawHeaderMonth);
    const headerTitleText = activeTab === 'breakdown' && breakdownState
      ? actionLabel(breakdownState.ctx.kind)
      : 'Template plan';

    const titleNode = el('div', { class: 'abt-tab-title' }, [
      document.createTextNode(headerTitleText),
      headerMonth ? el('span', { class: 'abt-tab-month', text: headerMonth }) : null,
    ]);

    const header = el('div', { class: 'abt-tab-header' }, [
      titleNode,
    ]);

    // Tab switcher
    const tabBreakdown = el('button', {
      class: 'abt-tab-tab',
      dataset: { active: String(activeTab === 'breakdown') },
      text: 'Breakdown',
      on: { click: () => switchTab('breakdown') },
    });
    const tabPriority = el('button', {
      class: 'abt-tab-tab',
      dataset: { active: String(activeTab === 'priority') },
      text: 'Priority plan',
      on: { click: () => switchTab('priority') },
    });
    const tabs = el('div', { class: 'abt-tab-tabs' }, [tabBreakdown, tabPriority]);

    toggle.addEventListener('click', () => {
      if (activeTab === 'breakdown') {
        showAllRows = !showAllRows;
        redrawActiveBody(body, footer, toggle);
      }
    });

    const panel = el('aside', {
      id: PANEL_ID,
      class: 'abt-template-drawer',
      'aria-label': 'Template plan',
    }, [
      header,
      tabs,
      body,
      footer,
      toggle,
    ]);

    document.body.appendChild(panel);

    redrawActiveBody(body, footer, toggle);

    // If we're on priority tab and haven't computed yet, kick it off.
    if (activeTab === 'priority') {
      refreshPriorityIfNeeded(body, footer, toggle);
    }
  }

  function switchTab(tab) {
    if (tab === activeTab) return;
    activeTab = tab;
    saveActiveTab();
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    // Update tab active states
    const buttons = panel.querySelectorAll('.abt-tab-tab');
    buttons.forEach((b) => {
      b.setAttribute('data-active', String(b.textContent.toLowerCase().startsWith(tab)));
    });
    const body = panel.querySelector('.abt-tab-body');
    const footer = panel.querySelector('.abt-tab-footer');
    const toggle = panel.querySelector('.abt-tab-toggle');
    const title = panel.querySelector('.abt-tab-title');
    // Update title + month label
    const rawMonthLabel = (activeTab === 'breakdown' && breakdownState && breakdownState.ctx.month)
      || (priorityCache && priorityCache.month) || null;
    const monthLabel = monthLabelForHeader(rawMonthLabel);
    title.textContent = '';
    title.appendChild(document.createTextNode(
      activeTab === 'breakdown' && breakdownState
        ? actionLabel(breakdownState.ctx.kind)
        : 'Template plan'
    ));
    if (monthLabel) {
      title.appendChild(el('span', { class: 'abt-tab-month', text: monthLabel }));
    }
    redrawActiveBody(body, footer, toggle);
    if (activeTab === 'priority') {
      refreshPriorityIfNeeded(body, footer, toggle);
    }
  }

  function redrawActiveBody(body, footer, toggle) {
    body.textContent = '';
    if (activeTab === 'breakdown') {
      renderBreakdownBody(body);
    } else {
      renderPriorityBody(body, priorityCache);
    }
    renderFooter(footer);
    renderToggle(toggle);
  }

  async function refreshPriorityIfNeeded(body, footer, toggle) {
    if (!isBudgetPage()) return;
    priorityLoading = true;
    updateDrawerTrigger();
    try {
      await computePriorityStatus(false);
    } catch (e) {
      console.warn('[ABT TAB] priority compute failed', e);
    } finally {
      priorityLoading = false;
      updateDrawerTrigger();
    }
    if (!document.getElementById(PANEL_ID)) return;
    if (activeTab !== 'priority') return;
    // Only redraw the priority body; don't disturb other state.
    body.textContent = '';
    renderPriorityBody(body, priorityCache);
    renderFooter(footer);
    renderToggle(toggle);
    // Update month label in header too
    const panel = document.getElementById(PANEL_ID);
    const title = panel && panel.querySelector('.abt-tab-title');
    if (title && priorityCache && priorityCache.month) {
      // Replace the month chip if present
      const existingChip = title.querySelector('.abt-tab-month');
      if (existingChip) existingChip.remove();
      title.appendChild(el('span', {
        class: 'abt-tab-month',
        text: formatMonthLabel(priorityCache.month),
      }));
    }
  }

  // ── Click interception (apply/overwrite) ─────────────────────────────
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
    breakdownLoading = true;
    // If we're on the priority tab, switch to breakdown so the user sees the loading.
    if (activeTab !== 'breakdown') {
      activeTab = 'breakdown';
      saveActiveTab();
    }
    drawerOpen = true;
    saveDrawerOpen();
    renderPanel();

    let beforeMap;
    try {
      beforeMap = await finishSnapshots(beforeStarts);
    } catch (e) {
      console.warn('[ABT TAB] snapshot before failed', e);
      breakdownLoading = false;
      renderPanel();
      return;
    }

    try { await waitForQuiescence(); } catch {}
    if (seq !== runSeq) return;

    let afterMap;
    try {
      afterMap = await finishSnapshots(startSnapshotAllVisible());
    } catch (e) {
      console.warn('[ABT TAB] snapshot after failed', e);
      breakdownLoading = false;
      renderPanel();
      return;
    }
    if (seq !== runSeq) return;

    let bestDiff = null;
    let bestSheet = null;
    let bestScore = 0;
    const sheets = new Set([...beforeMap.keys(), ...afterMap.keys()]);
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

    breakdownLoading = false;
    let priorityBreakdown = null;
    const prioritySheet = bestSheet || afterMap.keys().next().value;
    const priorityDiff = bestDiff || null;
    if (prioritySheet && priorityDiff) {
      try {
        priorityBreakdown = await buildBreakdownPrioritySummary(prioritySheet, priorityDiff);
      } catch (e) {
        console.warn('[ABT TAB] priority breakdown failed', e);
      }
    }

    if (!bestDiff || bestScore === 0) {
      const fallbackSheet = afterMap.keys().next().value;
      const empty = bestDiff || {
        groups: [],
        totalAllocated: 0,
        availableBefore: 0,
        availableAfter: 0,
        toBudgetBefore: 0,
        toBudgetAfter: 0,
      };
      breakdownState = {
        diff: empty,
        ctx: {
          kind,
          month: sheetToMonthLabel(fallbackSheet),
          notification: null,
          priorityBreakdown,
        },
      };
    } else {
      breakdownState = {
        diff: bestDiff,
        ctx: {
          kind,
          month: sheetToMonthLabel(bestSheet),
          notification: null,
          priorityBreakdown,
        },
      };
    }
    saveBreakdown(breakdownState.diff, breakdownState.ctx);

    // Invalidate priority cache (budget changed) and re-render
    invalidatePriorityStatus();
    renderPanel();
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
        if (!categoriesCache) return;
        const beforeStarts = startSnapshotAllVisible();
        handleTrigger(kind, beforeStarts);
      },
      true
    );
  }

  function installDrawerKeyboard() {
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      if (!drawerOpen || !isEnabled() || !isBudgetPage()) return;
      setDrawerOpen(false);
    });
  }

  // ── Toggle observation ───────────────────────────────────────────────
  function watchToggle() {
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'attributes' && m.attributeName === TOGGLE_ATTR) {
          if (isEnabled()) renderPanel();
          else removePanel();
        }
      }
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [TOGGLE_ATTR],
    });
  }

  // ── URL change → invalidate caches & refresh ─────────────────────────
  let lastUrl = location.href;
  let lastSheet = isBudgetPage() ? getCurrentSheet() : null;
  setInterval(() => {
    const urlChanged = location.href !== lastUrl;
    if (urlChanged) {
      lastUrl = location.href;
      invalidateCategoriesCache();
    }

    if (!isEnabled()) {
      removePanel();
      return;
    }

    const nowBudget = isBudgetPage();
    if (!nowBudget) {
      if (drawerOpen) {
        drawerOpen = false;
        saveDrawerOpen();
      }
      removePanel();
      return;
    }
    removeLegacyPanel();

    const sheetChanged = setActiveSheet(getCurrentSheet());
    if (sheetChanged) {
      renderPanel();
      return;
    }

    let panel = document.getElementById(PANEL_ID);
    const trigger = document.getElementById(TRIGGER_ID);
    if (drawerOpen && (!panel || !panel.isConnected)) {
      renderPanel();
      panel = document.getElementById(PANEL_ID);
      if (!panel) return;
    }
    if (!drawerOpen && (!trigger || !trigger.isConnected)) {
      renderPanel();
      return;
    }
    if (!drawerOpen) return;

    if (!urlChanged) return;

    if (activeTab === 'priority') {
      const body = panel.querySelector('.abt-tab-body');
      const footer = panel.querySelector('.abt-tab-footer');
      const toggle = panel.querySelector('.abt-tab-toggle');
      // If the cache is fresh (within TTL), redraw synchronously from it.
      // Otherwise show loading and recompute.
      const fresh = priorityCacheIsFreshForSheet(lastSheet);
      if (fresh) {
        body.textContent = '';
        renderPriorityBody(body, priorityCache);
      } else {
        body.textContent = '';
        renderPriorityBody(body, null); // loading
        refreshPriorityIfNeeded(body, footer, toggle);
      }
    }
  }, 1500);

  // ── Boot ─────────────────────────────────────────────────────────────
  (async function boot() {
    watchToggle();
    await waitForBackendReady();
    await loadCurrencyPreference();
    await loadCategories();
    installClickListener();
    installDrawerKeyboard();
    loadActiveTab();
    loadDrawerOpen();
    loadPrioCollapse();
    // Restore persisted breakdown (if any)
    const saved = loadBreakdown();
    if (saved) breakdownState = saved;
    if (isEnabled()) renderPanel();
  })();
})();
