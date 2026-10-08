<script lang="ts">
	import { ChevronDown } from "lucide-svelte";
	import { autofocus } from "../actions/autofocus";
	import type { AccountGroup } from "../lib/groups";

	const {
		group,
		count,
		open,
		editing,
		dropActive = false,
		onToggleOpen,
		onStartRename,
		onCommitRename,
		onCancelRename,
		onContextMenu,
		onDragOver,
		onDrop,
	}: {
		group: AccountGroup;
		count: number;
		open: boolean;
		editing: boolean;
		dropActive?: boolean;
		onToggleOpen: () => void;
		onStartRename: () => void;
		onCommitRename: (label: string) => void;
		onCancelRename: () => void;
		onContextMenu: (e: MouseEvent) => void;
		onDragOver: (e: DragEvent) => void;
		onDrop: (e: DragEvent) => void;
	} = $props();

	let editValue = $state(group.label);

	function startEdit() {
		editValue = group.label;
		onStartRename();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			onCommitRename(editValue);
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			onCancelRename();
		}
	}
</script>

{#if editing}
	<div class="group-header sub editing-group">
		<ChevronDown class="caret" color="var(--abt-ink-5)" strokeWidth={3} />
		<input
			class="group-rename"
			use:autofocus
			bind:value={editValue}
			onkeydown={onKeydown}
			onblur={() => onCommitRename(editValue)}
		/>
	</div>
{:else}
	<button
		type="button"
		class="group-header sub toggleable"
		class:drop-before={dropActive}
		class:collapsed={!open}
		onclick={onToggleOpen}
		ondblclick={startEdit}
		oncontextmenu={onContextMenu}
		ondragover={onDragOver}
		ondrop={onDrop}
	>
		<ChevronDown
			class={open ? "caret" : "caret collapsed"}
			color="var(--abt-ink-5)"
			strokeWidth={3}
		/>
		<span class="group-label sub-label">{group.label}</span>
		{#if count}<span class="group-count sub-count">{count}</span>{/if}
	</button>
{/if}

<style>
	.group-header.sub {
		padding-block: calc(var(--sb-row-pad-y, 5px) - 2px);
		padding-left: 16px;
		transition:
			background-color 0.3s ease,
			color 0.3s ease;
	}
	:global(.sidebar) .group-header.sub:hover {
		background: transparent;
		color: var(--abt-soft);
	}
	.group-header.sub:hover :global(*) {
		color: var(--abt-soft);
	}
	:global(.sidebar) .sub-label {
		flex: 0 1 auto;
		font-size: var(--abt-text-sm);
		letter-spacing: 0.115px;
		color: var(--abt-ink-5);
	}
	/* sub-category counts appear on hover, or always once collapsed (no rows
	   visible underneath to show the count some other way) */
	.sub-count {
		opacity: 0;
		transition: opacity 0.12s ease;
	}
	.group-header.sub.toggleable:hover .sub-count,
	.group-header.sub.toggleable.collapsed .sub-count {
		opacity: 1;
	}
	.group-header.sub.toggleable {
		position: relative;
	}
	.group-header.drop-before::after {
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
	.group-header.drop-before::after {
		top: -1px;
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
		font-size: var(--abt-text-sm);
		font-weight: 600;
		letter-spacing: 0.115px;
		text-transform: uppercase;
		color: var(--abt-ink);
		background: var(--sb-canvas);
		border: 1px solid var(--abt-accent);
		border-radius: var(--abt-radius-sm);
		padding: 2px 6px;
		outline: none;
	}
</style>
