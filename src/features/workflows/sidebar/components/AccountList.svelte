<script lang="ts">
	import type { AccountIconData } from "@features/appearance/account-icon-picker";
	import { closeCalendar, isCalendarOpen } from "@features/workflows/spending-calendar";
	import { dispatch, navigate } from "@lib/utilities/actual-api";
	import RollingNumber from "@lib/components/RollingNumber.svelte";
	import { getValue, setValue, watchValue } from "@lib/utilities/store";
	import { sidebarGroupTotals } from "@features/appearance/sidebar-group-totals";
	import { ChevronDown, List, ListTree, Plus } from "@lucide/svelte";
	import { overlayScrollbar } from "../actions/overlay-scrollbar";
	import { portal } from "../actions/portal";
	import { scrollFade } from "../actions/scroll-fade";
	import { tooltip } from "../actions/tooltip.svelte";
	import type { SidebarAccount } from "../lib/data";
	import type { AccountGroup, GroupState } from "../lib/groups";
	import {
		addGroup,
		assignAccount,
		deleteGroup,
		groupOf,
		groupsIn,
		loadCollapsedGroups,
		moveGroup,
		moveToGroup,
		removeGroup,
		renameGroup,
		renameGroupTo,
		reorderGroups,
		saveCollapsedGroups,
		watchCollapsedGroups,
		watchGroupState,
	} from "../lib/groups";
	import { applyOrder, loadAccountOrder, saveAccountOrder, watchAccountOrder } from "../lib/order";
	import AccountHoverCard from "./AccountHoverCard.svelte";
	import AccountRow from "./AccountRow.svelte";
	import GroupHeader from "./GroupHeader.svelte";
	import { route, trackRoute } from "../lib/route.svelte";

	const {
		accounts,
		icons,
		iconPicker = true,
		groupAccounts,
		budgetId,
		split = false,
		onToggleGroupMode,
		onRenameAccount,
		onCloseAccount,
	}: {
		accounts: SidebarAccount[];
		icons: Record<string, AccountIconData>;
		iconPicker?: boolean;
		groupAccounts: boolean;
		budgetId: string | undefined;
		split?: boolean;
		onToggleGroupMode: () => void;
		onRenameAccount: (accountId: string, name: string) => void;
		onCloseAccount: (accountId: string) => void;
	} = $props();

	const grandTotal = $derived(
		accounts.filter((a) => !a.closed).reduce((sum, a) => sum + a.balance, 0),
	);

	const STORAGE_KEY = "experimental-sidebar-collapsed-sections";

	let collapsed = $state<Record<string, boolean>>({});
	let collapsedGroups = $state<Record<string, boolean>>({});
	let order = $state<string[]>([]);
	let groupState = $state<GroupState>({
		groups: {},
		assignments: {},
		native: false,
		importable: false,
	});
	const groups = $derived(groupState.groups);
	const assignments = $derived(groupState.assignments);

	$effect(() => {
		getValue<Record<string, boolean>>(STORAGE_KEY, {}).then((stored) => (collapsed = stored));
	});
	const { key: TOTALS_KEY, defaultValue: TOTALS_DEFAULT } = sidebarGroupTotals.context;
	let showGroupTotals = $state(TOTALS_DEFAULT);
	$effect(() => {
		getValue<boolean>(TOTALS_KEY, TOTALS_DEFAULT).then((v) => (showGroupTotals = v));
		return watchValue<boolean>(TOTALS_KEY, (v) => (showGroupTotals = v ?? TOTALS_DEFAULT));
	});
	$effect(() => {
		loadCollapsedGroups().then((stored) => (collapsedGroups = stored));
		return watchCollapsedGroups((stored) => (collapsedGroups = stored));
	});
	// Reading budgetId here (rather than capturing it once) makes these
	// effects re-run whenever the open budget changes — otherwise this list
	// would keep showing whichever budget's groups/order were loaded first,
	// since this component persists across a budget switch instead of
	// remounting.
	$effect(() => {
		loadAccountOrder(budgetId).then((stored) => (order = stored));
		return watchAccountOrder(budgetId, (stored) => (order = stored));
	});
	$effect(() => watchGroupState(budgetId, (state) => (groupState = state)));

	function toggle(label: string) {
		collapsed = { ...collapsed, [label]: !collapsed[label] };
		setValue(STORAGE_KEY, collapsed);
	}

	function toggleGroup(id: string) {
		collapsedGroups = { ...collapsedGroups, [id]: !collapsedGroups[id] };
		saveCollapsedGroups(collapsedGroups);
	}

	const SECTION_KIND: Record<string, "onbudget" | "offbudget" | null> = {
		"On Budget": "onbudget",
		"Off Budget": "offbudget",
		Closed: null,
	};

	$effect(() => trackRoute());

	// See PrimaryNav.svelte for why any navigation elsewhere in this sidebar
	// has to close the spending-calendar overlay itself, if open.
	function go(path: string) {
		if (isCalendarOpen()) {
			closeCalendar();
		}
		navigate(path);
	}

	function isAllAccountsActive(): boolean {
		return Boolean(route()) && location.pathname === "/accounts";
	}

	function isSectionActive(kind: "onbudget" | "offbudget" | null): boolean {
		return Boolean(route()) && !!kind && location.pathname === `/accounts/${kind}`;
	}

	const sections = $derived(
		[
			{ label: "On Budget", items: accounts.filter((a) => !a.offbudget && !a.closed) },
			{ label: "Off Budget", items: accounts.filter((a) => a.offbudget && !a.closed), muted: true },
			{ label: "Closed", items: accounts.filter((a) => a.closed), muted: true },
		].filter((s) => s.items.length > 0),
	);

	const orderedSections = $derived(
		sections.map((s) => ({ ...s, items: applyOrder(s.items, order) })),
	);

	function groupsForSection(kind: "onbudget" | "offbudget"): AccountGroup[] {
		return groupsIn(kind, groupState, accounts);
	}

	function bucketOf(account: SidebarAccount): string | null {
		return groupOf(account, assignments, groups);
	}

	// On/off budget and closed are Actual's own; a drag only reorders or regroups within one.
	function sectionOf(id: string | null): string | null {
		const account = accounts.find((a) => a.id === id);
		if (!account) {
			return null;
		}
		return account.closed ? "closed" : account.offbudget ? "offbudget" : "onbudget";
	}

	// ---- category (sub-group) CRUD ----
	let editingGroupId = $state<string | null>(null);
	let menuGroup = $state<AccountGroup | null>(null);
	let menuX = $state(0);
	let menuY = $state(0);

	// ---- account rename / close (right-click context menu) ----
	let editingAccountId = $state<string | null>(null);
	let menuAccount = $state<SidebarAccount | null>(null);

	function openAccountMenu(e: MouseEvent, account: SidebarAccount) {
		e.preventDefault();
		e.stopPropagation();
		hideHoverCard();
		const MW = 200;
		const MH = 90;
		menuX = Math.min(e.clientX, window.innerWidth - MW - 8);
		menuY = Math.min(e.clientY, window.innerHeight - MH - 8);
		menuAccount = account;
	}

	// ---- account hover card ----
	// Hover-intent delay so the card doesn't flash while sweeping the list.
	const HOVER_CARD_WIDTH = 292;
	const HOVER_DELAY = 600;
	let hoverAccount = $state<SidebarAccount | null>(null);
	let hoverTop = $state(0);
	let hoverLeft = $state(0);
	let hoverFlip = $state(false);
	let hoverTimer: ReturnType<typeof setTimeout> | null = null;

	function showHoverCard(el: HTMLElement, account: SidebarAccount) {
		const rect = el.getBoundingClientRect();
		const flip = rect.right + HOVER_CARD_WIDTH + 16 > window.innerWidth;
		hoverFlip = flip;
		hoverLeft = flip ? rect.left - HOVER_CARD_WIDTH - 10 : rect.right + 10;
		const estimatedHeight = 360;
		hoverTop = Math.max(12, Math.min(rect.top - 6, window.innerHeight - estimatedHeight - 12));
		hoverAccount = account;
	}

	function onAccountRowEnter(e: MouseEvent, account: SidebarAccount) {
		if (dragSrcId || menuAccount || menuGroup || editingAccountId || editingGroupId) {
			return;
		}
		const el = e.currentTarget as HTMLElement;
		if (hoverTimer) {
			clearTimeout(hoverTimer);
		}
		hoverTimer = setTimeout(() => showHoverCard(el, account), HOVER_DELAY);
	}

	function hideHoverCard() {
		if (hoverTimer) {
			clearTimeout(hoverTimer);
			hoverTimer = null;
		}
		hoverAccount = null;
	}

	function commitAccountRename(accountId: string, name: string) {
		const trimmed = name.trim();
		if (trimmed) {
			onRenameAccount(accountId, trimmed);
		}
		editingAccountId = null;
	}

	function addCategory(sectionLabel: string) {
		const kind = SECTION_KIND[sectionLabel];
		if (!kind) {
			return;
		}
		void addGroup(budgetId, groupState, kind).then((id) => (editingGroupId = id));
	}

	function commitRename(id: string, label: string) {
		const state = groupState;
		groupState = { ...state, groups: renameGroup(state.groups, id, label) };
		void renameGroupTo(budgetId, state, id, label);
		editingGroupId = null;
	}

	function openGroupMenu(e: MouseEvent, group: AccountGroup) {
		e.preventDefault();
		e.stopPropagation();
		hideHoverCard();
		const MW = 200;
		const MH = 90;
		menuX = Math.min(e.clientX, window.innerWidth - MW - 8);
		menuY = Math.min(e.clientY, window.innerHeight - MH - 8);
		menuGroup = group;
	}

	function closeMenu() {
		menuGroup = null;
		menuAccount = null;
	}

	function ungroup(group: AccountGroup) {
		const state = groupState;
		groupState = { ...state, ...removeGroup(state.groups, state.assignments, group.id) };
		void deleteGroup(budgetId, state, group.id);
		closeMenu();
	}

	// ---- drag reorder + drag-to-assign-group ----
	let dragSrcId = $state<string | null>(null);
	let overId = $state<string | null>(null);
	let overPos = $state<"before" | "after">("before");
	let overGroupId = $state<string | null>(null);

	function endDrag() {
		dragSrcId = null;
		overId = null;
		overGroupId = null;
	}

	function onDragStart(e: DragEvent, id: string) {
		hideHoverCard();
		dragSrcId = id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", id);
		}
	}

	function onDragOver(e: DragEvent, targetId: string) {
		if (!dragSrcId || dragSrcId === targetId || sectionOf(dragSrcId) !== sectionOf(targetId)) {
			return;
		}
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = "move";
		}
		overId = targetId;
		overGroupId = null;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		overPos = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
	}

	function canDropInGroup(groupId: string): boolean {
		const kind = dragSrcId ? sectionOf(dragSrcId) : null;
		return (
			(kind === "onbudget" || kind === "offbudget") &&
			groupsForSection(kind).some((g) => g.id === groupId)
		);
	}

	function assign(accountId: string, groupId: string | null) {
		const state = groupState;
		groupState = { ...state, assignments: assignAccount(state.assignments, accountId, groupId) };
		void moveToGroup(budgetId, state, accountId, groupId);
	}

	function onGroupDragOver(e: DragEvent, groupId: string) {
		if (!canDropInGroup(groupId)) {
			return;
		}
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = "move";
		}
		overGroupId = groupId;
		overId = null;
	}

	function onGroupDrop(e: DragEvent, groupId: string) {
		if (!dragSrcId || !canDropInGroup(groupId)) {
			return;
		}
		e.preventDefault();
		assign(dragSrcId, groupId);
		endDrag();
	}

	// ---- drag to reorder groups within a section ----
	let dragGroupId = $state<string | null>(null);
	let overBlock = $state<{ id: string; pos: "before" | "after" } | null>(null);

	function endGroupDrag() {
		dragGroupId = null;
		overBlock = null;
	}

	function onGroupDragStart(e: DragEvent, id: string) {
		hideHoverCard();
		dragGroupId = id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", id);
		}
	}

	function onBlockDragOver(e: DragEvent, kind: "onbudget" | "offbudget", id: string) {
		if (!dragGroupId || !groupsForSection(kind).some((g) => g.id === dragGroupId)) {
			return;
		}
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = "move";
		}
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		overBlock =
			id === dragGroupId
				? null
				: { id, pos: e.clientY < rect.top + rect.height / 2 ? "before" : "after" };
	}

	function onBlockDrop(e: DragEvent, kind: "onbudget" | "offbudget") {
		if (!dragGroupId) {
			return;
		}
		e.preventDefault();
		const id = dragGroupId;
		const target = overBlock;
		endGroupDrag();
		if (!target) {
			return;
		}
		const list = groupsForSection(kind);
		const rest = list.filter((g) => g.id !== id);
		const at = rest.findIndex((g) => g.id === target.id) + (target.pos === "after" ? 1 : 0);
		const beforeId = rest[at]?.id ?? null;
		const reordered = reorderGroups(list, id, beforeId);
		const state = groupState;
		groupState = {
			...state,
			groups: { ...state.groups, ...Object.fromEntries(reordered.map((g) => [g.id, g])) },
		};
		void moveGroup(budgetId, state, reordered, id, beforeId);
	}

	/** Dropping onto an ungrouped-bucket row (or the target's bucket, whichever it is) reorders, and — if the dragged account was in a different bucket — reassigns its group to match. */
	function onDrop(
		e: DragEvent,
		sectionLabel: string,
		targetId: string,
		targetGroupId: string | null,
		sectionItems: SidebarAccount[],
	) {
		if (!dragSrcId || dragSrcId === targetId || sectionOf(dragSrcId) !== sectionOf(targetId)) {
			return;
		}
		e.preventDefault();

		const dragged = accounts.find((a) => a.id === dragSrcId);
		if (dragged && bucketOf(dragged) !== targetGroupId) {
			assign(dragSrcId, targetGroupId);
		}

		const ids = sectionItems.map((a) => a.id);
		const srcIndex = ids.indexOf(dragSrcId);
		if (srcIndex !== -1) {
			ids.splice(srcIndex, 1);
		}
		let targetIndex = ids.indexOf(targetId);
		if (targetIndex === -1) {
			targetIndex = ids.length;
		}
		if (overPos === "after") {
			targetIndex += 1;
		}
		ids.splice(targetIndex, 0, dragSrcId);

		const nextOrder = orderedSections.flatMap((s) =>
			s.label === sectionLabel ? ids : s.items.map((a) => a.id),
		);
		order = nextOrder;
		saveAccountOrder(budgetId, nextOrder);
		endDrag();
	}
