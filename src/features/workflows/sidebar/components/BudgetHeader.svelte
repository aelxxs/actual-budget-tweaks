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
			console.log(loadedFiles);
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
		console.log({ file });
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
