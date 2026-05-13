import {
  TOGGLE_ATTR,
  PANEL_ID,
  TRIGGER_ID,
  LEGACY_PANEL_ID,
  STORAGE_KEY,
  TAB_STORAGE_KEY,
  DRAWER_STORAGE_KEY,
  PRIO_COLLAPSE_STORAGE_KEY,
  TRIGGER_LABELS,
  priorityKey,
  priorityLabel,
} from './template-apply-breakdown/constants.js';
import { el } from './template-apply-breakdown/dom.js';
import { loadCurrencyPreference, fmtMoney } from './template-apply-breakdown/money.js';
import {
  waitForBackendReady,
  loadCategories,
  invalidateCategoriesCache,
  getCells,
  startSnapshotAllVisible,
  finishSnapshots,
  getCurrentSheet,
  sheetToMonthKey,
  sheetToMonthLabel,
  formatMonthLabel,
  monthLabelForHeader,
  isBudgetPage,
  waitForQuiescence,
  diffSnapshots,
  loadTemplatesByCategoryId,
} from './template-apply-breakdown/actual-data.js';
import { createPriorityPlanner, statusFor } from './template-apply-breakdown/priority-plan.js';

(function () {
  'use strict';

  function isEnabled() {
    return document.documentElement.getAttribute(TOGGLE_ATTR) === 'on';
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

  const priorityPlanner = createPriorityPlanner({
    getCurrentSheet,
    isBudgetPage,
    loadCategories,
    loadTemplatesByCategoryId,
    getCells,
    sheetToMonthKey,
    sheetToMonthLabel,
  });
  const {
    computePriorityStatus,
    buildBreakdownPrioritySummary,
    priorityCacheIsFreshForSheet,
    priorityCacheMatchesSheet,
    invalidatePriorityStatus,
    getCache: getPriorityCache,
  } = priorityPlanner;

  function setActiveSheet(sheet) {
    if (sheet === lastSheet) return false;
    lastSheet = sheet;
    invalidatePriorityStatus();
    return true;
  }

  // ── Drawer UI ────────────────────────────────────────────────────────
  let activeTab = 'priority'; // 'breakdown' | 'priority'
  let drawerOpen = false;
  let showAllRows = false;
  const prioCollapseOverrides = new Map();

  // Track the latest breakdown context (for header month label, etc.)
  let breakdownState = null; // { diff, ctx } | null
  let breakdownLoading = false;
  let priorityLoading = false;

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
    const priorityCache = getPriorityCache();
    if (breakdownLoading || priorityLoading) return 'loading';
    if (priorityCacheMatchesSheet(sheet) && priorityCache && priorityCache.ok) {
      return priorityCache.gapCents > 0 ? 'gap' : 'ok';
    }
    return 'idle';
  }

  function drawerTriggerTitle() {
    if (drawerOpen) return 'Close template plan';
    const sheet = getCurrentSheet();
    const priorityCache = getPriorityCache();
    if (breakdownLoading || priorityLoading) return 'Template plan is updating';
    if (priorityCacheMatchesSheet(sheet) && priorityCache && priorityCache.ok) {
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
    const priorityCache = getPriorityCache();
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
    const priorityCache = getPriorityCache();
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
      renderPriorityBody(body, getPriorityCache());
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
    const priorityCache = getPriorityCache();
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
        const priorityCache = getPriorityCache();
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
