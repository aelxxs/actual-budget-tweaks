<script lang="ts">
	import { CircleAlert, Clock, Check } from "lucide-svelte";
	import PreviewPair from "./PreviewPair.svelte";

	const ROWS = [
		{ name: "Groceries", balance: "120.00", tone: "var(--color-noticeTextLight)", Icon: Check },
		{ name: "Car fund", balance: "40.00", tone: "var(--color-warningText)", Icon: Clock },
		{ name: "Dining", balance: "-18.50", tone: "var(--color-errorText)", Icon: CircleAlert },
	];
</script>

<PreviewPair>
	{#snippet sample(on)}
		<div class="rows">
			{#each ROWS as row (row.name)}
				<div class="row">
					<span>{row.name}</span>
					{#if on}
						<span class="pill" style:--tone={row.tone}>
							<row.Icon size={11} strokeWidth={2.5} />{row.balance}
						</span>
					{:else}
						<span class="plain" style:color={row.tone}>{row.balance}</span>
					{/if}
				</div>
			{/each}
		</div>
	{/snippet}
</PreviewPair>

<style>
	.rows {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-tableBorder);
		border-radius: var(--abt-radius-sm);
		background: var(--color-tableBackground);
		font-size: var(--abt-text-xs);
		color: var(--color-tableText);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 24px;
		padding: var(--abt-space-1) var(--abt-space-3);
		border-top: 1px solid var(--color-tableBorder);
	}

	.row:first-child {
		border-top: none;
	}

	.plain,
	.pill {
		font-variant-numeric: tabular-nums;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 1px 7px 1px 5px;
		border-radius: var(--abt-radius-pill);
		background: color-mix(in srgb, var(--tone) 18%, transparent);
		color: color-mix(in srgb, var(--tone) 80%, var(--color-pageText));
	}
</style>
