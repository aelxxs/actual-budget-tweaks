// @ts-nocheck

import * as d3 from "d3";
import { sankey, sankeyJustify, sankeyLinkHorizontal } from "d3-sankey";
import { dashboardWidgetUtils } from "./dashboard-widget-utils";

(function () {
	"use strict";

	const STORAGE_PREFIX = "abt-income-breakdown-";
	const WIDGET_ID_PREFIX = "abt-income-breakdown-widget";
	const WIDGET_CLASS = "abt-ib-widget";
	const PLACEHOLDER_TEXT = "placeholder — extension will render here";
	const DEFAULT_WIDGET_NAME = "Income Breakdown";
	const DEFAULT_WIDGET_WIDTH = 8;
	const DEFAULT_WIDGET_HEIGHT = 4;
	const DASHBOARD_QUERY_KEY = ["dashboards", "lists"];
	const NON_DRAGGABLE_CLASS = "non-draggable-area";
	const POLL_INTERVAL = 1500;
	const DEBOUNCE_MS = 300;
	const INCOME_BREAKDOWN_WIDGET = dashboardWidgetUtils.createMarkdownWidgetDefinition({
		key: "income-breakdown",
		label: DEFAULT_WIDGET_NAME,
		placeholderText: PLACEHOLDER_TEXT,
		width: DEFAULT_WIDGET_WIDTH,
		height: DEFAULT_WIDGET_HEIGHT,
	}) || {
		key: "income-breakdown",
		label: DEFAULT_WIDGET_NAME,
		matchesRecord(widget) {
			const meta = parseMeta(widget?.meta);
			return widget?.type === "markdown-card" && String(meta.content || "").includes(PLACEHOLDER_TEXT);
		},
		buildWidgetPayload(dashboardPageId) {
			return {
				type: "markdown-card",
				width: DEFAULT_WIDGET_WIDTH,
				height: DEFAULT_WIDGET_HEIGHT,
				meta: {
					content: PLACEHOLDER_TEXT,
					name: DEFAULT_WIDGET_NAME,
				},
				dashboard_page_id: dashboardPageId,
			};
		},
	};
	const CUSTOM_DASHBOARD_WIDGETS = [INCOME_BREAKDOWN_WIDGET];

	// ── Settings persistence ──────────────────────────────────────────────
	function getSetting(key, defaultValue) {
		try {
			const v = localStorage.getItem(STORAGE_PREFIX + key);
			return v === null ? defaultValue : JSON.parse(v);
		} catch {
			return defaultValue;
		}
	}
	function setSetting(key, value) {
		localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
	}

	// ── Date preset helpers ───────────────────────────────────────────────
	function fmt(d) {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}
	function monthStart(d) {
		return new Date(d.getFullYear(), d.getMonth(), 1);
	}
	function monthEnd(d) {
		return new Date(d.getFullYear(), d.getMonth() + 1, 0);
	}

	// monthsAgo: create a Date rewound by N months (safe for month-end rollover)
	function monthsAgo(n) {
		const d = new Date();
		d.setDate(1);
		d.setMonth(d.getMonth() - n);
		return d;
	}

	const DATE_PRESETS = [
		{
			label: "This Month",
			calc() {
				const now = new Date();
				return { start: fmt(monthStart(now)), end: fmt(monthEnd(now)) };
			},
		},
		{
			label: "Last Month",
			calc() {
				const d = monthsAgo(1);
				return { start: fmt(monthStart(d)), end: fmt(monthEnd(d)) };
			},
		},
		{
			label: "3 Months",
			calc() {
				return { start: fmt(monthStart(monthsAgo(2))), end: fmt(monthEnd(new Date())) };
			},
		},
		{
			label: "6 Months",
			calc() {
				return { start: fmt(monthStart(monthsAgo(5))), end: fmt(monthEnd(new Date())) };
			},
		},
		{
			label: "1 Year",
			calc() {
				return { start: fmt(monthStart(monthsAgo(11))), end: fmt(monthEnd(new Date())) };
			},
		},
		{
			label: "Year to Date",
			calc() {
				const now = new Date();
				return { start: `${now.getFullYear()}-01-01`, end: fmt(monthEnd(now)) };
			},
		},
		{
			label: "Last Year",
			calc() {
				const y = new Date().getFullYear() - 1;
				return { start: `${y}-01-01`, end: `${y}-12-31` };
			},
		},
		{
			label: "Prior YTD",
			calc() {
				const now = new Date();
				const y = now.getFullYear() - 1;
				const endD = new Date(y, now.getMonth(), now.getDate());
				return { start: `${y}-01-01`, end: fmt(endD) };
			},
		},
		{
			label: "All Time",
			calc() {
				return { start: "2000-01-01", end: fmt(new Date()) };
			},
		},
	];

	// ── State ─────────────────────────────────────────────────────────────
	let state = {
		showIncome: getSetting("showIncome", true),
		showExpense: getSetting("showExpense", true),
		showSubCategories: getSetting("showSubCategories", true),
		showLossGain: getSetting("showLossGain", true),
		groupPositiveCategories: getSetting("groupPositiveCategories", false),
		startDate: getSetting("startDate", ""),
		endDate: getSetting("endDate", ""),
		activePreset: getSetting("activePreset", "This Month"),
	};

	let categoriesCache = null;
	let categoryGroupsCache = null;
	let payeesCache = null;
	let accountsCache = null;
	let lastCalculatedData = null;
	let lastTransactions = null;
	let dashboardWidgetsCache = null;
	let dashboardPagesCache = null;
	let isPrivacyMode = false;
	let isInjecting = false;
	let activeMenu = null;
	const resizeObservers = new Map();

	// ── Helpers ───────────────────────────────────────────────────────────
	function formatCurrency(amountInCents) {
		const dollars = amountInCents / 100;
		return dollars.toLocaleString("en-US", { style: "currency", currency: "USD" });
	}

	// Format date from "2026-03-30" to "03/30/26"
	function formatDate(dateStr) {
		if (!dateStr || dateStr.length < 10) return dateStr || "";
		const [y, m, d] = dateStr.split("-");
		return `${m}/${d}/${y.slice(2)}`;
	}

	function debounce(fn, ms) {
		let t;
		return (...args) => {
			clearTimeout(t);
			t = setTimeout(() => fn(...args), ms);
		};
	}

	function escapeHtml(value) {
		return String(value ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	function parseMeta(meta) {
		if (!meta) return {};
		if (typeof meta === "string") {
			try {
				return JSON.parse(meta) || {};
			} catch {
				return {};
			}
		}
		return meta;
	}

	function isIncomeBreakdownWidgetRecord(widget) {
		return INCOME_BREAKDOWN_WIDGET.matchesRecord(widget);
	}

	function getWidgetName(widgetRecord) {
		const meta = parseMeta(widgetRecord?.meta);
		return meta.name || DEFAULT_WIDGET_NAME;
	}

	function getWidgetElementId(widgetRecord) {
		return `${WIDGET_ID_PREFIX}-${widgetRecord?.id || "unknown"}`;
	}

	function invalidateDashboardQueries() {
		const queryClient = window.__TANSTACK_QUERY_CLIENT__;
		if (queryClient?.invalidateQueries) {
			queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
		}
	}

	function resetDashboardWidgetCaches() {
		dashboardWidgetsCache = null;
		dashboardPagesCache = null;
	}

	async function fetchDashboardWidgets() {
		if (dashboardWidgetsCache) return dashboardWidgetsCache;
		const q = window.$q,
			query = window.$query;
		if (!q || !query) return [];
		const result = await query(q("dashboard").select("*"));
		dashboardWidgetsCache = result.data || [];
		return dashboardWidgetsCache;
	}

	async function fetchDashboardPages() {
		if (dashboardPagesCache) return dashboardPagesCache;
		const q = window.$q,
			query = window.$query;
		if (!q || !query) return [];
		const result = await query(q("dashboard_pages").select("*"));
		dashboardPagesCache = result.data || [];
		return dashboardPagesCache;
	}

	function getDashboardIdFromUrl() {
		const match = window.location.pathname.match(/^\/reports\/([^/?#]+)/);
		return match ? decodeURIComponent(match[1]) : null;
	}

	async function getCurrentDashboardId() {
		const fromUrl = getDashboardIdFromUrl();
		if (fromUrl) return fromUrl;
		const pages = await fetchDashboardPages();
		return pages[0]?.id || null;
	}

	async function getIncomeBreakdownWidgetRecords() {
		const currentDashboardId = await getCurrentDashboardId();
		const widgets = await fetchDashboardWidgets();
		return widgets
			.filter(isIncomeBreakdownWidgetRecord)
			.filter((widget) => !currentDashboardId || widget.dashboard_page_id === currentDashboardId)
			.sort((a, b) => a.y - b.y || a.x - b.x);
	}

	async function refreshPrivacyMode() {
		const q = window.$q,
			query = window.$query;
		if (!q || !query) return;
		try {
			const result = await query(q("preferences").filter({ id: "isPrivacyEnabled" }).select("*"));
			isPrivacyMode = String(result.data?.[0]?.value) === "true";
			document.querySelectorAll(`.${WIDGET_CLASS}, .abt-ib-popover`).forEach((el) => {
				el.classList.toggle("abt-ib-privacy", isPrivacyMode);
			});
		} catch (err) {
			console.warn("[ABT Income Breakdown] Failed to read privacy mode:", err);
		}
	}

	function isDashboardEditing() {
		return Boolean(document.querySelector(".react-grid-item .hover-visible.non-draggable-area"));
	}

	function syncWidgetModeClasses() {
		const editing = isDashboardEditing();
		document.querySelectorAll(`.${WIDGET_CLASS}`).forEach((widget) => {
			widget.classList.toggle("abt-ib-editing", editing);
			widget.closest(".react-grid-item")?.classList.toggle("abt-ib-host-editing", editing);
		});
		if (editing) closeTransactionPopover();
	}

	async function sendDashboardMutation(name, args) {
		if (typeof window.$send !== "function") {
			throw new Error("Actual send API is unavailable.");
		}
		const result = await window.$send(name, args);
		resetDashboardWidgetCaches();
		invalidateDashboardQueries();
		setTimeout(() => {
			void injectWidgets();
		}, 250);
		return result;
	}

	async function updateDashboardWidgetMeta(widgetRecord, updates) {
		if (!widgetRecord?.id) return;
		const nextMeta = { ...parseMeta(widgetRecord.meta), ...updates };
		widgetRecord.meta = nextMeta;
		await sendDashboardMutation("dashboard-update-widget", {
			id: widgetRecord.id,
			meta: nextMeta,
		});
	}

	async function addIncomeBreakdownWidget() {
		const dashboardId = await getCurrentDashboardId();
		if (!dashboardId) return;
		await sendDashboardMutation("dashboard-add-widget", INCOME_BREAKDOWN_WIDGET.buildWidgetPayload(dashboardId));
	}

	async function addCustomDashboardWidget(widgetDefinition) {
		const dashboardId = await getCurrentDashboardId();
		if (!dashboardId) return;
		await sendDashboardMutation("dashboard-add-widget", widgetDefinition.buildWidgetPayload(dashboardId));
	}

	function dismissNativeMenu(anchor) {
		const eventInit = {
			key: "Escape",
			code: "Escape",
			keyCode: 27,
			which: 27,
			bubbles: true,
			cancelable: true,
		};
		anchor.dispatchEvent(new KeyboardEvent("keydown", eventInit));
		document.dispatchEvent(new KeyboardEvent("keydown", eventInit));
	}

	// ── Data fetching ─────────────────────────────────────────────────────
	async function fetchCategories() {
		if (categoriesCache) return categoriesCache;
		const q = window.$q,
			query = window.$query;
		if (!q || !query) return [];
		const result = await query(q("categories").select("*"));
		categoriesCache = result.data || [];
		return categoriesCache;
	}

	async function fetchCategoryGroups() {
		if (categoryGroupsCache) return categoryGroupsCache;
		const q = window.$q,
			query = window.$query;
		if (!q || !query) return [];
		const result = await query(q("category_groups").select("*"));
		categoryGroupsCache = result.data || [];
		return categoryGroupsCache;
	}

	async function fetchPayees() {
		if (payeesCache) return payeesCache;
		const q = window.$q,
			query = window.$query;
		if (!q || !query) return [];
		const result = await query(q("payees").select("*"));
		payeesCache = result.data || [];
		return payeesCache;
	}

	async function fetchAccounts() {
		if (accountsCache) return accountsCache;
		const q = window.$q,
			query = window.$query;
		if (!q || !query) return [];
		const result = await query(q("accounts").select("*"));
		accountsCache = result.data || [];
		return accountsCache;
	}

	async function fetchTransactions(startDate, endDate) {
		const q = window.$q,
			query = window.$query;
		if (!q || !query) return [];
		const qb = q("transactions")
			.filter({ date: { $gte: startDate } })
			.filter({ date: { $lte: endDate } })
			.filter({ tombstone: false })
			.filter({ is_child: false })
			.select("*");
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

		const catMap = new Map(categories.map((c) => [c.id, c]));
		const groupMap = new Map(categoryGroups.map((g) => [g.id, g]));
		const payeeMap = new Map(payees.map((p) => [p.id, p]));
		const accountMap = new Map(accounts.map((a) => [a.id, a]));

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
			if (!nodeSet.has(id)) {
				nodeSet.add(id);
				nodes.push({ id, name });
			}
		}

		ensureNode("budget", "Income");
		let totalIncome = 0;
		let totalExpense = 0;

		incomes.forEach((amount, payeeId) => {
			if (amount <= 0) return;
			const payee = payeeMap.get(payeeId);
			const name = payee ? payee.name : "Unknown";
			if (showIncome) {
				ensureNode("payee-" + payeeId, name);
				links.push({ source: "payee-" + payeeId, target: "budget", value: amount });
			}
			totalIncome += amount;
		});

		let positiveCategoriesAmount = 0;
		const positiveCategoriesLinks = [];
		const categorySeriesData = [];

		expenses.forEach((subMap, groupId) => {
			const group = groupMap.get(groupId);
			const groupName = group ? group.name : "Unknown Group";
			let masterTotal = 0;
			const subEntries = [];

			subMap.forEach((amount, catId) => {
				const cat = catMap.get(catId);
				const catName = cat ? cat.name : "Unknown";
				if (amount > 0) {
					positiveCategoriesLinks.push({ source: "cat-" + catId, target: "budget", value: amount, catName });
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
			categorySeriesData.push({
				groupId,
				groupName,
				masterTotal,
				subEntries: subEntries.sort((a, b) => b.absAmount - a.absAmount),
			});
		});

		if (positiveCategoriesAmount > 0 && showIncome) {
			if (groupPositiveCategories) {
				ensureNode("positive-cats", "POSITIVE CATEGORIES");
				links.push({ source: "positive-cats", target: "budget", value: positiveCategoriesAmount });
			} else {
				positiveCategoriesLinks.forEach((l) => {
					ensureNode(l.source, l.catName);
					links.push({ source: l.source, target: l.target, value: l.value });
				});
			}
		}

		if (showExpense) {
			categorySeriesData.sort((a, b) => b.masterTotal - a.masterTotal);
			categorySeriesData.forEach(({ groupId, groupName, masterTotal, subEntries }) => {
				ensureNode("group-" + groupId, groupName);
				links.push({ source: "budget", target: "group-" + groupId, value: masterTotal });
				if (showSubCategories) {
					subEntries.forEach(({ catId, catName, absAmount }) => {
						ensureNode("cat-" + catId, catName);
						links.push({ source: "group-" + groupId, target: "cat-" + catId, value: absAmount });
					});
				}
			});
		}

		if (showLossGain && (showExpense || showIncome) && totalExpense !== totalIncome) {
			if (totalExpense > totalIncome) {
				ensureNode("net-loss", "NET LOSS");
				const entry = { source: "net-loss", target: "budget", value: Math.abs(totalIncome - totalExpense) };
				totalIncome === 0 ? links.unshift(entry) : links.push(entry);
			} else {
				ensureNode("net-gain", "NET GAIN");
				links.push({ source: "budget", target: "net-gain", value: totalIncome - totalExpense });
			}
		}

		return { nodes, links, totalIncome, totalExpense };
	}

	// ── Transaction popover ────────────────────────────────────────────────
	function getTransactionsForNode(nodeId) {
		if (!lastTransactions || !lastCalculatedData) return [];
		const { catMap } = lastCalculatedData;

		if (nodeId.startsWith("payee-")) {
			const payeeId = nodeId.replace("payee-", "");
			return lastTransactions.filter(
				(tx) => tx.payee === payeeId && tx.category && catMap.get(tx.category)?.is_income,
			);
		}
		if (nodeId.startsWith("cat-")) {
			const catId = nodeId.replace("cat-", "");
			return lastTransactions.filter((tx) => tx.category === catId);
		}
		if (nodeId.startsWith("group-")) {
			const groupId = nodeId.replace("group-", "");
			return lastTransactions.filter((tx) => {
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
			conditions.push({ field: "date", op: "gte", value: state.startDate, type: "date" });
		}
		if (state.endDate) {
			conditions.push({ field: "date", op: "lte", value: state.endDate, type: "date" });
		}

		// Node-specific filter
		if (nodeId.startsWith("payee-")) {
			conditions.push({ field: "payee", op: "is", value: nodeId.replace("payee-", ""), type: "id" });
		} else if (nodeId.startsWith("cat-")) {
			conditions.push({ field: "category", op: "is", value: nodeId.replace("cat-", ""), type: "id" });
		} else if (nodeId.startsWith("group-")) {
			// For category groups, find all categories in this group and use oneOf
			const groupId = nodeId.replace("group-", "");
			const { catMap } = lastCalculatedData;
			const catIds = [];
			catMap.forEach((cat, id) => {
				if (cat.group === groupId && !cat.is_income) catIds.push(id);
			});
			if (catIds.length === 1) {
				conditions.push({ field: "category", op: "is", value: catIds[0], type: "id" });
			} else if (catIds.length > 1) {
				conditions.push({ field: "category", op: "oneOf", value: catIds, type: "id" });
			}
		}

		return conditions;
	}

	// Navigate to All Accounts with pre-applied filters (like Actual's donut graph)
	function navigateToAccounts(nodeId) {
		const filterConditions = buildFilterConditions(nodeId);
		if (typeof window.__navigate === "function") {
			window.__navigate("/accounts", {
				state: { goBack: true, filterConditions },
			});
		} else {
			// Fallback: use history.pushState + popstate for older Actual versions
			window.history.pushState({ usr: { goBack: true, filterConditions } }, "", "/accounts");
			window.dispatchEvent(new PopStateEvent("popstate"));
		}
	}

	function showTransactionPopover(nodeId, nodeName, anchorX, anchorY, container) {
		if (isDashboardEditing()) return;
		// Toggle: clicking the same node that's already open dismisses it
		const existing = document.getElementById("abt-ib-popover");
		if (existing && existing.dataset.nodeId === nodeId) {
			closeTransactionPopover();
			return;
		}
		closeTransactionPopover();

		const txs = getTransactionsForNode(nodeId);
		if (txs.length === 0) return;

		const { catMap, payeeMap, accountMap } = lastCalculatedData;

		const popover = document.createElement("div");
		popover.id = "abt-ib-popover";
		popover.className = "abt-ib-popover";
		popover.classList.toggle("abt-ib-privacy", isPrivacyMode);
		popover.dataset.nodeId = nodeId;

		txs.sort((a, b) => b.date.localeCompare(a.date));
		const total = txs.reduce((s, t) => s + t.amount, 0);

		popover.innerHTML = `
      <div class="abt-ib-popover-header">
        <div class="abt-ib-popover-title">
          <span>${nodeName}</span>
          <span class="abt-ib-popover-total abt-ib-private ${total >= 0 ? "positive" : "negative"}">${formatCurrency(total)}</span>
        </div>
        <div class="abt-ib-popover-actions">
          <span class="abt-ib-popover-count">${txs.length} transaction${txs.length !== 1 ? "s" : ""}</span>
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
            ${txs
				.map((tx) => {
					const payee = payeeMap.get(tx.payee);
					const cat = catMap.get(tx.category);
					const acct = accountMap.get(tx.account);
					const amtClass = tx.amount >= 0 ? "positive" : "negative";
					const statusClass = tx.reconciled ? "reconciled" : tx.cleared ? "cleared" : "uncleared";
					const statusIcon = tx.reconciled ? "🔒" : tx.cleared ? "✓" : "•";
					const statusTitle = tx.reconciled ? "Reconciled" : tx.cleared ? "Cleared" : "Not cleared";
					return `<tr class="abt-ib-tx-row">
                <td>${formatDate(tx.date)}</td>
                <td>${acct ? acct.name : "—"}</td>
                <td>${payee ? payee.name : "—"}</td>
                <td>${cat ? cat.name : "—"}</td>
                <td class="notes-col">${tx.notes || ""}</td>
                <td class="amount-col abt-ib-private ${amtClass}">${formatCurrency(tx.amount)}</td>
                <td class="col-status status-${statusClass}" title="${statusTitle}">${statusIcon}</td>
              </tr>`;
				})
				.join("")}
          </tbody>
        </table>
      </div>
    `;

		// "View in Accounts" button — navigate with filters, no page reload
		popover.querySelector(".abt-ib-view-accounts").addEventListener("click", () => {
			closeTransactionPopover();
			navigateToAccounts(nodeId);
		});

		// Append to body so it escapes all overflow clipping
		document.body.appendChild(popover);

		// Position using fixed viewport coordinates
		const containerRect = container.getBoundingClientRect();
		const popW = Math.min(900, window.innerWidth - 40);
		popover.style.width = popW + "px";

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

		popover.style.top = top + "px";
		popover.style.left = left + "px";

		popover.querySelector(".abt-ib-popover-close").addEventListener("click", closeTransactionPopover);

		// Dismiss on click outside — but let node/link clicks reach their handlers
		// so they can toggle (close when clicking the same node) or swap popovers.
		function onOutsideClick(e) {
			// If this popover is already gone (replaced by a newer one), clean up.
			if (!popover.isConnected) {
				document.removeEventListener("mousedown", onOutsideClick, true);
				return;
			}
			if (popover.contains(e.target)) return;
			if (e.target.closest(".abt-ib-node") || e.target.closest(".abt-ib-link")) return;
			closeTransactionPopover();
			document.removeEventListener("mousedown", onOutsideClick, true);
		}
		// Delay to avoid catching the click that opened it
		setTimeout(() => document.addEventListener("mousedown", onOutsideClick, true), 0);
	}

	function closeTransactionPopover() {
		const existing = document.getElementById("abt-ib-popover");
		if (existing) existing.remove();
	}

	// ── Rendering ─────────────────────────────────────────────────────────
	function getChartDimensions(container) {
		const rect = container.getBoundingClientRect();
		const rawWidth = Math.floor(rect.width || container.clientWidth || 0);
		const width = rawWidth - 16;
		if (width <= 0) return null;

		const rawHeight = Math.floor(container.clientHeight || rect.height || 400);
		return {
			width,
			height: Math.max(80, rawHeight),
		};
	}

	function retryRenderWhenReady(chart) {
		if (chart.dataset.abtIbRenderRetry === "1") return;
		const attempts = Number(chart.dataset.abtIbRenderRetryCount || 0);
		if (attempts >= 10) return;
		chart.dataset.abtIbRenderRetryCount = String(attempts + 1);
		chart.dataset.abtIbRenderRetry = "1";
		setTimeout(() => {
			delete chart.dataset.abtIbRenderRetry;
			void loadAndRender(chart);
		}, 100);
	}

	function renderSankey(container, sankeyData) {
		const { nodes, links, totalIncome } = sankeyData;
		const dimensions = getChartDimensions(container);
		if (!dimensions) return;
		const { width, height } = dimensions;

		const chartOnly = container.querySelector("svg");
		const tooltipEl = container.querySelector(".abt-ib-tooltip");
		if (chartOnly) chartOnly.remove();
		if (tooltipEl) tooltipEl.remove();
		// Remove loading/empty msgs
		const msgs = container.querySelectorAll(".abt-ib-loading, .abt-ib-empty");
		msgs.forEach((m) => m.remove());

		if (links.length === 0) {
			const empty = document.createElement("div");
			empty.className = "abt-ib-empty";
			empty.textContent = "No data for selected period";
			container.insertBefore(empty, container.firstChild);
			return;
		}

		const svg = d3
			.select(container)
			.insert("svg", ":first-child")
			.attr("width", width)
			.attr("height", height)
			.attr("viewBox", `0 0 ${width} ${height}`);

		const nodeById = new Map(nodes.map((n, i) => [n.id, i]));
		const sankeyNodes = nodes.map((n) => ({ ...n }));
		const sankeyLinks = links
			.filter((l) => nodeById.has(l.source) && nodeById.has(l.target))
			.map((l) => ({ source: nodeById.get(l.source), target: nodeById.get(l.target), value: l.value }));

		if (sankeyLinks.length === 0) {
			svg.remove();
			const empty = document.createElement("div");
			empty.className = "abt-ib-empty";
			empty.textContent = "No data for selected period";
			container.insertBefore(empty, container.firstChild);
			return;
		}

		const margin = { top: 10, right: 10, bottom: 10, left: 10 };
		const sankeyLayout = sankey()
			.nodeId((d) => d.index)
			.nodeWidth(18)
			.nodePadding(10)
			.nodeAlign(sankeyJustify)
			.extent([
				[margin.left, margin.top],
				[width - margin.right, height - margin.bottom],
			]);

		const graph = sankeyLayout({ nodes: sankeyNodes, links: sankeyLinks });

		const fallbackColors = [
			"#f38ba8",
			"#fab387",
			"#f9e2af",
			"#a6e3a1",
			"#94e2d5",
			"#89b4fa",
			"#b4befe",
			"#cba6f7",
			"#f5c2e7",
			"#f2cdcd",
			"#f5e0dc",
			"#89dceb",
			"#74c7ec",
			"#eba0ac",
		];

		function getNodeColor(node) {
			if (node.id === "budget") return "#cdd6f4";
			if (node.id === "net-gain") return "#a6e3a1";
			if (node.id === "net-loss") return "#f38ba8";
			if (node.id === "positive-cats") return "#a6e3a1";
			return fallbackColors[node.index % fallbackColors.length];
		}

		// Tooltip
		const tooltip = d3
			.select(container)
			.insert("div", ":first-child")
			.attr("class", "abt-ib-tooltip")
			.style("opacity", 0);

		// Move SVG before tooltip
		container.insertBefore(container.querySelector("svg"), container.querySelector(".abt-ib-tooltip"));

		// Determine which node a link click should resolve to (the more specific end)
		function clickableNodeForLink(d) {
			// Prefer the non-"budget" end; for group→cat links prefer the cat
			if (d.target.id !== "budget") return d.target;
			if (d.source.id !== "budget") return d.source;
			return d.target;
		}

		// Links — clickable bars
		const linkSel = svg
			.append("g")
			.attr("fill", "none")
			.selectAll("path")
			.data(graph.links)
			.join("path")
			.attr("d", sankeyLinkHorizontal())
			.attr("stroke", (d) => (d.source.id === "budget" ? getNodeColor(d.target) : getNodeColor(d.source)))
			.attr("stroke-opacity", 0.35)
			.attr("stroke-width", (d) => Math.max(1, d.width))
			.attr("class", "abt-ib-link")
			.on("mouseenter", function (event, d) {
				if (isDashboardEditing()) return;
				d3.select(this).attr("stroke-opacity", 0.6);
				const pct = totalIncome > 0 ? ((d.value / totalIncome) * 100).toFixed(1) : "0";
				const node = clickableNodeForLink(d);
				const hint =
					node.id !== "budget" && node.id !== "net-gain" && node.id !== "net-loss"
						? '<br><span class="abt-ib-tooltip-hint">Click to view transactions</span>'
						: "";
				tooltip
					.style("opacity", 1)
					.html(
						`${d.source.name} → ${d.target.name}<br><strong class="abt-ib-private">${formatCurrency(d.value)} (${pct}%)</strong>${hint}`,
					);
			})
			.on("mousemove", function (event) {
				if (isDashboardEditing()) return;
				tooltip.style("left", event.offsetX + 12 + "px").style("top", event.offsetY - 10 + "px");
			})
			.on("mouseleave", function () {
				d3.select(this).attr("stroke-opacity", 0.35);
				tooltip.style("opacity", 0);
			})
			.on("click", function (event, d) {
				event.stopPropagation();
				tooltip.style("opacity", 0);
				if (isDashboardEditing()) return;
				const node = clickableNodeForLink(d);
				if (node.id === "budget" || node.id === "net-gain" || node.id === "net-loss") return;
				showTransactionPopover(node.id, node.name, event.offsetX, event.offsetY, container);
			});

		// Nodes — clickable rects
		svg.append("g")
			.selectAll("rect")
			.data(graph.nodes)
			.join("rect")
			.attr("x", (d) => d.x0)
			.attr("y", (d) => d.y0)
			.attr("height", (d) => Math.max(1, d.y1 - d.y0))
			.attr("width", (d) => d.x1 - d.x0)
			.attr("fill", (d) => getNodeColor(d))
			.attr("rx", 3)
			.attr("opacity", 0.9)
			.attr("class", "abt-ib-node")
			.on("mouseenter", function (event, d) {
				if (isDashboardEditing()) return;
				linkSel.attr("stroke-opacity", (l) => (l.source === d || l.target === d ? 0.6 : 0.15));
				const hint =
					d.id !== "budget" && d.id !== "net-gain" && d.id !== "net-loss"
						? '<br><span class="abt-ib-tooltip-hint">Click to view transactions</span>'
						: "";
				tooltip
					.style("opacity", 1)
					.html(
						`${d.name}<br><strong class="abt-ib-private">${formatCurrency(d.value || 0)}</strong>${hint}`,
					);
			})
			.on("mousemove", function (event) {
				if (isDashboardEditing()) return;
				tooltip.style("left", event.offsetX + 12 + "px").style("top", event.offsetY - 10 + "px");
			})
			.on("mouseleave", function () {
				linkSel.attr("stroke-opacity", 0.35);
				tooltip.style("opacity", 0);
			})
			.on("click", function (event, d) {
				event.stopPropagation();
				tooltip.style("opacity", 0);
				if (isDashboardEditing()) return;
				if (d.id === "budget" || d.id === "net-gain" || d.id === "net-loss") return;
				showTransactionPopover(d.id, d.name, event.offsetX, event.offsetY, container);
			});

		// Labels
		svg.append("g")
			.selectAll("text")
			.data(graph.nodes)
			.join("text")
			.attr("x", (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
			.attr("y", (d) => (d.y1 + d.y0) / 2)
			.attr("dy", "0.35em")
			.attr("text-anchor", (d) => (d.x0 < width / 2 ? "start" : "end"))
			.attr("class", "abt-ib-label")
			.text((d) => d.name)
			.append("tspan")
			.attr("class", "abt-ib-label-amount")
			.text((d) => " " + formatCurrency(d.value || 0));
	}

	// ── Widget UI ─────────────────────────────────────────────────────────
	function applyPreset(label) {
		const preset = DATE_PRESETS.find((p) => p.label === label);
		if (!preset) return;
		const { start, end } = preset.calc();
		state.startDate = start;
		state.endDate = end;
		state.activePreset = label;
		setSetting("startDate", start);
		setSetting("endDate", end);
		setSetting("activePreset", label);
	}

	function createWidget(widgetRecord) {
		// Apply default preset if no dates set
		if (!state.startDate || !state.endDate) {
			applyPreset(state.activePreset || "This Month");
		}

		const widget = document.createElement("div");
		widget.id = getWidgetElementId(widgetRecord);
		widget.className = WIDGET_CLASS;
		widget.dataset.dashboardWidgetId = widgetRecord?.id || "";
		widget.__abtWidgetRecord = widgetRecord;
		widget.classList.toggle("abt-ib-privacy", isPrivacyMode);

		const presetButtons = DATE_PRESETS.map(
			(p) =>
				`<button class="abt-ib-preset${state.activePreset === p.label ? " active" : ""}" data-preset="${p.label}">${p.label}</button>`,
		).join("");
		const widgetName = escapeHtml(getWidgetName(widgetRecord));

		widget.innerHTML = `
      <div class="abt-ib-header">
        <div class="abt-ib-header-left">
          <h2 class="abt-ib-title">${widgetName}</h2>
          <span class="abt-ib-subtitle">${state.startDate} – ${state.endDate}</span>
        </div>
        <button type="button" class="abt-ib-widget-menu ${NON_DRAGGABLE_CLASS}" aria-label="Menu" title="Menu">⋮</button>
      </div>
      <div class="abt-ib-controls ${NON_DRAGGABLE_CLASS}">
        <div class="abt-ib-presets">${presetButtons}</div>
        <div class="abt-ib-date-row">
          <label class="abt-ib-field-label">From <input type="date" class="abt-ib-input" id="abt-ib-start" value="${state.startDate}"></label>
          <label class="abt-ib-field-label">To <input type="date" class="abt-ib-input" id="abt-ib-end" value="${state.endDate}"></label>
        </div>
        <div class="abt-ib-toggles">
          <label class="abt-ib-toggle"><input type="checkbox" id="abt-ib-income" ${state.showIncome ? "checked" : ""}>Income</label>
          <label class="abt-ib-toggle"><input type="checkbox" id="abt-ib-expense" ${state.showExpense ? "checked" : ""}>Expenses</label>
          <label class="abt-ib-toggle"><input type="checkbox" id="abt-ib-subcats" ${state.showSubCategories ? "checked" : ""} ${!state.showExpense ? "disabled" : ""}>Subcategories</label>
          <label class="abt-ib-toggle"><input type="checkbox" id="abt-ib-lossgain" ${state.showLossGain ? "checked" : ""}>Net Gain/Loss</label>
          <label class="abt-ib-toggle"><input type="checkbox" id="abt-ib-grouppos" ${state.groupPositiveCategories ? "checked" : ""}>Group Positive</label>
        </div>
      </div>
      <div class="abt-ib-chart-container"></div>
    `;

		return widget;
	}

	function updateSubtitle(widget) {
		const sub = widget.querySelector(".abt-ib-subtitle");
		if (sub) sub.textContent = `${state.startDate} – ${state.endDate}`;
	}

	function closeActiveMenu() {
		if (activeMenu) {
			activeMenu.remove();
			activeMenu = null;
		}
	}

	function positionMenu(menu, x, y) {
		document.body.appendChild(menu);
		const rect = menu.getBoundingClientRect();
		const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
		const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
		menu.style.left = `${left}px`;
		menu.style.top = `${top}px`;
	}

	function makeMenuButton(text, onClick) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "abt-ib-menu-item";
		button.textContent = text;
		button.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			try {
				await onClick();
			} catch (err) {
				console.error("[ABT Income Breakdown] Dashboard action failed:", err);
			}
		});
		return button;
	}

	function openMenu(menu, x, y) {
		closeActiveMenu();
		activeMenu = menu;
		positionMenu(menu, x, y);

		function onOutsideClick(e) {
			if (!activeMenu) {
				document.removeEventListener("mousedown", onOutsideClick, true);
				return;
			}
			if (activeMenu.contains(e.target)) return;
			closeActiveMenu();
			document.removeEventListener("mousedown", onOutsideClick, true);
		}

		setTimeout(() => document.addEventListener("mousedown", onOutsideClick, true), 0);
	}

	function showWidgetMenu(widget, x, y) {
		const widgetRecord = widget.__abtWidgetRecord;
		const menu = document.createElement("div");
		menu.className = "abt-ib-menu";

		menu.appendChild(
			makeMenuButton("Rename", async () => {
				closeActiveMenu();
				startRename(widget);
			}),
		);
		menu.appendChild(
			makeMenuButton("Remove", async () => {
				closeActiveMenu();
				if (!widgetRecord?.id) return;
				await sendDashboardMutation("dashboard-remove-widget", widgetRecord.id);
				widget.remove();
			}),
		);
		menu.appendChild(
			makeMenuButton("Copy to dashboard", async () => {
				await showCopyDashboardMenu(widget, x, y);
			}),
		);

		openMenu(menu, x, y);
	}

	async function showCopyDashboardMenu(widget, x, y) {
		const widgetRecord = widget.__abtWidgetRecord;
		const menu = document.createElement("div");
		menu.className = "abt-ib-menu abt-ib-copy-menu";

		const title = document.createElement("div");
		title.className = "abt-ib-menu-title";
		title.textContent = "Copy to dashboard";
		menu.appendChild(title);

		const pages = await fetchDashboardPages();
		if (pages.length === 0) {
			const empty = document.createElement("div");
			empty.className = "abt-ib-menu-empty";
			empty.textContent = "No dashboard pages available.";
			menu.appendChild(empty);
		} else {
			pages.forEach((page) => {
				menu.appendChild(
					makeMenuButton(page.name || "Untitled dashboard", async () => {
						closeActiveMenu();
						if (!widgetRecord?.id) return;
						await sendDashboardMutation("dashboard-copy-widget", {
							id: widgetRecord.id,
							targetDashboardPageId: page.id,
						});
					}),
				);
			});
		}

		openMenu(menu, x, y);
	}

	function startRename(widget) {
		const title = widget.querySelector(".abt-ib-title");
		const widgetRecord = widget.__abtWidgetRecord;
		if (!title || title.querySelector("input")) return;

		const currentName = getWidgetName(widgetRecord);
		const input = document.createElement("input");
		input.className = `abt-ib-rename-input ${NON_DRAGGABLE_CLASS}`;
		input.value = currentName;

		title.textContent = "";
		title.appendChild(input);
		input.focus();
		input.select();

		let finished = false;
		const finish = async (save) => {
			if (finished) return;
			finished = true;
			const nextName = input.value.trim() || DEFAULT_WIDGET_NAME;
			title.textContent = save ? nextName : currentName;
			if (save && nextName !== currentName) {
				await updateDashboardWidgetMeta(widgetRecord, { name: nextName });
			}
		};

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				void finish(true);
			} else if (e.key === "Escape") {
				e.preventDefault();
				void finish(false);
			}
		});
		input.addEventListener("blur", () => {
			void finish(true);
		});
	}

	function attachEventListeners(widget) {
		const chart = widget.querySelector(".abt-ib-chart-container");
		const refresh = debounce(() => loadAndRenderAll(), DEBOUNCE_MS);

		// Presets
		widget.querySelectorAll(".abt-ib-preset").forEach((btn) => {
			btn.addEventListener("click", () => {
				applyPreset(btn.dataset.preset);
				// Update active state
				widget.querySelectorAll(".abt-ib-preset").forEach((b) => b.classList.remove("active"));
				btn.classList.add("active");
				// Update date inputs
				widget.querySelector("#abt-ib-start").value = state.startDate;
				widget.querySelector("#abt-ib-end").value = state.endDate;
				updateAllWidgetControls();
				refresh();
			});
		});

		// Date inputs
		widget.querySelector("#abt-ib-start").addEventListener("change", (e) => {
			state.startDate = e.target.value;
			state.activePreset = "";
			setSetting("startDate", state.startDate);
			setSetting("activePreset", "");
			updateAllWidgetControls();
			refresh();
		});

		widget.querySelector("#abt-ib-end").addEventListener("change", (e) => {
			state.endDate = e.target.value;
			state.activePreset = "";
			setSetting("endDate", state.endDate);
			setSetting("activePreset", "");
			updateAllWidgetControls();
			refresh();
		});

		// Toggles
		const toggles = [
			{ id: "abt-ib-income", key: "showIncome" },
			{ id: "abt-ib-expense", key: "showExpense" },
			{ id: "abt-ib-subcats", key: "showSubCategories" },
			{ id: "abt-ib-lossgain", key: "showLossGain" },
			{ id: "abt-ib-grouppos", key: "groupPositiveCategories" },
		];

		toggles.forEach(({ id, key }) => {
			widget.querySelector("#" + id).addEventListener("change", (e) => {
				state[key] = e.target.checked;
				setSetting(key, state[key]);
				if (key === "showExpense") {
					updateAllWidgetControls();
				}
				refresh();
			});
		});

		// Close popover when clicking chart background
		chart.addEventListener("click", (e) => {
			if (
				e.target.closest(".abt-ib-popover") ||
				e.target.closest(".abt-ib-node") ||
				e.target.closest(".abt-ib-link")
			)
				return;
			closeTransactionPopover();
		});

		widget.addEventListener(
			"mousedown",
			() => {
				if (isDashboardEditing()) closeTransactionPopover();
			},
			true,
		);

		widget.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			e.stopPropagation();
			showWidgetMenu(widget, e.clientX, e.clientY);
		});

		widget.querySelector(".abt-ib-widget-menu").addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const rect = e.currentTarget.getBoundingClientRect();
			showWidgetMenu(widget, rect.right, rect.bottom);
		});
	}

	function updateWidgetControls(widget) {
		widget.querySelectorAll(".abt-ib-preset").forEach((btn) => {
			btn.classList.toggle("active", state.activePreset === btn.dataset.preset);
		});
		const start = widget.querySelector("#abt-ib-start");
		const end = widget.querySelector("#abt-ib-end");
		if (start) start.value = state.startDate;
		if (end) end.value = state.endDate;
		const income = widget.querySelector("#abt-ib-income");
		const expense = widget.querySelector("#abt-ib-expense");
		const subcats = widget.querySelector("#abt-ib-subcats");
		const lossgain = widget.querySelector("#abt-ib-lossgain");
		const grouppos = widget.querySelector("#abt-ib-grouppos");
		if (income) income.checked = state.showIncome;
		if (expense) expense.checked = state.showExpense;
		if (subcats) {
			subcats.checked = state.showSubCategories;
			subcats.disabled = !state.showExpense;
		}
		if (lossgain) lossgain.checked = state.showLossGain;
		if (grouppos) grouppos.checked = state.groupPositiveCategories;
		updateSubtitle(widget);
	}

	function updateAllWidgetControls() {
		document.querySelectorAll(`.${WIDGET_CLASS}`).forEach(updateWidgetControls);
	}

	async function loadAndRender(chart) {
		if (!chart) return;
		if (!getChartDimensions(chart)) {
			retryRenderWhenReady(chart);
			return;
		}
		delete chart.dataset.abtIbRenderRetryCount;

		// Show loading only if no existing chart
		if (!chart.querySelector("svg")) {
			chart.innerHTML = '<div class="abt-ib-loading">Loading...</div>';
		}

		try {
			const data = await calculateData(state.startDate, state.endDate);
			const sankeyData = buildSankeyData(data);
			renderSankey(chart, sankeyData);
		} catch (err) {
			console.error("[ABT Income Breakdown] Error:", err);
			chart.innerHTML = `<div class="abt-ib-empty">Error loading data: ${err.message}</div>`;
		}
	}

	function loadAndRenderAll() {
		document.querySelectorAll(`.${WIDGET_CLASS} .abt-ib-chart-container`).forEach((chart) => {
			void loadAndRender(chart);
		});
	}

	// ── Injection — overlay on top of the markdown placeholder widget ─────
	function isReportsPage() {
		return window.location.pathname.includes("/reports");
	}

	function findPlaceholderWidgets() {
		return Array.from(document.querySelectorAll(".react-grid-item"))
			.filter((item) => !item.dataset.abtOverlaid)
			.filter((item) => item.textContent.includes(PLACEHOLDER_TEXT))
			.sort((a, b) => {
				const aRect = a.getBoundingClientRect();
				const bRect = b.getBoundingClientRect();
				return aRect.top - bRect.top || aRect.left - bRect.left;
			});
	}

	function hidePlaceholderContent(gridItem) {
		const walker = document.createTreeWalker(gridItem, NodeFilter.SHOW_TEXT);
		let node;
		while ((node = walker.nextNode())) {
			if (!node.textContent.includes(PLACEHOLDER_TEXT)) continue;
			let target = node.parentElement;
			while (
				target?.parentElement &&
				target.parentElement !== gridItem &&
				target.parentElement.textContent.trim() === PLACEHOLDER_TEXT
			) {
				target = target.parentElement;
			}
			if (target) {
				target.style.visibility = "hidden";
			}
			return;
		}
	}

	function enhanceAddWidgetMenu() {
		dashboardWidgetUtils?.enhanceAddWidgetMenu?.({
			widgetDefinitions: CUSTOM_DASHBOARD_WIDGETS,
			onWidgetSelected: addCustomDashboardWidget,
			dismissNativeMenu,
			logger: console,
		});
	}

	async function injectWidgets() {
		if (!isReportsPage()) return;
		if (isInjecting) return;
		if (!window.$q || !window.$query) return;

		isInjecting = true;
		try {
			await refreshPrivacyMode();
			enhanceAddWidgetMenu();

			const gridItems = findPlaceholderWidgets();
			if (gridItems.length === 0) return;

			const usedIds = new Set(
				Array.from(document.querySelectorAll(`.${WIDGET_CLASS}`))
					.map((widget) => widget.dataset.dashboardWidgetId)
					.filter(Boolean),
			);
			const widgetRecords = (await getIncomeBreakdownWidgetRecords()).filter((record) => !usedIds.has(record.id));

			gridItems.forEach((gridItem, index) => {
				const widgetRecord = widgetRecords[index];
				if (!widgetRecord) return;

				// Mark so we don't match again
				gridItem.dataset.abtOverlaid = "1";
				gridItem.classList.add("abt-ib-host");
				hidePlaceholderContent(gridItem);

				// Create and overlay our widget
				const widget = createWidget(widgetRecord);
				gridItem.appendChild(widget);

				// Fit chart to available space
				const resizeChart = debounce(() => {
					const chart = widget.querySelector(".abt-ib-chart-container");
					if (!chart) return;
					const itemH = gridItem.offsetHeight;
					const chartTop = chart.getBoundingClientRect().top - gridItem.getBoundingClientRect().top;
					const available = itemH - chartTop - 4;
					if (available > 80) chart.style.height = available + "px";
				}, 100);

				// Observe grid item resize
				const existingObserver = resizeObservers.get(gridItem);
				if (existingObserver) existingObserver.disconnect();
				const resizeObserver = new ResizeObserver(() => {
					resizeChart();
					void loadAndRender(widget.querySelector(".abt-ib-chart-container"));
				});
				resizeObservers.set(gridItem, resizeObserver);
				resizeObserver.observe(gridItem);

				attachEventListeners(widget);
				syncWidgetModeClasses();
				resizeChart();
				void loadAndRender(widget.querySelector(".abt-ib-chart-container"));
			});
		} finally {
			isInjecting = false;
		}
	}

	// ── Page observer ─────────────────────────────────────────────────────
	let lastUrl = "";
	function checkAndInject() {
		const currentUrl = window.location.href;
		if (currentUrl !== lastUrl) {
			lastUrl = currentUrl;
			categoriesCache = null;
			categoryGroupsCache = null;
			payeesCache = null;
			accountsCache = null;
			resetDashboardWidgetCaches();
			closeActiveMenu();
			closeTransactionPopover();
		}
		if (isReportsPage()) {
			void refreshPrivacyMode();
			syncWidgetModeClasses();
			enhanceAddWidgetMenu();
			setTimeout(() => {
				void injectWidgets();
			}, 800);
		}
	}

	const observer = new MutationObserver(() => {
		if (isReportsPage()) {
			syncWidgetModeClasses();
			enhanceAddWidgetMenu();
			void injectWidgets();
		}
	});

	function waitForBackendReady() {
		return new Promise((resolve) => {
			function check() {
				if (window.$q && window.$query && document.querySelector('a[href="/budget"]') && document.querySelector('[data-testid="__global!accounts-balance"]')) {
					resolve();
				} else {
					setTimeout(check, 50);
				}
			}
			check();
		});
	}

	async function init() {
		await waitForBackendReady();
		checkAndInject();
		observer.observe(document.body, { childList: true, subtree: true });
		setInterval(checkAndInject, POLL_INTERVAL);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
