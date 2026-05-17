import { observeSidebarAllAccountsBalance, refreshPrivacyMode as sharedRefreshPrivacyMode } from './privacy-utils.js';

import {
  diffSnapshots,
  finishSnapshots,
  getCells,
  getCurrentSheet,
  invalidateCategoriesCache,
  isBudgetPage,
  loadCategories,
  loadTemplatesByCategoryId,
  monthLabelForHeader,
  sheetToMonthKey,
  sheetToMonthLabel,
  startSnapshotAllVisible,
  waitForBackendReady,
  waitForQuiescence,
} from './template-apply-breakdown/actual-data.js';
import {
  LEGACY_PANEL_ID,
  PANEL_ID,
  PRIO_COLLAPSE_STORAGE_KEY,
  STORAGE_KEY,
  TAB_STORAGE_KEY,
  TOGGLE_ATTR,
  TRIGGER_LABELS,
  priorityKey,
  priorityLabel,
} from './template-apply-breakdown/constants.js';
import { el } from './template-apply-breakdown/dom.js';
import { fmtMoney, loadCurrencyPreference } from './template-apply-breakdown/money.js';
import { createPriorityPlanner, statusFor } from './template-apply-breakdown/priority-plan.js';

const PANEL_OPEN_EVENT = 'abt:sidepanel:open';
const PANEL_CLOSE_EVENT = 'abt:sidepanel:close';
const PANEL_SET_TITLE_EVENT = 'abt:sidepanel:set-title';
const PANEL_SET_TRIGGER_LABEL_EVENT = "abt:sidepanel:set-trigger-label";

const DEBUG_PREFIX = '[ABT TAB]';
const HOST_SIDEBAR_SELECTOR = '[data-abt-side-drawer-sidebar]';
const HOST_PANEL_BODY_SELECTOR = '.abt-side-drawer-body';

function createChevronIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'abt-tab-prio-chevron-icon');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4 2.5L7.5 6L4 9.5');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.75');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);

  return el('span', { class: 'abt-tab-prio-chevron', 'aria-hidden': 'true' }, [svg]);
}

