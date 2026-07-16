<script lang="ts">
	// Standalone port of the "Actual Budget — Sidebar" Figma frame (node 46:890).
	// Self-contained test component: Catppuccin Mocha palette, sample data below.

	// Sync-status "dot grammar": fill = connection, motion = activity.
	//   synced  → solid dot        manual → hollow dot
	//   syncing → orbiting arc      error  → solid dot in a pulsing alert ring
	type Status = "synced" | "syncing" | "error" | "manual";

	interface Account {
		name: string;
		amount: string; // pre-formatted
		status: Status;
		negative?: boolean;
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

	let activePage = $state<string>("Budget");
	let moreExpanded = $state(false);
	let collapsedSections = $state<Record<string, boolean>>({});
	let collapsedGroups = $state<Record<string, boolean>>({});
	let query = $state("");
	let searchEl = $state<HTMLInputElement | null>(null);
	let groupAccounts = $state(true);
	let accountsMaskState = $state<"top" | "middle" | "bottom">("middle");

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
	}
	function handleAccountsScroll(event: Event) {
		const target = event.currentTarget as HTMLElement;
		const maxScroll = target.scrollHeight - target.clientHeight;
		const atTop = target.scrollTop <= 0;
		const atBottom = maxScroll > 0 && target.scrollTop >= maxScroll - 1;
		accountsMaskState = atTop ? "top" : atBottom ? "bottom" : "middle";
	}

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

	const q = $derived(query.trim().toLowerCase());
	const visibleAccounts = (g: Group) => (q === "" ? g.accounts : g.accounts.filter((account) => accountMatches(account)));
	const groupHasMatches = (g: Group) => visibleAccounts(g).length > 0;
	const sectionHasAccounts = (s: Section) => s.groups.some((g) => g.accounts.length > 0);
	const sectionAccounts = (s: Section) => s.groups.flatMap(visibleAccounts);
	const sectionHasMatches = (s: Section) => sectionHasAccounts(s) || s.groups.some((g) => groupHasMatches(g));
	const accountMatches = (account: Account) => {
		const haystack = `${account.name} ${account.amount}`.toLowerCase();
		return haystack.includes(q);
	};

	function toggleSection(label: string) {
		collapsedSections[label] = !collapsedSections[label];
	}
	function toggleGroup(label: string) {
		collapsedGroups[label] = !collapsedGroups[label];
	}

	function renderNavIcon(name: string) {
		return name === "Budget"
			? "◉"
			: name === "Reports"
				? "◌"
			: name === "Schedules"
				? "◍"
			: name === "More"
				? "⋯"
			: name === "Payees"
				? "◐"
			: name === "Rules"
				? "◑"
			: name === "Bank Sync"
				? "◒"
			: name === "Tags"
				? "◓"
			: "◔";
	}

	function renderGroupToggleIcon(on: boolean) {
		return on ? "▾" : "▸";
	}
</script>

