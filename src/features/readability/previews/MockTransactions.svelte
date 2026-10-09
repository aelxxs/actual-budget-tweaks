<script lang="ts">
	import { CircleCheck, Lock } from "lucide-svelte";

	/** A few rows of Actual's transaction table, for the transaction tweaks' previews. */
	const {
		zebra = false,
		colors = false,
		dim = false,
		highlight = false,
	}: { zebra?: boolean; colors?: boolean; dim?: boolean; highlight?: boolean } = $props();

	const ROWS = [
		{ payee: "Paycheck", category: "Income", amount: 2100, state: "reconciled" },
		{ payee: "Grocery Mart", category: "Food", amount: -54.2, state: "reconciled" },
		{ payee: "Coffee Shop", category: "", amount: -4.75, state: "cleared" },
		{ payee: "Electric Co", category: "Bills", amount: -88.1, state: "" },
	];

	const fmt = (n: number) =>
		n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
</script>

<!-- One grid for every row (rows use display: contents), so the columns line up. -->
<div class="mt">
	{#each ROWS as row, i (row.payee)}
		<div
			class="mt__row"
			class:zebra={zebra && i % 2 === 1}
			class:dim={dim && row.state === "reconciled"}
			class:uncat={highlight && !row.category}
		>
			<span class="mt__payee">{row.payee}</span>
			<span class="mt__cat" class:empty={!row.category}>{row.category || "Categorize"}</span>
			<span
				class="mt__amt"
				class:pos={colors && row.amount > 0}
				class:neg={colors && row.amount < 0}>{fmt(row.amount)}</span
			>
			<span class="mt__state" class:on={row.state === "cleared"}>
				{#if row.state === "reconciled"}
					<Lock size={11} strokeWidth={2} />
				{:else}
					<CircleCheck size={11} strokeWidth={2} />
				{/if}
			</span>
		</div>
	{/each}
</div>

<style>
	.mt {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto auto;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius-sm);
		overflow: hidden;
		background: var(--color-tableBackground);
		font-size: var(--abt-text-xs);
		color: var(--color-tableText);
	}

	.mt__row {
		display: contents;
	}

	.mt__row > span {
		display: flex;
		align-items: center;
		min-width: 0;
		padding: var(--abt-space-2) var(--abt-space-3);
		border-top: 1px solid var(--color-tableBorder);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mt__row:first-child > span {
		border-top: none;
	}

	.mt__row.zebra > span {
		background: color-mix(in srgb, var(--color-tableText) 6%, var(--color-tableBackground));
	}

	.mt__row.dim > span {
		opacity: 0.45;
	}

	.mt__row.uncat > span {
		background: color-mix(in srgb, var(--color-warningText) 12%, transparent);
		border-top-color: transparent;
	}

	.mt__row.uncat + .mt__row > span {
		border-top-color: transparent;
	}

	.mt__cat {
		color: var(--color-pageTextSubdued);
	}

	.mt__cat.empty {
		color: var(--color-pageTextLink, var(--abt-accent));
	}

	.mt__amt {
		justify-content: flex-end;
		font-variant-numeric: tabular-nums;
	}

	.mt__amt.pos {
		color: var(--color-numberPositive);
	}

	.mt__amt.neg {
		color: var(--color-numberNegative);
	}

	.mt__state {
		padding-left: 0 !important;
		color: var(--abt-ink-5);
	}

	.mt__state.on {
		color: var(--color-noticeTextLight);
	}
</style>
