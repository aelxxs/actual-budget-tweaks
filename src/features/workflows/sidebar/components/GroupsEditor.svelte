<script lang="ts">
	import { Info, Plus, X } from "@lucide/svelte";
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
		removeGroup,
		renameGroup,
		renameGroupTo,
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
				<div class="row">
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
