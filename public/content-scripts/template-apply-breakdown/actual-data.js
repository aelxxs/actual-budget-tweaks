import { parseNoteTemplates } from './templates.js';

// ── Backend readiness ────────────────────────────────────────────────
export function isBackendReady() {
  if (typeof window.$send !== 'function') return false;
  if (typeof window.$query !== 'function' || typeof window.$q !== 'function') return false;
  return !!document.querySelector(
    '[data-testid^="budget2"][data-testid*="!sum-amount-"]'
  );
}

export function waitForBackendReady() {
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

export async function loadCategories(force) {
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

export function invalidateCategoriesCache() {
  categoriesPromise = null;
  loadCategories(true);
  // Note: deliberately does NOT invalidate priorityCache — category metadata
  // (names/groups) changing doesn't affect goal/budget cell values. Priority
  // cache is invalidated on apply/overwrite and by its TTL.
}

// ── Cell reads ───────────────────────────────────────────────────────
export async function getCells(sheet, names) {
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
export function startSnapshotMonth(sheet, cats) {
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

export async function awaitSnapshotMonth(start) {
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

export function getVisibleSheets() {
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

export function sheetToMonthKey(sheet) {
  const m = sheet && sheet.match(/^budget(\d{4})(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

export function sheetToMonthLabel(sheet) {
  const key = sheetToMonthKey(sheet);
  return formatMonthLabel(key);
}

export function formatMonthLabel(value) {
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

export function activeMonthLabel() {
  return sheetToMonthLabel(getCurrentSheet());
}

export function monthLabelForHeader(value) {
  return formatMonthLabel(value) || activeMonthLabel();
}

export function getCurrentSheet() {
  // Prefer a sheet whose URL/focus matches, fall back to first visible.
  return getVisibleSheets()[0] || null;
}

// True when the user is on Actual's Budget page. On other pages (reports,
// schedules, accounts, …) the budget cells aren't relevant and the priority
// status should auto-collapse.
export function isBudgetPage() {
  return location.pathname === '/budget';
}

export function startSnapshotAllVisible() {
  if (!categoriesCache) return [];
  const sheets = getVisibleSheets();
  return sheets.map((s) => startSnapshotMonth(s, categoriesCache));
}

export async function finishSnapshots(starts) {
  const snaps = await Promise.all(starts.map(awaitSnapshotMonth));
  const map = new Map();
  snaps.forEach((s) => map.set(s.sheet, s));
  return map;
}

// ── DOM quiescence ───────────────────────────────────────────────────
export function waitForQuiescence(idleMs, maxMs) {
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
export function diffSnapshots(before, after) {
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

export async function loadTemplatesByCategoryId() {
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
