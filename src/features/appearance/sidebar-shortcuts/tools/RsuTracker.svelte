<script lang="ts">
	import { onMount } from "svelte";

	const { symbol = "", startDate = "", count = "0" } = $props<{
		symbol?: string;
		startDate?: string;
		count?: string;
	}>();

	let currentPrice = $state<number | null>(null);
	let grantPrice = $state<number | null>(null);
	let loading = $state(true);
	let error = $state(false);

	const rsuCount = $derived(parseFloat(count) || 0);
	const currentValue = $derived(currentPrice != null ? currentPrice * rsuCount : null);
	const grantValue = $derived(grantPrice != null ? grantPrice * rsuCount : null);
	const growth = $derived(
		currentValue != null && grantValue != null && grantValue > 0
			? ((currentValue - grantValue) / grantValue) * 100
			: null,
	);
	const gainDollars = $derived(
		currentValue != null && grantValue != null ? currentValue - grantValue : null,
	);

	async function fetchData() {
		if (!symbol) return;
		try {
			const res = await browser.runtime.sendMessage({
				type: "fetch",
				url: `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`,
			});
			if (!res.ok) throw new Error();
			const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
			currentPrice = data.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;

			if (startDate) {
				const ts = Math.floor(new Date(startDate + "T00:00:00").getTime() / 1000);
				const hRes = await browser.runtime.sendMessage({
					type: "fetch",
					url: `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${ts}&period2=${ts + 5 * 86400}&interval=1d`,
				});
				if (hRes.ok) {
					const hData = typeof hRes.data === "string" ? JSON.parse(hRes.data) : hRes.data;
					const closes = hData.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
					grantPrice = closes?.find((c: number | null) => c != null) ?? null;
				}
			}
		} catch {
			error = true;
		} finally {
			loading = false;
		}
	}

	function fmtCompact(n: number): string {
		const abs = Math.abs(n);
		if (abs >= 1000) return (n < 0 ? "-" : "") + "$" + (abs / 1000).toFixed(1) + "k";
		return (n < 0 ? "-" : "") + "$" + abs.toFixed(0);
	}

	onMount(() => {
		fetchData();
		const interval = setInterval(fetchData, 60000);
		return () => clearInterval(interval);
	});
</script>

<div class="rsu" title="{symbol} RSU · {rsuCount} shares">
	{#if loading}
		<span class="rsu__sym">{symbol || "RSU"}</span>
		<span class="rsu__dots">···</span>
	{:else if error || !currentPrice}
		<span class="rsu__sym">{symbol || "RSU"}</span>
		<span class="rsu__dots">—</span>
	{:else}
		<span class="rsu__sym">{symbol}</span>
		<span class="rsu__tag">RSU</span>
		<span class="rsu__count abt-privacy-number">{rsuCount}×</span>
		<span class="rsu__val abt-privacy-number">{fmtCompact(currentValue ?? 0)}</span>
		{#if growth != null}
			<span class="rsu__growth abt-privacy-number" class:is-pos={growth >= 0} class:is-neg={growth < 0}>
				{growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
			</span>
		{/if}
	{/if}
</div>

<style>
	.rsu {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		height: 100%;
		padding: 0 8px;
		font-size: 11px;
		overflow: hidden;
		white-space: nowrap;
	}

	.rsu__sym {
		font-weight: 700;
		font-size: 10px;
		opacity: 0.55;
		flex-shrink: 0;
	}

	.rsu__val {
		font-variant-numeric: tabular-nums;
		font-weight: 500;
		font-size: 11px;
		flex-shrink: 0;
	}

	.rsu__growth {
		font-size: 10px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		margin-inline-start: auto;
		flex-shrink: 0;
	}

	.rsu__growth.is-pos { color: var(--color-noticeTextLight); }
	.rsu__growth.is-neg { color: var(--color-errorText); }

	.rsu__tag {
		font-size: 8px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 1px 3px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 20%, transparent);
		color: var(--color-sidebarItemAccentSelected);
		flex-shrink: 0;
	}

	.rsu__count {
		font-size: 9px;
		opacity: 0.45;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}

	.rsu__dots {
		opacity: 0.35;
		margin-inline-start: auto;
		font-size: 10px;
	}
</style>
