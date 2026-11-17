<script lang="ts">
	import { pageMode } from "@features/theme/theme-apply";
	import { THEME_APPLIED_EVENT } from "@lib/theme-events";
	import { CircleAlert, Clock, Check } from "@lucide/svelte";
	import PreviewPair from "./PreviewPair.svelte";

	let light = $state(false);
	$effect(() => {
		const update = () => (light = pageMode() === "light");
		update();
		document.addEventListener(THEME_APPLIED_EVENT, update);
		return () => document.removeEventListener(THEME_APPLIED_EVENT, update);
	});

	const ROWS = [
		{ name: "Groceries", balance: "120.00", tone: "var(--color-noticeTextLight)", Icon: Check },
		{
			name: "Car fund",
			balance: "40.00",
			tone: "var(--color-warningText)",
			Icon: Clock,
			fill: 0.5,
		},
		{ name: "Dining", balance: "-18.50", tone: "var(--color-errorText)", Icon: CircleAlert },
		{
			name: "Gifts",
			balance: "0.00",
			tone: "color-mix(in srgb, var(--color-pageTextSubdued) 60%, var(--color-tableText))", // raw: mirrors Actual balance text
			Icon: null,
		},
	];
</script>

<PreviewPair>
	{#snippet sample(on)}
		<div class="rows">
			{#each ROWS as row (row.name)}
				<div class="row">
					<span>{row.name}</span>
					{#if on}
						<span
							class="pill"
							class:neutral={!row.Icon}
							class:light
							style:--tone={row.tone}
							style:--fill={row.fill}
						>
							{#if row.Icon}<row.Icon size={11} strokeWidth={2.5} />{/if}{row.balance}
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

	/* Mirrors the pills in balance-pills/index.ts. */
	.pill {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
		padding: 1px var(--abt-space-3); /* raw: compact badge inset */
		border-radius: var(--abt-radius-pill);
		background: color-mix(in srgb, var(--tone) 16%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tone) 4%, transparent);
		color: var(--tone);
	}
	.pill.light {
		background: oklch(from var(--tone) 0.93 calc(c * var(--fill, 0.35)) h);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tone) 7%, transparent);
		color: color-mix(in srgb, var(--tone), var(--color-tableText) 30%);
	}
	.pill.neutral {
		background: var(--abt-ink-3);
		box-shadow: none;
		color: var(--tone);
	}
</style>
