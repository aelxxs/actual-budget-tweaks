<script lang="ts">
	import { Plus, X } from "lucide-svelte";
	import { onMount, tick } from "svelte";
	import type { AccountGroup } from "../lib/groups";
	import {
		createGroup,
		loadAssignments,
		loadGroups,
		removeGroup,
		renameGroup,
		saveAssignments,
		saveGroups,
		watchAssignments,
		watchGroups,
	} from "../lib/groups";

	const { budgetId }: { budgetId: string | undefined } = $props();

	type Section = AccountGroup["section"];
	const SECTIONS: { kind: Section; label: string }[] = [
		{ kind: "onbudget", label: "On budget" },
		{ kind: "offbudget", label: "Off budget" },
	];

	let groups = $state<Record<string, AccountGroup>>({});
	let assignments = $state<Record<string, string>>({});
	let listEl: HTMLDivElement;

	onMount(() => {
		loadGroups(budgetId).then((stored) => (groups = stored));
		loadAssignments(budgetId).then((stored) => (assignments = stored));
		const stopGroups = watchGroups(budgetId, (stored) => (groups = stored));
		const stopAssignments = watchAssignments(budgetId, (stored) => (assignments = stored));
		return () => {
			stopGroups();
			stopAssignments();
		};
	});

	function inSection(kind: Section): AccountGroup[] {
		return Object.values(groups)
			.filter((g) => g.section === kind)
			.sort((a, b) => a.order - b.order);
	}

	function accountCount(id: string): number {
		return Object.values(assignments).filter((g) => g === id).length;
	}

	async function add(kind: Section) {
		const created = createGroup(groups, kind);
		groups = created.groups;
		saveGroups(budgetId, created.groups);
		await tick();
		const input = listEl.querySelector<HTMLInputElement>(`[data-group="${created.id}"]`);
		input?.focus();
		input?.select();
	}

	function rename(id: string, label: string) {
		const next = renameGroup(groups, id, label);
		if (next === groups) return;
		groups = next;
		saveGroups(budgetId, next);
	}

	function remove(id: string) {
		const result = removeGroup(groups, assignments, id);
		groups = result.groups;
		assignments = result.assignments;
		saveGroups(budgetId, result.groups);
		saveAssignments(budgetId, result.assignments);
	}
</script>

<div class="groups" bind:this={listEl}>
	<p class="intro">
		Groups nest accounts under On and Off budget in the Live sidebar. Drag an account onto a group
		there to move it in.
	</p>

	{#each SECTIONS as section (section.kind)}
		{@const list = inSection(section.kind)}
		<section class="section">
			<h4 class="abt-label">{section.label}</h4>
			{#if list.length === 0}
				<p class="empty">No groups yet.</p>
			{/if}
			{#each list as group (group.id)}
				{@const count = accountCount(group.id)}
				<div class="row">
					<input
						class="abt-input name"
						type="text"
						value={group.label}
						data-group={group.id}
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

	.section {
		display: flex;
		flex-direction: column;
		gap: var(--abt-space-2);
	}

	h4 {
		margin: 0 0 var(--abt-space-1);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
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