<div class="sidebar" style:width={collapsed ? `${RAIL_WIDTH}px` : `${340}px`}>
	<div class="rail">
		<div class="rail-nav">
			<button class="rail-btn" type="button" onclick={() => (collapsed = !collapsed)}>
				<span class="rail-icon">☰</span>
			</button>
		</div>
		<div class="rail-spacer"></div>
		<div class="rail-foot">
			<div class="rail-budget">{budgetInitials}</div>
		</div>
	</div>

	<div class="main">
		<div class="search">
			<div class="search-left">
				<input bind:this={searchEl} bind:value={query} placeholder="Search accounts" />
			</div>
		</div>
		<div class="divider"></div>
		<div class="accounts" style:mask-image={accountsMaskState === "top"
			? "linear-gradient(black 0%, black calc(100% - 34px), transparent 100%)"
			: accountsMaskState === "bottom"
				? "linear-gradient(transparent 0px, black 34px, black 100%)"
				: "linear-gradient(transparent 0px, black 34px, black calc(100% - 34px), transparent 100%)"}
			style:-webkit-mask-image={accountsMaskState === "top"
				? "linear-gradient(black 0%, black calc(100% - 34px), transparent 100%)"
				: accountsMaskState === "bottom"
					? "linear-gradient(transparent 0px, black 34px, black 100%)"
					: "linear-gradient(transparent 0px, black 34px, black calc(100% - 34px), transparent 100%)"}
			onscroll={handleAccountsScroll}>
			<div class="all-accounts">
				<div class="all-accounts-left">
					<span class="all-accounts-label">All Accounts</span>
					<button type="button" class="group-toggle" class:on={groupAccounts} onclick={() => (groupAccounts = !groupAccounts)}>
						▾
					</button>
				</div>
				<span class="all-accounts-total">{grandTotal}</span>
			</div>

			{#each sections as section}
				{#if sectionHasMatches(section)}
					<div class="section">
						<div class="section-head">
							<button class="caret-btn" type="button" onclick={() => toggleSection(section.label)}>
								{collapsedSections[section.label] ? "▸" : "▾"}
							</button>
							<span class="section-label">{section.label}</span>
							<span class="section-total">{section.total}</span>
						</div>
						{#if !collapsedSections[section.label]}
							{#each section.groups as group}
								{#if groupHasMatches(group)}
									<div class="group">
										{#if group.label}
											<div class="group-header">
												<span class="group-label">{group.label}</span>
												<span class="group-total">{group.total ?? ""}</span>
											</div>
										{/if}
										<div class="account-list">
											{#each visibleAccounts(group) as account (account.name)}
												<div class="account-row">
													<span class="account-name">{account.name}</span>
													<span class="account-amount">{account.amount}</span>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							{/each}
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #0d1117;
		font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		color: #e6edf3;
	}
	.sidebar {
		display: flex;
		width: 340px;
		min-height: 100vh;
		background: #010409;
		color: #e6edf3;
	}
	.rail {
		width: 64px;
		padding: 16px 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		border-right: 1px solid #30363d;
	}
	.rail-nav, .rail-foot, .rail-spacer { width: 100%; }
	.rail-btn {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		border: 0;
		background: #161b22;
		color: #e6edf3;
	}
	.rail-budget {
		width: 40px;
		height: 40px;
		border-radius: 999px;
		background: #1f6feb;
		display: grid;
		place-items: center;
		font-weight: 700;
		margin: 0 auto;
	}
	.main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.search {
		padding: 14px 16px;
	}
	.search input {
		width: 100%;
		box-sizing: border-box;
		padding: 8px 10px;
		border-radius: 8px;
		border: 1px solid #30363d;
		background: #0d1117;
		color: #e6edf3;
	}
	.divider { height: 1px; background: #30363d; }
	.accounts {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 8px 12px 2rem;
		mask-image: linear-gradient(black 0%, black calc(100% - 34px), transparent 100%);
		-webkit-mask-image: linear-gradient(black 0%, black calc(100% - 34px), transparent 100%);
	}
	.all-accounts {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
		font-size: 13px;
		font-weight: 600;
	}
	.all-accounts-left { display: flex; align-items: center; gap: 8px; }
	.group-toggle { background: transparent; border: 0; color: #e6edf3; }
	.section { margin-top: 10px; }
	.section-head { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px; color: #8b949e; }
	.caret-btn { background: transparent; border: 0; color: #8b949e; }
	.section-label { font-weight: 700; }
	.section-total { margin-left: auto; color: #e6edf3; }
	.group { margin-top: 6px; }
	.group-header { display: flex; justify-content: space-between; font-size: 12px; color: #8b949e; padding: 4px 0 2px; }
	.account-list { display: flex; flex-direction: column; gap: 2px; }
	.account-row { display: flex; justify-content: space-between; padding: 4px 8px; border-radius: 6px; }
	.account-row:hover { background: rgba(255,255,255,0.04); }
	.account-name { font-size: 13px; }
	.account-amount { font-size: 13px; color: #8b949e; }
</style>
