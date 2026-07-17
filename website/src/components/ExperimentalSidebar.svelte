<script lang="ts">
	// Standalone port of the "Actual Budget — Sidebar" Figma frame (node 46:890).
	// Self-contained test component: Catppuccin Mocha palette, sample data below.
	import emojiData from "unicode-emoji-json/data-by-group.json";

	// Sync-status "dot grammar": fill = connection, motion = activity.
	//   synced  → solid dot        manual → hollow dot
	//   syncing → orbiting arc      error  → solid dot in a pulsing alert ring
	type Status = "synced" | "syncing" | "error" | "manual";

	// Optional per-account icon (emoji, fetched logo, or uploaded image) — mirrors ABT.
	interface AccountIcon {
		type: "emoji" | "url" | "dataUrl";
		value: string;
	}

	interface Account {
		name: string;
		amount: string; // pre-formatted
		status: Status;
		negative?: boolean;
		icon?: AccountIcon;
	}

	interface Group {
		id?: string; // stable identity (labels can collide / change)
		label: string;
		total?: string;
		accounts: Account[];
	}

	interface Section {
		label: string;
		total: string;
		muted?: boolean; // dimmer label (e.g. Closed)
		groups: Group[]; // a group with an empty label renders its accounts directly
	}

	const grandTotal = "313,914.37";

	let sections = $state<Section[]>([
		{
			label: "On Budget",
			total: "34,872.12",
			groups: [
				{
					label: "",
					accounts: [
						{ name: "Everyday Checking", amount: "12,450.30", status: "synced" },
						{ name: "Joint Checking", amount: "3,673.45", status: "synced" },
					],
				},
				{
					label: "Credit Cards",
					accounts: [
						{ name: "Sapphire Rewards Card", amount: "-1,245.67", status: "synced", negative: true },
						{ name: "Everyday Cashback Card", amount: "-892.33", status: "synced", negative: true },
					],
				},
				{
					label: "Savings",
					accounts: [
						{ name: "Emergency Fund", amount: "6,230.18", status: "synced" },
						{ name: "Vacation Fund", amount: "5,890.75", status: "manual" },
						{ name: "High-Yield Savings", amount: "8,765.44", status: "synced" },
					],
				},
			],
		},
		{
			label: "Off Budget",
			total: "279,042.25",
			groups: [
				{
					label: "Investments",
					accounts: [
						{ name: "Brokerage Account", amount: "42,318.90", status: "synced" },
						{ name: "Company RSUs", amount: "18,760.25", status: "synced" },
						{ name: "Roth IRA", amount: "27,540.60", status: "synced" },
						{ name: "401(k)", amount: "63,215.80", status: "syncing" },
						{ name: "HSA Investment", amount: "4,982.15", status: "error" },
						{ name: "Crypto Wallet", amount: "2,145.30", status: "manual" },
					],
				},
				{
					label: "Assets",
					accounts: [{ name: "House Asset", amount: "420,000.00", status: "manual" }],
				},
				{
					label: "Loans",
					accounts: [
						{ name: "Mortgage", amount: "-285,600.00", status: "synced", negative: true },
						{ name: "Auto Loan", amount: "-14,320.75", status: "synced", negative: true },
					],
				},
			],
		},
		{
			label: "Closed",
			total: "0.00",
			muted: true,
			groups: [],
		},
	]);

	const navItems = ["Budget", "Reports", "Schedules"] as const;
	const moreItems = ["Payees", "Rules", "Bank Sync", "Tags", "Settings"] as const;

	// ---- interactive state ----
	// One global active page across nav links, "More" sub-links, section labels and accounts.
	let activePage = $state<string>("Budget");
	let moreExpanded = $state(false);
	let collapsedSections = $state<Record<string, boolean>>({});
	let collapsedGroups = $state<Record<string, boolean>>({});
	let query = $state("");
	let searchEl = $state<HTMLInputElement | null>(null);
	let groupAccounts = $state(true); // false = flat list under each section (no sub-categories)
	// edge-fade mask for the scrollable accounts list. "top" = scrolled to the top
	// (fade the bottom only), which is the correct state on load. "none" = the list
	// fits without scrolling, so no fade at all.
	let accountsMaskState = $state<"none" | "top" | "middle" | "bottom">("top");
	let accountsEl = $state<HTMLElement | null>(null);
	const accountsMask = $derived(
		accountsMaskState === "none"
			? "none"
			: accountsMaskState === "top"
				? "linear-gradient(black 0%, black calc(100% - 34px), transparent 100%)"
				: accountsMaskState === "bottom"
					? "linear-gradient(transparent 0px, black 34px, black 100%)"
					: "linear-gradient(transparent 0px, black 34px, black calc(100% - 34px), transparent 100%)",
	);

	// ---- budget selector ----
	type BudgetState = "syncing" | "downloadable" | "local";
	interface Budget {
		name: string;
		state: BudgetState;
	}
	let budgets = $state<Budget[]>([
		{ name: "Sample Budget", state: "syncing" },
		{ name: "Test Budget", state: "downloadable" },
		{ name: "Demo Budget", state: "local" },
	]);
	const budgetStateLabel = (s: BudgetState) =>
		s === "syncing" ? "Syncing" : s === "downloadable" ? "Available for download" : "Local";
	let currentBudget = $state("Sample Budget");
	let budgetOpen = $state(false);
	let editingBudget = $state(false);
	let editValue = $state("");
	let budgetEl = $state<HTMLElement | null>(null);

	function closeBudget() {
		budgetOpen = false;
		editingBudget = false;
	}
	function selectBudget(b: Budget) {
		currentBudget = b.name;
		closeBudget();
	}
	function closeFile() {
		// Placeholder: in the real app this exits the open budget back to the file-list screen.
		closeBudget();
	}
	function startEdit() {
		editValue = currentBudget;
		editingBudget = true;
	}
	function commitEdit() {
		const v = editValue.trim();
		if (v) {
			const b = budgets.find((x) => x.name === currentBudget);
			if (b) b.name = v;
			currentBudget = v;
		}
		editingBudget = false;
	}
	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			commitEdit();
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			editingBudget = false;
		}
	}
	function autofocus(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
	function handleWindowClick(e: MouseEvent) {
		if (budgetOpen && budgetEl && !budgetEl.contains(e.target as Node)) closeBudget();
		if (menuAccount || menuGroup) closeMenus();
		if (iconAccount && iconPickerEl && !iconPickerEl.contains(e.target as Node)) closeIconPicker();
	}
	function updateAccountsMask(el: HTMLElement) {
		const maxScroll = el.scrollHeight - el.clientHeight;
		if (maxScroll <= 1) {
			accountsMaskState = "none";
			return;
		}
		const atTop = el.scrollTop <= 0;
		const atBottom = el.scrollTop >= maxScroll - 1;
		accountsMaskState = atTop ? "top" : atBottom ? "bottom" : "middle";
	}
	function handleAccountsScroll(event: Event) {
		updateAccountsMask(event.currentTarget as HTMLElement);
		hideHoverCard();
		if (menuAccount || menuGroup) closeMenus();
	}
	// set the correct mask once the list mounts / re-mounts (e.g. expanding the rail)
	$effect(() => {
		if (accountsEl) updateAccountsMask(accountsEl);
	});

	// ---- theme (dark default, light optional) ----
	let theme = $state<"dark" | "light">("dark");
	function toggleTheme() {
		theme = theme === "dark" ? "light" : "dark";
	}
	// reflect the theme onto the host document so the surrounding page can match
	$effect(() => {
		if (typeof document !== "undefined") {
			document.documentElement.dataset.sidebarTheme = theme;
		}
	});

	// ---- custom tooltip (replaces native title=) ----
	type TipPlacement = "right" | "left" | "top" | "bottom";
	type TipOpts = { text: string; placement?: TipPlacement };
	let tip = $state<{ text: string; x: number; y: number; placement: TipPlacement } | null>(null);
	let tipTimer: ReturnType<typeof setTimeout> | null = null;
	const TIP_DELAY = 320;

	function placeTip(el: HTMLElement, o: Required<TipOpts>) {
		const r = el.getBoundingClientRect();
		const gap = 9;
		let x = 0;
		let y = 0;
		if (o.placement === "right") {
			x = r.right + gap;
			y = r.top + r.height / 2;
		} else if (o.placement === "left") {
			x = r.left - gap;
			y = r.top + r.height / 2;
		} else if (o.placement === "top") {
			x = r.left + r.width / 2;
			y = r.top - gap;
		} else {
			x = r.left + r.width / 2;
			y = r.bottom + gap;
		}
		tip = { text: o.text, x, y, placement: o.placement };
	}
	function hideTip() {
		if (tipTimer) {
			clearTimeout(tipTimer);
			tipTimer = null;
		}
		tip = null;
	}
	function tooltip(node: HTMLElement, param: string | TipOpts) {
		let o: Required<TipOpts> = {
			text: "",
			placement: "right",
			...(typeof param === "string" ? { text: param } : param),
		};
		const enter = () => {
			if (tipTimer) clearTimeout(tipTimer);
			if (!o.text) return;
			tipTimer = setTimeout(() => placeTip(node, o), TIP_DELAY);
		};
		const leave = () => hideTip();
		node.addEventListener("pointerenter", enter);
		node.addEventListener("pointerleave", leave);
		node.addEventListener("pointerdown", leave);
		node.addEventListener("focusin", enter);
		node.addEventListener("focusout", leave);
		return {
			update(next: string | TipOpts) {
				o = { text: "", placement: "right", ...(typeof next === "string" ? { text: next } : next) };
			},
			destroy() {
				node.removeEventListener("pointerenter", enter);
				node.removeEventListener("pointerleave", leave);
				node.removeEventListener("pointerdown", leave);
				node.removeEventListener("focusin", enter);
				node.removeEventListener("focusout", leave);
				leave();
			},
		};
	}

	// ---- collapse (icon rail) ----
	const RAIL_WIDTH = 64;
	let collapsed = $state(false);
	const budgetInitials = $derived(
		currentBudget
			.split(/\s+/)
			.map((w) => w[0])
			.join("")
			.slice(0, 2)
			.toUpperCase(),
	);
	function expandSidebar() {
		collapsed = false;
	}
	function expandAndSearch() {
		collapsed = false;
		requestAnimationFrame(() => requestAnimationFrame(() => searchEl?.focus()));
	}
	const accountInitials = (name: string) => {
		const words = name.trim().split(/\s+/);
		if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
		return name
			.replace(/[^a-z0-9]/gi, "")
			.slice(0, 2)
			.toUpperCase();
	};

	// ---- account hover card ----
	// Prototype detail: synthesize stable, plausible data per account from its name,
	// so hovering a row reveals sync status, balance trend, cleared/uncleared and schedules.
	interface Upcoming {
		date: string;
		payee: string;
		amount: string;
		negative: boolean;
		offset: number; // days from today, for chronological sorting
	}
	interface AccountDetail {
		institution: string;
		type: string;
		points: number[];
		deltaPct: number;
		deltaAbs: number;
		cleared: string;
		unclearedCount: number;
		unclearedAmount: string;
		unclearedNegative: boolean;
		showLedger: boolean;
		upcoming: Upcoming[];
		syncText: string;
	}

	// account name -> its section/group, so we can infer an account "type"
	const accountMeta: Record<string, { section: string; group: string }> = {};
	for (const s of sections)
		for (const g of s.groups)
			for (const a of g.accounts) accountMeta[a.name] = { section: s.label, group: g.label };

	// stable group ids (labels can collide or change)
	let groupIdSeq = 0;
	for (const s of sections) for (const g of s.groups) g.id = `g${groupIdSeq++}`;
	const nextGroupId = () => `g${groupIdSeq++}`;

	const INSTITUTIONS = [
		"Chase",
		"Bank of America",
		"Wells Fargo",
		"Ally",
		"Capital One",
		"Fidelity",
		"Vanguard",
		"Charles Schwab",
		"Amex",
		"Citi",
		"SoFi",
		"US Bank",
	];
	const PAYEES_OUT = ["Netflix", "Spotify", "Electric Co.", "Internet", "Gym", "Insurance", "Phone", "Water"];

	function hashStr(s: string): number {
		let h = 2166136261;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return h >>> 0;
	}
	function mulberry32(seed: number) {
		return () => {
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}
	const money = (n: number) =>
		Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	const TODAY = new Date(2026, 6, 16);
	function relTime(mins: number): string {
		if (mins < 60) return `${mins} min ago`;
		const h = Math.round(mins / 60);
		if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
		const d = Math.round(h / 24);
		return `${d} day${d > 1 ? "s" : ""} ago`;
	}
	function typeOf(name: string): string {
		const g = accountMeta[name]?.group ?? "";
		if (g === "Credit Cards") return "Credit Card";
		if (g === "Savings") return "Savings";
		if (g === "Investments") return "Investment";
		if (g === "Loans") return "Loan";
		if (g === "Assets") return "Asset";
		return "Checking";
	}

	const detailCache = new Map<string, AccountDetail>();
	function accountDetail(a: Account): AccountDetail {
		const cached = detailCache.get(a.name);
		if (cached) return cached;
		const rand = mulberry32(hashStr(a.name));
		const value = parseFloat(a.amount.replace(/[^0-9.-]/g, "")) || 0;
		const type = typeOf(a.name);

		// 30-day balance walk that ends exactly at the current value
		const n = 30;
		const deltaFrac = (rand() - 0.45) * 0.16;
		const start = value * (1 - deltaFrac) || (value === 0 ? -1 : value);
		const points: number[] = [];
		for (let i = 0; i < n; i++) {
			const t = i / (n - 1);
			const base = start + (value - start) * t;
			const noise = (rand() - 0.5) * (Math.abs(value) || 100) * 0.045;
			points.push(base + noise);
		}
		points[n - 1] = value;
		const deltaAbs = value - start;
		const deltaPct = start !== 0 ? (deltaAbs / Math.abs(start)) * 100 : 0;

		// cleared / uncleared — only for bank-linked ledger accounts
		const ledgerType = type === "Checking" || type === "Credit Card" || type === "Savings";
		const showLedger = a.status !== "manual" && ledgerType;
		let unclearedCount = 0;
		let unclearedVal = 0;
		if (showLedger) {
			unclearedCount = Math.floor(rand() * (type === "Credit Card" ? 14 : 6));
			if (unclearedCount) {
				const sign = type === "Credit Card" ? -1 : rand() < 0.35 ? -1 : 1;
				unclearedVal = sign * (5 + rand() * 240) * Math.min(unclearedCount, 6);
			}
		}
		const cleared = value - unclearedVal;

		// upcoming scheduled transactions attached to this account
		const upcoming: Upcoming[] = [];
		const addSched = (payee: string, amt: number, dayOffset: number) => {
			const d = new Date(TODAY);
			d.setDate(d.getDate() + dayOffset);
			upcoming.push({
				date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
				payee,
				amount: money(amt),
				negative: amt < 0,
				offset: dayOffset,
			});
		};
		if (a.status !== "manual") {
			if (type === "Checking") {
				addSched("Payroll", 2400 + Math.round(rand() * 800), 2 + Math.floor(rand() * 5));
				addSched(
					PAYEES_OUT[Math.floor(rand() * PAYEES_OUT.length)],
					-(20 + Math.round(rand() * 120)),
					4 + Math.floor(rand() * 8),
				);
			} else if (type === "Credit Card") {
				addSched("Minimum Payment", -(35 + Math.round(rand() * 90)), 6 + Math.floor(rand() * 10));
				if (rand() < 0.6)
					addSched(
						PAYEES_OUT[Math.floor(rand() * PAYEES_OUT.length)],
						-(9 + Math.round(rand() * 40)),
						1 + Math.floor(rand() * 5),
					);
			} else if (type === "Loan") {
				addSched("Loan Payment", -(220 + Math.round(rand() * 900)), 3 + Math.floor(rand() * 12));
			} else if (type === "Savings") {
				if (rand() < 0.7) addSched("Transfer In", 100 + Math.round(rand() * 400), 5 + Math.floor(rand() * 14));
			} else if (type === "Investment") {
				if (rand() < 0.5) addSched("Dividend", 12 + Math.round(rand() * 180), 8 + Math.floor(rand() * 18));
			}
		}
		upcoming.sort((x, y) => x.offset - y.offset);

		// sync status line
		const mins = 3 + Math.floor(rand() * 2600);
		let syncText: string;
		if (a.status === "syncing") syncText = "Syncing…";
		else if (a.status === "error") syncText = `Connection error · ${relTime(mins)}`;
		else if (a.status === "manual") syncText = "Manual account · not bank-linked";
		else syncText = `Synced ${relTime(mins)}`;

		const institution =
			a.status === "manual" ? "Manual entry" : INSTITUTIONS[hashStr(a.name) % INSTITUTIONS.length];

		const detail: AccountDetail = {
			institution,
			type,
			points,
			deltaPct,
			deltaAbs,
			cleared: money(cleared),
			unclearedCount,
			unclearedAmount: money(unclearedVal),
			unclearedNegative: unclearedVal < 0,
			showLedger,
			upcoming,
			syncText,
		};
		detailCache.set(a.name, detail);
		return detail;
	}

	function trendPath(pts: number[], w: number, h: number, pad = 3) {
		const min = Math.min(...pts);
		const max = Math.max(...pts);
		const range = max - min || 1;
		const step = w / (pts.length - 1);
		const xy = pts.map((p, i) => [i * step, pad + (h - pad * 2) * (1 - (p - min) / range)] as const);
		const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
		return { line, area: `${line} L ${w} ${h} L 0 ${h} Z` };
	}

	// hover-intent: delay so the card doesn't flash while sweeping the list
	let hoverAccount = $state<Account | null>(null);
	let hoverTop = $state(0);
	let hoverLeft = $state(0);
	let hoverFlip = $state(false);
	let hoverTimer: ReturnType<typeof setTimeout> | null = null;
	const CARD_WIDTH = 292;
	const HOVER_DELAY = 600; // ms of hover-intent before the card opens
	function showHoverCard(el: HTMLElement, a: Account) {
		const rect = el.getBoundingClientRect();
		const flip = rect.right + CARD_WIDTH + 16 > window.innerWidth;
		hoverFlip = flip;
		hoverLeft = flip ? rect.left - CARD_WIDTH - 10 : rect.right + 10;
		const estH = 360;
		hoverTop = Math.max(12, Math.min(rect.top - 6, window.innerHeight - estH - 12));
		hoverAccount = a;
	}
	function onAccountEnter(e: MouseEvent, a: Account) {
		// don't surface the hover card while dragging, or while the icon picker / a menu is open
		if (dragging || iconAccount || menuAccount || menuGroup) return;
		const el = e.currentTarget as HTMLElement;
		if (hoverTimer) clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => showHoverCard(el, a), HOVER_DELAY);
	}
	function hideHoverCard() {
		if (hoverTimer) {
			clearTimeout(hoverTimer);
			hoverTimer = null;
		}
		hoverAccount = null;
	}

	// ---- account right-click context menu ----
	let menuAccount = $state<Account | null>(null);
	let menuX = $state(0);
	let menuY = $state(0);
	function openAccountMenu(e: MouseEvent, a: Account) {
		e.preventDefault();
		hideHoverCard();
		// anchor a later icon-picker to the row's leading glyph, not the whole row
		const glyph = (e.currentTarget as HTMLElement).querySelector(".acct-glyph") as HTMLElement | null;
		menuAnchorRect = (glyph ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
		const MW = 200;
		const MH = 250;
		menuX = Math.min(e.clientX, window.innerWidth - MW - 8);
		menuY = Math.min(e.clientY, window.innerHeight - MH - 8);
		menuAccount = a;
	}
	function closeMenus() {
		menuAccount = null;
		menuGroup = null;
	}

	// inline rename (triggered from the context menu)
	let editingAccount = $state<string | null>(null);
	let acctEditValue = $state("");
	function startRename(a: Account) {
		acctEditValue = a.name;
		editingAccount = a.name;
		closeMenus();
	}
	function commitRename(a: Account) {
		const v = acctEditValue.trim();
		if (v && v !== a.name) {
			detailCache.delete(a.name);
			const wasActive = activePage === `account:${a.name}`;
			a.name = v;
			if (wasActive) activePage = `account:${v}`;
		}
		editingAccount = null;
	}
	function onRenameKeydown(e: KeyboardEvent, a: Account) {
		if (e.key === "Enter") {
			e.preventDefault();
			commitRename(a);
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			editingAccount = null;
		}
	}
	function toggleBankLink(a: Account) {
		detailCache.delete(a.name);
		a.status = a.status === "manual" ? "synced" : "manual";
		closeMenus();
	}
	function syncNow(a: Account) {
		detailCache.delete(a.name);
		a.status = "syncing";
		closeMenus();
		setTimeout(() => {
			detailCache.delete(a.name);
			a.status = "synced";
		}, 1500);
	}
	function reconcile(_a: Account) {
		// Placeholder: the real app opens a reconcile dialog to enter the true balance.
		closeMenus();
	}
	function closeAccount(a: Account) {
		for (const s of sections) {
			for (const g of s.groups) {
				const i = g.accounts.indexOf(a);
				if (i !== -1) {
					g.accounts.splice(i, 1);
					const closed = sections.find((x) => x.label === "Closed");
					if (closed) {
						if (!closed.groups.length) closed.groups.push({ label: "", accounts: [] });
						closed.groups[0].accounts.push(a);
					}
					if (activePage === `account:${a.name}`) activePage = "Budget";
					closeMenus();
					return;
				}
			}
		}
	}

	// ---- drag reorder ----
	// Accounts reorder anywhere within their section (incl. across sub-categories),
	// never across sections. Sub-category headers reorder within their section.
	type DragKind = "account" | "group";
	let dragKind: DragKind | null = null;
	let dragAccount: Account | null = null;
	let dragGroup: Group | null = null;
	let dragSrcId = $state<string | null>(null);
	let overId = $state<string | null>(null);
	let overPos = $state<"before" | "after">("before");
	let dragging = $state(false);

	function locateAccount(a: Account) {
		for (const s of sections)
			for (const g of s.groups) {
				const i = g.accounts.indexOf(a);
				if (i !== -1) return { section: s, group: g, index: i };
			}
		return null;
	}
	function locateGroup(g: Group) {
		for (const s of sections) {
			const i = s.groups.indexOf(g);
			if (i !== -1) return { section: s, index: i };
		}
		return null;
	}
	function edgePos(e: DragEvent, el: HTMLElement): "before" | "after" {
		const r = el.getBoundingClientRect();
		return e.clientY < r.top + r.height / 2 ? "before" : "after";
	}
	function endDrag() {
		dragKind = null;
		dragAccount = null;
		dragGroup = null;
		dragSrcId = null;
		dragging = false;
		overId = null;
	}

	function onAccountDragStart(e: DragEvent, a: Account) {
		dragKind = "account";
		dragAccount = a;
		dragSrcId = `acct:${a.name}`;
		dragging = true;
		hideHoverCard();
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", a.name);
		}
	}
	function onAccountDragOver(e: DragEvent, target: Account) {
		if (dragKind !== "account" || !dragAccount) return;
		if (target === dragAccount) {
			overId = null;
			return;
		}
		const src = locateAccount(dragAccount);
		const tgt = locateAccount(target);
		if (!src || !tgt || src.section !== tgt.section) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		overId = `acct:${target.name}`;
		overPos = edgePos(e, e.currentTarget as HTMLElement);
	}
	function onAccountDrop(e: DragEvent, target: Account) {
		if (dragKind !== "account" || !dragAccount) return;
		e.preventDefault();
		moveAccount(dragAccount, target, edgePos(e, e.currentTarget as HTMLElement));
		endDrag();
	}
	function moveAccount(src: Account, target: Account, pos: "before" | "after") {
		if (src === target) return;
		const s = locateAccount(src);
		const t = locateAccount(target);
		if (!s || !t || s.section !== t.section) return;
		s.group.accounts.splice(s.index, 1);
		let ti = t.group.accounts.indexOf(target);
		if (pos === "after") ti += 1;
		t.group.accounts.splice(ti, 0, src);
		detailCache.delete(src.name);
		accountMeta[src.name] = { section: t.section.label, group: t.group.label };
	}

	function onGroupDragStart(e: DragEvent, g: Group) {
		dragKind = "group";
		dragGroup = g;
		dragSrcId = `grp:${g.id}`;
		dragging = true;
		hideHoverCard();
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", g.label);
		}
	}
	function onGroupHeaderDragOver(e: DragEvent, g: Group) {
		if (dragKind === "account" && dragAccount) {
			// dropping an account onto a header moves it to the top of that group
			const src = locateAccount(dragAccount);
			const tl = locateGroup(g);
			if (!src || !tl || src.section !== tl.section) return;
			e.preventDefault();
			overId = `grp:${g.id}`;
			overPos = "before";
		} else if (dragKind === "group" && dragGroup && dragGroup !== g) {
			const s = locateGroup(dragGroup);
			const t = locateGroup(g);
			if (!s || !t || s.section !== t.section) return;
			e.preventDefault();
			overId = `grp:${g.id}`;
			overPos = edgePos(e, e.currentTarget as HTMLElement);
		}
	}
	function onGroupHeaderDrop(e: DragEvent, g: Group) {
		if (dragKind === "account" && dragAccount) {
			e.preventDefault();
			const src = locateAccount(dragAccount);
			const tl = locateGroup(g);
			if (src && tl && src.section === tl.section) {
				src.group.accounts.splice(src.index, 1);
				g.accounts.unshift(dragAccount);
				detailCache.delete(dragAccount.name);
				accountMeta[dragAccount.name] = { section: tl.section.label, group: g.label };
			}
		} else if (dragKind === "group" && dragGroup) {
			e.preventDefault();
			moveGroup(dragGroup, g, edgePos(e, e.currentTarget as HTMLElement));
		}
		endDrag();
	}
	function moveGroup(src: Group, target: Group, pos: "before" | "after") {
		if (src === target) return;
		const s = locateGroup(src);
		const t = locateGroup(target);
		if (!s || !t || s.section !== t.section) return;
		s.section.groups.splice(s.index, 1);
		let ti = t.section.groups.indexOf(target);
		if (pos === "after") ti += 1;
		t.section.groups.splice(ti, 0, src);
	}

	// ---- category (sub-group) CRUD ----
	let editingGroup = $state<string | null>(null); // group id being renamed
	let groupEditValue = $state("");
	let menuGroup = $state<Group | null>(null);

	function addCategory(s: Section) {
		if (!groupAccounts) groupAccounts = true; // categories only make sense in grouped view
		const g: Group = { id: nextGroupId(), label: "New Category", accounts: [] };
		s.groups.push(g);
		collapsedGroups[g.id!] = false;
		startGroupRename(g);
	}
	function startGroupRename(g: Group) {
		groupEditValue = g.label;
		editingGroup = g.id ?? null;
		closeMenus();
	}
	function commitGroupRename(g: Group) {
		const v = groupEditValue.trim();
		if (v) g.label = v;
		editingGroup = null;
	}
	function onGroupRenameKeydown(e: KeyboardEvent, g: Group) {
		if (e.key === "Enter") {
			e.preventDefault();
			commitGroupRename(g);
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			editingGroup = null;
		}
	}
	function openGroupMenu(e: MouseEvent, g: Group) {
		e.preventDefault();
		e.stopPropagation();
		hideHoverCard();
		menuAccount = null;
		const MW = 200;
		const MH = 110;
		menuX = Math.min(e.clientX, window.innerWidth - MW - 8);
		menuY = Math.min(e.clientY, window.innerHeight - MH - 8);
		menuGroup = g;
	}
	// remove a category by ungrouping: its accounts move to the section's
	// uncategorized bucket (created if needed), then the empty header is dropped.
	function removeCategory(g: Group) {
		const loc = locateGroup(g);
		closeMenus();
		if (!loc) return;
		const { section } = loc;
		if (g.accounts.length) {
			let bucket = section.groups.find((x) => x.label === "");
			if (!bucket) {
				bucket = { id: nextGroupId(), label: "", accounts: [] };
				section.groups.unshift(bucket);
			}
			for (const a of g.accounts) accountMeta[a.name] = { section: section.label, group: "" };
			bucket.accounts.push(...g.accounts);
		}
		const i = section.groups.indexOf(g);
		if (i !== -1) section.groups.splice(i, 1);
	}

	// ---- account icon picker (Emoji / Logo / Upload) — ported from ABT ----
	interface EmojiEntry {
		emoji: string;
		name: string;
		slug: string;
		skin_tone_support: boolean;
	}
	interface EmojiGroup {
		name: string;
		emojis: EmojiEntry[];
	}
	const emojiGroups = emojiData as unknown as EmojiGroup[];
	const EMOJI_GROUP_ICONS: Record<string, string> = {
		"Smileys & Emotion": "😀",
		"People & Body": "🧑",
		"Animals & Nature": "🐶",
		"Food & Drink": "🍕",
		"Travel & Places": "✈️",
		Activities: "⚽",
		Objects: "💡",
		Symbols: "💱",
		Flags: "🏳️",
	};
	const FAVICON_BASE =
		"https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://";
	function faviconUrl(input: string, size = 128): string | null {
		try {
			const domain = input.includes("://") ? new URL(input).hostname : input.replace(/^www\./, "");
			return domain ? `${FAVICON_BASE}${domain}&size=${size}` : null;
		} catch {
			return null;
		}
	}

	type IconTab = "emoji" | "logo" | "upload";
	let iconAccount = $state<Account | null>(null);
	let iconX = $state(0);
	let iconY = $state(0);
	let iconTab = $state<IconTab>("emoji");
	let iconPickerEl = $state<HTMLElement | null>(null);
	let menuAnchorRect: DOMRect | null = null;

	// emoji tab
	let emojiSearch = $state("");
	let emojiActiveGroup = $state(emojiGroups[0]?.name ?? "");
	let emojiGridWrap = $state<HTMLElement | null>(null);
	const filteredEmoji = $derived.by(() => {
		const q = emojiSearch.trim().toLowerCase();
		if (!q) return null;
		const out: EmojiEntry[] = [];
		for (const g of emojiGroups)
			for (const e of g.emojis) {
				if (e.name.includes(q) || e.slug.includes(q)) out.push(e);
				if (out.length >= 80) return out;
			}
		return out;
	});
	function scrollToEmojiGroup(name: string) {
		emojiActiveGroup = name;
		emojiSearch = "";
		emojiGridWrap?.querySelector(`[data-egroup="${name}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
	}

	// logo tab
	let logoDomain = $state("");
	let logoUrl = $state<string | null>(null);
	let logoLoaded = $state(false);
	let logoError = $state(false);
	let logoDebounce: ReturnType<typeof setTimeout> | null = null;
	function fetchLogo() {
		logoUrl = faviconUrl(logoDomain.trim().toLowerCase());
		logoLoaded = false;
		logoError = false;
	}
	function onLogoInput() {
		if (logoDebounce) clearTimeout(logoDebounce);
		logoDebounce = setTimeout(fetchLogo, 400);
	}

	// upload tab
	let uploadDataUrl = $state<string | null>(null);
	let uploadDragOver = $state(false);
	let uploadInputEl = $state<HTMLInputElement | null>(null);
	function readImageFile(file: File) {
		if (!file.type.startsWith("image/")) return;
		const reader = new FileReader();
		reader.onload = (e) => (uploadDataUrl = e.target?.result as string);
		reader.readAsDataURL(file);
	}

	const IP_W = 280;
	const IP_H = 372;
	// `rect` is the account's leading-glyph rect, so the picker opens right by the icon.
	function openIconPicker(rect: DOMRect, a: Account) {
		closeMenus();
		hideHoverCard();
		const m = 8;
		// left-align with the icon, drop it just below; flip above if there's no room
		let left = Math.min(rect.left - 4, window.innerWidth - IP_W - m);
		iconX = Math.max(m, left);
		let top = rect.bottom + 6;
		if (top + IP_H > window.innerHeight - m) top = rect.top - IP_H - 6;
		iconY = Math.max(m, top);
		iconTab = "emoji";
		emojiSearch = "";
		logoDomain = "";
		logoUrl = null;
		uploadDataUrl = null;
		iconAccount = a;
	}
	function closeIconPicker() {
		iconAccount = null;
	}
	function chooseIcon(icon: AccountIcon) {
		if (iconAccount) iconAccount.icon = icon;
		closeIconPicker();
	}
	function removeIcon(a: Account) {
		a.icon = undefined;
		closeIconPicker();
		closeMenus();
	}

	// ---- resize ----
	const MIN_WIDTH = 240;
	const MAX_WIDTH = 560;
	const DEFAULT_WIDTH = 300;
	let sidebarWidth = $state(DEFAULT_WIDTH);
	let resizing = $state(false);
	let dragStartX = 0;
	let dragStartWidth = 0;

	function startResize(e: PointerEvent) {
		resizing = true;
		dragStartX = e.clientX;
		dragStartWidth = sidebarWidth;
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			/* synthetic events may lack a capturable pointer id */
		}
	}
	function onResizeMove(e: PointerEvent) {
		if (!resizing) return;
		const next = dragStartWidth + (e.clientX - dragStartX);
		sidebarWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next));
	}
	function endResize(e: PointerEvent) {
		if (!resizing) return;
		resizing = false;
		(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
	}
	function resetWidth() {
		sidebarWidth = DEFAULT_WIDTH;
	}

	const q = $derived(query.trim().toLowerCase());

	const accountMatches = (a: Account) => q === "" || a.name.toLowerCase().includes(q);
	const visibleAccounts = (g: Group) => (q === "" ? g.accounts : g.accounts.filter(accountMatches));
	const groupHasMatches = (g: Group) => visibleAccounts(g).length > 0;
	const sectionHasMatches = (s: Section) => q === "" || s.groups.some(groupHasMatches);
	const sectionHasAccounts = (s: Section) => s.groups.some((g) => g.accounts.length > 0);
	const sectionCount = (s: Section) => s.groups.reduce((n, g) => n + g.accounts.length, 0);
	// Flat mode: every visible account in a section, ignoring its sub-category grouping.
	const sectionAccounts = (s: Section) => s.groups.flatMap(visibleAccounts);

	// While searching, everything is force-expanded so matches are always visible.
	const sectionOpen = (s: Section) => q !== "" || !collapsedSections[s.label];
	const groupOpen = (g: Group) => q !== "" || !collapsedGroups[g.id ?? g.label];

	function toggleSection(s: Section) {
		if (sectionHasAccounts(s)) collapsedSections[s.label] = !collapsedSections[s.label];
	}
	function toggleGroup(g: Group) {
		const k = g.id ?? g.label;
		collapsedGroups[k] = !collapsedGroups[k];
	}

	// show a named group even when empty (so freshly-created categories appear);
	// while searching, only show groups with matches
	const showGroup = (g: Group) => (g.label ? q === "" || groupHasMatches(g) : groupHasMatches(g));

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
			e.preventDefault();
			searchEl?.focus();
		} else if (e.key === "Escape" && iconAccount) {
			closeIconPicker();
		} else if (e.key === "Escape" && (menuAccount || menuGroup)) {
			closeMenus();
		} else if (e.key === "Escape" && budgetOpen) {
			closeBudget();
		} else if (e.key === "Escape" && query) {
			query = "";
			searchEl?.blur();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleWindowClick} />

{#snippet caret(open: boolean)}
	<svg class="caret" class:collapsed={!open} viewBox="0 0 7 10" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path
			d="M6 3.75L3.5 6.25L1 3.75"
			stroke="#C9D1D9"
			stroke-opacity="0.4"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
{/snippet}

{#snippet pageIcon()}
	<svg class="page-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
		<line x1="7" y1="17" x2="17" y2="7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
		<polyline points="8 7 17 7 17 16" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
	</svg>
{/snippet}

{#snippet budgetStateIcon(state: BudgetState)}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		xmlns="http://www.w3.org/2000/svg"
	>
		<!-- shared cloud -->
		<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
		{#if state === "syncing"}
			<path d="m9 13 2 2 4-4" />
		{:else if state === "downloadable"}
			<path d="M12 10v6" />
			<path d="m9 13 3 3 3-3" />
		{:else}
			<path d="m7 7 10 10" />
		{/if}
	</svg>
{/snippet}

{#snippet groupToggleIcon(grouped: boolean)}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		xmlns="http://www.w3.org/2000/svg"
	>
		{#if grouped}
			<!-- indented rows = grouped by sub-category -->
			<line x1="4" y1="6" x2="20" y2="6" />
			<line x1="10" y1="12" x2="20" y2="12" />
			<line x1="10" y1="18" x2="20" y2="18" />
		{:else}
			<!-- even rows = flat list -->
			<line x1="4" y1="6" x2="20" y2="6" />
			<line x1="4" y1="12" x2="20" y2="12" />
			<line x1="4" y1="18" x2="20" y2="18" />
		{/if}
	</svg>
{/snippet}

{#snippet navIcon(name: string)}
	{#if name === "Budget"}
		<svg viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M5.625 1.875H2.5C2.155 1.875 1.875 2.155 1.875 2.5V5.625C1.875 5.97 2.155 6.25 2.5 6.25H5.625C5.97 6.25 6.25 5.97 6.25 5.625V2.5C6.25 2.155 5.97 1.875 5.625 1.875Z"
				stroke="currentColor"
				stroke-width="0.9375"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M12.5 1.875H9.375C9.03 1.875 8.75 2.155 8.75 2.5V5.625C8.75 5.97 9.03 6.25 9.375 6.25H12.5C12.845 6.25 13.125 5.97 13.125 5.625V2.5C13.125 2.155 12.845 1.875 12.5 1.875Z"
				stroke="currentColor"
				stroke-width="0.9375"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M5.625 8.75H2.5C2.155 8.75 1.875 9.03 1.875 9.375V12.5C1.875 12.845 2.155 13.125 2.5 13.125H5.625C5.97 13.125 6.25 12.845 6.25 12.5V9.375C6.25 9.03 5.97 8.75 5.625 8.75Z"
				stroke="currentColor"
				stroke-width="0.9375"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M12.5 8.75H9.375C9.03 8.75 8.75 9.03 8.75 9.375V12.5C8.75 12.845 9.03 13.125 9.375 13.125H12.5C12.845 13.125 13.125 12.845 13.125 12.5V9.375C13.125 9.03 12.845 8.75 12.5 8.75Z"
				stroke="currentColor"
				stroke-width="0.9375"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	{:else if name === "Reports"}
		<svg viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M11.25 12.5V6.25"
				stroke="currentColor"
				stroke-width="0.9375"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M7.5 12.5V2.5"
				stroke="currentColor"
				stroke-width="0.9375"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M3.75 12.5V8.75"
				stroke="currentColor"
				stroke-width="0.9375"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	{:else if name === "Schedules"}
		<svg viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M11.875 2.5H3.125C2.435 2.5 1.875 3.06 1.875 3.75V12.5C1.875 13.19 2.435 13.75 3.125 13.75H11.875C12.565 13.75 13.125 13.19 13.125 12.5V3.75C13.125 3.06 12.565 2.5 11.875 2.5Z"
				stroke="currentColor"
				stroke-width="0.9375"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M10 1.25V3.75"
				stroke="currentColor"
				stroke-width="0.9375"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M5 1.25V3.75"
				stroke="currentColor"
				stroke-width="0.9375"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M1.875 6.25H13.125"
				stroke="currentColor"
				stroke-width="0.9375"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	{:else if name === "More"}
		<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
			<circle cx="5" cy="12" r="1.9" />
			<circle cx="12" cy="12" r="1.9" />
			<circle cx="19" cy="12" r="1.9" />
		</svg>
	{:else if name === "Payees"}
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M22 20v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	{:else if name === "Rules"}
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			xmlns="http://www.w3.org/2000/svg"
		>
			<line x1="4" y1="7" x2="14" y2="7" />
			<line x1="18" y1="7" x2="20" y2="7" />
			<circle cx="16" cy="7" r="2" />
			<line x1="4" y1="17" x2="8" y2="17" />
			<line x1="12" y1="17" x2="20" y2="17" />
			<circle cx="10" cy="17" r="2" />
		</svg>
	{:else if name === "Bank Sync"}
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			xmlns="http://www.w3.org/2000/svg"
		>
			<line x1="3" y1="21" x2="21" y2="21" />
			<path d="M4 10h16" />
			<path d="M12 3 20 8H4z" />
			<line x1="6" y1="10" x2="6" y2="21" />
			<line x1="12" y1="10" x2="12" y2="21" />
			<line x1="18" y1="10" x2="18" y2="21" />
		</svg>
	{:else if name === "Tags"}
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
			<line x1="7" y1="7" x2="7.01" y2="7" />
		</svg>
	{:else if name === "Settings"}
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			xmlns="http://www.w3.org/2000/svg"
		>
			<circle cx="12" cy="12" r="3" />
			<path
				d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
			/>
		</svg>
	{/if}
{/snippet}

{#snippet statusIcon(status: Status)}
	<span class="status status-{status}" aria-label={status}>
		{#if status === "synced"}
			<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
				<circle cx="24" cy="24" r="9" fill="currentColor" />
			</svg>
		{:else if status === "syncing"}
			<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
				<circle cx="24" cy="24" r="4.6" fill="currentColor" />
				<g class="orbit">
					<path d="M24 24m-11,0 a11,11 0 0 1 19.5,-6.8" stroke-width="3.4" stroke-linecap="round" />
				</g>
			</svg>
		{:else if status === "error"}
			<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
				<circle cx="24" cy="24" r="6.5" fill="currentColor" stroke="none" />
				<circle class="ring-pulse" cx="24" cy="24" r="13" stroke-width="3" />
			</svg>
		{:else}
			<svg
				viewBox="0 0 48 48"
				fill="none"
				stroke="currentColor"
				stroke-width="3.4"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle cx="24" cy="24" r="8" />
			</svg>
		{/if}
	</span>
{/snippet}

<!-- account icon (avatar): sits to the left of the name, separate from the status dot -->
{#snippet acctIcon(a: Account)}
	{#if a.icon}
		<span class="acct-icon">
			{#if a.icon.type === "emoji"}
				<span class="acct-icon-emoji">{a.icon.value}</span>
			{:else}
				<img class="acct-icon-img" src={a.icon.value} alt="" />
			{/if}
		</span>
	{/if}
{/snippet}

{#snippet ctxIcon(name: string)}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		xmlns="http://www.w3.org/2000/svg"
	>
		{#if name === "rename"}
			<path d="M12 20h9" />
			<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
		{:else if name === "sync"}
			<path d="M21 2v6h-6" />
			<path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
			<path d="M3 22v-6h6" />
			<path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
		{:else if name === "reconcile"}
			<path d="M12 3v18" />
			<path d="M3 7l9-4 9 4" />
			<path d="M6 7l-3 6a3 3 0 0 0 6 0Z" />
			<path d="M18 7l3 6a3 3 0 0 1-6 0Z" />
		{:else if name === "link"}
			<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
			<path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
		{:else if name === "emoji"}
			<circle cx="12" cy="12" r="9" />
			<path d="M8.5 14s1.2 2 3.5 2 3.5-2 3.5-2" />
			<line x1="9" y1="9.5" x2="9.01" y2="9.5" />
			<line x1="15" y1="9.5" x2="15.01" y2="9.5" />
		{:else if name === "unlink"}
			<path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
			<path d="M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" />
			<line x1="8" y1="2" x2="8" y2="5" />
			<line x1="2" y1="8" x2="5" y2="8" />
			<line x1="16" y1="19" x2="16" y2="22" />
			<line x1="19" y1="16" x2="22" y2="16" />
		{:else if name === "close"}
			<rect x="3" y="4" width="18" height="4" rx="1" />
			<path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
			<line x1="10" y1="12" x2="14" y2="12" />
		{:else if name === "ungroup"}
			<path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
			<line x1="9" y1="13" x2="15" y2="13" />
		{:else if name === "plus"}
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		{/if}
	</svg>
{/snippet}

{#snippet accountRow(a: Account)}
	{@const key = `account:${a.name}`}
	{@const isSelected = activePage === key}
	{@const rowId = `acct:${a.name}`}
	{#if editingAccount === a.name}
		<div class="account editing">
			{@render statusIcon(a.status)}
			{@render acctIcon(a)}
			<input
				class="account-rename"
				bind:value={acctEditValue}
				use:autofocus
				onkeydown={(e) => onRenameKeydown(e, a)}
				onblur={() => commitRename(a)}
			/>
		</div>
	{:else}
		<button
			type="button"
			class="account"
			class:selected={isSelected}
			class:dragging={dragSrcId === rowId}
			class:drop-before={overId === rowId && overPos === "before"}
			class:drop-after={overId === rowId && overPos === "after"}
			draggable="true"
			onclick={() => (activePage = key)}
			oncontextmenu={(e) => openAccountMenu(e, a)}
			onmouseenter={(e) => onAccountEnter(e, a)}
			onmouseleave={hideHoverCard}
			ondragstart={(e) => onAccountDragStart(e, a)}
			ondragover={(e) => onAccountDragOver(e, a)}
			ondrop={(e) => onAccountDrop(e, a)}
			ondragend={endDrag}
		>
			<span
				class="acct-glyph"
				class:has-icon={!!a.icon}
				role="button"
				tabindex="-1"
				aria-label="Change icon"
				use:tooltip={{ text: "Change icon", placement: "right" }}
				onclick={(e) => {
					e.stopPropagation();
					openIconPicker((e.currentTarget as HTMLElement).getBoundingClientRect(), a);
				}}
				onkeydown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						e.stopPropagation();
						openIconPicker((e.currentTarget as HTMLElement).getBoundingClientRect(), a);
					}
				}}
			>
				{@render statusIcon(a.status)}
				{@render acctIcon(a)}
				<span class="acct-glyph-edit" aria-hidden="true">{@render ctxIcon("emoji")}</span>
			</span>
			<span class="account-name" class:mauve={isSelected}>{a.name}</span>
			<span class="account-amount" class:mauve={isSelected} class:red={!isSelected && a.negative}>{a.amount}</span
			>
		</button>
	{/if}
{/snippet}

<div
	class="sidebar"
	class:resizing
	class:collapsed
	class:light={theme === "light"}
	style="width: {collapsed ? RAIL_WIDTH : sidebarWidth}px"
>
	{#if collapsed}
		<!-- ===== Collapsed icon rail ===== -->
		<button
			type="button"
			class="rail-avatar"
			onclick={expandSidebar}
			aria-label={`${currentBudget} — expand`}
			use:tooltip={`${currentBudget} — expand`}>{budgetInitials}</button
		>
		<button
			type="button"
			class="rail-icon"
			onclick={expandAndSearch}
			aria-label="Search"
			use:tooltip={"Search (⌘K)"}
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle cx="11" cy="11" r="7" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
		</button>
		<div class="rail-nav">
			{#each navItems as item}
				<button
					type="button"
					class="rail-icon"
					class:active={activePage === item}
					onclick={() => (activePage = item)}
					aria-label={item}
					use:tooltip={item}
				>
					{@render navIcon(item)}
				</button>
			{/each}
			<button type="button" class="rail-icon" onclick={expandSidebar} aria-label="More" use:tooltip={"More"}>
				{@render navIcon("More")}
			</button>
		</div>
		<div class="rail-divider"></div>
		<div class="rail-list">
			{#each sections as section}
				{#if sectionHasAccounts(section)}
					{@const [first, ...rest] = section.label.split(" ")}
					<div class="rail-section" use:tooltip={`${section.label} · ${section.total}`}>
						{first}{#if rest.length}<small>{rest.join(" ")}</small>{/if}
					</div>
					{#each section.groups as group, gi}
						{#if gi > 0 && group.accounts.length}<div class="rail-gsep"></div>{/if}
						{#each group.accounts as a (a.name)}
							{@const key = `account:${a.name}`}
							<button
								type="button"
								class="rtile-wrap"
								class:selected={activePage === key}
								aria-label={`${a.name} · ${a.amount}`}
								use:tooltip={`${a.name} · ${a.amount}`}
								onclick={() => (activePage = key)}
							>
								<span class="rtile">
									{#if a.icon}
										{#if a.icon.type === "emoji"}<span class="rtile-emoji">{a.icon.value}</span
											>{:else}<img class="rtile-img" src={a.icon.value} alt="" />{/if}
									{:else}{accountInitials(a.name)}{/if}
								</span>
								<span class="rtile-badge">{@render statusIcon(a.status)}</span>
							</button>
						{/each}
					{/each}
				{/if}
			{/each}
		</div>
		<div class="rail-foot">
			<button type="button" class="rail-icon" aria-label="Add account" use:tooltip={"Add account"}>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					xmlns="http://www.w3.org/2000/svg"
				>
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</button>
			<button
				type="button"
				class="rail-icon"
				onclick={expandSidebar}
				aria-label="Expand sidebar"
				use:tooltip={"Expand sidebar"}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					xmlns="http://www.w3.org/2000/svg"
				>
					<rect x="3" y="4" width="18" height="16" rx="2" />
					<line x1="15" y1="4" x2="15" y2="20" />
				</svg>
			</button>
		</div>
	{:else}
		<!-- Budget selection -->
		<div class="budget" bind:this={budgetEl}>
			{#if !budgetOpen}
				<button
					type="button"
					class="budget-select"
					onclick={(e) => {
						e.stopPropagation();
						budgetOpen = true;
					}}
				>
					<span class="budget-name">{currentBudget}</span>
					<svg
						class="chevron-updown"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						xmlns="http://www.w3.org/2000/svg"
					>
						<polyline points="7 15 12 20 17 15" />
						<polyline points="17 9 12 4 7 9" />
					</svg>
				</button>
			{:else}
				<div class="budget-header" class:editing={editingBudget}>
					{#if editingBudget}
						<input
							class="budget-edit"
							bind:value={editValue}
							use:autofocus
							onkeydown={onEditKeydown}
							onblur={commitEdit}
						/>
					{:else}
						<button
							type="button"
							class="budget-name-btn"
							use:tooltip={{ text: "Click to rename", placement: "bottom" }}
							onclick={(e) => {
								e.stopPropagation();
								startEdit();
							}}
						>
							<span class="budget-name">{currentBudget}</span>
						</button>
					{/if}
					<button
						type="button"
						class="budget-edit-btn"
						aria-label={editingBudget ? "Save budget name" : "Rename budget"}
						onclick={(e) => {
							e.stopPropagation();
							editingBudget ? commitEdit() : startEdit();
						}}
					>
						{#if editingBudget}
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.4"
								stroke-linecap="round"
								stroke-linejoin="round"
								xmlns="http://www.w3.org/2000/svg"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						{:else}
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path d="M12 20h9" />
								<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
							</svg>
						{/if}
					</button>
				</div>
				<div class="budget-menu">
					{#each budgets as b (b.name)}
						{@const isActive = b.name === currentBudget}
						<button
							type="button"
							class="budget-item"
							class:active={isActive}
							onclick={() => selectBudget(b)}
						>
							<span class="budget-dot" class:active={isActive}></span>
							<span class="budget-item-name">{b.name}</span>
							<span
								class="budget-state budget-state-{b.state}"
								aria-label={budgetStateLabel(b.state)}
								use:tooltip={{ text: budgetStateLabel(b.state), placement: "left" }}
							>
								{@render budgetStateIcon(b.state)}
							</span>
						</button>
					{/each}
					<div class="budget-menu-divider"></div>
					<button type="button" class="budget-exit" onclick={closeFile}>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
							<polyline points="16 17 21 12 16 7" />
							<line x1="21" y1="12" x2="9" y2="12" />
						</svg>
						<span>Close file</span>
					</button>
				</div>
			{/if}
		</div>

		<!-- Search -->
		<div class="search">
			<div class="search-left">
				<svg class="search-icon" viewBox="0 0 11.75 11.75" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path
						d="M7.625 7.625L11.125 11.125M4.708 8.792C2.453 8.792 0.625 6.963 0.625 4.708C0.625 2.453 2.453 0.625 4.708 0.625C6.963 0.625 8.792 2.453 8.792 4.708C8.792 6.963 6.963 8.792 4.708 8.792Z"
						stroke="#E6EDF3"
						stroke-opacity="0.4"
						stroke-width="1.25"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<input
					class="search-input"
					type="text"
					placeholder="Search..."
					bind:this={searchEl}
					bind:value={query}
				/>
			</div>
			{#if query}
				<button type="button" class="search-clear" aria-label="Clear search" onclick={() => (query = "")}
					>✕</button
				>
			{:else}
				<span class="search-kbd">⌘K</span>
			{/if}
		</div>

		<!-- Nav -->
		<nav class="nav">
			{#each navItems as item}
				<button
					type="button"
					class="nav-link"
					class:active={activePage === item}
					onclick={() => (activePage = item)}
				>
					<span class="nav-icon">{@render navIcon(item)}</span>
					<span class="nav-label">{item}</span>
				</button>
			{/each}

			<!-- More: pure disclosure for its sub-pages (not a page itself) -->
			<button
				type="button"
				class="nav-link"
				aria-expanded={moreExpanded}
				onclick={() => (moreExpanded = !moreExpanded)}
			>
				<span class="nav-icon">{@render navIcon("More")}</span>
				<span class="nav-label">More</span>
				<span class="nav-caret">{@render caret(moreExpanded)}</span>
			</button>

			{#if moreExpanded}
				<div class="nav-sublist">
					{#each moreItems as sub}
						<button
							type="button"
							class="nav-link nav-sublink"
							class:active={activePage === sub}
							onclick={() => (activePage = sub)}
						>
							<span class="nav-icon">{@render navIcon(sub)}</span>
							<span class="nav-label">{sub}</span>
						</button>
					{/each}
				</div>
			{/if}
		</nav>

		<div class="divider"></div>

		<!-- Accounts -->
		<div
			class="accounts"
			bind:this={accountsEl}
			style:mask-image={accountsMask}
			style:-webkit-mask-image={accountsMask}
			onscroll={handleAccountsScroll}
		>
			<div class="all-accounts">
				<div class="all-accounts-left">
					<span class="all-accounts-label">All Accounts</span>
					<button
						type="button"
						class="group-toggle"
						class:on={groupAccounts}
						aria-pressed={groupAccounts}
						use:tooltip={{
							text: groupAccounts
								? "Grouped by category — click for a flat list"
								: "Flat list — click to group by category",
							placement: "right",
						}}
						onclick={() => (groupAccounts = !groupAccounts)}
					>
						{@render groupToggleIcon(groupAccounts)}
					</button>
				</div>
				<span class="all-accounts-total">{grandTotal}</span>
			</div>

			{#each sections as section}
				{#if sectionHasMatches(section)}
					<div class="section">
						<div class="group-header section-head" class:active={activePage === section.label}>
							<button
								type="button"
								class="caret-btn"
								class:disabled={!sectionHasAccounts(section)}
								aria-label={sectionOpen(section) ? "Collapse section" : "Expand section"}
								aria-expanded={sectionOpen(section)}
								onclick={() => toggleSection(section)}
							>
								{@render caret(sectionOpen(section))}
							</button>
							<button type="button" class="section-nav" onclick={() => (activePage = section.label)}>
								<span class="group-label" class:dim={section.muted}>{section.label}</span>
								{#if sectionCount(section)}<span class="group-count">{sectionCount(section)}</span>{/if}
								{@render pageIcon()}
								<span class="group-total">{section.total}</span>
							</button>
							{#if !section.muted}
								<button
									type="button"
									class="section-add"
									aria-label="New category in {section.label}"
									use:tooltip={{ text: "New category", placement: "top" }}
									onclick={(e) => {
										e.stopPropagation();
										addCategory(section);
									}}
								>
									{@render ctxIcon("plus")}
								</button>
							{/if}
						</div>

						{#if sectionOpen(section)}
							{#if groupAccounts}
								{#each section.groups as group (group.id)}
									{#if showGroup(group)}
										{#if group.label}
											{#if editingGroup === group.id}
												<div class="group-header sub editing-group">
													{@render caret(true)}
													<input
														class="group-rename"
														bind:value={groupEditValue}
														use:autofocus
														onkeydown={(e) => onGroupRenameKeydown(e, group)}
														onblur={() => commitGroupRename(group)}
													/>
												</div>
											{:else}
												<button
													type="button"
													class="group-header sub toggleable"
													class:dragging={dragSrcId === `grp:${group.id}`}
													class:drop-before={overId === `grp:${group.id}` &&
														overPos === "before"}
													class:drop-after={overId === `grp:${group.id}` &&
														overPos === "after"}
													draggable="true"
													onclick={() => toggleGroup(group)}
													ondblclick={() => startGroupRename(group)}
													oncontextmenu={(e) => openGroupMenu(e, group)}
													ondragstart={(e) => onGroupDragStart(e, group)}
													ondragover={(e) => onGroupHeaderDragOver(e, group)}
													ondrop={(e) => onGroupHeaderDrop(e, group)}
													ondragend={endDrag}
												>
													{@render caret(groupOpen(group))}
													<span class="group-label sub-label">{group.label}</span>
													{#if group.accounts.length}<span class="group-count sub-count"
															>{group.accounts.length}</span
														>{/if}
													{#if group.total}<span class="group-total">{group.total}</span>{/if}
												</button>
											{/if}
											{#if groupOpen(group)}
												{#if visibleAccounts(group).length}
													<div class="account-list indented">
														{#each visibleAccounts(group) as a (a.name)}{@render accountRow(
																a,
															)}{/each}
													</div>
												{:else if q === ""}
													<div
														class="group-empty-hint"
														class:drop-before={overId === `grp:${group.id}`}
														ondragover={(e) => onGroupHeaderDragOver(e, group)}
														ondrop={(e) => onGroupHeaderDrop(e, group)}
														role="list"
													>
														Drop accounts here
													</div>
												{/if}
											{/if}
										{:else}
											<div class="account-list">
												{#each visibleAccounts(group) as a (a.name)}{@render accountRow(
														a,
													)}{/each}
											</div>
										{/if}
									{/if}
								{/each}
							{:else}
								<!-- flat: all accounts in the section, no sub-category headers or indent -->
								<div class="account-list">
									{#each sectionAccounts(section) as a (a.name)}{@render accountRow(a)}{/each}
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			{/each}

			{#if q !== "" && !sections.some(sectionHasMatches)}
				<p class="no-results">No accounts match "{query}"</p>
			{/if}
		</div>

		<!-- Footer -->
		<div class="footer">
			<button type="button" class="add-account">
				<svg
					class="plus"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					xmlns="http://www.w3.org/2000/svg"
				>
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				<span>Add account</span>
			</button>
			<button
				type="button"
				class="theme-toggle"
				aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
				use:tooltip={{
					text: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
					placement: "top",
				}}
				onclick={toggleTheme}
			>
				{#if theme === "dark"}
					<!-- sun: click to go light -->
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						xmlns="http://www.w3.org/2000/svg"
					>
						<circle cx="12" cy="12" r="4" />
						<path
							d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
						/>
					</svg>
				{:else}
					<!-- moon: click to go dark -->
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
					</svg>
				{/if}
			</button>
			<button
				type="button"
				class="collapse"
				aria-label="Collapse sidebar"
				use:tooltip={{ text: "Collapse sidebar", placement: "top" }}
				onclick={() => (collapsed = true)}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					xmlns="http://www.w3.org/2000/svg"
				>
					<rect x="3" y="4" width="18" height="16" rx="2" />
					<line x1="9" y1="4" x2="9" y2="20" />
				</svg>
			</button>
		</div>
	{/if}

	<!-- Custom tooltip (replaces native title=) -->
	{#if tip}
		<div class="tooltip tip-{tip.placement}" style="left: {tip.x}px; top: {tip.y}px" role="tooltip">
			{tip.text}
		</div>
	{/if}

	<!-- Drag to resize (double-click to reset) -->
	{#if !collapsed}
		<div
			class="resize-handle"
			class:active={resizing}
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize sidebar"
			use:tooltip={{ text: "Drag to resize · double-click to reset", placement: "left" }}
			onpointerdown={startResize}
			onpointermove={onResizeMove}
			onpointerup={endResize}
			onpointercancel={endResize}
			ondblclick={resetWidth}
		></div>
	{/if}

	<!-- Account hover card: rich "account at a glance" anchored to the row -->
	{#if hoverAccount && !collapsed}
		{@const d = accountDetail(hoverAccount)}
		{@const up = d.deltaAbs >= 0}
		{@const path = trendPath(d.points, 264, 52)}
		<div class="acard" class:flip={hoverFlip} style="top: {hoverTop}px; left: {hoverLeft}px">
			<div class="acard-head">
				<span class="acard-status">{@render statusIcon(hoverAccount.status)}</span>
				<div class="acard-title">
					<span class="acard-name">{hoverAccount.name}</span>
					<span class="acard-sub">{d.institution} · {d.type}</span>
				</div>
			</div>

			<div class="acard-balrow">
				<span class="acard-ballabel">Balance</span>
				<span class="acard-bal" class:neg={hoverAccount.negative}>{hoverAccount.amount}</span>
			</div>

			<div class="acard-chart">
				<svg viewBox="0 0 264 52" preserveAspectRatio="none" class:up class:down={!up}>
					<defs>
						<linearGradient id="acardgrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="currentColor" stop-opacity="0.28" />
							<stop offset="100%" stop-color="currentColor" stop-opacity="0" />
						</linearGradient>
					</defs>
					<path d={path.area} fill="url(#acardgrad)" stroke="none" />
					<path
						d={path.line}
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
						stroke-linejoin="round"
						stroke-linecap="round"
					/>
				</svg>
				<div class="acard-chart-foot">
					<span class="acard-period">30 days</span>
					<span class="acard-delta" class:up class:down={!up}>
						{up ? "▲" : "▼"}
						{Math.abs(d.deltaPct).toFixed(1)}%
						<span class="acard-delta-abs">{up ? "+" : "−"}{money(d.deltaAbs)}</span>
					</span>
				</div>
			</div>

			{#if d.showLedger}
				<div class="acard-div"></div>
				<div class="acard-lines">
					<div class="acard-line">
						<span class="k">Cleared</span>
						<span class="v">{d.cleared}</span>
					</div>
					{#if d.unclearedCount}
						<div class="acard-line">
							<span class="k">Uncleared <span class="acard-badge">{d.unclearedCount}</span></span>
							<span class="v" class:neg={d.unclearedNegative}
								>{d.unclearedNegative ? "−" : "+"}{d.unclearedAmount}</span
							>
						</div>
					{/if}
				</div>
			{/if}

			{#if d.upcoming.length}
				<div class="acard-div"></div>
				<div class="acard-block-label">Upcoming</div>
				<div class="acard-lines">
					{#each d.upcoming as u}
						<div class="acard-sched">
							<span class="acard-date">{u.date}</span>
							<span class="acard-payee">{u.payee}</span>
							<span class="acard-amt" class:neg={u.negative}>{u.negative ? "−" : "+"}{u.amount}</span>
						</div>
					{/each}
				</div>
			{/if}

			<div class="acard-sync acard-sync-{hoverAccount.status}">
				<span class="acard-sync-dot">{@render statusIcon(hoverAccount.status)}</span>
				<span>{d.syncText}</span>
			</div>
		</div>
	{/if}

	<!-- Account right-click context menu -->
	{#if menuAccount}
		{@const a = menuAccount}
		{@const linked = a.status !== "manual"}
		<div class="ctx" style="top: {menuY}px; left: {menuX}px">
			<button type="button" class="ctx-item" onclick={() => startRename(a)}>
				{@render ctxIcon("rename")}<span>Rename</span>
			</button>
			<button
				type="button"
				class="ctx-item"
				onclick={(e) => {
					e.stopPropagation();
					if (menuAnchorRect) openIconPicker(menuAnchorRect, a);
				}}
			>
				{@render ctxIcon("emoji")}<span>Change icon…</span>
			</button>
			{#if a.icon}
				<button type="button" class="ctx-item" onclick={() => removeIcon(a)}>
					{@render ctxIcon("close")}<span>Remove icon</span>
				</button>
			{/if}
			{#if linked}
				<button type="button" class="ctx-item" onclick={() => syncNow(a)}>
					{@render ctxIcon("sync")}<span>Sync now</span>
				</button>
			{/if}
			<button type="button" class="ctx-item" onclick={() => reconcile(a)}>
				{@render ctxIcon("reconcile")}<span>Reconcile…</span>
			</button>
			<button type="button" class="ctx-item" onclick={() => toggleBankLink(a)}>
				{@render ctxIcon(linked ? "unlink" : "link")}<span>{linked ? "Unlink bank" : "Link bank"}</span>
			</button>
			<div class="ctx-div"></div>
			<button type="button" class="ctx-item danger" onclick={() => closeAccount(a)}>
				{@render ctxIcon("close")}<span>Close account</span>
			</button>
		</div>
	{/if}

	<!-- Category (sub-group) right-click context menu -->
	{#if menuGroup}
		{@const g = menuGroup}
		<div class="ctx" style="top: {menuY}px; left: {menuX}px">
			<button type="button" class="ctx-item" onclick={() => startGroupRename(g)}>
				{@render ctxIcon("rename")}<span>Rename</span>
			</button>
			<div class="ctx-div"></div>
			<button type="button" class="ctx-item danger" onclick={() => removeCategory(g)}>
				{@render ctxIcon("ungroup")}<span>Remove category</span>
			</button>
		</div>
	{/if}

	<!-- Account icon picker (Emoji / Logo / Upload) -->
	{#if iconAccount}
		<div
			class="ipick"
			style="top: {iconY}px; left: {iconX}px"
			bind:this={iconPickerEl}
			role="dialog"
			aria-label="Account icon"
		>
			<div class="ipick-tabs">
				<button class="ipick-tab" class:active={iconTab === "emoji"} onclick={() => (iconTab = "emoji")}
					>Emoji</button
				>
				<button class="ipick-tab" class:active={iconTab === "logo"} onclick={() => (iconTab = "logo")}
					>Logo</button
				>
				<button class="ipick-tab" class:active={iconTab === "upload"} onclick={() => (iconTab = "upload")}
					>Upload</button
				>
				<button class="ipick-close" aria-label="Close" onclick={closeIconPicker}>
					<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
						><path d="M4 4l8 8M12 4l-8 8" /></svg
					>
				</button>
			</div>

			{#if iconTab === "emoji"}
				<div class="ipick-pane">
					<input class="ipick-input" type="text" placeholder="Search emoji…" bind:value={emojiSearch} />
					{#if !emojiSearch.trim()}
						<div class="eg-tabs">
							{#each emojiGroups as g}
								<button
									class="eg-tab"
									class:active={emojiActiveGroup === g.name}
									title={g.name}
									onclick={() => scrollToEmojiGroup(g.name)}
									>{EMOJI_GROUP_ICONS[g.name] ?? "·"}</button
								>
							{/each}
						</div>
					{/if}
					<div class="eg-grid-wrap" bind:this={emojiGridWrap}>
						{#if filteredEmoji}
							{#if filteredEmoji.length}
								<div class="eg-grid">
									{#each filteredEmoji as e}
										<button
											class="eg-btn"
											title={e.name}
											onclick={() => chooseIcon({ type: "emoji", value: e.emoji })}
											>{e.emoji}</button
										>
									{/each}
								</div>
							{:else}
								<div class="ipick-hint">No results</div>
							{/if}
						{:else}
							{#each emojiGroups as g}
								<div data-egroup={g.name}>
									<div class="eg-label">{g.name}</div>
									<div class="eg-grid">
										{#each g.emojis as e}
											{#if !e.skin_tone_support || !e.name.includes("skin tone")}
												<button
													class="eg-btn"
													title={e.name}
													onclick={() => chooseIcon({ type: "emoji", value: e.emoji })}
													>{e.emoji}</button
												>
											{/if}
										{/each}
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{:else if iconTab === "logo"}
				<div class="ipick-pane">
					<input
						class="ipick-input"
						type="text"
						placeholder="bankofamerica.com"
						bind:value={logoDomain}
						oninput={onLogoInput}
						onkeydown={(e) => e.key === "Enter" && fetchLogo()}
					/>
					{#if logoUrl}
						<button
							class="logo-preview"
							class:loaded={logoLoaded}
							disabled={!logoLoaded}
							onclick={() => logoLoaded && chooseIcon({ type: "url", value: logoUrl! })}
						>
							{#if logoError}
								<span class="logo-err">No logo found</span>
							{:else}
								<img
									src={logoUrl}
									alt="logo"
									onload={() => {
										logoLoaded = true;
										logoError = false;
									}}
									onerror={() => {
										logoLoaded = false;
										logoError = true;
									}}
								/>
								{#if logoLoaded}<span class="logo-hint">Click to use</span>{/if}
							{/if}
						</button>
					{:else}
						<p class="ipick-hint">Type a domain to fetch its logo</p>
					{/if}
				</div>
			{:else}
				<div class="ipick-pane">
					<input
						type="file"
						accept="image/*"
						class="ipick-sr"
						bind:this={uploadInputEl}
						onchange={(e) => {
							const f = (e.target as HTMLInputElement).files?.[0];
							if (f) readImageFile(f);
						}}
					/>
					<div
						class="dropzone"
						class:over={uploadDragOver}
						role="button"
						tabindex="0"
						onclick={() => uploadInputEl?.click()}
						onkeydown={(e) => e.key === "Enter" && uploadInputEl?.click()}
						ondragover={(e) => {
							e.preventDefault();
							uploadDragOver = true;
						}}
						ondragleave={() => (uploadDragOver = false)}
						ondrop={(e) => {
							e.preventDefault();
							uploadDragOver = false;
							const f = e.dataTransfer?.files?.[0];
							if (f) readImageFile(f);
						}}
					>
						{#if uploadDataUrl}
							<img src={uploadDataUrl} alt="preview" class="dropzone-img" />
							<span class="ipick-hint">Click to replace</span>
						{:else}
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="dropzone-icon"
								><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
									points="17 8 12 3 7 8"
								/><line x1="12" y1="3" x2="12" y2="15" /></svg
							>
							<span class="ipick-hint">Drop image or click to browse</span>
						{/if}
					</div>
					{#if uploadDataUrl}
						<button
							class="ipick-primary"
							onclick={() => chooseIcon({ type: "dataUrl", value: uploadDataUrl! })}
							>Use this image</button
						>
					{/if}
				</div>
			{/if}

			{#if iconAccount.icon}
				<div class="ipick-foot">
					<button class="ipick-remove" onclick={() => iconAccount && removeIcon(iconAccount)}
						>Remove icon</button
					>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.sidebar,
	.sidebar :global(*),
	.sidebar :global(*::before),
	.sidebar :global(*::after) {
		box-sizing: border-box;
	}

	.sidebar {
		/* ── Theme tokens (GitHub-dark defaults; .sidebar.light overrides) ── */
		--sb-bg: #161b22;
		--sb-canvas: #0d1117;
		--sb-inset: #1c2129;
		--sb-surface: #21262d;
		--sb-surface-hover: #262c36;
		--sb-neutral-muted: #30363d;
		--sb-border: #30363d;
		--sb-border-muted: #21262d;
		--sb-border-strong: #3d444d;
		--sb-fg: #e6edf3;
		--sb-fg-default: #c9d1d9;
		--sb-fg-muted: #8b949e;
		--sb-fg-subtle: #6e7681;
		--sb-fg-faint: #59636e;
		--sb-accent: #58a6ff;
		--sb-accent-emphasis: #1f6feb;
		--sb-accent-muted: rgba(56, 139, 253, 0.15);
		--sb-accent-wash: rgba(56, 139, 253, 0.14);
		--sb-accent-subtle: rgba(56, 139, 253, 0.1);
		--sb-accent-subtle2: rgba(56, 139, 253, 0.08);
		--sb-accent-faint: rgba(56, 139, 253, 0.06);
		--sb-accent-a60: rgba(88, 166, 255, 0.6);
		--sb-success: #3fb950;
		--sb-success-muted: rgba(63, 185, 80, 0.18);
		--sb-danger: #f85149;
		--sb-danger-muted: rgba(248, 81, 73, 0.12);
		--sb-danger-subtle: rgba(248, 81, 73, 0.1);
		--sb-attention: #d29922;
		--sb-hover-0: rgba(255, 255, 255, 0.02);
		--sb-hover-1: rgba(255, 255, 255, 0.05);
		--sb-hover-2: rgba(255, 255, 255, 0.06);
		--sb-hover-3: rgba(255, 255, 255, 0.08);
		--sb-hover-4: rgba(255, 255, 255, 0.1);
		--sb-hover-5: rgba(255, 255, 255, 0.12);
		--sb-hover-6: rgba(255, 255, 255, 0.14);
		--sb-fg-a95: rgba(230, 237, 243, 0.95);
		--sb-fg-a50: rgba(230, 237, 243, 0.5);
		--sb-fg-a40: rgba(230, 237, 243, 0.4);
		--sb-fg-a32: rgba(230, 237, 243, 0.32);
		--sb-fg-a22: rgba(230, 237, 243, 0.22);
		--sb-fg-a18: rgba(230, 237, 243, 0.18);
		--sb-fgd-a85: rgba(201, 209, 217, 0.85);
		--sb-fgm-a100: rgba(139, 148, 158, 1);
		--sb-fgm-a80: rgba(139, 148, 158, 0.8);
		--sb-fgm-a75: rgba(139, 148, 158, 0.75);
		--sb-fgm-a60: rgba(139, 148, 158, 0.6);
		--sb-fgm-a55: rgba(139, 148, 158, 0.55);
		--sb-fgm-a50: rgba(139, 148, 158, 0.5);
		--sb-fgm-a45: rgba(139, 148, 158, 0.45);
		--sb-fgm-a16: rgba(139, 148, 158, 0.16);
		--sb-shadow: rgba(1, 4, 9, 0.6);
		--sb-shadow-2: rgba(1, 4, 9, 0.55);
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 340px;
		height: 100vh;
		padding: 10px 8px;
		background: var(--sb-bg);
		border-right: 1px solid var(--sb-border-muted);
		font-family:
			"Inter",
			-apple-system,
			BlinkMacSystemFont,
			"Segoe UI",
			sans-serif;
		/* explicit so the widget's row heights don't depend on the host page's
		   inherited line-height (≈ Inter's `normal`, so no visual change) */
		line-height: 1.3 !important;
		font-feature-settings:
			"lnum" 1,
			"tnum" 1;
		overflow: hidden;
	}
	/* ── Light theme ── */
	.sidebar.light {
		--sb-bg: #f6f8fa;
		--sb-canvas: #ffffff;
		--sb-inset: #f6f8fa;
		--sb-surface: #ffffff;
		--sb-surface-hover: #eff2f5;
		--sb-neutral-muted: #eaeef2;
		--sb-border: #d0d7de;
		--sb-border-muted: #d8dee4;
		--sb-border-strong: #afb8c1;
		--sb-fg: #1f2328;
		--sb-fg-default: #24292f;
		--sb-fg-muted: #656d76;
		--sb-fg-subtle: #6e7781;
		--sb-fg-faint: #8c959f;
		--sb-accent: #0969da;
		--sb-accent-emphasis: #0969da;
		--sb-accent-muted: rgba(9, 105, 218, 0.12);
		--sb-accent-wash: rgba(9, 105, 218, 0.1);
		--sb-accent-subtle: rgba(9, 105, 218, 0.08);
		--sb-accent-subtle2: rgba(9, 105, 218, 0.06);
		--sb-accent-faint: rgba(9, 105, 218, 0.05);
		--sb-accent-a60: rgba(9, 105, 218, 0.5);
		--sb-success: #1a7f37;
		--sb-success-muted: rgba(26, 127, 55, 0.12);
		--sb-danger: #cf222e;
		--sb-danger-muted: rgba(207, 34, 46, 0.1);
		--sb-danger-subtle: rgba(207, 34, 46, 0.08);
		--sb-attention: #9a6700;
		--sb-hover-0: rgba(31, 35, 40, 0.03);
		--sb-hover-1: rgba(31, 35, 40, 0.04);
		--sb-hover-2: rgba(31, 35, 40, 0.05);
		--sb-hover-3: rgba(31, 35, 40, 0.06);
		--sb-hover-4: rgba(31, 35, 40, 0.08);
		--sb-hover-5: rgba(31, 35, 40, 0.1);
		--sb-hover-6: rgba(31, 35, 40, 0.12);
		--sb-fg-a95: rgba(31, 35, 40, 0.92);
		--sb-fg-a50: rgba(31, 35, 40, 0.6);
		--sb-fg-a40: rgba(31, 35, 40, 0.5);
		--sb-fg-a32: rgba(31, 35, 40, 0.42);
		--sb-fg-a22: rgba(31, 35, 40, 0.32);
		--sb-fg-a18: rgba(31, 35, 40, 0.26);
		--sb-fgd-a85: rgba(36, 41, 47, 0.8);
		--sb-fgm-a100: #656d76;
		--sb-fgm-a80: rgba(101, 109, 118, 0.85);
		--sb-fgm-a75: rgba(101, 109, 118, 0.8);
		--sb-fgm-a60: rgba(101, 109, 118, 0.72);
		--sb-fgm-a55: rgba(101, 109, 118, 0.66);
		--sb-fgm-a50: rgba(101, 109, 118, 0.62);
		--sb-fgm-a45: rgba(101, 109, 118, 0.56);
		--sb-fgm-a16: rgba(101, 109, 118, 0.24);
		--sb-shadow: rgba(31, 35, 40, 0.16);
		--sb-shadow-2: rgba(31, 35, 40, 0.12);
	}

	.sidebar.resizing {
		user-select: none;
	}

	/* ===== Collapsed icon rail ===== */
	.sidebar.collapsed {
		align-items: center;
		gap: 4px;
		padding: 12px 0 8px;
	}
	.rail-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 9px;
		background: linear-gradient(135deg, var(--sb-accent-emphasis), var(--sb-accent));
		color: #fff;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.3px;
		cursor: pointer;
		flex-shrink: 0;
		margin-bottom: 4px;
	}
	.rail-nav {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		width: 100%;
	}
	.rail-divider {
		width: 40px;
		height: 1px;
		flex-shrink: 0;
		margin: 6px 0;
		background: var(--sb-neutral-muted);
	}
	.rail-list {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		width: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;
	}
	.rail-list::-webkit-scrollbar {
		display: none;
	}
	.rail-section {
		width: 44px;
		margin: 6px 0 2px;
		padding: 3px 0;
		font-size: 8.5px;
		font-weight: 800;
		line-height: 1.15;
		letter-spacing: 0.3px;
		text-transform: uppercase;
		text-align: center;
		color: var(--sb-fg-subtle);
	}
	.rail-section small {
		display: block;
		font-size: 8px;
		font-weight: 700;
		color: var(--sb-fg-faint);
	}
	.rail-gsep {
		width: 20px;
		height: 1px;
		margin: 4px 0;
		background: var(--sb-surface-hover);
	}
	.rtile-wrap {
		position: relative;
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		cursor: pointer;
	}
	.rtile {
		position: absolute;
		inset: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 9px;
		background: var(--sb-neutral-muted);
		color: var(--sb-fg-default);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.2px;
		transition: filter 0.12s ease;
	}
	.rtile-emoji {
		font-size: 18px;
		line-height: 1;
	}
	.rtile-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 9px;
	}
	.rtile-wrap:hover .rtile {
		filter: brightness(1.2);
	}
	.rtile-wrap.selected .rtile {
		color: #fff;
		box-shadow:
			0 0 0 2px var(--sb-bg),
			0 0 0 4px var(--sb-accent);
	}
	.rtile-badge {
		position: absolute;
		right: -2px;
		bottom: -2px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--sb-bg);
	}
	.rtile-badge :global(.status) {
		width: 18px;
		height: 18px;
	}
	.rail-foot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		width: 100%;
		flex-shrink: 0;
	}
	.rail-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 38px;
		border-radius: 9px;
		color: var(--sb-fg-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background 0.12s ease,
			color 0.12s ease;
	}
	.rail-icon:hover {
		background: var(--sb-hover-1);
		color: var(--sb-fg);
	}
	.rail-icon.active {
		background: var(--sb-accent-muted);
		color: var(--sb-accent);
	}
	.rail-icon :global(svg) {
		width: 18px;
		height: 18px;
	}

	/* Resize handle on the right edge */
	.resize-handle {
		position: absolute;
		top: 0;
		right: 0;
		width: 10px;
		height: 100%;
		cursor: col-resize;
		z-index: 10;
		touch-action: none;
	}
	.resize-handle::after {
		content: "";
		position: absolute;
		top: 0;
		right: 0;
		width: 2px;
		height: 100%;
		background: transparent;
		transition: background 0.12s ease;
	}
	.resize-handle:hover::after,
	.resize-handle.active::after {
		background: var(--sb-accent);
		opacity: 0.85;
	}

	button {
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		cursor: pointer;
	}

	/* Budget selection */
	.budget {
		position: relative;
		width: 100%;
		flex-shrink: 0;
	}
	.budget-select {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		box-sizing: border-box;
		height: 40px;
		padding: 0 10px;
		/* fixed height + transparent border match the expanded header exactly → no layout shift */
		border: 1px solid transparent;
		border-radius: 8px;
		text-align: left;
		transition:
			background 0.12s ease,
			border-color 0.12s ease;
	}
	.budget-select:hover {
		background: var(--sb-surface);
		border-color: var(--sb-border);
	}
	.budget-name {
		font-size: 16px;
		font-weight: 600;
		letter-spacing: 0.16px;
		color: var(--sb-fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chevron-updown {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		color: var(--sb-fg-muted);
	}
	.budget-select:hover .chevron-updown {
		color: var(--sb-fg-default);
	}

	/* Expanded budget switcher */
	.budget-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		box-sizing: border-box;
		height: 40px;
		padding: 0 8px 0 10px;
		background: var(--sb-surface);
		border: 1px solid var(--sb-border);
		border-radius: 8px;
	}
	.budget-header.editing {
		border-color: var(--sb-accent);
	}
	.budget-name-btn {
		display: flex;
		align-items: center;
		flex: 1 1 auto;
		min-width: 0;
		height: 26px;
		padding: 0 6px;
		margin-left: -6px;
		border-radius: 5px;
		text-align: left;
		transition: background 0.12s ease;
	}
	.budget-name-btn:hover {
		background: var(--sb-hover-1);
	}
	.budget-edit {
		flex: 1 1 auto;
		min-width: 0;
		font-family: inherit;
		font-size: 16px;
		font-weight: 600;
		letter-spacing: 0.16px;
		color: var(--sb-fg);
		background: var(--sb-canvas);
		border: 1px solid var(--sb-border);
		border-radius: 5px;
		padding: 3px 7px;
		outline: none;
	}
	.budget-edit:focus {
		border-color: var(--sb-accent);
	}
	.budget-edit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		border-radius: 5px;
		color: var(--sb-fg-muted);
		transition:
			color 0.12s ease,
			background 0.12s ease;
	}
	.budget-edit-btn:hover {
		color: var(--sb-fg-default);
		background: var(--sb-hover-1);
	}
	.budget-edit-btn svg {
		width: 14px;
		height: 14px;
	}
	.budget-menu {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 2px;
		box-sizing: border-box;
		padding: 5px;
		background: var(--sb-surface);
		border: 1px solid var(--sb-border);
		border-radius: 8px;
		box-shadow: 0 8px 24px var(--sb-shadow-2);
	}
	.budget-item {
		display: flex;
		align-items: center;
		gap: 9px;
		width: 100%;
		box-sizing: border-box;
		padding: 6px 8px;
		border-radius: 6px;
		text-align: left;
		transition: background 0.12s ease;
	}
	.budget-item:hover {
		background: var(--sb-hover-1);
	}
	.budget-item.active {
		background: var(--sb-accent-muted);
	}
	.budget-item-name {
		flex: 1 1 auto;
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.13px;
		color: var(--sb-fg-default);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.budget-item.active .budget-item-name {
		color: var(--sb-accent);
	}
	/* left dot: green marks the active budget, muted otherwise */
	.budget-dot {
		flex-shrink: 0;
		width: 6px;
		height: 6px;
		margin: 0 1px;
		border-radius: 50%;
		background: var(--sb-fg-subtle);
	}
	.budget-dot.active {
		width: 8px;
		height: 8px;
		margin: 0;
		background: var(--sb-success);
		box-shadow: 0 0 0 3px var(--sb-success-muted);
	}
	/* right: file-state icon */
	.budget-state {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		color: var(--sb-fg-muted);
	}
	.budget-state svg {
		width: 15px;
		height: 15px;
	}
	.budget-menu-divider {
		height: 1px;
		margin: 4px 6px;
		background: var(--sb-neutral-muted);
	}
	.budget-exit {
		display: flex;
		align-items: center;
		gap: 9px;
		width: 100%;
		box-sizing: border-box;
		padding: 6px 8px;
		border-radius: 6px;
		text-align: left;
		color: var(--sb-fg-muted);
		transition:
			background 0.12s ease,
			color 0.12s ease;
	}
	.budget-exit:hover {
		background: var(--sb-hover-1);
		color: var(--sb-fg);
	}
	.budget-exit svg {
		flex-shrink: 0;
		width: 15px;
		height: 15px;
	}
	.budget-exit span {
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.13px;
	}

	/* Search */
	.search {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		width: 100%;
		box-sizing: border-box;
		padding: 8px 13px;
		background: var(--sb-surface);
		border: 1px solid var(--sb-border);
		border-radius: 11px;
		transition: border-color 0.12s ease;
	}
	.search:focus-within {
		border-color: var(--sb-accent);
	}
	.search-left {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1 1 auto;
		min-width: 0;
	}
	.search-icon {
		width: 12.5px;
		height: 12.5px;
		flex-shrink: 0;
	}
	.search-input {
		flex: 1 1 auto;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		padding: 0;
		font-family: inherit;
		font-size: 15px;
		font-weight: 400;
		letter-spacing: 0.15px;
		color: var(--sb-fg);
	}
	.search-input::placeholder {
		color: var(--sb-fg-a40);
	}
	.search-kbd {
		flex-shrink: 0;
		padding: 3px 7px;
		background: var(--sb-neutral-muted);
		border-radius: 5px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.11px;
		color: var(--sb-fg-a40);
	}
	.search-clear {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 4px;
		font-size: 11px;
		color: var(--sb-fg-a50);
	}
	.search-clear:hover {
		background: var(--sb-neutral-muted);
		color: var(--sb-fg);
	}

	/* Nav */
	.nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.nav-link {
		display: flex;
		align-items: center;
		gap: 13px;
		width: 100%;
		padding: 8px 8px;
		border-radius: 6px;
		text-align: left;
		transition: background 0.12s ease;
	}
	.nav-link:hover {
		background: var(--sb-hover-3);
	}
	.nav-link.active {
		background: var(--sb-accent-muted);
	}
	.nav-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		color: var(--sb-fgm-a60);
	}
	.nav-icon :global(svg) {
		width: 17px;
		height: 17px;
	}
	.nav-label {
		font-size: 15px;
		font-weight: 500;
		letter-spacing: 0.16px;
		color: var(--sb-fg);
	}
	.nav-link.active .nav-icon {
		color: var(--sb-accent);
	}
	.nav-link.active .nav-label {
		color: var(--sb-accent);
	}

	/* "More" disclosure caret + sub-links */
	.nav-caret {
		margin-left: auto;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--sb-fgm-a50);
	}
	.nav-caret :global(.caret) {
		width: 11px;
		height: 14px;
	}
	.nav-sublist {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 2px 0 2px 17px;
		padding-left: 10px;
		border-left: 1px solid var(--sb-border-muted);
	}
	.nav-sublink {
		gap: 11px;
		padding: 6px 8px;
	}
	.nav-sublink .nav-icon {
		width: 16px;
		height: 16px;
	}
	.nav-sublink .nav-icon :global(svg) {
		width: 15px;
		height: 15px;
	}
	.nav-sublink .nav-label {
		font-size: 14px;
	}

	.divider {
		height: 1px;
		width: 100%;
		background: var(--sb-neutral-muted);
		flex-shrink: 0;
	}

	/* Accounts */
	.accounts {
		display: flex;
		flex-direction: column;
		gap: 9px;
		flex: 1 1 auto;
		min-height: 0;
		/* Extend the scroller 8px into the sidebar's right padding so the scrollbar
		   sits in that gutter; padding the rows back keeps them flush with the
		   nav/search/footer above and below. (calc width is needed because an
		   explicit width:100% would otherwise cancel the negative margin.)
		   The extra 6px on the left gives the active indicator a gutter to live
		   in without being clipped by overflow-x. */
		width: calc(100% + 14px);
		margin-left: -6px;
		margin-right: -8px;
		padding-left: 6px;
		padding-right: 8px;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: var(--sb-fg-a22) transparent;
		padding-bottom: 2rem;
		mask-image: linear-gradient(black 0%, black calc(100% - 34px), transparent 100%);
		-webkit-mask-image: linear-gradient(black 0%, black calc(100% - 34px), transparent 100%);
		transition:
			mask-image 140ms ease,
			-webkit-mask-image 140ms ease;
	}
	.accounts::-webkit-scrollbar {
		width: 8px;
	}
	.accounts::-webkit-scrollbar-track {
		background: transparent;
	}
	.accounts::-webkit-scrollbar-thumb {
		background: var(--sb-fg-a18);
		border-radius: 8px;
		border: 2px solid transparent;
		background-clip: padding-box;
	}
	.accounts::-webkit-scrollbar-thumb:hover {
		background: var(--sb-fg-a32);
		background-clip: padding-box;
	}
	.all-accounts {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		box-sizing: border-box;
		height: 38px;
		padding: 8px;
		border-radius: 6px;
		flex-shrink: 0;
	}
	.all-accounts-label {
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.42px;
		color: var(--sb-fg-a95);
	}
	.all-accounts-left {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.all-accounts-total {
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.14px;
		text-transform: uppercase;
		color: var(--sb-fg-default);
		font-variant-numeric: tabular-nums;
	}
	/* grouped/flat account layout toggle */
	.group-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 5px;
		color: var(--sb-fgm-a45);
		transition:
			background 0.12s ease,
			color 0.12s ease;
	}
	.group-toggle:hover {
		background: var(--sb-hover-4);
		color: var(--sb-fg);
	}
	.group-toggle.on {
		color: var(--sb-accent);
	}
	.group-toggle svg {
		width: 15px;
		height: 15px;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
	}
	.group-header {
		display: flex;
		align-items: center;
		gap: 5px;
		width: 100%;
		box-sizing: border-box;
		padding: 6px 8px;
		border-radius: 6px;
		text-align: left;
		cursor: default;
		transition: background 0.12s ease;
	}
	/* sub-group headers stay a single whole-row toggle */
	.group-header.toggleable {
		cursor: pointer;
	}
	.group-header.toggleable:hover {
		background: var(--sb-hover-2);
	}

	/* section caret = dedicated collapse button */
	.caret-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin: -2px 0;
		height: 16px;
		width: 16px;
		border-radius: 5px;
		cursor: pointer;
		transition: background 0.12s ease;
	}
	.caret-btn:hover {
		background: var(--sb-hover-6);
	}
	.caret-btn.disabled {
		pointer-events: none;
		opacity: 0.35;
	}

	/* whole section header row navigates; caret (above) is the collapse sub-control */
	.section-head {
		cursor: default;
	}
	.section-head:hover {
		background: var(--sb-hover-2);
	}
	.section-head.active {
		background: var(--sb-accent-muted);
	}
	.section-nav {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}
	.section-nav .group-label {
		flex: 0 0 auto;
	}
	.section-nav .group-total {
		margin-left: auto;
	}
	.section-head.active .group-label {
		color: var(--sb-accent);
	}
	.page-arrow {
		width: 11px;
		height: 11px;
		flex-shrink: 0;
		color: var(--sb-fgm-a75);
		opacity: 0;
		transition: opacity 0.12s ease;
	}
	.section-head:hover .page-arrow {
		opacity: 0.6;
	}
	.section-head.active .page-arrow {
		opacity: 0.9;
		color: var(--sb-accent);
	}
	.group-header.sub {
		padding-block: 4px;
		padding-left: 17.5px;
		transition:
			background-color 0.3s ease,
			color 0.3s ease;
	}
	.group-header.sub:hover {
		background: transparent;
		color: var(--sb-fgm-a100);
	}
	.group-header.sub:hover * {
		color: var(--sb-fgm-a100);
	}
	.caret {
		width: 8px;
		height: 11px;
		flex-shrink: 0;
		transition: transform 0.15s ease;
	}
	.caret.collapsed {
		transform: rotate(-90deg);
	}
	.group-label {
		flex: 1 1 auto;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.125px;
		text-transform: uppercase;
		color: var(--sb-fgm-a75);
	}
	.group-label.dim {
		color: var(--sb-fgm-a75);
	}
	.sub-label {
		flex: 0 1 auto;
		font-size: 10.5px;
		letter-spacing: 0.115px;
		color: var(--sb-fgm-a50);
	}
	.group-total {
		font-size: 12.5px;
		font-weight: 600;
		letter-spacing: 0.125px;
		text-transform: uppercase;
		color: var(--sb-fg-default);
		font-variant-numeric: tabular-nums;
	}
	/* account-count badge next to a category label */
	.group-count {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 15px;
		padding: 0 5px;
		border-radius: 8px;
		background: var(--sb-fgm-a16);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.2px;
		color: var(--sb-fgd-a85);
		font-variant-numeric: tabular-nums;
	}
	/* sub-category counts appear on hover only */
	.sub-count {
		opacity: 0;
		transition: opacity 0.12s ease;
	}
	.group-header.sub.toggleable:hover .sub-count {
		opacity: 1;
	}

	.account-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		width: 100%;
	}
	.account-list.indented {
		padding-left: 9px;
	}
	/* accounts nested under a sub-category sit a touch tighter */
	.account-list.indented .account {
		padding-block: 4px;
	}
	.account {
		display: flex;
		align-items: center;
		gap: 5px;
		width: 100%;
		box-sizing: border-box;
		padding: 6px 8px 6px 13px;
		border-radius: 7px;
		text-align: left;
		transition: background 0.12s ease;
	}
	.account:hover {
		background: var(--sb-hover-3);
	}
	.account.selected {
		background: var(--sb-accent-muted);
	}
	.no-results {
		margin: 5px 8px;
		font-size: 14px;
		color: var(--sb-fg-a40);
	}

	/* Sync-status glyphs (dot grammar) */
	.status {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 17px;
		height: 17px;
		flex-shrink: 0;
	}
	.status svg {
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.status-synced {
		color: var(--sb-success);
	}
	.status-syncing {
		color: var(--sb-attention);
	}
	.status-error {
		color: var(--sb-danger);
	}
	.status-manual {
		color: var(--sb-fgm-a50);
	}
	.orbit {
		transform-origin: 24px 24px;
		animation: abt-orbit 0.95s linear infinite;
	}
	.ring-pulse {
		transform-origin: center;
		animation: abt-ring-pulse 1.7s ease-in-out infinite;
	}
	@keyframes abt-orbit {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes abt-ring-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.orbit,
		.ring-pulse {
			animation: none;
		}
	}
	.account-name {
		flex: 1 1 auto;
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.145px;
		color: var(--sb-fg-default);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.account-amount {
		font-size: 12.5px;
		font-weight: 500;
		letter-spacing: 0.14px;
		text-transform: uppercase;
		color: var(--sb-fgm-a75);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}
	.mauve {
		color: var(--sb-accent);
	}
	.red {
		color: var(--sb-danger);
	}

	/* Footer */
	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		box-sizing: border-box;
		padding: 0px 8px 0;
		flex-shrink: 0;
	}
	.add-account {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7.5px 10px;
		background: var(--sb-surface);
		border: 1px solid var(--sb-border);
		border-radius: 9px;
		font-size: 13.5px;
		font-weight: 600;
		color: var(--sb-fg);
		white-space: nowrap;
		transition:
			background 0.12s ease,
			border-color 0.12s ease;
	}
	.add-account:hover {
		background: var(--sb-surface-hover);
		border-color: var(--sb-border-strong);
	}
	.add-account span {
		margin-bottom: 1px;
	}
	.plus {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		color: var(--sb-fg-muted);
	}
	.theme-toggle {
		display: flex;
		align-items: center;
		margin-left: auto;
		padding: 5px;
		color: var(--sb-fg-muted);
		border-radius: 6px;
		transition:
			color 0.12s ease,
			background 0.12s ease;
	}
	.theme-toggle:hover {
		color: var(--sb-fg-default);
		background: var(--sb-hover-1);
	}
	.theme-toggle svg {
		width: 17px;
		height: 17px;
	}
	.collapse {
		display: flex;
		align-items: center;
		padding: 5px;
		color: var(--sb-fg-muted);
		border-radius: 6px;
		transition:
			color 0.12s ease,
			background 0.12s ease;
	}
	.collapse:hover {
		color: var(--sb-fg-default);
		background: var(--sb-hover-1);
	}
	.collapse svg {
		width: 18px;
		height: 18px;
	}

	/* ===== Custom tooltip ===== */
	.tooltip {
		position: fixed;
		z-index: 200;
		max-width: 240px;
		padding: 5px 9px;
		background: var(--sb-surface);
		border: 1px solid var(--sb-border);
		border-radius: 7px;
		color: var(--sb-fg);
		font-size: 12px;
		font-weight: 600;
		line-height: 1.35;
		white-space: nowrap;
		box-shadow: 0 6px 20px var(--sb-shadow);
		pointer-events: none;
		animation: tip-in 0.11s ease;
	}
	.tip-right {
		transform: translateY(-50%);
	}
	.tip-left {
		transform: translate(-100%, -50%);
	}
	.tip-top {
		transform: translate(-50%, -100%);
	}
	.tip-bottom {
		transform: translateX(-50%);
	}
	/* little arrow that points back to the anchor */
	.tooltip::after {
		content: "";
		position: absolute;
		width: 7px;
		height: 7px;
		background: var(--sb-surface);
		border: 1px solid var(--sb-border);
		transform: rotate(45deg);
	}
	.tip-right::after {
		left: -4.5px;
		top: 50%;
		margin-top: -3.5px;
		border-right: none;
		border-top: none;
	}
	.tip-left::after {
		right: -4.5px;
		top: 50%;
		margin-top: -3.5px;
		border-left: none;
		border-bottom: none;
	}
	.tip-top::after {
		bottom: -4.5px;
		left: 50%;
		margin-left: -3.5px;
		border-left: none;
		border-top: none;
	}
	.tip-bottom::after {
		top: -4.5px;
		left: 50%;
		margin-left: -3.5px;
		border-right: none;
		border-bottom: none;
	}
	@keyframes tip-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* ===== Account hover card ===== */
	.acard {
		position: fixed;
		z-index: 60;
		width: 292px;
		padding: 12px 13px 11px;
		background: var(--sb-inset);
		border: 1px solid var(--sb-border);
		border-radius: 12px;
		box-shadow: 0 12px 34px var(--sb-shadow);
		color: var(--sb-fg);
		pointer-events: none;
		animation: acard-in 0.13s ease;
	}
	@keyframes acard-in {
		from {
			opacity: 0;
			transform: translateX(-4px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	.acard.flip {
		animation-name: acard-in-flip;
	}
	@keyframes acard-in-flip {
		from {
			opacity: 0;
			transform: translateX(4px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.acard {
			animation: none;
		}
	}
	.acard-head {
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.acard-status {
		flex-shrink: 0;
		display: flex;
	}
	.acard-status :global(.status) {
		width: 15px;
		height: 15px;
	}
	.acard-title {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.acard-name {
		font-size: 14px;
		font-weight: 650;
		letter-spacing: 0.1px;
		color: var(--sb-fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.acard-sub {
		font-size: 11px;
		font-weight: 500;
		color: var(--sb-fg-muted);
	}
	.acard-balrow {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-top: 11px;
	}
	.acard-ballabel {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		color: var(--sb-fg-muted);
	}
	.acard-bal {
		font-size: 19px;
		font-weight: 500;
		letter-spacing: 0.2px;
		color: var(--sb-fg);
		font-variant-numeric: tabular-nums;
	}
	.acard-bal.neg {
		color: var(--sb-danger);
	}
	.acard-chart {
		margin-top: 6px;
	}
	.acard-chart svg {
		display: block;
		width: 100%;
		height: 52px;
	}
	.acard-chart svg.up {
		color: var(--sb-success);
	}
	.acard-chart svg.down {
		color: var(--sb-danger);
	}
	.acard-chart-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 3px;
	}
	.acard-period {
		font-size: 11px;
		font-weight: 500;
		color: var(--sb-fg-subtle);
	}
	.acard-delta {
		font-size: 11.5px;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}
	.acard-delta.up {
		color: var(--sb-success);
	}
	.acard-delta.down {
		color: var(--sb-danger);
	}
	.acard-delta-abs {
		margin-left: 3px;
		font-weight: 600;
		color: var(--sb-fg-muted);
	}
	.acard-div {
		height: 1px;
		margin: 11px -13px;
		background: var(--sb-surface-hover);
	}
	.acard-lines {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.acard-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.acard-line .k {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--sb-fg-default);
	}
	.acard-line .v {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--sb-fg-default);
		font-variant-numeric: tabular-nums;
	}
	.acard-line .v.neg {
		color: var(--sb-danger);
	}
	.acard-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 8px;
		background: var(--sb-neutral-muted);
		font-size: 10px;
		font-weight: 700;
		color: var(--sb-fg-default);
	}
	.acard-block-label {
		margin-bottom: 7px;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		color: var(--sb-fg-muted);
	}
	.acard-sched {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.acard-date {
		flex-shrink: 0;
		width: 42px;
		font-size: 11px;
		font-weight: 600;
		color: var(--sb-fg-subtle);
		font-variant-numeric: tabular-nums;
	}
	.acard-payee {
		flex: 1 1 auto;
		min-width: 0;
		font-size: 12.5px;
		color: var(--sb-fg-default);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.acard-amt {
		flex-shrink: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--sb-success);
		font-variant-numeric: tabular-nums;
	}
	.acard-amt.neg {
		color: var(--sb-danger);
	}
	.acard-sync {
		display: flex;
		align-items: center;
		gap: 7px;
		margin-top: 11px;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--sb-fg-muted);
	}
	.acard-sync-dot {
		display: flex;
	}
	.acard-sync-dot :global(.status) {
		width: 12px;
		height: 12px;
	}
	.acard-sync-error {
		color: var(--sb-danger);
	}
	.acard-sync-syncing {
		color: var(--sb-attention);
	}

	/* ===== Account context menu ===== */
	.ctx {
		position: fixed;
		z-index: 70;
		min-width: 190px;
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 5px;
		background: var(--sb-surface);
		border: 1px solid var(--sb-border);
		border-radius: 9px;
		box-shadow: 0 12px 30px var(--sb-shadow);
		animation: acard-in 0.1s ease;
	}
	.ctx-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 7px 9px;
		border-radius: 6px;
		text-align: left;
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.13px;
		color: var(--sb-fg);
		transition: background 0.1s ease;
	}
	.ctx-item:hover {
		background: var(--sb-hover-2);
	}
	.ctx-item svg {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		color: var(--sb-fg-muted);
	}
	.ctx-item:hover svg {
		color: var(--sb-fg-default);
	}
	.ctx-item.danger {
		color: var(--sb-danger);
	}
	.ctx-item.danger svg {
		color: var(--sb-danger);
	}
	.ctx-item.danger:hover {
		background: var(--sb-danger-muted);
	}
	.ctx-item.danger:hover svg {
		color: var(--sb-danger);
	}
	.ctx-div {
		height: 1px;
		margin: 4px 4px;
		background: var(--sb-neutral-muted);
	}

	/* ===== drag reorder ===== */
	.account,
	.group-header.sub.toggleable {
		position: relative;
	}
	.account.dragging,
	.group-header.dragging {
		opacity: 0.4;
	}

	/* ===== active indicator ===== */
	/* a short rounded accent pill just left of the active row's background */
	.nav-link,
	.section-head {
		position: relative;
	}
	.nav-link.active::before,
	.section-head.active::before,
	.account.selected::before {
		content: "";
		position: absolute;
		left: -6px;
		top: 50%;
		transform: translateY(-50%);
		width: 3px;
		height: 15px;
		border-radius: 3px;
		background: var(--sb-accent);
	}
	@media (prefers-reduced-motion: no-preference) {
		.nav-link.active::before,
		.section-head.active::before,
		.account.selected::before {
			animation: active-pop 0.16s ease;
		}
	}
	@keyframes active-pop {
		from {
			opacity: 0;
			height: 4px;
		}
		to {
			opacity: 1;
			height: 15px;
		}
	}
	/* blue insertion line above/below the drop target */
	.account.drop-before::after,
	.account.drop-after::after,
	.group-header.drop-before::after,
	.group-header.drop-after::after {
		content: "";
		position: absolute;
		left: 8px;
		right: 8px;
		height: 2px;
		border-radius: 2px;
		background: var(--sb-accent);
		box-shadow: 0 0 4px var(--sb-accent-a60);
		pointer-events: none;
	}
	.account.drop-before::after,
	.group-header.drop-before::after {
		top: -1px;
	}
	.account.drop-after::after,
	.group-header.drop-after::after {
		bottom: -1px;
	}

	/* inline account rename */
	.account.editing {
		display: flex;
		align-items: center;
		gap: 5px;
		width: 100%;
		box-sizing: border-box;
		padding: 6px 8px 6px 13px;
		border-radius: 7px;
		background: var(--sb-accent-subtle);
	}
	.account-rename {
		flex: 1 1 auto;
		min-width: 0;
		font-family: inherit;
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.145px;
		color: var(--sb-fg);
		background: var(--sb-canvas);
		border: 1px solid var(--sb-accent);
		border-radius: 5px;
		padding: 2px 6px;
		outline: none;
	}

	/* ===== category (sub-group) management ===== */
	/* hover "+" on a section header — swapped with the total, so no layout shift */
	.section-add {
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 5px;
		color: var(--sb-fg-muted);
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 0.12s ease,
			background 0.12s ease,
			color 0.12s ease;
	}
	.section-add svg {
		width: 15px;
		height: 15px;
	}
	.section-head:hover .section-add {
		opacity: 1;
		pointer-events: auto;
	}
	.section-add:hover {
		background: var(--sb-hover-4);
		color: var(--sb-fg);
	}
	.section-head .group-total {
		transition: opacity 0.12s ease;
	}
	.section-head:hover .group-total {
		opacity: 0;
	}

	/* inline category rename */
	.group-header.sub.editing-group {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.group-rename {
		flex: 1 1 auto;
		min-width: 0;
		font-family: inherit;
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.115px;
		text-transform: uppercase;
		color: var(--sb-fg);
		background: var(--sb-canvas);
		border: 1px solid var(--sb-accent);
		border-radius: 5px;
		padding: 2px 6px;
		outline: none;
	}

	/* empty category placeholder / drop zone */
	.group-empty-hint {
		margin: 2px 0 3px 9px;
		padding: 8px 10px;
		border: 1px dashed var(--sb-border);
		border-radius: 7px;
		font-size: 12px;
		font-weight: 500;
		color: var(--sb-fgm-a55);
		text-align: center;
		transition:
			border-color 0.12s ease,
			color 0.12s ease,
			background 0.12s ease;
	}
	.group-empty-hint.drop-before {
		border-style: solid;
		border-color: var(--sb-accent);
		color: var(--sb-accent);
		background: var(--sb-accent-subtle2);
	}

	/* ===== account leading glyph (status + icon), clickable to set an icon ===== */
	.acct-glyph {
		position: relative;
		display: flex;
		align-items: center;
		gap: 5px;
		flex-shrink: 0;
		cursor: pointer;
		outline: none;
	}
	/* the edit affordance sits over the status-dot slot only (never over the icon) */
	.acct-glyph-edit {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 17px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--sb-fg-muted);
		opacity: 0;
		transition:
			opacity 0.1s ease,
			color 0.1s ease;
		pointer-events: none;
	}
	.acct-glyph-edit svg {
		width: 15px;
		height: 15px;
	}
	/* accounts WITHOUT an icon: cross-fade the status dot to the "add icon" affordance */
	.account:hover .acct-glyph:not(.has-icon) .status {
		opacity: 0;
	}
	.account:hover .acct-glyph:not(.has-icon) .acct-glyph-edit {
		opacity: 1;
	}
	.acct-glyph:not(.has-icon):hover .acct-glyph-edit {
		color: var(--sb-fg);
	}
	/* accounts WITH an icon: keep it visible, just give it a subtle clickable highlight */
	.acct-glyph.has-icon .acct-icon {
		border-radius: 5px;
		transition: background 0.1s ease;
	}
	.acct-glyph.has-icon:hover .acct-icon {
		background: var(--sb-hover-5);
	}

	/* ===== account icon (avatar), left of the name ===== */
	.acct-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		margin-left: -1px;
	}
	.acct-icon-emoji {
		font-size: 14px;
		line-height: 1;
	}
	.acct-icon-img {
		width: 16px;
		height: 16px;
		object-fit: cover;
		border-radius: 2px;
		background: var(--sb-neutral-muted);
	}

	/* ===== account icon picker ===== */
	.ipick {
		position: fixed;
		z-index: 80;
		width: 280px;
		display: flex;
		flex-direction: column;
		background: var(--sb-inset);
		border: 1px solid var(--sb-border);
		border-radius: 12px;
		box-shadow: 0 12px 34px var(--sb-shadow);
		overflow: hidden;
		animation: acard-in 0.12s ease;
	}
	.ipick-tabs {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 5px 6px;
		border-bottom: 1px solid var(--sb-border-muted);
	}
	.ipick-tab {
		padding: 6px 10px;
		border-radius: 6px;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--sb-fg-muted);
		transition:
			background 0.1s ease,
			color 0.1s ease;
	}
	.ipick-tab:hover {
		color: var(--sb-fg);
		background: var(--sb-hover-1);
	}
	.ipick-tab.active {
		color: var(--sb-accent);
		background: var(--sb-accent-muted);
	}
	.ipick-close {
		margin-left: auto;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 5px;
		color: var(--sb-fg-muted);
		transition:
			background 0.1s ease,
			color 0.1s ease;
	}
	.ipick-close:hover {
		color: var(--sb-fg);
		background: var(--sb-hover-2);
	}
	.ipick-close svg {
		width: 12px;
		height: 12px;
	}
	.ipick-pane {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 9px;
	}
	.ipick-input {
		width: 100%;
		box-sizing: border-box;
		padding: 7px 9px;
		font-family: inherit;
		font-size: 12.5px;
		color: var(--sb-fg);
		background: var(--sb-canvas);
		border: 1px solid var(--sb-border);
		border-radius: 7px;
		outline: none;
		transition:
			border-color 0.12s ease,
			box-shadow 0.12s ease;
	}
	.ipick-input:focus {
		border-color: var(--sb-accent);
		box-shadow: 0 0 0 2px var(--sb-accent-muted);
	}
	.ipick-input::placeholder {
		color: var(--sb-fg-a40);
	}
	.eg-tabs {
		display: flex;
		gap: 1px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--sb-border-muted);
	}
	.eg-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px 0;
		border-radius: 5px;
		font-size: 14px;
		line-height: 1;
		opacity: 0.5;
		transition:
			opacity 0.08s ease,
			background 0.08s ease;
	}
	.eg-tab:hover {
		opacity: 0.85;
		background: var(--sb-hover-1);
	}
	.eg-tab.active {
		opacity: 1;
		background: var(--sb-accent-muted);
	}
	.eg-grid-wrap {
		max-height: 220px;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--sb-fg-a22) transparent;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.eg-label {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 4px 2px 3px;
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--sb-fg-muted);
		background: var(--sb-inset);
	}
	.eg-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 1px;
	}
	.eg-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		border-radius: 5px;
		font-size: 18px;
		line-height: 1;
		transition: background 0.08s ease;
	}
	.eg-btn:hover {
		background: var(--sb-hover-4);
	}
	.logo-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		min-height: 84px;
		padding: 12px;
		border: 1px solid var(--sb-border);
		border-radius: 8px;
		background: var(--sb-hover-0);
		cursor: default;
		transition:
			background 0.15s ease,
			border-color 0.15s ease;
	}
	.logo-preview.loaded {
		cursor: pointer;
		border-color: var(--sb-accent);
		background: var(--sb-accent-subtle2);
	}
	.logo-preview.loaded:hover {
		background: var(--sb-accent-wash);
	}
	.logo-preview img {
		width: 48px;
		height: 48px;
		object-fit: contain;
		border-radius: 6px;
	}
	.logo-hint {
		font-size: 10.5px;
		font-weight: 600;
		color: var(--sb-accent);
	}
	.logo-err {
		font-size: 11px;
		color: var(--sb-danger);
	}
	.dropzone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 104px;
		padding: 12px;
		border: 2px dashed var(--sb-border);
		border-radius: 8px;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.dropzone:hover,
	.dropzone.over {
		border-color: var(--sb-accent);
		background: var(--sb-accent-faint);
	}
	.dropzone-icon {
		width: 22px;
		height: 22px;
		opacity: 0.35;
		color: var(--sb-fg);
	}
	.dropzone-img {
		max-width: 100%;
		max-height: 82px;
		object-fit: contain;
		border-radius: 6px;
	}
	.ipick-hint {
		font-size: 11.5px;
		color: var(--sb-fgm-a80);
		text-align: center;
		margin: 0;
		padding: 4px 0;
	}
	.ipick-primary {
		width: 100%;
		padding: 8px;
		border-radius: 7px;
		font-size: 12.5px;
		font-weight: 600;
		color: #fff;
		background: var(--sb-accent-emphasis);
		transition: background 0.1s ease;
	}
	.ipick-primary:hover {
		background: var(--sb-accent);
	}
	.ipick-foot {
		padding: 6px 9px 9px;
		border-top: 1px solid var(--sb-border-muted);
	}
	.ipick-remove {
		width: 100%;
		padding: 6px;
		border-radius: 6px;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--sb-danger);
		transition: background 0.1s ease;
	}
	.ipick-remove:hover {
		background: var(--sb-danger-subtle);
	}
	.ipick-sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}
</style>
