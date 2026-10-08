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
