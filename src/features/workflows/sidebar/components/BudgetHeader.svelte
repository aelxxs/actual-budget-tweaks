<script lang="ts">
	import type { IconPickerResult } from "@lib/components/IconPickerPopover.svelte";
	import IconPickerPopover from "@lib/components/IconPickerPopover.svelte";
	import {
		Check,
		ChevronsUpDown,
		CloudCheck,
		CloudDownload,
		CloudOff,
		LogOut,
		Pencil,
	} from "lucide-svelte";
	import { onMount } from "svelte";
	import { autofocus } from "../actions/autofocus";
	import { tooltip } from "../actions/tooltip.svelte";
	import type { BudgetFile, BudgetIcon, FileState } from "../lib/budgets";
	import {
		closeToFileList,
		loadBudgetFiles,
		loadBudgetIcon,
		loadCurrentBudgetId,
		removeBudgetIcon,
		renameBudget,
		selectBudgetFile,
		setBudgetIcon,
	} from "../lib/budgets";

	const {
		name,
		showBudgetIcon = true,
		onBudgetChange,
	}: { name: string; showBudgetIcon?: boolean; onBudgetChange?: () => void } = $props();

	// Writable $derived: re-syncs to `name` whenever the prop changes, but the
	// rename handler below can still assign it locally in the meantime.
	let displayName = $derived(name);

	let open = $state(false);
	let editing = $state(false);
	let editValue = $state("");
	let files = $state<BudgetFile[]>([]);
	let currentId = $state<string | undefined>(undefined);
	let filesLoaded = $state(false);

	let icon = $state<BudgetIcon | undefined>(undefined);
	let iconBtnEl = $state<HTMLButtonElement | HTMLSpanElement | undefined>(undefined);
	let iconPickerOpen = $state(false);
	let iconAnchorRect = $state<DOMRect | undefined>(undefined);

	const budgetInitials = $derived(
		displayName
			.split(/\s+/)
			.map((w) => w[0])
			.join("")
			.slice(0, 2)
			.toUpperCase(),
	);

	const currentFile = $derived(files.find((f) => f.id === currentId));

	onMount(async () => {
		try {
			const [id, loadedFiles] = await Promise.all([loadCurrentBudgetId(), loadBudgetFiles()]);
			currentId = id;
			files = loadedFiles;
			filesLoaded = true;
			if (id) icon = await loadBudgetIcon(id);
		} catch (err) {
			console.error("[ABT experimental sidebar] failed to load budget header data", err);
		} finally {
			filesLoaded = true;
		}
	});

	function openIconPicker(): void {
		if (!iconBtnEl) return;
		iconAnchorRect = iconBtnEl.getBoundingClientRect();
		iconPickerOpen = true;
	}

	async function handleIconSelect(result: IconPickerResult): Promise<void> {
		icon = result;
		iconPickerOpen = false;
		if (currentId) await setBudgetIcon(currentId, result);
	}

	async function handleIconRemove(): Promise<void> {
		icon = undefined;
		iconPickerOpen = false;
		if (currentId) await removeBudgetIcon(currentId);
	}

	const STATE_LABEL: Record<FileState, string> = {
		local: "Local only",
		remote: "Available to download",
		synced: "Synced",
		detached: "Sync detached",
		broken: "No access",
		unknown: "Offline",
	};

	// Compact caption for the trigger card — a "synced" file is both on disk
	// and kept in sync with the cloud, so it's worth spelling out both halves
	// (unlike the single-word labels above used for each row in the menu).
	const STATUS_CAPTION: Record<FileState, string> = {
		local: "Local",
		remote: "Remote · not downloaded",
		synced: "Local · synced",
		detached: "Local · sync detached",
		broken: "Local · no access",
		unknown: "Offline",
	};

	function stateIcon(state: FileState) {
		if (state === "synced") return CloudCheck;
		if (state === "remote") return CloudDownload;
		return CloudOff;
	}

	async function openMenu() {
		open = true;
		editing = false;
		try {
			const [loadedFiles, id] = await Promise.all([loadBudgetFiles(), loadCurrentBudgetId()]);
			files = loadedFiles;
			currentId = id;
		} catch (err) {
			console.error("[ABT experimental sidebar] failed to load budget files", err);
			files = [];
		}
	}

	function closeMenu() {
		open = false;
		editing = false;
	}

	function startEdit() {
		editValue = displayName;
		editing = true;
	}

	async function commitEdit() {
		const value = editValue.trim();
		if (value && value !== displayName) {
			await renameBudget(value);
			displayName = value;
		}
		editing = false;
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			commitEdit();
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			editing = false;
		}
	}

	async function onSelectFile(file: BudgetFile) {
		if (file.state === "broken") return;
		if (file.id && file.id === currentId) {
			closeMenu();
			return;
		}
		closeMenu();
		await selectBudgetFile(file);
		onBudgetChange?.();
	}

	async function onCloseFile() {
		closeMenu();
		await closeToFileList();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === "Escape" && open && !editing) closeMenu();
	}
