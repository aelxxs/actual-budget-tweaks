<script lang="ts">
	import type { AccountIconData } from "@features/appearance/account-icon-picker";
	import {
		closeCalendar,
		isCalendarOpen,
		openCalendar,
	} from "@features/workflows/spending-calendar";
	import IconPickerPopover from "@lib/components/IconPickerPopover.svelte";
	import { dispatch, navigate } from "@lib/utilities/actual-api";
	import { watchDom } from "@lib/utilities/dom-watcher";
	import { Page, matchesPage, pagePath } from "@lib/utilities/pages";
	import { getValue } from "@lib/utilities/store";
	import { CalendarDays, PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-svelte";
	import { portal } from "../actions/portal";
	import { scrollFade } from "../actions/scroll-fade";
	import { tooltip } from "../actions/tooltip.svelte";
	import type { BudgetIcon } from "../lib/budgets";
	import { loadBudgetIcon, removeBudgetIcon, setBudgetIcon } from "../lib/budgets";
	import type { SidebarAccount } from "../lib/data";
	import { navItems, settingsItem, settingsMenu, settingsPages } from "../lib/nav";

	// See PrimaryNav.svelte for why this watches DOM mutations rather than
	// `watchRoute`/history — cross-world navigation isn't observable there,
	// and why `isActive` (not a sibling `{@const}`) is what makes the
	// `class:active` binding itself depend on `tick`.
	let tick = $state({});

	$effect(() => {
		return watchDom(() => (tick = {}));
	});

	function isActive(page: Page): boolean {
		return Boolean(tick) && matchesPage(page);
	}

	// Same route check AccountRow.svelte uses for its own .selected state.
	function isAccountSelected(id: string): boolean {
		return Boolean(tick) && location.pathname === `/accounts/${id}`;
	}

	// See PrimaryNav.svelte for the full explanation of both of these.
	let calendarFeatureEnabled = $state(false);

	$effect(() => {
		getValue<boolean>("spending-calendar-enabled", false).then((v) => (calendarFeatureEnabled = v));
	});

	function go(page: Page) {
		const covered = isCalendarOpen();
		if (covered) closeCalendar();
		// The page under the calendar is already showing; navigating again makes Actual remount it.
		if (covered && matchesPage(page)) return;
		navigate(pagePath(page));
	}

	const {
		budgetName,
		budgetId,
		accounts,
		icons,
		onExpand,
		onSearch,
		split = false,
		panelCollapsed = false,
		onTogglePanel,
	}: {
		budgetName: string;
		budgetId?: string;
		accounts: SidebarAccount[];
		icons: Record<string, AccountIconData>;
		onExpand: () => void;
		onSearch: () => void;
		// split: this rail is the always-on activity bar of the split layout
		// (see Sidebar.svelte) rather than the classic layout's
		// collapsed-rail substitute — it only takes over showing accounts
		// itself while its companion accounts panel is collapsed.
		split?: boolean;
		panelCollapsed?: boolean;
		onTogglePanel?: () => void;
	} = $props();

	// In split mode the panel's BudgetHeader hides its own icon, so this
	// avatar is where the icon is edited; the collapsed rail's just expands.
	let budgetIcon = $state<BudgetIcon | undefined>(undefined);
	let avatarEl = $state<HTMLButtonElement | undefined>();
	let iconPickerOpen = $state(false);
	let iconAnchorRect = $state<DOMRect | undefined>(undefined);

	$effect(() => {
		if (!budgetId) {
			budgetIcon = undefined;
			return;
		}
		loadBudgetIcon(budgetId).then((icon) => (budgetIcon = icon));
	});

	function onAvatarClick() {
		if (!split) {
			onExpand();
			return;
		}
		if (!avatarEl) return;
		iconAnchorRect = avatarEl.getBoundingClientRect();
		iconPickerOpen = true;
	}

	async function handleIconSelect(result: BudgetIcon): Promise<void> {
		budgetIcon = result;
		iconPickerOpen = false;
		if (budgetId) await setBudgetIcon(budgetId, result);
	}

	async function handleIconRemove(): Promise<void> {
		budgetIcon = undefined;
		iconPickerOpen = false;
		if (budgetId) await removeBudgetIcon(budgetId);
	}

	const avatarLabel = $derived(split ? "Change budget icon" : `${budgetName} — expand`);

	// The rail only has room to spare when it isn't also listing accounts;
	// otherwise the extra pages fold into a "More" menu.
	const showAccounts = $derived(!split || panelCollapsed);

	let moreOpen = $state(false);

	$effect(() => {
		if (!showAccounts) moreOpen = false;
	});

	let moreX = $state(0);
	let moreY = $state(0);
	const moreActive = $derived(Boolean(tick) && settingsMenu.some((item) => matchesPage(item.page)));

	function toggleMore(e: MouseEvent) {
		e.stopPropagation();
		if (moreOpen) {
			moreOpen = false;
			return;
		}
		const MH = 200;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		moreX = rect.right + 8;
		moreY = Math.min(rect.top, window.innerHeight - MH - 8);
		moreOpen = true;
	}

	const budgetInitials = $derived(
		budgetName
			.split(/\s+/)
			.map((w) => w[0])
			.join("")
			.slice(0, 2)
			.toUpperCase(),
	);

	function accountInitials(name: string): string {
		const words = name.trim().split(/\s+/);
		if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
		return name
			.replace(/[^a-z0-9]/gi, "")
			.slice(0, 2)
			.toUpperCase();
	}

	const sections = $derived(
		[
			{ label: "On Budget", items: accounts.filter((a) => !a.offbudget && !a.closed) },
			{ label: "Off Budget", items: accounts.filter((a) => a.offbudget && !a.closed) },
			{ label: "Closed", items: accounts.filter((a) => a.closed) },
		].filter((s) => s.items.length > 0),
	);

	async function addAccount() {
		await dispatch("pushModal", { modal: { name: "add-account", options: {} } });
	}
</script>

<svelte:window
	onclick={() => (moreOpen = false)}
	onkeydown={(e) => {
		if (e.key === "Escape") moreOpen = false;
	}}
/>

<button
	type="button"
	class="rail-avatar"
	class:has-icon={!!budgetIcon}
	bind:this={avatarEl}
	onclick={onAvatarClick}
	aria-label={avatarLabel}
	use:tooltip={avatarLabel}
>
	{#if budgetIcon?.type === "emoji"}
		<span class="budget-icon-emoji">{budgetIcon.value}</span>
	{:else if budgetIcon}
		<img class="budget-icon-img" src={budgetIcon.value} alt="" />
	{:else}
		{budgetInitials}
	{/if}
</button>

{#if iconPickerOpen && iconAnchorRect}
	<IconPickerPopover
		anchorRect={iconAnchorRect}
		hasIcon={!!budgetIcon}
		onSelect={handleIconSelect}
		onRemove={budgetIcon ? handleIconRemove : undefined}
		onClose={() => (iconPickerOpen = false)}
	/>
{/if}

<button
	type="button"
	class="rail-icon"
	onclick={onSearch}
	aria-label="Search"
	use:tooltip={"Search (⌘K)"}
>
	<Search strokeWidth={1.5} />
</button>
<div class="rail-nav">
	{#each navItems as item (item.page)}
		<button
			type="button"
			class="rail-icon"
			class:active={isActive(item.page)}
			onclick={() => go(item.page)}
			aria-label={item.label}
			use:tooltip={item.label}
		>
			<item.icon strokeWidth={1.5} />
		</button>
	{/each}
	{#if calendarFeatureEnabled}
		<button
			type="button"
			class="rail-icon"
			class:active={isActive(Page.Calendar)}
			onclick={() => openCalendar()}
			aria-label="Calendar"
			use:tooltip={"Calendar"}
		>
			<CalendarDays strokeWidth={1.5} />
		</button>
	{/if}
	{#if showAccounts}
		<button
			type="button"
			class="rail-icon"
			class:active={moreActive || moreOpen}
			aria-label={settingsItem.label}
			aria-expanded={moreOpen}
			onclick={toggleMore}
			use:tooltip={settingsItem.label}
		>
			<settingsItem.icon strokeWidth={1.5} />
		</button>
	{/if}
</div>
{#if !showAccounts}
	<div class="rail-divider"></div>
	<div class="rail-nav">
		{#each [...settingsPages, settingsItem] as item (item.page)}
			<button
				type="button"
				class="rail-icon"
				class:active={isActive(item.page)}
				onclick={() => go(item.page)}
				aria-label={item.label}
				use:tooltip={item.label}
			>
				<item.icon strokeWidth={1.5} />
			</button>
		{/each}
	</div>
{/if}

{#if moreOpen}
	<div use:portal class="ctx" style="top: {moreY}px; left: {moreX}px">
		{#each settingsMenu as item (item.page)}
			<button
				type="button"
				class="ctx-item"
				class:active={isActive(item.page)}
				onclick={() => {
					moreOpen = false;
					go(item.page);
				}}
			>
				<item.icon strokeWidth={1.5} />
				<span>{item.label}</span>
			</button>
		{/each}
	</div>
{/if}

{#if showAccounts}
	<div class="rail-divider"></div>
	<div class="rail-list" use:scrollFade>
		{#each sections as section (section.label)}
			{@const [first, ...rest] = section.label.split(" ")}
			<div class="rail-section" use:tooltip={section.label}>
				{first}{#if rest.length}<small>{rest.join(" ")}</small>{/if}
			</div>
			{#each section.items as account (account.id)}
				{@const icon = icons[account.id]}
				<button
					type="button"
					class="rtile-wrap"
					class:selected={isAccountSelected(account.id)}
					aria-label={account.name}
					use:tooltip={account.name}
					onclick={() => {
						if (isCalendarOpen()) closeCalendar();
						navigate(`/accounts/${account.id}`);
					}}
				>
					<span class="rtile">
						{#if icon?.type === "emoji"}
							<span class="rtile-emoji">{icon.value}</span>
						{:else if icon}
							<img class="rtile-img" src={icon.value} alt="" />
						{:else}
							{accountInitials(account.name)}
						{/if}
					</span>
				</button>
			{/each}
		{/each}
	</div>
{:else}
	<div class="rail-spacer"></div>
{/if}
<div class="rail-foot">
	{#if split}
		<button
			type="button"
			class="rail-icon"
			onclick={onTogglePanel}
			aria-label={panelCollapsed ? "Show accounts panel" : "Hide accounts panel"}
			use:tooltip={panelCollapsed ? "Show accounts panel" : "Hide accounts panel"}
		>
			{#if panelCollapsed}
				<PanelLeftOpen strokeWidth={1.5} />
			{:else}
				<PanelLeftClose strokeWidth={1.5} />
			{/if}
		</button>
	{:else}
		<button
			type="button"
			class="rail-icon"
			onclick={addAccount}
			aria-label="Add account"
			use:tooltip={"Add account"}
		>
			<Plus strokeWidth={2.2} />
		</button>
		<button
			type="button"
			class="rail-icon"
			onclick={onExpand}
			aria-label="Expand sidebar"
			use:tooltip={"Expand sidebar"}
		>
			<PanelLeftOpen strokeWidth={1.5} />
		</button>
	{/if}
</div>

<style>
	.rail-avatar {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: var(--abt-radius);
		background: linear-gradient(135deg, var(--abt-accent), var(--abt-accent));
		color: #fff;
		font-size: var(--abt-text-base);
		font-weight: 800;
		letter-spacing: 0.3px;
		overflow: hidden;
		cursor: pointer;
		flex-shrink: 0;
		margin-bottom: 4px;
	}
	.rail-avatar.has-icon {
		background: var(--abt-ink-3);
		color: var(--abt-ink);
	}
	.rail-avatar .budget-icon-emoji {
		font-size: 20px;
		line-height: 1;
	}
	.rail-avatar .budget-icon-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.rail-spacer {
		flex: 1 1 auto;
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
		background: var(--abt-ink-3);
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
		/* Pre-JS fallback — scrollFade (scroll-fade.ts) takes over, same as
		   .accounts in AccountList. */
		mask-image: linear-gradient(black 0%, black calc(100% - 34px), transparent 100%);
		-webkit-mask-image: linear-gradient(black 0%, black calc(100% - 34px), transparent 100%);
		transition:
			mask-image 140ms ease,
			-webkit-mask-image 140ms ease;
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
		color: var(--abt-soft);
	}
	.rail-section small {
		display: block;
		font-size: 8px;
		font-weight: 700;
		color: var(--abt-subtle);
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
		border-radius: var(--abt-radius);
		background: var(--abt-ink-3);
		color: var(--abt-ink);
		font-size: var(--abt-text-sm);
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
		border-radius: var(--abt-radius);
	}
	.rtile-wrap:hover .rtile {
		filter: brightness(1.2);
	}
	.rtile-wrap.selected .rtile {
		color: #fff;
		box-shadow:
			0 0 0 2px var(--sb-bg),
			0 0 0 4px var(--abt-accent);
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
		width: 36px;
		height: 36px;
		border-radius: var(--abt-radius);
		color: var(--abt-soft);
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background 0.12s ease,
			color 0.12s ease;
	}
	.rail-icon:hover {
		background: var(--abt-ink-2);
		color: var(--abt-ink);
	}
	.rail-icon.active {
		background: var(--abt-accent-2);
		color: var(--abt-accent);
	}
	.rail-icon :global(svg) {
		width: 18px;
		height: 18px;
	}
</style>
