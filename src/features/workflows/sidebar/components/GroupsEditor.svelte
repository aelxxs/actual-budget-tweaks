<script lang="ts">
	import { GripVertical, Info, Plus, X } from "@lucide/svelte";
	import { onMount, tick } from "svelte";
	import { onListChange, query } from "@lib/utilities/actual-api";
	import type { Account } from "@lib/types/actual-schema";
	import type { AccountGroup, GroupState, Section } from "../lib/groups";
	import {
		addGroup,
		deleteGroup,
		groupOf,
		groupsIn,
		importGroups,
		moveGroup,
		removeGroup,
		renameGroup,
		renameGroupTo,
		reorderGroups,
		watchGroupState,
	} from "../lib/groups";

	const { budgetId }: { budgetId: string | undefined } = $props();

	const SECTIONS: { kind: Section; label: string }[] = [
		{ kind: "onbudget", label: "On budget" },
		{ kind: "offbudget", label: "Off budget" },
	];

	let groupState = $state<GroupState>({
		groups: {},
		assignments: {},
		native: false,
		importable: false,
	});
	let accounts = $state<Pick<Account, "id" | "offbudget" | "closed">[]>([]);
	let importing = $state(false);
	let listEl: HTMLDivElement;

	onMount(() => {
		const loadAccounts = () =>
			void query<Pick<Account, "id" | "offbudget" | "closed" | "tombstone">[]>("accounts", {
				select: ["id", "offbudget", "closed", "tombstone"],
			}).then((rows) => (accounts = rows.filter((a) => !a.tombstone)));
		loadAccounts();
		const stopGroups = watchGroupState(budgetId, (next) => (groupState = next));
		const stopAccounts = onListChange("accounts", loadAccounts);
		return () => {
			stopGroups();
			stopAccounts();
		};
	});

	function inSection(kind: Section): AccountGroup[] {
		return groupsIn(kind, groupState, accounts);
	}

	function accountCount(id: string, kind: Section): number {
		return accounts.filter(
			(a) =>
				!a.closed &&
				(a.offbudget ? "offbudget" : "onbudget") === kind &&
				groupOf(a, groupState.assignments, groupState.groups) === id,
		).length;
	}

	async function add(kind: Section) {
		const id = await addGroup(budgetId, groupState, kind);
		await tick();
		const input = listEl.querySelector<HTMLInputElement>(`[data-group="${id}"]`);
		input?.focus();
		input?.select();
	}

	function rename(id: string, label: string) {
		const prev = groupState;
		groupState = { ...prev, groups: renameGroup(prev.groups, id, label) };
		void renameGroupTo(budgetId, prev, id, label);
	}

	function remove(id: string) {
		const prev = groupState;
		groupState = { ...prev, ...removeGroup(prev.groups, prev.assignments, id) };
		void deleteGroup(budgetId, prev, id);
	}

	function reorder(kind: Section, id: string, beforeId: string | null) {
		const prev = groupState;
		const reordered = reorderGroups(inSection(kind), id, beforeId);
		groupState = {
			...prev,
			groups: { ...prev.groups, ...Object.fromEntries(reordered.map((g) => [g.id, g])) },
		};
		void moveGroup(budgetId, prev, reordered, id, beforeId);
	}

	let drag = $state<{ kind: Section; id: string } | null>(null);
	let over = $state<{ id: string; pos: "before" | "after" } | null>(null);

	function onDragStart(e: DragEvent, kind: Section, id: string) {
		drag = { kind, id };
		const row = (e.currentTarget as HTMLElement).closest(".row");
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", id);
			if (row) {
				e.dataTransfer.setDragImage(row, 16, 16);
			}
		}
	}

	function onDragOver(e: DragEvent, kind: Section, id: string) {
		if (drag?.kind !== kind) {
			return;
		}
		e.preventDefault();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		over =
			id === drag.id
				? null
				: { id, pos: e.clientY < rect.top + rect.height / 2 ? "before" : "after" };
	}

	function onDrop(e: DragEvent, kind: Section) {
		if (drag?.kind !== kind) {
			return;
		}
		e.preventDefault();
		const { id } = drag;
		const target = over;
		endDrag();
		if (!target) {
			return;
		}
		const rest = inSection(kind).filter((g) => g.id !== id);
		const at = rest.findIndex((g) => g.id === target.id) + (target.pos === "after" ? 1 : 0);
		reorder(kind, id, rest[at]?.id ?? null);
	}

	function endDrag() {
		drag = null;
		over = null;
	}

	async function onHandleKey(e: KeyboardEvent, kind: Section, id: string) {
		if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
			return;
		}
		e.preventDefault();
		const list = inSection(kind);
		const i = list.findIndex((g) => g.id === id);
		if (e.key === "ArrowUp" && i > 0) {
			reorder(kind, id, list[i - 1].id);
		} else if (e.key === "ArrowDown" && i < list.length - 1) {
			reorder(kind, id, list[i + 2]?.id ?? null);
		} else {
			return;
		}
		await tick();
		listEl.querySelector<HTMLElement>(`[data-handle="${id}"]`)?.focus();
	}

	async function moveIntoActual() {
		importing = true;
		try {
			await importGroups(budgetId);
		} finally {
			importing = false;
		}
	}
</script>

