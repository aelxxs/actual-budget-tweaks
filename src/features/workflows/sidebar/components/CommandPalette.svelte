<script lang="ts">
	import type { AccountIconData } from "@features/appearance/account-icon-picker";
	import { getEmojiAssetUrl } from "@features/appearance/account-icon-picker";
	import { getPrivacyMode } from "@features/core/privacy-mode";
	import {
		applyThemeByKey,
		fetchCommunityThemeCatalog,
		getBuiltinPreviewColors,
		NATIVE_THEME_KEY,
		type RemoteTheme,
	} from "@features/theme/theme-apply";
	import { closeCalendar, isCalendarOpen } from "@features/workflows/spending-calendar";
	import { themes } from "@lib/design";
	import { dispatch, navigate, query as queryTable } from "@lib/utilities/actual-api";
	import { fmtMoney } from "@lib/utilities/currency";
	import { Page } from "@lib/utilities/pages";
	import { getValue, setValue } from "@lib/utilities/store";
	import {
		ArrowLeft,
		ArrowUpRight,
		Calendar,
		ChartColumn,
		Check,
		ChevronRight,
		Eye,
		EyeOff,
		Landmark,
		LayoutGrid,
		Palette,
		Plus,
		RefreshCw,
		Search,
		Settings,
		SlidersHorizontal,
		Tag,
		Users,
	} from "lucide-svelte";
	import { autofocus } from "../actions/autofocus";
	import { portal } from "../actions/portal";
	import type { SidebarAccount } from "../lib/data";
	import { syncAllAccounts } from "../lib/data";
	import StatusIcon from "./StatusIcon.svelte";

	// Matches theme.ts's defineSetting context ("catppuccin-palette" /
	// "mocha") — this palette applies/persists the same setting the full
	// ThemeCustomizer settings panel reads from, so they stay in sync.
	const THEME_SETTING_KEY = "catppuccin-palette";
	const DEFAULT_THEME_KEY = "mocha";

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
		{ label: "Schedules", page: Page.Schedules, icon: Calendar },
		{ label: "Payees", page: Page.Payees, icon: Users },
		{ label: "Bank Sync", page: Page.BankSync, icon: Landmark },
		{ label: "Rules", page: Page.Rules, icon: SlidersHorizontal },
		{ label: "Tags", page: Page.Tags, icon: Tag },
		{ label: "Settings", page: Page.Settings, icon: Settings },
	];

	// Each of these is a real dispatch/navigate call, verified against Actual's
	// own source (loot-core/desktop-client) rather than guessed modal names.
	// "Add transaction", "Import transactions" and "Reconcile" were dropped —
	// they either have no global (accountless) trigger, or their real modal
	// requires a callback prop that this bridge's JSON-serialized dispatch
	// can't pass through, which would leave the modal broken once opened.
	const QUICK_ACTIONS: { icon: typeof LayoutGrid; label: string; run: () => void }[] = [
		{
			icon: Calendar,
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
		{
			icon: Plus,
			label: "Add new account",
			run: () => dispatch("pushModal", { modal: { name: "add-account", options: {} } }),
		},
	];

	type PaletteItem =
		| { kind: "account"; account: SidebarAccount }
		| { kind: "report"; report: CustomReport }
		| { kind: "nav"; label: string; page: Page; icon: typeof LayoutGrid }
		| { kind: "action"; label: string; icon: typeof LayoutGrid; run: () => void }
		| { kind: "view-all"; label: string; target: SubPage }
		| { kind: "subpage"; label: string; icon: typeof LayoutGrid; target: SubPage }
		| { kind: "theme"; key: string; name: string; swatch: string[] };
	interface PaletteGroup {
		label: string;
		items: PaletteItem[];
	}

	// Root-page lists longer than this get truncated with a trailing "View
	// all" row (see PREVIEW_LIMIT below) instead of dumping everything into
	// the root list — mirrors CommandBar.tsx's themes page: a pushed
	// sub-page rather than an ever-growing root list.
	type SubPage = "accounts" | "reports" | "themes";
	const PREVIEW_LIMIT = 5;

	let open = $state(false);
	let query = $state("");
	let index = $state(0);
	let listEl = $state<HTMLElement | null>(null);
	let page = $state<"root" | SubPage>("root");
	// Only a page *transition* animates — not the dialog's initial open.
	let animatePageChange = $state(false);

	// Refreshed each time the palette opens (see openPalette) rather than
	// tracked live — privacy.ts's own state isn't a Svelte store, and the
	// palette closes immediately after running any action anyway.
	let privacyEnabled = $state(false);

	let reports = $state<CustomReport[]>([]);
	let reportsLoaded = false;
	async function ensureReportsLoaded(): Promise<void> {
		if (reportsLoaded) return;
		reportsLoaded = true;
		try {
			reports = await queryTable<(CustomReport & { tombstone?: boolean })[]>("custom_reports", {
				filter: { tombstone: false },
			});
		} catch {
			reportsLoaded = false;
		}
	}

	let activeThemeKey = $state(DEFAULT_THEME_KEY);
	let communityThemes = $state<RemoteTheme[]>([]);
	let communityThemesLoaded = false;
	async function ensureCommunityThemesLoaded(): Promise<void> {
		if (communityThemesLoaded) return;
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
			: page === "reports"
				? "Search reports…"
				: page === "themes"
					? "Search themes…"
					: "Search accounts and pages…",
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

		const out: PaletteGroup[] = [
			{ label: "Accounts", items: accountItems },
			{ label: "Reports", items: reportItems },
			{
				label: "Go to",
				items: NAV_PAGES.filter((p) => match(p.label)).map((p) => ({
					kind: "nav" as const,
					label: p.label,
					page: p.page,
					icon: p.icon,
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
					...(() => {
						const label = privacyEnabled ? "Show amounts" : "Hide amounts";
						if (!match(label)) return [];
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
		if (target === "themes") ensureCommunityThemesLoaded();
	}
	function goBackToRoot(): void {
		page = "root";
		query = "";
		index = 0;
		animatePageChange = true;
	}
	function runItem(item: PaletteItem): void {
		if (item.kind === "view-all" || item.kind === "subpage") {
			goToPage(item.target);
			return;
		}
		if (isCalendarOpen()) closeCalendar();
		if (item.kind === "nav") navigate(`/${item.page}`);
		else if (item.kind === "account") navigate(`/accounts/${item.account.id}`);
		else if (item.kind === "report") navigate(`/reports/custom/${item.report.id}`);
		else if (item.kind === "theme") {
			activeThemeKey = item.key;
			setValue(THEME_SETTING_KEY, item.key);
			applyThemeByKey(item.key, DEFAULT_THEME_KEY);
		} else item.run();
		closePalette();
	}
	function moveIndex(delta: number): void {
		const n = items.length;
		if (!n) return;
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
			if (item) runItem(item);
		} else if (e.key === "Backspace" && query === "" && page !== "root") {
			e.preventDefault();
			goBackToRoot();
		} else if (e.key === "Escape") {
			e.preventDefault();
			if (page !== "root") goBackToRoot();
			else closePalette();
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
			if (page !== "root") goBackToRoot();
			else closePalette();
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
					{#each group.items as item, ii}
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
									class:red={item.account.balance < 0}
								>
									{fmtMoney(item.account.balance)}
								</span>
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
							{:else if item.kind === "theme"}
								<span class="cp-item-glyph">
									{#each item.swatch.slice(0, 4) as color}
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
