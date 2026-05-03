(function () {
  'use strict';

  const STORAGE_PREFIX = 'abt-income-breakdown-';
  const WIDGET_ID = 'abt-income-breakdown-widget';
  const PLACEHOLDER_TEXT = 'placeholder — extension will render here';
  const POLL_INTERVAL = 1500;
  const DEBOUNCE_MS = 300;

  // ── Settings persistence ──────────────────────────────────────────────
  function getSetting(key, defaultValue) {
    try {
      const v = localStorage.getItem(STORAGE_PREFIX + key);
      return v === null ? defaultValue : JSON.parse(v);
    } catch { return defaultValue; }
  }
  function setSetting(key, value) {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  }

  // ── Date preset helpers ───────────────────────────────────────────────
  function fmt(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function monthEnd(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

  // monthsAgo: create a Date rewound by N months (safe for month-end rollover)
  function monthsAgo(n) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return d; }

  const DATE_PRESETS = [
    {
      label: 'This Month',
      calc() {
        const now = new Date();
        return { start: fmt(monthStart(now)), end: fmt(monthEnd(now)) };
      },
    },
    {
      label: 'Last Month',
      calc() {
        const d = monthsAgo(1);
        return { start: fmt(monthStart(d)), end: fmt(monthEnd(d)) };
      },
    },
    {
      label: '3 Months',
      calc() {
        return { start: fmt(monthStart(monthsAgo(2))), end: fmt(monthEnd(new Date())) };
      },
    },
    {
      label: '6 Months',
      calc() {
        return { start: fmt(monthStart(monthsAgo(5))), end: fmt(monthEnd(new Date())) };
      },
    },
    {
      label: '1 Year',
      calc() {
        return { start: fmt(monthStart(monthsAgo(11))), end: fmt(monthEnd(new Date())) };
      },
    },
    {
      label: 'Year to Date',
      calc() {
        const now = new Date();
        return { start: `${now.getFullYear()}-01-01`, end: fmt(monthEnd(now)) };
      },
    },
    {
      label: 'Last Year',
      calc() {
        const y = new Date().getFullYear() - 1;
        return { start: `${y}-01-01`, end: `${y}-12-31` };
      },
    },
    {
      label: 'Prior YTD',
      calc() {
        const now = new Date();
        const y = now.getFullYear() - 1;
        const endD = new Date(y, now.getMonth(), now.getDate());
        return { start: `${y}-01-01`, end: fmt(endD) };
      },
    },
    {
      label: 'All Time',
      calc() {
        return { start: '2000-01-01', end: fmt(new Date()) };
      },
    },
  ];

  // ── State ─────────────────────────────────────────────────────────────
  let state = {
    showIncome: getSetting('showIncome', true),
    showExpense: getSetting('showExpense', true),
    showSubCategories: getSetting('showSubCategories', true),
    showLossGain: getSetting('showLossGain', true),
    groupPositiveCategories: getSetting('groupPositiveCategories', false),
    startDate: getSetting('startDate', ''),
    endDate: getSetting('endDate', ''),
    activePreset: getSetting('activePreset', 'This Month'),
  };

  let categoriesCache = null;
  let categoryGroupsCache = null;
  let payeesCache = null;
  let accountsCache = null;
  let lastCalculatedData = null;
  let lastTransactions = null;

  // ── Helpers ───────────────────────────────────────────────────────────
  function formatCurrency(amountInCents) {
    const dollars = amountInCents / 100;
    return dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  // Format date from "2026-03-30" to "03/30/26"
  function formatDate(dateStr) {
    if (!dateStr || dateStr.length < 10) return dateStr || '';
    const [y, m, d] = dateStr.split('-');
    return `${m}/${d}/${y.slice(2)}`;
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // ── Data fetching ─────────────────────────────────────────────────────
  async function fetchCategories() {
    if (categoriesCache) return categoriesCache;
    const q = window.$q, query = window.$query;
    if (!q || !query) return [];
    const result = await query(q('categories').select('*'));
    categoriesCache = result.data || [];
    return categoriesCache;
  }

  async function fetchCategoryGroups() {
    if (categoryGroupsCache) return categoryGroupsCache;
    const q = window.$q, query = window.$query;
    if (!q || !query) return [];
    const result = await query(q('category_groups').select('*'));
    categoryGroupsCache = result.data || [];
    return categoryGroupsCache;
  }

  async function fetchPayees() {
    if (payeesCache) return payeesCache;
    const q = window.$q, query = window.$query;
    if (!q || !query) return [];
    const result = await query(q('payees').select('*'));
    payeesCache = result.data || [];
    return payeesCache;
  }

  async function fetchAccounts() {
    if (accountsCache) return accountsCache;
    const q = window.$q, query = window.$query;
    if (!q || !query) return [];
    const result = await query(q('accounts').select('*'));
    accountsCache = result.data || [];
    return accountsCache;
  }

  async function fetchTransactions(startDate, endDate) {
    const q = window.$q, query = window.$query;
    if (!q || !query) return [];
    const qb = q('transactions')
      .filter({ date: { $gte: startDate } })
      .filter({ date: { $lte: endDate } })
      .filter({ tombstone: false })
      .filter({ is_child: false })
      .select('*');
    const result = await query(qb);
    return result.data || [];
  }

  // ── Data processing ───────────────────────────────────────────────────
  async function calculateData(startDate, endDate) {
    const [transactions, categories, categoryGroups, payees, accounts] = await Promise.all([
      fetchTransactions(startDate, endDate),
      fetchCategories(),
      fetchCategoryGroups(),
      fetchPayees(),
      fetchAccounts(),
    ]);

    lastTransactions = transactions;

    const catMap = new Map(categories.map(c => [c.id, c]));
    const groupMap = new Map(categoryGroups.map(g => [g.id, g]));
    const payeeMap = new Map(payees.map(p => [p.id, p]));
    const accountMap = new Map(accounts.map(a => [a.id, a]));

    const incomes = new Map();
    const expenses = new Map();

    for (const tx of transactions) {
      if (!tx.category) continue;
      const cat = catMap.get(tx.category);
      if (!cat) continue;
      if (cat.is_income) {
        const payeeId = tx.payee;
        if (!payeeId) continue;
        const payee = payeeMap.get(payeeId);
        if (!payee) continue;
        incomes.set(payeeId, (incomes.get(payeeId) || 0) + tx.amount);
      } else {
        const groupId = cat.group;
        if (!groupId) continue;
        if (!expenses.has(groupId)) expenses.set(groupId, new Map());
        const subMap = expenses.get(groupId);
        subMap.set(tx.category, (subMap.get(tx.category) || 0) + tx.amount);
      }
    }

    lastCalculatedData = { incomes, expenses, catMap, groupMap, payeeMap, accountMap };
    return lastCalculatedData;
  }

  function buildSankeyData(data) {
    const { incomes, expenses, catMap, groupMap, payeeMap } = data;
    const { showIncome, showExpense, showSubCategories, showLossGain, groupPositiveCategories } = state;

    const nodes = [];
    const links = [];
    const nodeSet = new Set();

    function ensureNode(id, name) {
      if (!nodeSet.has(id)) { nodeSet.add(id); nodes.push({ id, name }); }
    }

    ensureNode('budget', 'Income');
    let totalIncome = 0;
    let totalExpense = 0;

    incomes.forEach((amount, payeeId) => {
      if (amount <= 0) return;
      const payee = payeeMap.get(payeeId);
      const name = payee ? payee.name : 'Unknown';
      if (showIncome) {
        ensureNode('payee-' + payeeId, name);
        links.push({ source: 'payee-' + payeeId, target: 'budget', value: amount });
      }
      totalIncome += amount;
    });

    let positiveCategoriesAmount = 0;
    const positiveCategoriesLinks = [];
    const categorySeriesData = [];

    expenses.forEach((subMap, groupId) => {
      const group = groupMap.get(groupId);
      const groupName = group ? group.name : 'Unknown Group';
      let masterTotal = 0;
      const subEntries = [];

      subMap.forEach((amount, catId) => {
        const cat = catMap.get(catId);
        const catName = cat ? cat.name : 'Unknown';
        if (amount > 0) {
          positiveCategoriesLinks.push({ source: 'cat-' + catId, target: 'budget', value: amount, catName });
          positiveCategoriesAmount += amount;
          totalIncome += amount;
          return;
        }
        const absAmount = Math.abs(amount);
        if (absAmount <= 0) return;
        subEntries.push({ catId, catName, absAmount });
        masterTotal += absAmount;
        totalExpense += absAmount;
      });

      if (masterTotal <= 0) return;
      categorySeriesData.push({ groupId, groupName, masterTotal, subEntries: subEntries.sort((a, b) => b.absAmount - a.absAmount) });
    });

    if (positiveCategoriesAmount > 0 && showIncome) {
      if (groupPositiveCategories) {
        ensureNode('positive-cats', 'POSITIVE CATEGORIES');
        links.push({ source: 'positive-cats', target: 'budget', value: positiveCategoriesAmount });
      } else {
        positiveCategoriesLinks.forEach(l => {
          ensureNode(l.source, l.catName);
          links.push({ source: l.source, target: l.target, value: l.value });
        });
      }
    }

    if (showExpense) {
      categorySeriesData.sort((a, b) => b.masterTotal - a.masterTotal);
      categorySeriesData.forEach(({ groupId, groupName, masterTotal, subEntries }) => {
        ensureNode('group-' + groupId, groupName);
        links.push({ source: 'budget', target: 'group-' + groupId, value: masterTotal });
        if (showSubCategories) {
          subEntries.forEach(({ catId, catName, absAmount }) => {
            ensureNode('cat-' + catId, catName);
            links.push({ source: 'group-' + groupId, target: 'cat-' + catId, value: absAmount });
          });
        }
      });
    }

    if (showLossGain && (showExpense || showIncome) && totalExpense !== totalIncome) {
      if (totalExpense > totalIncome) {
        ensureNode('net-loss', 'NET LOSS');
        const entry = { source: 'net-loss', target: 'budget', value: Math.abs(totalIncome - totalExpense) };
        totalIncome === 0 ? links.unshift(entry) : links.push(entry);
      } else {
        ensureNode('net-gain', 'NET GAIN');
        links.push({ source: 'budget', target: 'net-gain', value: totalIncome - totalExpense });
      }
    }

    return { nodes, links, totalIncome, totalExpense };
  }

  // ── Transaction popover ────────────────────────────────────────────────
  function getTransactionsForNode(nodeId) {
    if (!lastTransactions || !lastCalculatedData) return [];
    const { catMap } = lastCalculatedData;

    if (nodeId.startsWith('payee-')) {
      const payeeId = nodeId.replace('payee-', '');
      return lastTransactions.filter(tx => tx.payee === payeeId && tx.category && catMap.get(tx.category)?.is_income);
    }
    if (nodeId.startsWith('cat-')) {
      const catId = nodeId.replace('cat-', '');
      return lastTransactions.filter(tx => tx.category === catId);
    }
    if (nodeId.startsWith('group-')) {
      const groupId = nodeId.replace('group-', '');
      return lastTransactions.filter(tx => {
        if (!tx.category) return false;
        const cat = catMap.get(tx.category);
        return cat && cat.group === groupId && !cat.is_income;
      });
    }
    return [];
  }

  // Build filter conditions for navigating to All Accounts (mirrors Actual's showActivity)
  function buildFilterConditions(nodeId) {
    const conditions = [];

    // Date range filters
    if (state.startDate) {
      conditions.push({ field: 'date', op: 'gte', value: state.startDate, type: 'date' });
    }
    if (state.endDate) {
      conditions.push({ field: 'date', op: 'lte', value: state.endDate, type: 'date' });
    }

    // Node-specific filter
    if (nodeId.startsWith('payee-')) {
      conditions.push({ field: 'payee', op: 'is', value: nodeId.replace('payee-', ''), type: 'id' });
    } else if (nodeId.startsWith('cat-')) {
      conditions.push({ field: 'category', op: 'is', value: nodeId.replace('cat-', ''), type: 'id' });
    } else if (nodeId.startsWith('group-')) {
      // For category groups, find all categories in this group and use oneOf
      const groupId = nodeId.replace('group-', '');
      const { catMap } = lastCalculatedData;
      const catIds = [];
      catMap.forEach((cat, id) => {
        if (cat.group === groupId && !cat.is_income) catIds.push(id);
      });
      if (catIds.length === 1) {
        conditions.push({ field: 'category', op: 'is', value: catIds[0], type: 'id' });
      } else if (catIds.length > 1) {
        conditions.push({ field: 'category', op: 'oneOf', value: catIds, type: 'id' });
      }
    }

    return conditions;
  }

  // Navigate to All Accounts with pre-applied filters (like Actual's donut graph)
  function navigateToAccounts(nodeId) {
    const filterConditions = buildFilterConditions(nodeId);
    if (typeof window.__navigate === 'function') {
      window.__navigate('/accounts', {
        state: { goBack: true, filterConditions },
      });
    } else {
      // Fallback: use history.pushState + popstate for older Actual versions
      window.history.pushState(
        { usr: { goBack: true, filterConditions } },
        '',
        '/accounts'
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  function showTransactionPopover(nodeId, nodeName, anchorX, anchorY, container) {
    // Toggle: clicking the same node that's already open dismisses it
    const existing = document.getElementById('abt-ib-popover');
    if (existing && existing.dataset.nodeId === nodeId) {
      closeTransactionPopover();
      return;
    }
    closeTransactionPopover();

    const txs = getTransactionsForNode(nodeId);
    if (txs.length === 0) return;

    const { catMap, payeeMap, accountMap } = lastCalculatedData;

    const popover = document.createElement('div');
    popover.id = 'abt-ib-popover';
    popover.className = 'abt-ib-popover';
    popover.dataset.nodeId = nodeId;

    txs.sort((a, b) => b.date.localeCompare(a.date));
    const total = txs.reduce((s, t) => s + t.amount, 0);

    popover.innerHTML = `
      <div class="abt-ib-popover-header">
        <div class="abt-ib-popover-title">
          <span>${nodeName}</span>
          <span class="abt-ib-popover-total ${total >= 0 ? 'positive' : 'negative'}">${formatCurrency(total)}</span>
        </div>
        <div class="abt-ib-popover-actions">
          <span class="abt-ib-popover-count">${txs.length} transaction${txs.length !== 1 ? 's' : ''}</span>
          <button class="abt-ib-view-accounts" title="View in All Accounts with filters">View in Accounts &rarr;</button>
          <button class="abt-ib-popover-close" title="Close">&times;</button>
        </div>
      </div>
      <div class="abt-ib-popover-table-wrap">
        <table class="abt-ib-popover-table">
          <thead>
            <tr>
              <th class="col-date">Date</th>
              <th class="col-account">Account</th>
              <th class="col-payee">Payee</th>
              <th class="col-category">Category</th>
              <th class="col-notes">Notes</th>
              <th class="col-amount amount-col">Amount</th>
              <th class="col-status"></th>
            </tr>
          </thead>
          <tbody>
            ${txs.map(tx => {
              const payee = payeeMap.get(tx.payee);
              const cat = catMap.get(tx.category);
              const acct = accountMap.get(tx.account);
              const amtClass = tx.amount >= 0 ? 'positive' : 'negative';
              const statusClass = tx.reconciled ? 'reconciled' : tx.cleared ? 'cleared' : 'uncleared';
              const statusIcon = tx.reconciled ? '🔒' : tx.cleared ? '✓' : '•';
              const statusTitle = tx.reconciled ? 'Reconciled' : tx.cleared ? 'Cleared' : 'Not cleared';
              return `<tr class="abt-ib-tx-row">
                <td>${formatDate(tx.date)}</td>
                <td>${acct ? acct.name : '—'}</td>
                <td>${payee ? payee.name : '—'}</td>
                <td>${cat ? cat.name : '—'}</td>
                <td class="notes-col">${tx.notes || ''}</td>
                <td class="amount-col ${amtClass}">${formatCurrency(tx.amount)}</td>
                <td class="col-status status-${statusClass}" title="${statusTitle}">${statusIcon}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // "View in Accounts" button — navigate with filters, no page reload
    popover.querySelector('.abt-ib-view-accounts').addEventListener('click', () => {
      closeTransactionPopover();
      navigateToAccounts(nodeId);
    });

    // Append to body so it escapes all overflow clipping
    document.body.appendChild(popover);

    // Position using fixed viewport coordinates
    const containerRect = container.getBoundingClientRect();
    const popW = Math.min(900, window.innerWidth - 40);
    popover.style.width = popW + 'px';

    // anchorX/anchorY are relative to the SVG/container — convert to viewport
    const viewportX = containerRect.left + anchorX;
    const viewportY = containerRect.top + anchorY;

    const popH = popover.offsetHeight;
    // Prefer above the click; fall back to below
    let top = viewportY - popH - 8;
    if (top < 8) top = viewportY + 12;
    // Clamp to viewport bottom
    if (top + popH > window.innerHeight - 8) top = window.innerHeight - popH - 8;
    let left = viewportX - popW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));

    popover.style.top = top + 'px';
    popover.style.left = left + 'px';

    popover.querySelector('.abt-ib-popover-close').addEventListener('click', closeTransactionPopover);

    // Dismiss on click outside — but let node/link clicks reach their handlers
    // so they can toggle (close when clicking the same node) or swap popovers.
    function onOutsideClick(e) {
      // If this popover is already gone (replaced by a newer one), clean up.
      if (!popover.isConnected) {
        document.removeEventListener('mousedown', onOutsideClick, true);
        return;
      }
      if (popover.contains(e.target)) return;
      if (e.target.closest('.abt-ib-node') || e.target.closest('.abt-ib-link')) return;
      closeTransactionPopover();
      document.removeEventListener('mousedown', onOutsideClick, true);
    }
    // Delay to avoid catching the click that opened it
    setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);
  }

  function closeTransactionPopover() {
    const existing = document.getElementById('abt-ib-popover');
    if (existing) existing.remove();
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  function renderSankey(container, sankeyData) {
    const { nodes, links, totalIncome } = sankeyData;

    const chartOnly = container.querySelector('svg');
    const tooltipEl = container.querySelector('.abt-ib-tooltip');
    if (chartOnly) chartOnly.remove();
    if (tooltipEl) tooltipEl.remove();
    // Remove loading/empty msgs
    const msgs = container.querySelectorAll('.abt-ib-loading, .abt-ib-empty');
    msgs.forEach(m => m.remove());

    if (links.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'abt-ib-empty';
      empty.textContent = 'No data for selected period';
      container.insertBefore(empty, container.firstChild);
      return;
    }

    const width = container.clientWidth - 16;
    const height = container.clientHeight || 400;

    const svg = d3.select(container)
      .insert('svg', ':first-child')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const nodeById = new Map(nodes.map((n, i) => [n.id, i]));
    const sankeyNodes = nodes.map(n => ({ ...n }));
    const sankeyLinks = links
      .filter(l => nodeById.has(l.source) && nodeById.has(l.target))
      .map(l => ({ source: nodeById.get(l.source), target: nodeById.get(l.target), value: l.value }));

    if (sankeyLinks.length === 0) {
      svg.remove();
      const empty = document.createElement('div');
      empty.className = 'abt-ib-empty';
      empty.textContent = 'No data for selected period';
      container.insertBefore(empty, container.firstChild);
      return;
    }

    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const sankey = d3.sankey()
      .nodeId(d => d.index)
      .nodeWidth(18)
      .nodePadding(10)
      .nodeAlign(d3.sankeyJustify)
      .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

    const graph = sankey({ nodes: sankeyNodes, links: sankeyLinks });

    const fallbackColors = [
      '#f38ba8', '#fab387', '#f9e2af', '#a6e3a1',
      '#94e2d5', '#89b4fa', '#b4befe', '#cba6f7',
      '#f5c2e7', '#f2cdcd', '#f5e0dc', '#89dceb',
      '#74c7ec', '#eba0ac',
    ];

    function getNodeColor(node) {
      if (node.id === 'budget') return '#cdd6f4';
      if (node.id === 'net-gain') return '#a6e3a1';
      if (node.id === 'net-loss') return '#f38ba8';
      if (node.id === 'positive-cats') return '#a6e3a1';
      return fallbackColors[node.index % fallbackColors.length];
    }

    // Tooltip
    const tooltip = d3.select(container)
      .insert('div', ':first-child')
      .attr('class', 'abt-ib-tooltip')
      .style('opacity', 0);

    // Move SVG before tooltip
    container.insertBefore(container.querySelector('svg'), container.querySelector('.abt-ib-tooltip'));

    // Determine which node a link click should resolve to (the more specific end)
    function clickableNodeForLink(d) {
      // Prefer the non-"budget" end; for group→cat links prefer the cat
      if (d.target.id !== 'budget') return d.target;
      if (d.source.id !== 'budget') return d.source;
      return d.target;
    }

    // Links — clickable bars
    const linkSel = svg.append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('stroke', d => d.source.id === 'budget' ? getNodeColor(d.target) : getNodeColor(d.source))
      .attr('stroke-opacity', 0.35)
      .attr('stroke-width', d => Math.max(1, d.width))
      .attr('class', 'abt-ib-link')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('stroke-opacity', 0.6);
        const pct = totalIncome > 0 ? ((d.value / totalIncome) * 100).toFixed(1) : '0';
        const node = clickableNodeForLink(d);
        const hint = (node.id !== 'budget' && node.id !== 'net-gain' && node.id !== 'net-loss')
          ? '<br><span class="abt-ib-tooltip-hint">Click to view transactions</span>' : '';
        tooltip.style('opacity', 1)
          .html(`${d.source.name} → ${d.target.name}<br><strong>${formatCurrency(d.value)} (${pct}%)</strong>${hint}`);
      })
      .on('mousemove', function (event) {
        tooltip.style('left', (event.offsetX + 12) + 'px').style('top', (event.offsetY - 10) + 'px');
      })
      .on('mouseleave', function () {
        d3.select(this).attr('stroke-opacity', 0.35);
        tooltip.style('opacity', 0);
      })
      .on('click', function (event, d) {
        event.stopPropagation();
        tooltip.style('opacity', 0);
        const node = clickableNodeForLink(d);
        if (node.id === 'budget' || node.id === 'net-gain' || node.id === 'net-loss') return;
        showTransactionPopover(node.id, node.name, event.offsetX, event.offsetY, container);
      });

    // Nodes — clickable rects
    svg.append('g')
      .selectAll('rect')
      .data(graph.nodes)
      .join('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('height', d => Math.max(1, d.y1 - d.y0))
      .attr('width', d => d.x1 - d.x0)
      .attr('fill', d => getNodeColor(d))
      .attr('rx', 3)
      .attr('opacity', 0.9)
      .attr('class', 'abt-ib-node')
      .on('mouseenter', function (event, d) {
        linkSel.attr('stroke-opacity', l => l.source === d || l.target === d ? 0.6 : 0.15);
        const hint = (d.id !== 'budget' && d.id !== 'net-gain' && d.id !== 'net-loss')
          ? '<br><span class="abt-ib-tooltip-hint">Click to view transactions</span>' : '';
        tooltip.style('opacity', 1).html(`${d.name}<br><strong>${formatCurrency(d.value || 0)}</strong>${hint}`);
      })
      .on('mousemove', function (event) {
        tooltip.style('left', (event.offsetX + 12) + 'px').style('top', (event.offsetY - 10) + 'px');
      })
      .on('mouseleave', function () {
        linkSel.attr('stroke-opacity', 0.35);
        tooltip.style('opacity', 0);
      })
      .on('click', function (event, d) {
        event.stopPropagation();
        tooltip.style('opacity', 0);
        if (d.id === 'budget' || d.id === 'net-gain' || d.id === 'net-loss') return;
        showTransactionPopover(d.id, d.name, event.offsetX, event.offsetY, container);
      });

    // Labels
    svg.append('g')
      .selectAll('text')
      .data(graph.nodes)
      .join('text')
      .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
      .attr('y', d => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
      .attr('class', 'abt-ib-label')
      .text(d => d.name)
      .append('tspan')
      .attr('class', 'abt-ib-label-amount')
      .text(d => ' ' + formatCurrency(d.value || 0));
  }

  // ── Widget UI ─────────────────────────────────────────────────────────
  function applyPreset(label) {
    const preset = DATE_PRESETS.find(p => p.label === label);
    if (!preset) return;
    const { start, end } = preset.calc();
    state.startDate = start;
    state.endDate = end;
    state.activePreset = label;
    setSetting('startDate', start);
    setSetting('endDate', end);
    setSetting('activePreset', label);
  }

  function createWidget() {
    const existing = document.getElementById(WIDGET_ID);
    if (existing) existing.remove();

    // Apply default preset if no dates set
    if (!state.startDate || !state.endDate) {
      applyPreset(state.activePreset || 'This Month');
    }

    const widget = document.createElement('div');
    widget.id = WIDGET_ID;
    widget.className = 'abt-ib-widget';

    const presetButtons = DATE_PRESETS.map(p =>
      `<button class="abt-ib-preset${state.activePreset === p.label ? ' active' : ''}" data-preset="${p.label}">${p.label}</button>`
    ).join('');

    widget.innerHTML = `
      <div class="abt-ib-header">
        <div class="abt-ib-header-left">
          <h2 class="abt-ib-title">Income Breakdown</h2>
          <span class="abt-ib-subtitle">${state.startDate} – ${state.endDate}</span>
        </div>
      </div>
      <div class="abt-ib-controls">
        <div class="abt-ib-presets">${presetButtons}</div>
        <div class="abt-ib-date-row">
          <label class="abt-ib-field-label">From <input type="date" class="abt-ib-input" id="abt-ib-start" value="${state.startDate}"></label>
          <label class="abt-ib-field-label">To <input type="date" class="abt-ib-input" id="abt-ib-end" value="${state.endDate}"></label>
        </div>
        <div class="abt-ib-toggles">
          <label class="abt-ib-toggle"><input type="checkbox" id="abt-ib-income" ${state.showIncome ? 'checked' : ''}>Income</label>
          <label class="abt-ib-toggle"><input type="checkbox" id="abt-ib-expense" ${state.showExpense ? 'checked' : ''}>Expenses</label>
          <label class="abt-ib-toggle"><input type="checkbox" id="abt-ib-subcats" ${state.showSubCategories ? 'checked' : ''} ${!state.showExpense ? 'disabled' : ''}>Subcategories</label>
          <label class="abt-ib-toggle"><input type="checkbox" id="abt-ib-lossgain" ${state.showLossGain ? 'checked' : ''}>Net Gain/Loss</label>
          <label class="abt-ib-toggle"><input type="checkbox" id="abt-ib-grouppos" ${state.groupPositiveCategories ? 'checked' : ''}>Group Positive</label>
        </div>
      </div>
      <div class="abt-ib-chart-container" id="abt-ib-chart"></div>
    `;

    return widget;
  }

  function updateSubtitle() {
    const sub = document.querySelector('.abt-ib-subtitle');
    if (sub) sub.textContent = `${state.startDate} – ${state.endDate}`;
  }

  function attachEventListeners(widget) {
    const refresh = debounce(() => loadAndRender(), DEBOUNCE_MS);

    // Presets
    widget.querySelectorAll('.abt-ib-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        applyPreset(btn.dataset.preset);
        // Update active state
        widget.querySelectorAll('.abt-ib-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Update date inputs
        widget.querySelector('#abt-ib-start').value = state.startDate;
        widget.querySelector('#abt-ib-end').value = state.endDate;
        updateSubtitle();
        refresh();
      });
    });

    // Date inputs
    widget.querySelector('#abt-ib-start').addEventListener('change', (e) => {
      state.startDate = e.target.value;
      state.activePreset = '';
      setSetting('startDate', state.startDate);
      setSetting('activePreset', '');
      widget.querySelectorAll('.abt-ib-preset').forEach(b => b.classList.remove('active'));
      updateSubtitle();
      refresh();
    });

    widget.querySelector('#abt-ib-end').addEventListener('change', (e) => {
      state.endDate = e.target.value;
      state.activePreset = '';
      setSetting('endDate', state.endDate);
      setSetting('activePreset', '');
      widget.querySelectorAll('.abt-ib-preset').forEach(b => b.classList.remove('active'));
      updateSubtitle();
      refresh();
    });

    // Toggles
    const toggles = [
      { id: 'abt-ib-income', key: 'showIncome' },
      { id: 'abt-ib-expense', key: 'showExpense' },
      { id: 'abt-ib-subcats', key: 'showSubCategories' },
      { id: 'abt-ib-lossgain', key: 'showLossGain' },
      { id: 'abt-ib-grouppos', key: 'groupPositiveCategories' },
    ];

    toggles.forEach(({ id, key }) => {
      widget.querySelector('#' + id).addEventListener('change', (e) => {
        state[key] = e.target.checked;
        setSetting(key, state[key]);
        if (key === 'showExpense') {
          widget.querySelector('#abt-ib-subcats').disabled = !state.showExpense;
        }
        refresh();
      });
    });

    // Close popover when clicking chart background
    widget.querySelector('#abt-ib-chart').addEventListener('click', (e) => {
      if (e.target.closest('.abt-ib-popover') || e.target.closest('.abt-ib-node') || e.target.closest('.abt-ib-link')) return;
      closeTransactionPopover();
    });
  }

  async function loadAndRender() {
    const chart = document.getElementById('abt-ib-chart');
    if (!chart) return;

    // Show loading only if no existing chart
    if (!chart.querySelector('svg')) {
      chart.innerHTML = '<div class="abt-ib-loading">Loading...</div>';
    }

    try {
      const data = await calculateData(state.startDate, state.endDate);
      const sankeyData = buildSankeyData(data);
      renderSankey(chart, sankeyData);
    } catch (err) {
      console.error('[ABT Income Breakdown] Error:', err);
      chart.innerHTML = `<div class="abt-ib-empty">Error loading data: ${err.message}</div>`;
    }
  }

  // ── Injection — overlay on top of the markdown placeholder widget ─────
  function isReportsPage() {
    return window.location.pathname.includes('/reports');
  }

  function findPlaceholderWidget() {
    const gridItems = document.querySelectorAll('.react-grid-item');
    for (const item of gridItems) {
      // Only match items we haven't already overlaid
      if (item.dataset.abtOverlaid) continue;
      if (item.textContent.includes(PLACEHOLDER_TEXT)) {
        return item;
      }
    }
    return null;
  }

  let activeResizeObserver = null;

  function injectWidget() {
    if (!isReportsPage()) return;
    if (document.getElementById(WIDGET_ID)) return;
    if (typeof d3 === 'undefined' || typeof d3.sankey !== 'function') return;
    if (!window.$q || !window.$query) return;

    const gridItem = findPlaceholderWidget();
    if (!gridItem) return;

    // Mark so we don't match again
    gridItem.dataset.abtOverlaid = '1';

    // Hide the original markdown content visually but keep it in the DOM
    // so React doesn't crash on re-render
    const originalContent = gridItem.querySelector('div');
    if (originalContent) originalContent.style.visibility = 'hidden';

    // Create and overlay our widget
    const widget = createWidget();
    gridItem.appendChild(widget);

    // Fit chart to available space
    const resizeChart = debounce(() => {
      const chart = document.getElementById('abt-ib-chart');
      if (!chart) return;
      const itemH = gridItem.offsetHeight;
      const chartTop = chart.getBoundingClientRect().top - gridItem.getBoundingClientRect().top;
      const available = itemH - chartTop - 4;
      if (available > 80) chart.style.height = available + 'px';
    }, 100);

    // Observe grid item resize
    if (activeResizeObserver) activeResizeObserver.disconnect();
    activeResizeObserver = new ResizeObserver(() => {
      resizeChart();
      loadAndRender();
    });
    activeResizeObserver.observe(gridItem);

    attachEventListeners(widget);
    resizeChart();
    loadAndRender();
  }

  // ── Page observer ─────────────────────────────────────────────────────
  let lastUrl = '';
  function checkAndInject() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      categoriesCache = null;
      categoryGroupsCache = null;
      payeesCache = null;
      accountsCache = null;
    }
    if (isReportsPage() && !document.getElementById(WIDGET_ID)) {
      setTimeout(injectWidget, 800);
    }
  }

  const observer = new MutationObserver(() => {
    if (isReportsPage() && !document.getElementById(WIDGET_ID)) {
      injectWidget();
    }
  });

  function init() {
    checkAndInject();
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(checkAndInject, POLL_INTERVAL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