(function () {
  'use strict';

  function isEnabled() {
    return document.documentElement.getAttribute(TOGGLE_ATTR) === 'on';
  }

  function isHostDrawerOpen() {
    return Boolean(document.querySelector(HOST_SIDEBAR_SELECTOR));
  }

  function getHostDrawerBody() {
    return document.querySelector(`${HOST_SIDEBAR_SELECTOR} ${HOST_PANEL_BODY_SELECTOR}`);
  }

  function getSidePanelApi() {
    const api = window.abtSidepanel;
    if (api) {
      return api;
    }

    return {
      open: (title, bodyNode) => {
        document.dispatchEvent(new CustomEvent(PANEL_OPEN_EVENT, {
          detail: { title, bodyNode },
        }));
      },
      close: () => {
        document.dispatchEvent(new CustomEvent(PANEL_CLOSE_EVENT));
      },
      setTitle: (title) => {
        document.dispatchEvent(new CustomEvent(PANEL_SET_TITLE_EVENT, {
          detail: { title },
        }));
      },
      isOpen: () => {
        return Boolean(document.querySelector(HOST_SIDEBAR_SELECTOR));
      },
      setPanelTriggerLabel: (label) => {
        document.dispatchEvent(new CustomEvent(PANEL_SET_TRIGGER_LABEL_EVENT, {
          detail: { label },
        }));
      }
    };
  }

  function updateSidePanelTitle() {
    if (!isEnabled() || !isBudgetPage()) return;

    const priorityCache = getPriorityCache();
    const rawMonthLabel = (activeTab === 'breakdown' && breakdownState && breakdownState.ctx.month)
      || (priorityCache && priorityCache.month)
      || null;
    const monthLabel = monthLabelForHeader(rawMonthLabel);
    const headerTitleText = activeTab === 'breakdown' && breakdownState
      ? actionLabel(breakdownState.ctx.kind)
      : 'Template plan';
    const nextTitle = monthLabel ? `${headerTitleText} • ${monthLabel}` : headerTitleText;

    const hostTitle = document.querySelector(`${HOST_SIDEBAR_SELECTOR} .abt-side-drawer-title`);
    if (hostTitle && hostTitle.textContent !== nextTitle) {
      hostTitle.textContent = nextTitle;
    }

    if (!drawerOpen && !isHostDrawerOpen()) return;
    const api = getSidePanelApi();
    if (api.setTitle) {
      api.setTitle(nextTitle);
    }
  }

  // ── Storage ──────────────────────────────────────────────────────────
  function saveBreakdown(diff, ctx) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ diff, ctx })); } catch { }
  }

  function loadBreakdown() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function saveActiveTab() {
    try { localStorage.setItem(TAB_STORAGE_KEY, activeTab); } catch { }
  }

  function loadActiveTab() {
    try {
      const v = localStorage.getItem(TAB_STORAGE_KEY);
      if (v === 'breakdown' || v === 'priority') activeTab = v;
    } catch { }
  }



  // Per-priority explicit collapse overrides. Map<priority-key, collapsed:boolean>.
  // Absence = "use default" (full → collapsed, otherwise → expanded).
  function savePrioCollapse() {
    try {
      const obj = {};
      for (const [k, v] of prioCollapseOverrides.entries()) obj[k] = v;
      localStorage.setItem(PRIO_COLLAPSE_STORAGE_KEY, JSON.stringify(obj));
    } catch { }
  }

  function loadPrioCollapse() {
    try {
      const raw = localStorage.getItem(PRIO_COLLAPSE_STORAGE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      for (const k in obj) {
        if (typeof obj[k] === 'boolean') prioCollapseOverrides.set(String(k), obj[k]);
      }
    } catch { }
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
    invalidatePriorityStatus,
    getCache: getPriorityCache,
  } = priorityPlanner;

  function getSheetKey(sheet) {
    try {
      return sheet ? sheetToMonthKey(sheet) : null;
    } catch {
      return null;
    }
  }

  function setActiveSheet(sheet) {
    const nextKey = getSheetKey(sheet);
    if (nextKey === lastSheetKey) return false;
    lastSheet = sheet;
    lastSheetKey = nextKey;
    invalidatePriorityStatus();
    return true;
  }

  // ── Drawer UI ────────────────────────────────────────────────────────
  let activeTab = 'priority'; // 'breakdown' | 'priority'
  let drawerOpen = false;
  let pendingHostOpenRequest = false;
  let lastHostDrawerOpen = isHostDrawerOpen();
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
    if (existing && existing.isConnected) {
      existing.remove();
    }
  }

  function setDrawerOpen(open) {
    pendingHostOpenRequest = Boolean(open);
    drawerOpen = !!open;
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
    summary.appendChild(el('div', { class: 'abt-tab-prio-summary-value abt-privacy-number', text: fmtMoney(data.totalRequestedCents) }));

    summary.appendChild(el('div', { class: 'abt-tab-prio-summary-label', text: 'Will allocate' }));
    summary.appendChild(
      el('div', {
        class: 'abt-tab-prio-summary-value abt-privacy-number',
        dataset: { status: data.totalAllocatedCents > 0 ? 'ok' : 'gap' },
        text: fmtMoney(data.totalAllocatedCents),
      })
    );

    summary.appendChild(el('div', { class: 'abt-tab-prio-summary-label', text: 'Gap remaining' }));
    summary.appendChild(
      el('div', {
        class: 'abt-tab-prio-summary-value abt-privacy-number',
        dataset: { status: data.gapCents > 0 ? 'gap' : 'ok' },
        text: fmtMoney(data.gapCents),
      })
    );

    summary.appendChild(el('div', { class: 'abt-tab-prio-summary-label', text: 'Budgetable funds' }));
    summary.appendChild(
      el('div', {
        class: 'abt-tab-prio-summary-value abt-privacy-number',
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
        createChevronIcon(),
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
          class: 'abt-tab-prio-tier-amount abt-privacy-number',
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
            class: 'abt-tab-prio-row-amount abt-privacy-number',
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
                class: 'abt-tab-row-delta abt-privacy-number',
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
          class: 'abt-tab-breakdown-priority-total abt-privacy-number',
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
            class: 'abt-tab-breakdown-priority-tier-amount abt-privacy-number',
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
              class: 'abt-tab-breakdown-priority-row-amount abt-privacy-number',
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
          class: 'abt-tab-footer-value abt-privacy-number',
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

  // ── Drawer mount ─────────────────────────────────────────────────────
  function renderPanel() {
    const hostDrawerOpen = isHostDrawerOpen();
    const shouldRender = drawerOpen || hostDrawerOpen;

    if (!isEnabled() || !isBudgetPage()) {
      removePanel();
      const api = getSidePanelApi();
      api.close();
      return;
    }

    if (!shouldRender) {
      removePanel();
      return;
    }

    if (hostDrawerOpen && !drawerOpen) {
      drawerOpen = true;
    }


    updateSidePanelTitle();
    if (!hostDrawerOpen) {
      if (!pendingHostOpenRequest) {
        if (drawerOpen) {
          drawerOpen = false;
        }
        removePanel();
        return;
      }

      api.open();
      return;
    }

    pendingHostOpenRequest = false;

    const hostBody = getHostDrawerBody();
    if (!hostBody) {
      api.open();
      return;
    }

    const existingPanel = document.getElementById(PANEL_ID);
    if (existingPanel && existingPanel.isConnected) {
      const body = existingPanel.querySelector('.abt-tab-body');
      const footer = existingPanel.querySelector('.abt-tab-footer');
      const toggle = existingPanel.querySelector('.abt-tab-toggle');
      if (body && footer && toggle) {
        if (existingPanel.parentElement !== hostBody) {
          hostBody.replaceChildren(existingPanel);
        }
        redrawActiveBody(body, footer, toggle);
        if (activeTab === 'priority' && !priorityLoading && !getPriorityCache()) {
          refreshPriorityIfNeeded(body, footer, toggle);
        }
        return;
      }
      existingPanel.remove();
    }

    const body = el('div', { class: 'abt-tab-body' });
    const footer = el('div', { class: 'abt-tab-footer' });
    const toggle = el('div', { class: 'abt-tab-toggle' });

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

    const panel = el('div', {
      id: PANEL_ID,
      class: 'abt-template-drawer-content',
      'aria-label': 'Template plan',
    }, [
      tabs,
      body,
      footer,
      toggle,
    ]);
    hostBody.replaceChildren(panel);

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
    updateSidePanelTitle();
    refreshPrivacyMode(); // Ensure privacy is always applied after redraw
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
    refreshPrivacyMode();
    renderFooter(footer);
    renderToggle(toggle);
  }

  async function refreshPriorityIfNeeded(body, footer, toggle) {
    if (!isBudgetPage()) return;
    priorityLoading = true;
    try {
      await computePriorityStatus(false);
    } catch (e) {
      console.warn('[ABT TAB] priority compute failed', e);
    } finally {
      priorityLoading = false;
    }
    if (!document.getElementById(PANEL_ID)) return;
    if (activeTab !== 'priority') return;
    // Only redraw the priority body; don't disturb other state.
    const priorityCache = getPriorityCache();
    body.textContent = '';
    renderPriorityBody(body, priorityCache);
    renderFooter(footer);
    renderToggle(toggle);
    updateSidePanelTitle();
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
    setDrawerOpen(true);

    let beforeMap;
    try {
      beforeMap = await finishSnapshots(beforeStarts);
    } catch (e) {
      console.warn('[ABT TAB] snapshot before failed', e);
      breakdownLoading = false;
      renderPanel();
      return;
    }

    try { await waitForQuiescence(); } catch { }
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
          else {
            removePanel();
            const api = getSidePanelApi();
            api.close();
          }
        }
      }
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [TOGGLE_ATTR],
    });
  }

  function watchHostDrawer() {
    const obs = new MutationObserver(() => {
      const hostOpen = isHostDrawerOpen();
      if (hostOpen === lastHostDrawerOpen) {
        return;
      }

      lastHostDrawerOpen = hostOpen;
      if (!hostOpen && drawerOpen && !pendingHostOpenRequest) {
        drawerOpen = false;
        removePanel();
        return;
      }

      if (hostOpen) {

        renderPanel();
      }
    });

    obs.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // ── URL change → invalidate caches & refresh ─────────────────────────
  let lastUrl = location.href;
  let lastSheet = isBudgetPage() ? getCurrentSheet() : null;
  let lastSheetKey = isBudgetPage() ? getSheetKey(getCurrentSheet()) : null;
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
      }
      // Page navigation replaces the entire DOM—don't interfere with cleanup
      return;
    }

    const sheetChanged = setActiveSheet(getCurrentSheet());
    if (sheetChanged) {
      renderPanel();
      return;
    }

    let panel = document.getElementById(PANEL_ID);
    const shouldRender = drawerOpen || isHostDrawerOpen();
    if (shouldRender && (!panel || !panel.isConnected)) {
      renderPanel();
      panel = document.getElementById(PANEL_ID);
      if (!panel) return;
    }
    if (!shouldRender) return;

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
        updateSidePanelTitle();
      } else {
        body.textContent = '';
        renderPriorityBody(body, null); // loading
        refreshPriorityIfNeeded(body, footer, toggle);
      }
    }
  }, 1500);


  function refreshPrivacyMode() {
    sharedRefreshPrivacyMode();
  }

  function bootPrivacyMode() {
    refreshPrivacyMode(); // Apply privacy immediately on load
    observeSidebarAllAccountsBalance(refreshPrivacyMode);
  }

  // ── Boot ─────────────────────────────────────────────────────────────
  (async function boot() {
    await waitForBackendReady();
    bootPrivacyMode();
    loadActiveTab();
    watchToggle();
    watchHostDrawer();
    await loadCurrencyPreference();
    await loadCategories();
    installClickListener();
    installDrawerKeyboard();
    loadPrioCollapse();
    // Restore persisted breakdown (if any)
    const saved = loadBreakdown();
    if (saved) breakdownState = saved;
    if (isEnabled()) {
      const api = getSidePanelApi();
      // Set the trigger/host drawer title to a static label when opening
      api.setPanelTriggerLabel('Plan');

      renderPanel();
    }
  })();
})();
