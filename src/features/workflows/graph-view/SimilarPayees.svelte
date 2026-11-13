<script lang="ts">
	import Section from "@lib/components/panel/Section.svelte";
	import { SvelteMap } from "svelte/reactivity";

	const {
		note,
		groups,
		names,
		uses,
		onPick,
		onMerge,
	}: {
		note: string;
		/** Each group most-used first; the first is the suggested name to keep. */
		groups: string[][];
		names: Map<string, string>;
		/** Transactions per payee in the range. */
		uses: Map<string, number>;
		onPick: (group: string[]) => void;
		onMerge: (target: string, others: string[]) => Promise<void>;
	} = $props();

	// The payee each group keeps, by the group's first id.
	const keep = new SvelteMap<string, string>();
	let busy = $state<string | null>(null);

	const nameOf = (id: string) => names.get(id) ?? "Unknown";

	async function merge(group: string[]) {
		const target = keep.get(group[0]) ?? group[0];
		busy = group[0];
		try {
			await onMerge(
				target,
				group.filter((id) => id !== target),
			);
		} finally {
			busy = null;
		}
	}
</script>

<div>
	<p class="sp__note">{note}</p>
	<Section title="Groups" count={groups.length}>
		{#each groups as group (group[0])}
			{@const target = keep.get(group[0]) ?? group[0]}
			<div class="sp__group">
				<div class="sp__names" role="radiogroup" aria-label="Name to keep">
					{#each group as id (id)}
						<button
							type="button"
							class="sp__name"
							role="radio"
							aria-checked={id === target}
							onclick={() => keep.set(group[0], id)}
						>
							<span class="sp__radio" aria-hidden="true"></span>
							<span class="sp__label abt-privacy-number">{nameOf(id)}</span>
							<span class="sp__uses">{uses.get(id) ?? 0}</span>
						</button>
					{/each}
				</div>
				<div class="sp__actions">
					<button
						type="button"
						class="abt-btn abt-btn--sm abt-btn--ghost"
						onclick={() => onPick(group)}
					>
						Show
					</button>
					<button
						type="button"
						class="abt-btn abt-btn--sm abt-tone-accent"
						disabled={busy !== null}
						onclick={() => merge(group)}
					>
						{busy === group[0] ? "Merging…" : `Merge into ${nameOf(target)}`}
					</button>
				</div>
			</div>
		{:else}
			<p class="sp__empty">No payees look alike.</p>
		{/each}
	</Section>
</div>

<style>
	.sp__note {
		margin: var(--abt-space-3) 12px var(--abt-space-4); /* raw: the sections' 12px inset */
		font-size: var(--abt-text-sm);
		line-height: 1.4;
		color: var(--abt-muted);
	}

	.sp__empty {
		margin: 0;
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}

	.sp__group + .sp__group {
		margin-top: var(--abt-space-3);
		padding-top: var(--abt-space-3);
		border-top: 1px solid var(--abt-line);
	}

	.sp__names {
		display: flex;
		flex-direction: column;
	}

	.sp__name {
		display: flex;
		align-items: center;
		gap: var(--abt-space-3);
		width: 100%;
		padding: var(--abt-space-2);
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		font-size: var(--abt-text-sm);
		text-align: left;
		cursor: pointer;
	}

	.sp__name:hover {
		background: var(--abt-fill-hover);
	}

	.sp__radio {
		flex-shrink: 0;
		box-sizing: border-box;
		width: 12px;
		height: 12px;
		border: 1.5px solid var(--abt-muted);
		border-radius: var(--abt-radius-pill);
	}

	.sp__name[aria-checked="true"] .sp__radio {
		border: 4px solid var(--abt-accent);
	}

	.sp__label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sp__uses {
		font-size: var(--abt-text-xs);
		font-variant-numeric: tabular-nums;
		color: var(--abt-muted);
	}

	.sp__actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--abt-space-2);
		margin-top: var(--abt-space-2);
	}
</style>
