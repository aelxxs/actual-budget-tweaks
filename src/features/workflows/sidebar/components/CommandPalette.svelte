<script lang="ts">
	import { balanceColors, followBalanceColors } from "../lib/balance-colors.svelte";

	followBalanceColors();
	import { customizeSidebar } from "../lib/customize.svelte";
	import type { AccountIconData } from "@features/appearance/account-icon-picker";
	import { getEmojiAssetUrl } from "@features/appearance/account-icon-picker";
	import { openTool } from "@features/appearance/sidebar-shortcuts/open-tool";
	import { BUILTIN_TOOLS } from "@features/appearance/sidebar-shortcuts/store";
	import type { ToolId } from "@features/appearance/sidebar-shortcuts/types";
	import { getPrivacyMode } from "@features/core/privacy-mode";
	import {
		applyThemeByKey,
		fetchCommunityThemeCatalog,
		getBuiltinPreviewColors,
		NATIVE_THEME_KEY,
		type RemoteTheme,
	} from "@features/theme/theme-apply";
	import type { PageSetting } from "@features/index";
	import { applySettingChange } from "@features/runtime";
	import { openCalendar, spendingCalendar } from "@features/workflows/spending-calendar";
	import { closeOverlayPage, isOverlayOpen } from "@features/core/overlay-page";
	import {
		currentAccountId,
		modernReconcile,
		reconcileAccount,
	} from "@features/workflows/reconcile";
	import { compactAge } from "@features/workflows/reconcile/relative-time";
	import { openInsights, templatePlan } from "@features/workflows/template-plan";
	import { graphView, openGraphView } from "@features/workflows/graph-view";
	import { themes } from "@lib/design";
	import { dispatch, navigate, notify, query as queryTable, send } from "@lib/utilities/actual-api";
	import { calculate } from "@lib/utilities/calc";
	import { fmtMoney, fmtNumber } from "@lib/utilities/currency";
	import { Page, matchesPage, pagePath } from "@lib/utilities/pages";
	import { TWEAKS_PATH, searchTweaksFor } from "@lib/utilities/settings-page";
	import { getValue, setValue } from "@lib/utilities/store";
	import {
		ArrowLeft,
		ArrowLeftRight,
		ArrowUpRight,
		Calculator,
		CalendarDays,
		ClipboardList,
		ChartColumn,
		Check,
		ChevronRight,
		Copy,
		Eye,
		EyeOff,
		Landmark,
		LayoutGrid,
		ListChecks,
		Network,
		Paintbrush,
		Palette,
		Percent,
		Plus,
		RefreshCw,
		Search,
		Settings,
		Sparkles,
		SlidersHorizontal,
		Tag,
		ToggleRight,
		Users,
		Wrench,
	} from "@lucide/svelte";
	import { autofocus } from "../actions/autofocus";
	import { portal } from "../actions/portal";
	import type { SidebarAccount } from "../lib/data";
	import { syncAllAccounts } from "../lib/data";
	import StatusIcon from "./StatusIcon.svelte";
	import { DEFAULT_THEME } from "@features/theme/defaults";
	import { openThemeStudio } from "@features/theme/studio/open";

	// Matches theme.ts's setting key — this palette applies/persists the same
	// setting the full ThemeCustomizer settings panel reads from, so they stay in sync.
	const THEME_SETTING_KEY = "catppuccin-palette";
	const DEFAULT_THEME_KEY = DEFAULT_THEME;

	interface CustomReport {
		id: string;
		name: string;
	}

	const {
		accounts,
		icons,
	}: {
		accounts: SidebarAccount[];
		icons: Record<string, AccountIconData>;
	} = $props();

	const NAV_PAGES = [
		{ label: "Budget", page: Page.Budget, icon: LayoutGrid },
		{ label: "Reports", page: Page.Reports, icon: ChartColumn },
		{ label: "Schedules", page: Page.Schedules, icon: ClipboardList },
		{ label: "Payees", page: Page.Payees, icon: Users },
		{ label: "Bank Sync", page: Page.BankSync, icon: Landmark },
		{ label: "Rules", page: Page.Rules, icon: SlidersHorizontal },
		{ label: "Tags", page: Page.Tags, icon: Tag },
		{ label: "Settings", page: Page.Settings, icon: Settings },
	];

	const TOOL_ICONS: Record<ToolId, typeof LayoutGrid> = {
		calculator: Calculator,
		"currency-converter": ArrowLeftRight,
		"interest-calculator": Percent,
	};

	// Each of these is a real dispatch/navigate call, verified against Actual's
	// own source (loot-core/desktop-client) rather than guessed modal names.
	// "Add transaction" and "Import transactions" were dropped — they either
	// have no global (accountless) trigger, or their real modal requires a
	// callback prop that this bridge's JSON-serialized dispatch can't pass
	// through, which would leave the modal broken once opened.
	const QUICK_ACTIONS: { icon: typeof LayoutGrid; label: string; run: () => void }[] = [
		{
			icon: ClipboardList,
			label: "Create new schedule",
			run: () => dispatch("pushModal", { modal: { name: "schedule-edit", options: {} } }),
		},
		{ icon: ChartColumn, label: "Create new report", run: () => navigate("/reports/custom") },
		{
			// dispatch("sync") is Titlebar's cloud FILE sync (multi-device budget
			// sync) — a no-op with no other devices to sync against, which is why
			// this looked broken. Real per-account bank sync lives in
			// syncAllAccounts (lib/data.ts), matching the native app's own
			// useSyncAccountsMutation RPC.
			icon: RefreshCw,
			label: "Sync all accounts",
			run: () => syncAllAccounts(accounts),
		},
		{ icon: SlidersHorizontal, label: "Customize sidebar", run: () => customizeSidebar() },
		{
			icon: Plus,
			label: "Add new account",
			run: () => dispatch("pushModal", { modal: { name: "add-account", options: {} } }),
		},
	];

	type PaletteItem =
		| { kind: "account"; account: SidebarAccount }
		| { kind: "reconcile"; account: SidebarAccount }
		| { kind: "report"; report: CustomReport }
		| { kind: "nav"; label: string; page: Page; icon: typeof LayoutGrid }
		| { kind: "action"; label: string; icon: typeof LayoutGrid; run: () => void }
		| { kind: "view-all"; label: string; target: SubPage }
		| { kind: "subpage"; label: string; icon: typeof LayoutGrid; target: SubPage }
		| { kind: "theme"; key: string; name: string; swatch: string[] }
		| { kind: "math"; value: number }
		| { kind: "setting"; setting: PageSetting; section: string };
	interface PaletteGroup {
		label: string;
		items: PaletteItem[];
	}

	// Root-page lists longer than this get truncated with a trailing "View
	// all" row (see PREVIEW_LIMIT below) instead of dumping everything into
	// the root list — mirrors CommandBar.tsx's themes page: a pushed
	// sub-page rather than an ever-growing root list.
	type SubPage = "accounts" | "reconcile" | "reports" | "themes";
	const PREVIEW_LIMIT = 5;
	const SETTINGS_LIMIT = 6;

	let open = $state(false);
	let query = $state("");
	let index = $state(0);
	let listEl = $state<HTMLElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let page = $state<"root" | SubPage>("root");
	// Only a page *transition* animates — not the dialog's initial open.
	let animatePageChange = $state(false);

	// Refreshed each time the palette opens (see openPalette) rather than
	// tracked live — privacy.ts's own state isn't a Svelte store, and the
	// palette closes immediately after running any action anyway.
	let privacyEnabled = $state(false);

	// What ABT offers, read when the palette opens: settings can change at any time.
	let settings = $state.raw<{ setting: PageSetting; section: string }[]>([]);
	let enabled = $state<Record<string, boolean>>({});
	async function loadSettings(): Promise<void> {
		const { scriptSections } = await import("@features/index");
		const all = scriptSections.flatMap((section) =>
			section.groups.flatMap((group) =>
				group.items
					.filter((setting) => setting.platform !== "mobile")
					.map((setting) => ({ setting, section: section.title })),
			),
		);
		const values = await Promise.all(
			all.map(({ setting }) => getValue(setting.context.key, setting.context.defaultValue)),
		);
		settings = all;
		enabled = Object.fromEntries(
			all.map(({ setting }, i) => [setting.context.key, values[i] === true]),
		);
	}

	let reports = $state<CustomReport[]>([]);
	let reportsLoaded = false;
	async function ensureReportsLoaded(): Promise<void> {
		if (reportsLoaded) {
			return;
		}
		reportsLoaded = true;
		try {
			reports = await queryTable<(CustomReport & { tombstone?: boolean })[]>("custom_reports", {
				filter: { tombstone: false },
			});
		} catch {
			reportsLoaded = false;
		}
	}

	const DAY = 24 * 3600e3;
	// Last reconciled, in ms, by account; accounts never reconciled are missing.
	let reconciledAt = $state.raw<Record<string, number>>({});
	async function loadReconciledDates(): Promise<void> {
		const rows = await send<{ id: string; last_reconciled: string | null }[]>("accounts-get");
		reconciledAt = Object.fromEntries(
			rows.filter((r) => r.last_reconciled).map((r) => [r.id, Number(r.last_reconciled)]),
		);
	}
	function reconciledAge(id: string): string {
		const at = reconciledAt[id];
		return at ? compactAge((Date.now() - at) / DAY) : "never";
	}

	let activeThemeKey = $state(DEFAULT_THEME_KEY);
	let communityThemes = $state<RemoteTheme[]>([]);
	let communityThemesLoaded = false;
	async function ensureCommunityThemesLoaded(): Promise<void> {
		if (communityThemesLoaded) {
			return;
		}
		communityThemesLoaded = true;
		try {
			communityThemes = await fetchCommunityThemeCatalog();
		} catch {
			communityThemesLoaded = false;
		}
	}

	const q = $derived(query.trim().toLowerCase());
	const placeholder = $derived(
		page === "accounts"
			? "Search accounts…"
			: page === "reconcile"
				? "Choose an account to reconcile…"
				: page === "reports"
					? "Search reports…"
					: page === "themes"
						? "Search themes…"
						: "Search, or try 145.20 * 12",
	);

	const groups = $derived.by((): PaletteGroup[] => {
		const match = (s: string) => q === "" || s.toLowerCase().includes(q);
		const matchedAccounts = accounts.filter((a) => !a.closed && match(a.name));
		const matchedReports = reports.filter((r) => match(r.name));

		if (page === "accounts") {
			return matchedAccounts.length
				? [
						{
							label: "Accounts",
							items: matchedAccounts.map((account) => ({ kind: "account" as const, account })),
						},
					]
				: [];
		}
		if (page === "reconcile") {
			const current = currentAccountId();
			const rank = (a: SidebarAccount) => (a.id === current ? -1 : (reconciledAt[a.id] ?? 0));
			return matchedAccounts.length
				? [
						{
							label: "Accounts",
							items: [...matchedAccounts]
								.sort((a, b) => rank(a) - rank(b))
								.map((account) => ({ kind: "reconcile" as const, account })),
						},
					]
				: [];
		}
		if (page === "reports") {
			return matchedReports.length
				? [
						{
							label: "Reports",
							items: matchedReports.map((report) => ({ kind: "report" as const, report })),
						},
					]
				: [];
		}
		if (page === "themes") {
			const builtinItems: PaletteItem[] = [
				...(match("Actual default")
					? [{ kind: "theme" as const, key: NATIVE_THEME_KEY, name: "Actual default", swatch: [] }]
					: []),
				...Object.entries(themes)
					.filter(([, t]) => match(t.name))
					.map(([key, t]) => ({
						kind: "theme" as const,
						key,
						name: t.name,
						swatch: getBuiltinPreviewColors(key),
					})),
			];
			const communityItems: PaletteItem[] = communityThemes
				.filter((t) => match(t.name))
				.map((t) => ({ kind: "theme" as const, key: t.repo, name: t.name, swatch: t.colors }));
			return [
				{ label: "Built-in", items: builtinItems },
				{ label: "Community", items: communityItems },
			].filter((g) => g.items.length > 0);
		}

		// Resting state previews a handful per list; typing searches all of
		// them directly (no point paging through a filtered result).
		const accountItems: PaletteItem[] = (
			q === "" ? matchedAccounts.slice(0, PREVIEW_LIMIT) : matchedAccounts
		).map((account) => ({ kind: "account" as const, account }));
		if (q === "" && matchedAccounts.length > PREVIEW_LIMIT) {
			accountItems.push({
				kind: "view-all",
				label: `View all ${matchedAccounts.length} accounts`,
				target: "accounts",
			});
		}
		const reportItems: PaletteItem[] = (
			q === "" ? matchedReports.slice(0, PREVIEW_LIMIT) : matchedReports
		).map((report) => ({ kind: "report" as const, report }));
		if (q === "" && matchedReports.length > PREVIEW_LIMIT) {
			reportItems.push({
				kind: "view-all",
				label: `View all ${matchedReports.length} reports`,
				target: "reports",
			});
		}

		const math = calculate(query);
		const abtPages = [
			...(enabled[spendingCalendar.context.key]
				? [{ label: "Spending Calendar", icon: CalendarDays, run: openCalendar }]
				: []),
			...(enabled[templatePlan.context.key]
				? [{ label: "Insights", icon: Sparkles, run: showInsights }]
				: []),
			...(enabled[graphView.context.key]
				? [{ label: "Graph", icon: Network, run: openGraphView }]
				: []),
			{ label: "Tweaks", icon: Wrench, run: () => navigate(TWEAKS_PATH) },
		];
		const settingWords = (s: PageSetting) =>
			`${s.label} ${"description" in s ? (s.description ?? "") : ""}`;

		const out: PaletteGroup[] = [
			{
				label: "Calculator",
				items: math === null ? [] : [{ kind: "math" as const, value: math }],
			},
			{ label: "Accounts", items: accountItems },
			{ label: "Reports", items: reportItems },
			{
				label: "Go to",
				items: [
					...NAV_PAGES.filter((p) => match(p.label)).map((p) => ({
						kind: "nav" as const,
						label: p.label,
						page: p.page,
						icon: p.icon,
					})),
					...abtPages.filter((p) => match(p.label)).map((p) => ({ kind: "action" as const, ...p })),
				],
			},
			{
				label: "Tools",
				items: BUILTIN_TOOLS.filter((tool) => match(tool.label)).map((tool) => ({
					kind: "action" as const,
					label: tool.label,
					icon: TOOL_ICONS[tool.id],
					run: () =>
						openTool(tool.id, tool.label, window.innerWidth / 2, window.innerHeight * 0.2, true),
				})),
			},
			{
				label: "Quick actions",
				items: [
					...QUICK_ACTIONS.filter((a) => match(a.label)).map((a) => ({
						kind: "action" as const,
						label: a.label,
						icon: a.icon,
						run: a.run,
					})),
					...(enabled[modernReconcile.context.key] && match("Reconcile account")
						? [
								{
									kind: "subpage" as const,
									label: "Reconcile account",
									icon: ListChecks,
									target: "reconcile" as const,
								},
							]
						: []),
					...(match("Change theme")
						? [
								{
									kind: "subpage" as const,
									label: "Change theme",
									icon: Palette,
									target: "themes" as const,
								},
							]
						: []),
					...(match("Create theme")
						? [
								{
									kind: "action" as const,
									label: "Create theme",
									icon: Paintbrush,
									run: () => openThemeStudio(),
								},
							]
						: []),
					...(() => {
						const label = privacyEnabled ? "Show amounts" : "Hide amounts";
						if (!match(label)) {
							return [];
						}
						return [
							{
								kind: "action" as const,
								label,
								icon: privacyEnabled ? Eye : EyeOff,
								run: () =>
									dispatch("saveSyncedPrefs", {
										prefs: { isPrivacyEnabled: String(!privacyEnabled) },
									}),
							},
						];
					})(),
				],
			},
			{
				label: "Tweaks",
				// Only when asked for: all of them would bury everything else.
				items:
					q.length < 2
						? []
						: settings
								.filter(({ setting }) => match(settingWords(setting)))
								.slice(0, SETTINGS_LIMIT)
								.map((entry) => ({ kind: "setting" as const, ...entry })),
			},
		];
		return out.filter((g) => g.items.length > 0);
	});
	const items = $derived(groups.flatMap((g) => g.items));
	const groupBase = (gi: number) => groups.slice(0, gi).reduce((n, g) => n + g.items.length, 0);

	export function openPalette(): void {
		query = "";
		index = 0;
		page = "root";
		open = true;
		privacyEnabled = getPrivacyMode();
		ensureReportsLoaded();
		void loadSettings();
		void loadReconciledDates();
		getValue<string>(THEME_SETTING_KEY, DEFAULT_THEME_KEY).then(
			(v) => (activeThemeKey = v ?? DEFAULT_THEME_KEY),
		);
	}
	function closePalette(): void {
		open = false;
		animatePageChange = false;
	}
	function goToPage(target: SubPage): void {
		page = target;
		query = "";
		index = 0;
		animatePageChange = true;
		// A clicked row is removed with the old page, which drops focus to the body.
		inputEl?.focus();
		if (target === "themes") {
			ensureCommunityThemesLoaded();
		}
	}
	function goBackToRoot(): void {
		page = "root";
		query = "";
		index = 0;
		animatePageChange = true;
		inputEl?.focus();
	}
	// Insights needs the budget table, so it opens itself once the page has arrived.
	function showInsights(): void {
		openInsights();
		if (!matchesPage(Page.Budget)) {
			navigate(pagePath(Page.Budget));
		}
	}

	function copyResult(value: number): void {
		const text = String(value);
		navigator.clipboard
			?.writeText(text)
			.then(() => notify({ type: "message", message: `Copied ${text}` }))
			.catch(() => notify({ type: "error", message: "Couldn't copy the result" }));
	}

	function runSetting(setting: PageSetting): void {
		if (setting.type === "checkbox") {
			const { key } = setting.context;
			enabled[key] = !enabled[key];
			void applySettingChange(setting, enabled[key]);
			return;
		}
		searchTweaksFor(setting.label);
		navigate(TWEAKS_PATH);
		closePalette();
	}

	function runItem(item: PaletteItem): void {
		if (item.kind === "view-all" || item.kind === "subpage") {
			goToPage(item.target);
			return;
		}
		// Stays open, so the switch visibly changes and a few can be flipped in a row.
		if (item.kind === "setting") {
			runSetting(item.setting);
			return;
		}
		if (item.kind === "math") {
			copyResult(item.value);
			closePalette();
			return;
		}
		if (isOverlayOpen()) {
			closeOverlayPage();
		}
		if (item.kind === "nav") {
			navigate(pagePath(item.page));
		} else if (item.kind === "account") {
			navigate(`/accounts/${item.account.id}`);
		} else if (item.kind === "reconcile") {
			reconcileAccount(item.account.id);
		} else if (item.kind === "report") {
			navigate(`/reports/custom/${item.report.id}`);
		} else if (item.kind === "theme") {
			activeThemeKey = item.key;
			setValue(THEME_SETTING_KEY, item.key);
			applyThemeByKey(item.key, DEFAULT_THEME_KEY);
		} else {
			item.run();
		}
		closePalette();
	}
	function moveIndex(delta: number): void {
		const n = items.length;
		if (!n) {
			return;
		}
		index = (index + delta + n) % n;
		listEl?.querySelector(`[data-pidx="${index}"]`)?.scrollIntoView({ block: "nearest" });
	}
	function onInputKeydown(e: KeyboardEvent): void {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			moveIndex(1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			moveIndex(-1);
		} else if (e.key === "Enter") {
			e.preventDefault();
			const item = items[index];
			if (item) {
				runItem(item);
			}
		} else if (e.key === "Backspace" && query === "" && page !== "root") {
			e.preventDefault();
			goBackToRoot();
		} else if (e.key === "Escape") {
			e.preventDefault();
			if (page !== "root") {
				goBackToRoot();
			} else {
				closePalette();
			}
		}
	}

	// Actual's own ⌘K (CommandBar.tsx) is a plain bubble-phase listener on
	// `document` with no defaultPrevented check, so preventDefault alone
	// can't stop it — only capture-phase + stopping propagation before the
	// event ever reaches that bubble listener does.
	function onWindowKeydown(e: KeyboardEvent): void {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
			e.preventDefault();
			e.stopImmediatePropagation();
			e.stopPropagation();
			if (open) {
				closePalette();
			} else {
				openPalette();
			}
		} else if (e.key === "Escape" && open) {
			if (page !== "root") {
				goBackToRoot();
			} else {
				closePalette();
			}
		}
	}

	$effect(() => {
		window.addEventListener("keydown", onWindowKeydown, true);
		return () => window.removeEventListener("keydown", onWindowKeydown, true);
	});
