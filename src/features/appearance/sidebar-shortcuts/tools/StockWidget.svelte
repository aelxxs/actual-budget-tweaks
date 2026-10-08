<script lang="ts">
	import RollingNumber from "@lib/components/RollingNumber.svelte";
	import { onMount } from "svelte";

	const { symbol = "SPY" } = $props<{ symbol?: string }>();

	let price = $state<number | null>(null);
	let change = $state<number | null>(null);
	let changePercent = $state<number | null>(null);
	let loading = $state(true);
	let error = $state(false);

	async function fetchQuote() {
		try {
			const res = await browser.runtime.sendMessage({
				type: "fetch",
				url: `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`,
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);

			const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
			const result = data.chart?.result?.[0];
			if (!result) throw new Error("No chart data");

			const meta = result.meta;
			price = meta.regularMarketPrice;
			const prevClose = meta.chartPreviousClose ?? meta.previousClose;

			if (price != null && prevClose != null && prevClose !== 0) {
				change = price - prevClose;
				changePercent = (change / prevClose) * 100;
			}

			if (price == null) {
				const closes = result.indicators?.quote?.[0]?.close;
				if (closes?.length) {
					price = [...closes].reverse().find((p: number | null) => p !== null) ?? null;
				}
			}
		} catch (e) {
			console.warn("[ABT Stock]", symbol, e);
			error = true;
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchQuote();
		const interval = setInterval(fetchQuote, 60000);
		return () => clearInterval(interval);
	});

	let tooltip = $derived(
		price != null && change != null
			? `${symbol} $${price.toFixed(2)} (${change >= 0 ? "+" : ""}${change.toFixed(2)})`
			: symbol,
	);
</script>

<div class="stk" title={tooltip}>
	{#if loading}
		<span class="stk__sym">{symbol}</span>
		<span class="stk__dots">···</span>
	{:else if error}
		<span class="stk__sym">{symbol}</span>
		<span class="stk__err">—</span>
	{:else}
		<span class="stk__sym">{symbol}</span>
		<RollingNumber
			value={price ?? 0}
			format={(n) => n.toFixed(2)}
			resetKey={symbol}
			class="stk__price abt-privacy-number"
		/>
		{#if changePercent != null}
			<RollingNumber
				value={changePercent}
				format={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`}
				resetKey={symbol}
				class="stk__pct abt-privacy-number {changePercent >= 0 ? 'is-pos' : 'is-neg'}"
			/>
		{/if}
	{/if}
</div>

<style>
	.stk {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		height: 100%;
		padding: 0 8px;
		font-size: var(--abt-text-sm);
		overflow: hidden;
		white-space: nowrap;
	}

	.stk__sym {
		font-weight: 700;
		font-size: var(--abt-text-xs);
		opacity: 0.55;
		flex-shrink: 0;
	}

	/* Rendered by RollingNumber, so outside this component's scope. */
	.stk :global(.stk__price) {
		font-variant-numeric: tabular-nums;
		font-weight: 500;
		font-size: var(--abt-text-sm);
		flex-shrink: 0;
	}

	.stk :global(.stk__pct) {
		font-size: var(--abt-text-xs);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		margin-inline-start: auto;
		flex-shrink: 0;
	}

	.stk :global(.stk__pct.is-pos) {
		color: var(--color-sidebarTextPositive, var(--color-noticeTextLight));
	}
	.stk :global(.stk__pct.is-neg) {
		color: var(--color-sidebarTextFailed, var(--color-errorText));
	}

	.stk__dots,
	.stk__err {
		opacity: 0.35;
		margin-inline-start: auto;
		font-size: var(--abt-text-xs);
	}
</style>
