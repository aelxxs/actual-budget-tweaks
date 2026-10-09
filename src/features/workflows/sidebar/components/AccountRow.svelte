<script lang="ts">
	import type { AccountIconData } from "@features/appearance/account-icon-picker";
	import {
		getEmojiAssetUrl,
		removeAccountIcon,
		setAccountIcon,
	} from "@features/appearance/account-icon-picker";
	import IconPickerModal from "@features/appearance/account-icon-picker/Modal.svelte";
	import { closeCalendar, isCalendarOpen } from "@features/workflows/spending-calendar";
	import { navigate } from "@lib/utilities/actual-api";
	import { fmtMoney } from "@lib/utilities/currency";
	import { watchDom } from "@lib/utilities/dom-watcher";
	import { Smile } from "lucide-svelte";
	import { mount, unmount } from "svelte";
	import { autofocus } from "../actions/autofocus";
	import { tooltip } from "../actions/tooltip.svelte";
	import type { SidebarAccount } from "../lib/data";
	import StatusIcon from "./StatusIcon.svelte";

	// See PrimaryNav.svelte for why this watches DOM mutations rather than
	// `watchRoute`/history — cross-world navigation isn't observable there.
	let tick = $state({});

	$effect(() => {
		return watchDom(() => (tick = {}));
	});

	const {
		account,
		icon,
		iconPicker = true,
		dragging = false,
		dropPos = null,
		editing = false,
		onDragStart,
		onDragOver,
		onDrop,
		onDragEnd,
		onStartRename,
		onCommitRename,
		onCancelRename,
		onContextMenu,
		onRowMouseEnter,
		onRowMouseLeave,
	}: {
		account: SidebarAccount;
		icon: AccountIconData | undefined;
		iconPicker?: boolean;
		dragging?: boolean;
		dropPos?: "before" | "after" | null;
		editing?: boolean;
		onDragStart?: (e: DragEvent) => void;
		onDragOver?: (e: DragEvent) => void;
		onDrop?: (e: DragEvent) => void;
		onDragEnd?: () => void;
		onStartRename?: () => void;
		onCommitRename?: (name: string) => void;
		onCancelRename?: () => void;
		onContextMenu?: (e: MouseEvent) => void;
		onRowMouseEnter?: (e: MouseEvent) => void;
		onRowMouseLeave?: () => void;
	} = $props();

	// Inline rename (triggered from AccountList's right-click context menu),
	// matching GroupHeader's editing pattern.
	let editValue = $state(account.name);

	function onRenameKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			onCommitRename?.(editValue);
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			onCancelRename?.();
		}
	}

	// Overrides the `icon` prop once the user changes it here, so this row
	// reflects the change immediately without waiting for a full reload of
	// the icon cache from the parent.
	let iconOverride = $state<AccountIconData | null | undefined>(undefined);
	const effectiveIcon = $derived(
		!iconPicker ? undefined : iconOverride !== undefined ? iconOverride : icon,
	);

	// Reads `tick` so this recomputes on route change (see the watchDom effect
	// above) without needing a `{#key}` block, which would tear down and
	// recreate this row's DOM on every tick — itself a mutation the shared
	// watchDom observer would see, re-triggering forever.
	const isSelected = $derived.by(() => {
		void tick;
		return location.pathname === `/accounts/${account.id}`;
	});

	function open() {
		if (isCalendarOpen()) closeCalendar();
		navigate(`/accounts/${account.id}`);
	}

	function openIconPicker(anchorRect: DOMRect) {
		if (document.querySelector('[data-abt-modal="experimental-icon-picker"]')) return;

		const container = document.createElement("div");
		container.dataset.abtModal = "experimental-icon-picker";

		let done = false;
		const cleanup = () => {
			if (done) return;
			done = true;
			unmount(instance);
			container.remove();
		};

		const instance = mount(IconPickerModal, {
			target: container,
			props: {
				accountId: account.id,
				accountName: account.name,
				hasIcon: Boolean(effectiveIcon),
				anchorRect,
				onSave: async (iconData: AccountIconData) => {
					await setAccountIcon(account.id, iconData);
					iconOverride = iconData;
					cleanup();
				},
				onRemove: async () => {
					await removeAccountIcon(account.id);
					iconOverride = null;
					cleanup();
				},
				onClose: cleanup,
			},
		});

		document.body.appendChild(container);
	}
</script>