<div class="groups" bind:this={listEl}>
	<p class="intro">
		Groups nest accounts under On and Off budget in the Live sidebar. Drag an account onto a group
		there to move it in.
		{#if groupState.native}
			They're saved in this budget, so Actual and other tools see them too.
		{/if}
	</p>

	{#if groupState.importable}
		<div class="import" role="note">
			<Info size={16} strokeWidth={1.75} />
			<div class="import-text">
				<strong>Keep these groups in your budget</strong>
				<p>Actual can now store account groups, so Actual and other tools see them too.</p>
			</div>
			<button
				type="button"
				class="import-btn abt-btn abt-btn--sm"
				disabled={importing}
				onclick={moveIntoActual}
			>
				{importing ? "Moving…" : "Move into Actual"}
			</button>
		</div>
	{/if}

	{#each SECTIONS as section (section.kind)}
		{@const list = inSection(section.kind)}
		<section class="section">
			<h4 class="abt-label">{section.label}</h4>
			{#if list.length === 0}
				<p class="empty">No groups yet.</p>
			{/if}
			{#each list as group (group.id)}
				{@const count = accountCount(group.id, section.kind)}
				<div
					class="row"
					class:dragging={drag?.id === group.id}
					class:drop-before={over?.id === group.id && over.pos === "before"}
					class:drop-after={over?.id === group.id && over.pos === "after"}
					ondragover={(e) => onDragOver(e, section.kind, group.id)}
					ondrop={(e) => onDrop(e, section.kind)}
					role="listitem"
				>
					<button
						type="button"
						class="handle abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
						draggable="true"
						data-handle={group.id}
						title="Drag to reorder, or use the arrow keys"
						aria-label="Move {group.label}"
						disabled={list.length < 2}
						ondragstart={(e) => onDragStart(e, section.kind, group.id)}
						ondragend={endDrag}
						onkeydown={(e) => onHandleKey(e, section.kind, group.id)}
					>
						<GripVertical size={14} strokeWidth={1.75} />
					</button>
					<input
						class="abt-input name"
						type="text"
						value={group.label}
						data-group={group.id}
						autocomplete="off"
						data-form-type="other"
						data-1p-ignore
						data-lpignore="true"
						data-bwignore
						aria-label="Group name"
						onchange={(e) => rename(group.id, e.currentTarget.value)}
						onkeydown={(e) => e.key === "Enter" && e.currentTarget.blur()}
					/>
					<span class="count">{count} {count === 1 ? "account" : "accounts"}</span>
					<button
						type="button"
						class="remove abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
						title="Delete group; its accounts move back to {section.label}"
						aria-label="Delete {group.label}"
						onclick={() => remove(group.id)}
					>
						<X size={14} strokeWidth={1.75} />
					</button>
				</div>
			{/each}
			<button
				type="button"
				class="add abt-btn abt-btn--sm abt-btn--ghost"
				onclick={() => add(section.kind)}
			>
				<Plus size={14} strokeWidth={1.75} /> Add group
			</button>
		</section>
	{/each}
</div>

<style>
	.groups {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-5);
	}

	.intro,
	.empty {
		margin: 0;
		font-size: var(--abt-text-sm);
		color: var(--color-pageTextSubdued);
	}

	.import {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		padding: var(--abt-space-3) var(--abt-space-4);
		border: 1px solid var(--abt-accent-3);
		border-radius: var(--abt-radius);
		background: var(--abt-accent-1);
	}

	.import > :global(svg) {
		flex-shrink: 0;
		align-self: flex-start;
		margin-top: 2px;
		color: var(--abt-accent);
	}

	.import-text {
		flex: 1;
		min-width: 0;
		font-size: var(--abt-text-sm);
	}

	.import-text p {
		margin: 2px 0 0;
		color: var(--color-pageTextSubdued);
	}

	.import-btn {
		flex-shrink: 0;
		border-color: var(--abt-accent-4);
		background: var(--abt-accent-2);
		color: var(--abt-accent);
	}

	.import-btn:hover:not(:disabled) {
		background: var(--abt-accent-3);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
	}

	h4 {
		margin: 0 0 var(--abt-space-1);
	}

	.row {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
	}

	.row.dragging {
		opacity: 0.4;
	}

	.row.drop-before::after,
	.row.drop-after::after {
		content: "";
		position: absolute;
		left: 0;
		right: 0;
		height: 2px;
		border-radius: 2px;
		background: var(--abt-accent);
		pointer-events: none;
	}

	.row.drop-before::after {
		top: calc(-1 * var(--abt-space-1) - 1px);
	}

	.row.drop-after::after {
		bottom: calc(-1 * var(--abt-space-1) - 1px);
	}

	.handle {
		flex-shrink: 0;
		margin-right: calc(-1 * var(--abt-space-2));
		color: var(--color-pageTextSubdued);
		cursor: grab;
	}

	.handle:disabled {
		visibility: hidden;
	}

	.name {
		flex: 1;
	}

	.count {
		flex-shrink: 0;
		min-width: 72px;
		font-size: var(--abt-text-sm);
		text-align: right;
		color: var(--color-pageTextSubdued);
	}

	.remove:hover {
		color: var(--color-errorText);
	}

	.add {
		align-self: flex-start;
		margin-left: calc(-1 * var(--abt-space-3));
	}
</style>