</script>

<svelte:window onclick={closeMenu} onkeydown={onWindowKeydown} />

{#snippet fileStatus()}
	{#if currentFile}
		{@const StatusIcon = stateIcon(currentFile.state)}
		<span class="budget-select-status">
			<StatusIcon strokeWidth={1.5} />
			{STATUS_CAPTION[currentFile.state]}
		</span>
	{:else if !filesLoaded}
		<!-- Zero-width space gives the placeholder the caption's line height. -->
		<span class="budget-select-status" aria-hidden="true"
			><span class="skel-status"></span>&#8203;</span
		>
	{/if}
{/snippet}

{#snippet iconContent()}
	{#if icon?.type === "emoji"}
		<span class="budget-icon-emoji">{icon.value}</span>
	{:else if icon}
		<img class="budget-icon-img" src={icon.value} alt="" />
	{:else}
		{budgetInitials}
	{/if}
{/snippet}

{#snippet iconButton()}
	<button
		type="button"
		class="budget-icon-btn budget-icon-btn--lg"
		class:has-icon={!!icon}
		bind:this={iconBtnEl}
		aria-label="Change budget icon"
		use:tooltip={"Change budget icon"}
		onclick={(e) => {
			e.stopPropagation();
			openIconPicker();
		}}
	>
		{@render iconContent()}
	</button>
{/snippet}

<!-- Stops any click inside the widget (including the rename input) from
     bubbling to the window listener above, which would otherwise close the
     dropdown / exit rename-mode on every internal click. Not an interactive
     element itself, just an event-bubbling guard. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="budget" onclick={(e) => e.stopPropagation()}>
	{#if !open}
		<button
			type="button"
			class="budget-select"
			onclick={(e) => {
				e.stopPropagation();
				openMenu();
			}}
		>
			<!-- Not a real <button> — it lives inside the .budget-select button
			     itself (nested buttons aren't valid HTML), so it's a span made
			     keyboard-operable instead. -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			{#if showBudgetIcon}
				<span
					class="budget-icon-btn budget-icon-btn--lg"
					class:has-icon={!!icon}
					bind:this={iconBtnEl}
					role="button"
					tabindex="0"
					aria-label="Change budget icon"
					use:tooltip={"Change budget icon"}
					onclick={(e) => {
						e.stopPropagation();
						openIconPicker();
					}}
					onkeydown={(e) => {
						if (e.key !== "Enter" && e.key !== " ") return;
						e.preventDefault();
						e.stopPropagation();
						openIconPicker();
					}}
				>
					{@render iconContent()}
				</span>
			{/if}

			<span class="budget-select-text">
				<span class="budget-name">{displayName}</span>
				{@render fileStatus()}
			</span>
			<ChevronsUpDown class="chevron-updown" />
		</button>
	{:else}
		<div class="budget-header" class:editing>
			{#if showBudgetIcon}
				{@render iconButton()}
			{/if}
			<div class="budget-select-text">
				{#if editing}
					<input
						class="budget-edit"
						use:autofocus
						bind:value={editValue}
						onkeydown={onEditKeydown}
						onblur={commitEdit}
					/>
				{:else}
					<!-- Same trigger as the closed state, just re-clicked to close —
					     renaming only happens via the explicit pencil button below,
					     never by clicking the name itself. -->
					<button
						type="button"
						class="budget-name-btn"
						onclick={(e) => {
							e.stopPropagation();
							closeMenu();
						}}
					>
						<span class="budget-name">{displayName}</span>
					</button>
					{@render fileStatus()}
				{/if}
			</div>
			<button
				type="button"
				class="budget-edit-btn"
				aria-label={editing ? "Save budget name" : "Rename budget"}
				onclick={(e) => {
					e.stopPropagation();
					if (editing) commitEdit();
					else startEdit();
				}}
			>
				{#if editing}
					<Check strokeWidth={2.4} />
				{:else}
					<Pencil />
				{/if}
			</button>
		</div>
		<div class="budget-menu" onclick={(e) => e.stopPropagation()}>
			{#each files as file, i (file.id ?? file.cloudFileId ?? i)}
				{@const isActive = !!file.id && file.id === currentId}
				{@const Icon = stateIcon(file.state)}
				<button
					type="button"
					class="budget-item"
					class:active={isActive}
					onclick={() => onSelectFile(file)}
				>
					<span class="budget-dot" class:active={isActive}></span>
					<span class="budget-item-name">{file.name}</span>
					<span
						class="budget-state"
						aria-label={STATE_LABEL[file.state]}
						use:tooltip={{ text: STATE_LABEL[file.state], placement: "left" }}
					>
						<Icon strokeWidth={1.5} />
					</span>
				</button>
			{/each}
			<div class="budget-menu-divider"></div>
			<button type="button" class="budget-exit" onclick={onCloseFile}>
				<LogOut strokeWidth={1.5} />
				<span>Close file</span>
			</button>
		</div>
	{/if}

	{#if iconPickerOpen && iconAnchorRect}
		<IconPickerPopover
			anchorRect={iconAnchorRect}
			hasIcon={!!icon}
			onSelect={handleIconSelect}
			onRemove={icon ? handleIconRemove : undefined}
			onClose={() => (iconPickerOpen = false)}
		/>
	{/if}
</div>

<style>
	.budget {
		position: relative;
		width: 100%;
		flex-shrink: 0;
	}
	.budget-select {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 3.75rem;
		box-sizing: border-box;
		padding: 0.75rem;
		/* transparent border matches the expanded header exactly → no layout shift */
		border-bottom: 1px solid var(--abt-ink-2);
		text-align: left;
		transition:
			background 0.12s ease,
			border-color 0.12s ease;
	}
	.budget-select:hover {
		background: var(--sb-surface);
		border-color: var(--abt-ink-2);
	}
	.budget-select-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1 1 auto;
		min-width: 0;
	}
	.budget-select-status {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--abt-text-sm);
		font-weight: 500;
		color: var(--abt-soft);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.budget-select-status :global(svg) {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
	}
	.budget-name {
		font-size: var(--abt-text-lg);
		font-weight: 600;
		letter-spacing: 0.1px;
		/* Actual has a dedicated token for exactly this label, unlike the rest
		   of the sidebar (which reuses --sb-fg / sidebarItemText). */
		color: var(--color-sidebarBudgetName, var(--abt-ink));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.budget-select :global(.chevron-updown) {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		color: var(--abt-soft);
	}
	.budget-select:hover :global(.chevron-updown) {
		color: var(--abt-ink);
	}

	/* Expanded budget switcher — same blended-into-sidebar chrome as
	   .budget-select (same height/padding/bottom border/icon size) so opening
	   the switcher or entering rename mode doesn't change the header's look,
	   only its trailing control (chevron → pencil/check) and its text (name →
	   input). */
	.budget-header {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 3.75rem;
		box-sizing: border-box;
		padding: 0.75rem;
		border-bottom: 1px solid var(--abt-ink-2);
	}
	:global(.split-panel) .budget-select,
	:global(.split-panel) .budget-header {
		padding-right: calc(0.75rem + var(--sb-panel-room));
	}

	/* Budget icon (default: initials, matches .rail-avatar; customizable via the
	   same icon picker used for accounts) */
	.budget-icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 26px;
		height: 26px;
		border-radius: var(--abt-radius);
		background: linear-gradient(135deg, var(--abt-accent), var(--abt-accent));
		color: #fff;
		font-size: var(--abt-text-xs);
		font-weight: 800;
		letter-spacing: 0.2px;
		overflow: hidden;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.budget-icon-btn:hover {
		filter: brightness(1.12);
	}
	.budget-icon-btn.has-icon {
		background: var(--abt-ink-3);
		color: var(--abt-ink);
	}
	.budget-icon-btn--lg {
		width: 32px;
		height: 32px;
		border-radius: var(--abt-radius);
		font-size: 15px;
	}
	.budget-icon-btn--lg .budget-icon-emoji {
		font-size: 21px;
	}
	.budget-icon-emoji {
		font-size: var(--abt-text-lg);
		line-height: 1;
	}
	.budget-icon-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.budget-name-btn {
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		padding: 1px 4px;
		margin: -1px -4px;
		border-radius: var(--abt-radius-sm);
		text-align: left;
		transition: background 0.12s ease;
	}
	.budget-edit {
		width: 100%;
		box-sizing: border-box;
		font-family: inherit;
		font-size: var(--abt-text-lg);
		font-weight: 600;
		letter-spacing: 0.1px;
		color: var(--abt-ink);
		background: var(--sb-canvas);
		border: 1px solid var(--abt-ink-2);
		border-radius: var(--abt-radius-sm);
		padding: 3px 7px;
		margin: -3px -7px;
		outline: none;
	}
	.budget-edit:focus {
		border-color: var(--abt-accent);
	}
	.budget-edit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		border-radius: var(--abt-radius-sm);
		color: var(--abt-soft);
		transition:
			color 0.12s ease,
			background 0.12s ease;
	}
	.budget-edit-btn:hover {
		color: var(--abt-ink);
		background: var(--abt-ink-2);
	}
	.budget-edit-btn :global(svg) {
		width: 14px;
		height: 14px;
	}
	.budget-menu {
		position: absolute;
		top: calc(100% + -1px);
		left: 0;
		right: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 2px;
		box-sizing: border-box;
		padding: 5px;
		background: var(--sb-bg);
		border: 1px solid var(--abt-ink-2);
		border-radius: 0px;
		border-inline: 0px;

		box-shadow: 0 8px 24px var(--sb-shadow-2);
		transform-origin: top;
		animation: bmenu-in 0.14s cubic-bezier(0.2, 0.9, 0.3, 1);
	}
	@keyframes bmenu-in {
		from {
			opacity: 0;
			transform: translateY(-6px) scale(0.98);
		}
	}
	.budget-item {
		display: flex;
		align-items: center;
		gap: 9px;
		width: 100%;
		box-sizing: border-box;
		padding: 6px 8px;
		border-radius: var(--abt-radius-sm);
		text-align: left;
		transition: background 0.12s ease;
	}
	.budget-item:hover {
		background: var(--abt-ink-2);
	}
	.budget-item.active {
		background: var(--abt-accent-2);
	}
	.budget-item-name {
		flex: 1 1 auto;
		font-size: var(--abt-text-md);
		font-weight: 500;
		letter-spacing: 0.13px;
		color: var(--abt-ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.budget-item.active .budget-item-name {
		color: var(--abt-accent);
	}
	/* left dot: green marks the active budget, muted otherwise */
	.budget-dot {
		flex-shrink: 0;
		width: 6px;
		height: 6px;
		margin: 0 1px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-soft);
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
		color: var(--abt-soft);
	}
	.budget-state :global(svg) {
		width: 15px;
		height: 15px;
	}
	.budget-menu-divider {
		height: 1px;
		margin: 4px 6px;
		background: var(--abt-ink-2);
	}
	.budget-exit {
		display: flex;
		align-items: center;
		gap: 9px;
		width: 100%;
		box-sizing: border-box;
		padding: 6px 8px;
		border-radius: var(--abt-radius-sm);
		text-align: left;
		color: var(--abt-soft);
		transition:
			background 0.12s ease,
			color 0.12s ease;
	}
	.budget-exit:hover {
		background: var(--abt-ink-2);
		color: var(--abt-ink);
	}
	.budget-exit :global(svg) {
		flex-shrink: 0;
		width: 15px;
		height: 15px;
	}
	.budget-exit span {
		font-size: var(--abt-text-md);
		font-weight: 500;
		letter-spacing: 0.13px;
	}

	.skel-status {
		width: 72px;
		height: 8px;
		border-radius: var(--abt-radius-pill);
		background: var(--abt-ink-3);
	}
	.skel-status {
		animation: skel-pulse 1.4s ease-in-out infinite;
	}
</style>