{#if editing}
	<div class="account editing">
		<StatusIcon status={account.status} />
		{#if effectiveIcon}
			<span class="acct-icon">
				{#if effectiveIcon.type === "emoji"}
					<img
						class="acct-icon-img"
						src={getEmojiAssetUrl(effectiveIcon.value)}
						alt={effectiveIcon.value}
					/>
				{:else}
					<img class="acct-icon-img" src={effectiveIcon.value} alt="" />
				{/if}
			</span>
		{/if}
		<input
			class="account-rename"
			use:autofocus
			bind:value={editValue}
			onkeydown={onRenameKeydown}
			onblur={() => onCommitRename?.(editValue)}
		/>
	</div>
{:else}
	<button
		type="button"
		class="account"
		class:dragging
		class:selected={isSelected}
		class:drop-before={dropPos === "before"}
		class:drop-after={dropPos === "after"}
		draggable="true"
		onclick={open}
		ondblclick={() => {
			editValue = account.name;
			onStartRename?.();
		}}
		oncontextmenu={onContextMenu}
		ondragstart={onDragStart}
		ondragover={onDragOver}
		ondrop={onDrop}
		ondragend={onDragEnd}
		onmouseenter={onRowMouseEnter}
		onmouseleave={onRowMouseLeave}
	>
		{#if !iconPicker}
			<StatusIcon status={account.status} />
		{:else}
			<span
				class="acct-glyph"
				class:has-icon={!!effectiveIcon}
				role="button"
				tabindex="-1"
				aria-label="Change icon"
				use:tooltip={{ text: "Change icon", placement: "right" }}
				onclick={(e) => {
					e.stopPropagation();
					openIconPicker((e.currentTarget as HTMLElement).getBoundingClientRect());
				}}
				onkeydown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						e.stopPropagation();
						openIconPicker((e.currentTarget as HTMLElement).getBoundingClientRect());
					}
				}}
			>
				<StatusIcon status={account.status} />
				{#if effectiveIcon}
					<span class="acct-icon">
						{#if effectiveIcon.type === "emoji"}
							<img
								class="acct-icon-img"
								src={getEmojiAssetUrl(effectiveIcon.value)}
								alt={effectiveIcon.value}
							/>
						{:else}
							<img class="acct-icon-img" src={effectiveIcon.value} alt="" />
						{/if}
					</span>
				{/if}
				<span class="acct-glyph-edit" aria-hidden="true"><Smile strokeWidth={1.5} /></span>
			</span>
		{/if}
		<span class="account-name">{account.name}</span>
		{#if account.uncategorized > 0}
			<span class="account-uncat">{account.uncategorized}</span>
		{/if}
		<span class="account-amount abt-privacy-number" class:red={account.balance < 0}
			>{fmtMoney(account.balance)}</span
		>
	</button>
{/if}

<style>
	/* accounts nested under a sub-category sit a touch tighter */
	:global(.account-list.indented) .account {
		padding-block: calc(var(--sb-row-pad-y, 5px) - 2px);
	}
	:global(.split .account-list.indented) .account {
		padding-left: 22px;
	}
	.account {
		display: flex;
		align-items: center;
		gap: 5px;
		width: 100%;
		box-sizing: border-box;
		padding: var(--sb-row-pad-y, 5px) 8px var(--sb-row-pad-y, 5px) 5px;
		border-radius: var(--abt-radius);
		text-align: left;
		transition: background 0.12s ease;
	}
	.account:hover {
		background: var(--abt-ink-4);
	}
	.account.selected {
		background: var(--abt-accent-2);
	}
	.account.selected .account-name {
		color: var(--abt-accent);
	}
	:global(.split) .account {
		border-radius: 0;
		padding-left: 8px;
		padding-right: calc(8px + var(--sb-panel-room));
	}
	.account-name {
		flex: 1 1 auto;
		font-size: var(--abt-text-md);
		font-weight: 500;
		letter-spacing: 0.145px;
		color: var(--abt-ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.account-amount {
		font-size: var(--abt-text-base);
		font-weight: 400;
		letter-spacing: 0.14px;
		text-transform: uppercase;
		color: var(--abt-soft);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}
	/* count of uncategorized transactions — amber like the "syncing" status dot,
		   since both signal "needs your attention" rather than a neutral fact */
	.account-uncat {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 15px;
		padding: 0 5px;
		border-radius: var(--abt-radius-pill);
		background: var(--sb-attention-muted);
		font-size: var(--abt-text-xs);
		font-weight: 700;
		letter-spacing: 0.2px;
		color: var(--sb-attention);
		font-variant-numeric: tabular-nums;
	}
	.account-amount.red {
		color: var(--sb-danger);
	}
	/* ===== drag reorder ===== */
	.account {
		position: relative;
	}
	.account.dragging {
		opacity: 0.4;
	}
	/* blue insertion line above/below the drop target */
	.account.drop-before::after,
	.account.drop-after::after {
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
	.account.drop-before::after {
		top: -1px;
	}
	.account.drop-after::after {
		bottom: -1px;
	}
	/* inline account rename */
	.account.editing {
		display: flex;
		align-items: center;
		gap: 5px;
		width: 100%;
		box-sizing: border-box;
		padding: var(--sb-row-pad-y, 5px) 8px var(--sb-row-pad-y, 5px) 5px;
		border-radius: var(--abt-radius);
		background: var(--abt-accent-1);
	}
	.account-rename {
		flex: 1 1 auto;
		min-width: 0;
		font-family: inherit;
		font-size: var(--abt-text-md);
		font-weight: 500;
		letter-spacing: 0.145px;
		color: var(--abt-ink);
		background: var(--sb-canvas);
		border: 1px solid var(--abt-accent);
		border-radius: var(--abt-radius-sm);
		padding: 2px 6px;
		outline: none;
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
		color: var(--abt-soft);
		opacity: 0;
		transition:
			opacity 0.1s ease,
			color 0.1s ease;
		pointer-events: none;
	}
	.acct-glyph-edit :global(svg) {
		width: 15px;
		height: 15px;
	}
	/* accounts WITHOUT an icon: cross-fade the status dot to the "add icon" affordance */
	.account:hover .acct-glyph:not(.has-icon) :global(.status) {
		opacity: 0;
	}
	.account:hover .acct-glyph:not(.has-icon) .acct-glyph-edit {
		opacity: 1;
	}
	.acct-glyph:not(.has-icon):hover .acct-glyph-edit {
		color: var(--abt-ink);
	}
	/* accounts WITH an icon: keep it visible, just give it a subtle clickable highlight */
	.acct-glyph.has-icon .acct-icon {
		border-radius: var(--abt-radius-sm);
		transition: background 0.1s ease;
	}
	.acct-glyph.has-icon:hover .acct-icon {
		background: var(--abt-ink-5);
	}
</style>