</script>

<svelte:window onclick={closeMenu} />

<div class="accounts-viewport">
	<div
		class="accounts"
		use:scrollFade
		use:overlayScrollbar={{ enabled: split }}
		onscroll={hideHoverCard}
	>
		<div class="all-accounts section-head" class:active={isAllAccountsActive()}>
			<button type="button" class="section-nav" onclick={() => go("/accounts")}>
				<span class="group-label">Accounts</span>
				<RollingNumber
					value={grandTotal}
					resetKey={budgetId}
					class="group-total abt-privacy-number"
				/>
			</button>
			<!-- Adding accounts is occasional, so it's revealed here on hover rather than kept in the footer. -->
			<button
				type="button"
				class="header-add"
				aria-label="Add account"
				use:tooltip={{ text: "Add account", placement: "right" }}
				onclick={() => dispatch("pushModal", { modal: { name: "add-account", options: {} } })}
			>
				<Plus strokeWidth={1.5} />
			</button>
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
				onclick={onToggleGroupMode}
			>
				{#if groupAccounts}
					<ListTree strokeWidth={1.5} />
				{:else}
					<List strokeWidth={1.5} />
				{/if}
			</button>
		</div>
		{#each orderedSections as section (section.label)}
			{@const kind = SECTION_KIND[section.label]}
			<div class="section">
				<div class="group-header section-head" class:active={isSectionActive(kind)}>
					<button
						type="button"
						class="caret-btn"
						aria-label={collapsed[section.label] ? "Expand section" : "Collapse section"}
						aria-expanded={!collapsed[section.label]}
						onclick={() => toggle(section.label)}
					>
						<ChevronDown
							class={collapsed[section.label] ? "caret collapsed" : "caret"}
							color="var(--abt-ink-5)"
							strokeWidth={3}
						/>
					</button>
					{#if kind}
						<button type="button" class="section-nav" onclick={() => go(`/accounts/${kind}`)}>
							<span class="group-label" class:dim={section.muted}>{section.label}</span>
							<span class="group-count">{section.items.length}</span>
							<RollingNumber
								value={section.items.reduce((sum, a) => sum + a.balance, 0)}
								resetKey={budgetId}
								class="group-total abt-privacy-number"
							/>
						</button>
					{:else}
						<span class="section-nav">
							<span class="group-label" class:dim={section.muted}>{section.label}</span>
							<span class="group-count">{section.items.length}</span>
							<RollingNumber
								value={section.items.reduce((sum, a) => sum + a.balance, 0)}
								resetKey={budgetId}
								class="group-total abt-privacy-number"
							/>
						</span>
					{/if}
					{#if kind}
						<button
							type="button"
							class="section-add"
							aria-label="New category in {section.label}"
							onclick={(e) => {
								e.stopPropagation();
								addCategory(section.label);
							}}
						>
							<Plus strokeWidth={1.5} />
						</button>
					{/if}
				</div>
				{#if !collapsed[section.label]}
					{#if !kind || !groupAccounts}
						<!-- Closed accounts, or flat mode: no sub-category headers. -->
						<div class="account-list">
							{#each section.items as account (account.id)}
								<AccountRow
									{account}
									icon={icons[account.id]}
									{iconPicker}
									dragging={dragSrcId === account.id}
									dropPos={overId === account.id ? overPos : null}
									editing={editingAccountId === account.id}
									onDragStart={(e) => onDragStart(e, account.id)}
									onDragOver={(e) => onDragOver(e, account.id)}
									onDrop={(e) => onDrop(e, section.label, account.id, null, section.items)}
									onDragEnd={endDrag}
									onStartRename={() => (editingAccountId = account.id)}
									onCommitRename={(name) => commitAccountRename(account.id, name)}
									onCancelRename={() => (editingAccountId = null)}
									onContextMenu={(e) => openAccountMenu(e, account)}
									onRowMouseEnter={(e) => onAccountRowEnter(e, account)}
									onRowMouseLeave={hideHoverCard}
								/>
							{/each}
						</div>
					{:else}
						{@const ungrouped = section.items.filter((a) => !bucketOf(a))}
						{#if ungrouped.length}
							<div class="account-list">
								{#each ungrouped as account (account.id)}
									<AccountRow
										{account}
										icon={icons[account.id]}
										{iconPicker}
										dragging={dragSrcId === account.id}
										dropPos={overId === account.id ? overPos : null}
										editing={editingAccountId === account.id}
										onDragStart={(e) => onDragStart(e, account.id)}
										onDragOver={(e) => onDragOver(e, account.id)}
										onDrop={(e) => onDrop(e, section.label, account.id, null, section.items)}
										onDragEnd={endDrag}
										onStartRename={() => (editingAccountId = account.id)}
										onCommitRename={(name) => commitAccountRename(account.id, name)}
										onCancelRename={() => (editingAccountId = null)}
										onContextMenu={(e) => openAccountMenu(e, account)}
										onRowMouseEnter={(e) => onAccountRowEnter(e, account)}
										onRowMouseLeave={hideHoverCard}
									/>
								{/each}
							</div>
						{/if}
						{#each groupsForSection(kind) as group (group.id)}
							{@const itemsInGroup = section.items.filter((a) => bucketOf(a) === group.id)}
							<div
								class="group-block"
								class:dragging={dragGroupId === group.id}
								class:drop-before={overBlock?.id === group.id && overBlock.pos === "before"}
								class:drop-after={overBlock?.id === group.id && overBlock.pos === "after"}
								ondragover={(e) => kind && onBlockDragOver(e, kind, group.id)}
								ondrop={(e) => kind && onBlockDrop(e, kind)}
								role="group"
								aria-label={group.label}
							>
								<GroupHeader
									{group}
									count={itemsInGroup.length}
									total={showGroupTotals && itemsInGroup.length
										? itemsInGroup.reduce((sum, a) => sum + a.balance, 0)
										: null}
									{budgetId}
									open={!collapsedGroups[group.id]}
									editing={editingGroupId === group.id}
									dropActive={overGroupId === group.id}
									onToggleOpen={() => toggleGroup(group.id)}
									onStartRename={() => (editingGroupId = group.id)}
									onCommitRename={(label) => commitRename(group.id, label)}
									onCancelRename={() => (editingGroupId = null)}
									onContextMenu={(e) => openGroupMenu(e, group)}
									onDragOver={(e) => onGroupDragOver(e, group.id)}
									onDrop={(e) => onGroupDrop(e, group.id)}
									onDragStart={(e) => onGroupDragStart(e, group.id)}
									onDragEnd={endGroupDrag}
								/>
								{#if !collapsedGroups[group.id]}
									{#if itemsInGroup.length}
										<div class="account-list indented">
											{#each itemsInGroup as account (account.id)}
												<AccountRow
													{account}
													icon={icons[account.id]}
													{iconPicker}
													dragging={dragSrcId === account.id}
													dropPos={overId === account.id ? overPos : null}
													editing={editingAccountId === account.id}
													onDragStart={(e) => onDragStart(e, account.id)}
													onDragOver={(e) => onDragOver(e, account.id)}
													onDrop={(e) =>
														onDrop(e, section.label, account.id, group.id, section.items)}
													onDragEnd={endDrag}
													onStartRename={() => (editingAccountId = account.id)}
													onCommitRename={(name) => commitAccountRename(account.id, name)}
													onCancelRename={() => (editingAccountId = null)}
													onContextMenu={(e) => openAccountMenu(e, account)}
													onRowMouseEnter={(e) => onAccountRowEnter(e, account)}
													onRowMouseLeave={hideHoverCard}
												/>
											{/each}
										</div>
									{:else}
										<div
											class="group-empty-hint"
											class:drop-before={overGroupId === group.id}
											ondragover={(e) => onGroupDragOver(e, group.id)}
											ondrop={(e) => onGroupDrop(e, group.id)}
											role="list"
										>
											Drop accounts here
										</div>
									{/if}
								{/if}
							</div>
						{/each}
					{/if}
				{/if}
			</div>
		{/each}
	</div>
</div>

{#if menuGroup}
	{@const g = menuGroup}
	<div use:portal class="ctx" style="top: {menuY}px; left: {menuX}px">
		<button
			type="button"
			class="ctx-item"
			onclick={() => {
				editingGroupId = g.id;
				closeMenu();
			}}
		>
			<span>Rename</span>
		</button>
		<div class="ctx-div"></div>
		<button type="button" class="ctx-item danger" onclick={() => ungroup(g)}>
			<span>Remove category</span>
		</button>
	</div>
{/if}

{#if menuAccount}
	{@const acc = menuAccount}
	<div use:portal class="ctx" style="top: {menuY}px; left: {menuX}px">
		<button
			type="button"
			class="ctx-item"
			onclick={() => {
				editingAccountId = acc.id;
				closeMenu();
			}}
		>
			<span>Rename</span>
		</button>
		<div class="ctx-div"></div>
		<button
			type="button"
			class="ctx-item danger"
			onclick={() => {
				onCloseAccount(acc.id);
				closeMenu();
			}}
		>
			<span>Close account</span>
		</button>
	</div>
{/if}

{#if hoverAccount}
	<AccountHoverCard account={hoverAccount} top={hoverTop} left={hoverLeft} flip={hoverFlip} />
{/if}

<style>
	/* Wraps .accounts (which scrolls) so split mode's custom scrollbar thumb
	   (see overlay-scrollbar.ts) has a non-scrolling element to be positioned
	   against — an absolutely positioned child of .accounts itself would scroll
	   away with the content it's meant to represent. */
	.accounts-viewport {
		position: relative;
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
	}
	.accounts {
		display: flex;
		flex-direction: column;
		gap: 9px;
		flex: 1 1 auto;
		min-height: 0;
		/* 8px overflows into the sidebar's right padding so the scrollbar lives
		   there instead of squeezing row content. */
		width: calc(100% + 8px);
		padding-right: 8px;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: var(--abt-ink-5) transparent;
		/* Pre-JS fallback — scrollFade (scroll-fade.ts) takes over, fading
		   whichever edge has more content past it instead of always the bottom. */
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
		background: var(--abt-ink-4);
		border-radius: var(--abt-radius);
		border: 2px solid transparent;
		background-clip: padding-box;
	}
	.accounts::-webkit-scrollbar-thumb:hover {
		background: var(--abt-ink-5);
		background-clip: padding-box;
	}
	.all-accounts {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		box-sizing: border-box;
		height: 32px;
		padding: 6px;
		padding-inline: 8px;
		border-radius: var(--abt-radius);
		flex-shrink: 0;
	}
	/* grouped/flat account layout toggle — swaps in over the total on hover,
	   same slot/pattern as .section-add for the category rows */
	.group-toggle {
		position: absolute;
		right: 4px;
		top: 50%;
		padding: 0px !important;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: var(--abt-radius-sm);
		color: var(--abt-ink-5);
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 0.12s ease,
			background 0.12s ease,
			color 0.12s ease;
	}
	.all-accounts:hover .group-toggle,
	.all-accounts:hover .header-add {
		opacity: 1;
		pointer-events: auto;
	}
	.header-add {
		position: absolute;
		right: 28px;
		top: 50%;
		padding: 0px !important;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: var(--abt-radius-sm);
		color: var(--abt-soft);
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 0.12s ease,
			background 0.12s ease,
			color 0.12s ease;
	}
	.header-add:hover {
		background: var(--abt-ink-4);
		color: var(--abt-ink);
	}
	.header-add :global(svg) {
		width: 15px;
		height: 15px;
	}
	.group-toggle:hover {
		background: var(--abt-ink-4);
		color: var(--abt-ink);
	}
	.group-toggle.on {
		color: var(--abt-accent);
	}
	.group-toggle :global(svg) {
		width: 15px;
		height: 15px;
	}
	.section {
		display: flex;
		flex-direction: column;
		gap: 1px;
		width: 100%;
	}
	/* section caret = dedicated collapse button */
	.caret-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin: -2px 0;
		height: 16px;
		width: 16px;
		border-radius: var(--abt-radius-sm);
		cursor: pointer;
		transition: background 0.12s ease;
	}
	/* same left inset as the account rows, so the caret sits over their status dots */
	:global(.sidebar:not(.split)) .section-head {
		padding-left: 5px;
	}
	.caret-btn:hover {
		background: var(--abt-ink-5);
	}
	/* whole section header row navigates; caret (above) is the collapse sub-control */
	.section-head {
		cursor: default;
	}
	.section-head:hover {
		background: var(--abt-ink-3);
	}
	.section-head.active {
		background: var(--abt-accent-2);
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
	.section-nav :global(.group-total) {
		margin-left: auto;
	}
	.section-nav .group-label {
		flex: 0 0 auto;
	}
	.section-head.active .group-label {
		color: var(--abt-accent);
	}
	/* All Accounts reads as the top-level view, not a category — sentence case,
	   brighter than the muted uppercase category labels */
	.all-accounts .group-label {
		font-size: var(--abt-text-md);
		font-weight: 600;
		letter-spacing: 0.42px;
		text-transform: none;
		color: var(--abt-ink);
	}
	.accounts :global(.group-total) {
		font-size: var(--abt-text-base);
		font-weight: 500;
		letter-spacing: 0.125px;
		text-transform: uppercase;
		color: var(--abt-ink);
		font-variant-numeric: tabular-nums;
	}
	.account-list {
		display: flex;
		flex-direction: column;
		gap: 0px;
		width: 100%;
	}
	/* Centres a nested row's status dot between its sub-category's caret and label. */
	.group-block {
		position: relative;
	}
	.group-block.dragging {
		opacity: 0.4;
	}
	.group-block.drop-before::after,
	.group-block.drop-after::after {
		content: "";
		position: absolute;
		left: 8px;
		right: 8px;
		height: 2px;
		border-radius: 2px;
		background: var(--abt-accent);
		box-shadow: 0 0 4px var(--abt-accent-4);
		pointer-events: none;
	}
	.group-block.drop-before::after {
		top: -1px;
	}
	.group-block.drop-after::after {
		bottom: -1px;
	}
	.account-list.indented {
		padding-left: 9.5px;
	}
	/* Split layout: the indent has to live inside the row (padding), not on
	   the list container, otherwise a selected nested row's background would
	   stop 9px short of the panel's left edge instead of reaching it like its
	   unindented siblings. */
	:global(.split) .account-list.indented {
		padding-left: 0;
	}
	:global(.split) .all-accounts {
		border-radius: 0;
		margin-bottom: -0.75rem;
		padding-left: 11px;
		padding-right: calc(8px + var(--sb-panel-room));
	}
	:global(.split) .group-toggle,
	:global(.split) .section-add {
		right: calc(4px + var(--sb-panel-room));
	}
	:global(.split) .header-add {
		right: calc(28px + var(--sb-panel-room));
	}
	:global(.split) .accounts {
		width: 100%;
		margin-left: 0;
		padding-left: 0;
		padding-right: 0;
		/* Native scrollbar fully hidden — overlay-scrollbar.ts draws a themed one
		   that never reserves layout width, since no combination of
		   scrollbar-width/-color gets Firefox to do that natively (see
		   overlay-scrollbar.ts). */
		scrollbar-width: none;
	}
	:global(.split) .accounts::-webkit-scrollbar {
		display: none;
	}
	/* ===== category (sub-group) management ===== */
	/* hover "+" on a section header — swapped with the total, so no layout shift */
	.section-add {
		/* Firefox's default button padding would squeeze the icon below its size. */
		padding: 0;
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: var(--abt-radius-sm);
		color: var(--abt-soft);
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 0.12s ease,
			background 0.12s ease,
			color 0.12s ease;
	}
	.section-add :global(svg) {
		width: 15px;
		height: 15px;
	}
	.section-head:hover .section-add {
		opacity: 1;
		pointer-events: auto;
	}
	.section-add:hover {
		background: var(--abt-ink-4);
		color: var(--abt-ink);
	}
	/* hide the total on hover to make room for the row's hover-revealed button —
	   "add category" on the category rows, the grouped/flat toggle on All Accounts */
	.section-head :global(.group-total) {
		transition: opacity 0.12s ease;
	}
	.section-head:hover :global(.group-total) {
		opacity: 0;
	}
	/* empty category placeholder / drop zone */
	.group-empty-hint {
		margin: 2px 0 3px 14px;
		padding: 8px 10px;
		border: 1px dashed var(--abt-ink-2);
		border-radius: var(--abt-radius);
		font-size: var(--abt-text-base);
		font-weight: 500;
		color: var(--abt-subtle);
		text-align: center;
		transition:
			border-color 0.12s ease,
			color 0.12s ease,
			background 0.12s ease;
	}
	:global(.split) .group-empty-hint {
		margin-right: calc(8px + var(--sb-panel-room));
	}
	.group-empty-hint.drop-before {
		border-style: solid;
		border-color: var(--abt-accent);
		color: var(--abt-accent);
		background: var(--abt-accent-1);
	}
</style>