</script>

{#snippet hl(text: string)}
	{@const i = q === "" ? -1 : text.toLowerCase().indexOf(q)}
	{#if i === -1}{text}{:else}{text.slice(0, i)}<mark class="cp-mark"
			>{text.slice(i, i + q.length)}</mark
		>{text.slice(i + q.length)}{/if}
{/snippet}

{#snippet acctIcon(account: SidebarAccount)}
	{@const icon = icons[account.id]}
	{#if icon}
		<span class="acct-icon">
			{#if icon.type === "emoji"}
				<img class="acct-icon-img" src={getEmojiAssetUrl(icon.value)} alt={icon.value} />
			{:else}
				<img class="acct-icon-img" src={icon.value} alt="" />
			{/if}
		</span>
	{/if}
{/snippet}

{#if open}
	<div use:portal class="cp-backdrop" onclick={closePalette} aria-hidden="true"></div>
	<div use:portal class="cp" role="dialog" aria-modal="true" aria-label="Command palette">
		<div class="cp-search">
			{#if page !== "root"}
				<button type="button" class="cp-back" aria-label="Back" onclick={goBackToRoot}>
					<ArrowLeft class="cp-search-icon" />
				</button>
			{:else}
				<Search class="cp-search-icon" />
			{/if}
			<input
				class="cp-input"
				type="text"
				{placeholder}
				bind:this={inputEl}
				bind:value={query}
				use:autofocus
				oninput={() => (index = 0)}
				onkeydown={onInputKeydown}
			/>
			<span class="cp-kbd">esc</span>
		</div>
		{#key page}
			<div class="cp-body" class:cp-page-enter={animatePageChange} bind:this={listEl}>
				{#each groups as group, gi (group.label)}
					{@const base = groupBase(gi)}
					<div class="cp-group-label">{group.label}</div>
					{#each group.items as item, ii (ii)}
						{@const idx = base + ii}
						<button
							type="button"
							class="cp-item"
							class:selected={idx === index}
							class:viewall={item.kind === "view-all"}
							data-pidx={idx}
							onmousemove={() => (index = idx)}
							onclick={() => runItem(item)}
						>
							{#if item.kind === "account"}
								<span class="cp-item-glyph">
									<StatusIcon status={item.account.status} />
									{@render acctIcon(item.account)}
								</span>
								<span class="cp-item-label">{@render hl(item.account.name)}</span>
								<span
									class="cp-item-amount abt-privacy-number"
									class:red={balanceColors.on && item.account.balance < 0}
								>
									{fmtMoney(item.account.balance)}
								</span>
							{:else if item.kind === "reconcile"}
								<span class="cp-item-glyph">
									<StatusIcon status={item.account.status} />
									{@render acctIcon(item.account)}
								</span>
								<span class="cp-item-label">{@render hl(item.account.name)}</span>
								<span class="cp-item-meta">{reconciledAge(item.account.id)}</span>
							{:else if item.kind === "report"}
								<span class="cp-item-glyph cp-item-icon"><ChartColumn strokeWidth={1.5} /></span>
								<span class="cp-item-label">{@render hl(item.report.name)}</span>
								<ArrowUpRight class="cp-go" strokeWidth={2.2} />
							{:else if item.kind === "nav"}
								<span class="cp-item-glyph cp-item-icon"><item.icon strokeWidth={1.5} /></span>
								<span class="cp-item-label">{@render hl(item.label)}</span>
								<ArrowUpRight class="cp-go" strokeWidth={2.2} />
							{:else if item.kind === "view-all"}
								<span class="cp-item-glyph cp-item-icon"><ChevronRight strokeWidth={1.5} /></span>
								<span class="cp-item-label">{item.label}</span>
							{:else if item.kind === "subpage"}
								<span class="cp-item-glyph cp-item-icon"><item.icon strokeWidth={1.5} /></span>
								<span class="cp-item-label">{@render hl(item.label)}</span>
								<ArrowUpRight class="cp-go" strokeWidth={2.2} />
							{:else if item.kind === "math"}
								<span class="cp-item-glyph cp-item-icon"><Calculator strokeWidth={1.5} /></span>
								<span class="cp-item-label cp-math">= {fmtNumber(item.value, { max: 10 })}</span>
								<Copy class="cp-go" strokeWidth={2.2} />
							{:else if item.kind === "setting"}
								<span class="cp-item-glyph cp-item-icon"><ToggleRight strokeWidth={1.5} /></span>
								<span class="cp-item-label">{@render hl(item.setting.label)}</span>
								<span class="cp-item-meta">{item.section}</span>
								{#if item.setting.type === "checkbox"}
									<span class="cp-state" class:on={enabled[item.setting.context.key]}>
										{enabled[item.setting.context.key] ? "On" : "Off"}
									</span>
								{:else}
									<ArrowUpRight class="cp-go" strokeWidth={2.2} />
								{/if}
							{:else if item.kind === "theme"}
								<span class="cp-item-glyph">
									{#each item.swatch.slice(0, 4) as color, i (i)}
										<span class="cp-swatch-dot" style="background:{color}"></span>
									{/each}
								</span>
								<span class="cp-item-label">{@render hl(item.name)}</span>
								{#if item.key === activeThemeKey}
									<Check class="cp-theme-active" strokeWidth={2.2} />
								{/if}
							{:else}
								<span class="cp-item-glyph cp-item-icon"><item.icon strokeWidth={1.5} /></span>
								<span class="cp-item-label">{@render hl(item.label)}</span>
							{/if}
						</button>
					{/each}
				{/each}
				{#if items.length === 0}
					<p class="cp-empty">No results for "{query.trim()}"</p>
				{/if}
			</div>
		{/key}
		<div class="cp-foot">
			<span class="cp-foot-hint"
				><span class="cp-kbd">↑</span><span class="cp-kbd">↓</span> navigate</span
			>
			<span class="cp-foot-hint"><span class="cp-kbd">↵</span> select</span>
			<span class="cp-foot-hint"><span class="cp-kbd">esc</span> close</span>
		</div>
	</div>
{/if}

<style>
	.cp-backdrop {
		position: fixed;
		inset: 0;
		/* Rendered via a body-level portal (portal.ts) — needs to beat Actual's
		   own stacking contexts, not just other sidebar elements. Maxed (not just
		   above the other portaled overlays) since this is a full modal. */
		z-index: 2147483647;
		background: var(--sb-shadow-2);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		animation: cp-fade 0.14s ease;
	}
	.cp {
		position: fixed;
		left: 50%;
		top: 14vh;
		transform: translateX(-50%);
		z-index: 2147483647;
		display: flex;
		flex-direction: column;
		width: min(600px, calc(100vw - 48px));
		max-height: min(440px, 68vh);
		background: var(--sb-bg);
		border: 1px solid var(--abt-ink-2) !important;
		border-radius: var(--abt-radius-lg);
		box-shadow:
			0 0 0 1px var(--sb-shadow-2),
			0 24px 64px var(--sb-shadow);
		overflow: hidden;
		animation: cp-pop 0.16s cubic-bezier(0.2, 0.9, 0.3, 1);
	}
	@keyframes cp-fade {
		from {
			opacity: 0;
		}
	}
	@keyframes cp-pop {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(-10px) scale(0.98);
		}
	}
	.cp-search {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
		padding: 13px 15px;
		border-bottom: 1px solid var(--abt-ink-3);
	}
	.cp-search :global(.cp-search-icon) {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		color: var(--abt-subtle);
	}
	.cp-back {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
	}
	.cp-back:hover :global(.cp-search-icon) {
		color: var(--abt-ink);
	}
	.cp-input {
		flex: 1 1 auto;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		padding: 0;
		font-family: inherit;
		font-size: var(--abt-text-xl);
		color: var(--abt-ink);
	}
	.cp-input::placeholder {
		color: var(--abt-subtle);
	}
	.cp-kbd {
		flex-shrink: 0;
		padding: 2px 6px;
		background: var(--abt-ink-3);
		border-radius: var(--abt-radius-sm);
		font-size: var(--abt-text-sm);
		font-weight: 600;
		letter-spacing: 0.2px;
		color: var(--abt-subtle);
	}
	.cp-body {
		flex: 1 1 auto;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 6px;
		scrollbar-color: var(--abt-ink-5) transparent;
	}
	.cp-body::-webkit-scrollbar {
		width: 8px;
	}
	.cp-body::-webkit-scrollbar-track {
		background: transparent;
	}
	.cp-body::-webkit-scrollbar-thumb {
		background: var(--abt-ink-4);
		border-radius: var(--abt-radius);
		border: 2px solid transparent;
		background-clip: padding-box;
	}
	.cp-body::-webkit-scrollbar-thumb:hover {
		background: var(--abt-ink-5);
		background-clip: padding-box;
	}
	/* Only a root↔sub-page *transition* animates — the {#key page} block gives
	   the body a fresh DOM node each time so this replays on every transition,
	   not just the dialog's initial open. */
	@keyframes cp-page-enter {
		from {
			opacity: 0;
			transform: translateX(8px);
		}
	}
	.cp-body.cp-page-enter {
		animation: cp-page-enter 0.14s ease;
	}
	.cp-group-label {
		padding: 9px 10px 4px;
		font-size: var(--abt-text-sm);
		font-weight: 700;
		letter-spacing: 0.7px;
		text-transform: uppercase;
		color: var(--abt-subtle);
	}
	.cp-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 7px 10px;
		border-radius: var(--abt-radius);
		font-size: var(--abt-text-md);
		letter-spacing: 0.1px;
		color: var(--abt-ink);
		text-align: left;
	}
	/* selection follows the keyboard/mouse; no separate :hover so the two never fight */
	.cp-item.selected {
		background: var(--abt-accent-2);
		color: var(--abt-ink);
	}
	.cp-item-glyph {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		min-width: 18px;
		flex-shrink: 0;
	}
	.cp-item-icon :global(svg) {
		width: 15px;
		height: 15px;
		color: var(--abt-subtle);
	}
	.cp-item.selected .cp-item-icon :global(svg) {
		color: var(--abt-ink);
	}
	.cp-item-label {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cp-item.viewall .cp-item-label {
		color: var(--abt-subtle);
	}
	.cp-mark {
		background: none;
		color: var(--abt-accent);
		font-weight: 700;
	}
	.cp-math {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}

	.cp-item-meta {
		flex-shrink: 0;
		font-size: var(--abt-text-sm);
		color: var(--abt-soft);
	}

	.cp-state {
		flex-shrink: 0;
		min-width: 28px;
		font-size: var(--abt-text-sm);
		font-weight: 600;
		text-align: right;
		color: var(--abt-soft);
	}

	.cp-state.on {
		color: var(--abt-accent);
	}

	.cp-item-amount {
		flex-shrink: 0;
		font-size: var(--abt-text-base);
		color: var(--abt-soft);
	}
	.cp-item-amount.red {
		color: var(--sb-danger);
	}
	.cp :global(.cp-go) {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		color: var(--abt-subtle);
		opacity: 0;
	}
	.cp-item.selected :global(.cp-go) {
		opacity: 1;
	}
	.cp-swatch-dot {
		width: 10px;
		height: 10px;
		border-radius: var(--abt-radius-pill);
		flex-shrink: 0;
		box-shadow: 0 0 0 1px var(--abt-ink-4);
	}
	.cp :global(.cp-theme-active) {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		color: var(--abt-accent);
	}
	.cp-empty {
		margin: 0;
		padding: 28px 0 32px;
		text-align: center;
		font-size: var(--abt-text-md);
		color: var(--abt-soft);
	}
	.cp-foot {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
		padding: 9px 15px;
		border-top: 1px solid var(--abt-ink-3);
		/* Flat, like the rail/activity-bar — no distinct-colored strip. */
		background: var(--sb-bg);
	}
	.cp-foot-hint {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--abt-text-sm);
		color: var(--abt-subtle);
	}
</style>
