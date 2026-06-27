<script lang="ts">
	import { onMount } from "svelte";

	const { onClose } = $props<{ onClose: () => void }>();

	const CURRENCIES = [
		"USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY",
		"INR", "MXN", "BRL", "KRW", "SEK", "NOK", "DKK", "NZD",
		"SGD", "HKD", "TRY", "ZAR", "PLN", "THB", "PHP", "CZK",
	];

	let fromCurrency = $state("USD");
	let toCurrency = $state("EUR");
	let fromAmount = $state("1");
	let toAmount = $state("");
	let rates = $state<Record<string, number>>({});
	let loading = $state(true);
	let error = $state("");
	let lastUpdated = $state("");

	async function fetchRates() {
		loading = true;
		error = "";
		try {
			const res = await browser.runtime.sendMessage({
				type: "fetch",
				url: `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`,
				responseType: "json",
			});
			if (!res.ok) throw new Error("Failed to fetch");
			rates = res.data.rates;
			lastUpdated = new Date().toLocaleTimeString();
			convert();
		} catch {
			error = "Failed to fetch rates";
		} finally {
			loading = false;
		}
	}

	function convert() {
		const amount = parseFloat(fromAmount);
		if (isNaN(amount) || !rates[toCurrency]) {
			toAmount = "";
			return;
		}
		const result = amount * rates[toCurrency];
		toAmount = result.toFixed(2);
	}

	function swap() {
		const tmpCurr = fromCurrency;
		fromCurrency = toCurrency;
		toCurrency = tmpCurr;
		fetchRates();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") onClose();
	}

	onMount(() => {
		fetchRates();
	});

	$effect(() => {
		fromAmount;
		toCurrency;
		convert();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="conv">
	<div class="conv__row">
		<div class="conv__field">
			<select class="conv__select" bind:value={fromCurrency} onchange={() => fetchRates()}>
				{#each CURRENCIES as c}
					<option value={c}>{c}</option>
				{/each}
			</select>
			<input
				class="conv__input"
				type="number"
				bind:value={fromAmount}
				placeholder="0"
				step="any"
			/>
		</div>
	</div>

	<div class="conv__swap">
		<button class="conv__swap-btn" onclick={swap} title="Swap">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
		</button>
	</div>

	<div class="conv__row">
		<div class="conv__field">
			<select class="conv__select" bind:value={toCurrency}>
				{#each CURRENCIES as c}
					<option value={c}>{c}</option>
				{/each}
			</select>
			<input
				class="conv__input conv__input--result"
				type="text"
				value={loading ? "..." : toAmount}
				readonly
			/>
		</div>
	</div>

	{#if error}
		<div class="conv__error">{error}</div>
	{/if}

	{#if lastUpdated && !error}
		<div class="conv__meta">
			{#if rates[toCurrency]}
				<span>1 {fromCurrency} = {rates[toCurrency].toFixed(4)} {toCurrency}</span>
			{/if}
			<span class="conv__time">Updated {lastUpdated}</span>
		</div>
	{/if}
</div>

<style>
	.conv {
		width: 260px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.conv__row {
		display: flex;
	}

	.conv__field {
		flex: 1;
		display: flex;
		border: 1px solid var(--color-tableBorder);
		border-radius: 8px;
		overflow: hidden;
		background: color-mix(in srgb, var(--color-pageText) 4%, transparent);
	}

	.conv__select {
		padding: 10px 8px 10px 10px;
		border: none;
		background: color-mix(in srgb, var(--color-pageText) 6%, transparent);
		color: var(--color-pageText);
		font-family: inherit;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		outline: none;
		border-right: 1px solid var(--color-tableBorder);
	}

	.conv__input {
		flex: 1;
		padding: 10px;
		border: none;
		background: transparent;
		color: var(--color-pageText);
		font-family: inherit;
		font-size: 16px;
		font-weight: 500;
		outline: none;
		text-align: right;
		min-width: 0;
		font-variant-numeric: tabular-nums;
	}

	.conv__input::placeholder { color: var(--color-pageTextSubdued); }

	.conv__input--result {
		color: var(--color-sidebarItemAccentSelected, #7c5cbf);
	}

	/* Hide number input arrows */
	.conv__input::-webkit-outer-spin-button,
	.conv__input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	/* Ensure number inputs behave like textfields across browsers */
	.conv__input[type="number"] {
		-moz-appearance: textfield;
		-webkit-appearance: none;
		appearance: textfield;
	}

	.conv__swap {
		display: flex;
		justify-content: center;
		padding: 2px 0;
	}

	.conv__swap-btn {
		width: 28px;
		height: 28px;
		border: 1px solid var(--color-tableBorder);
		border-radius: 50%;
		background: var(--color-cardBackground);
		color: var(--color-pageTextSubdued);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.1s, border-color 0.1s;
	}

	.conv__swap-btn:hover {
		color: var(--color-pageText);
		border-color: var(--color-sidebarItemAccentSelected);
	}

	.conv__error {
		font-size: 11px;
		color: var(--color-errorText);
		text-align: center;
		padding: 4px 0;
	}

	.conv__meta {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		color: var(--color-pageTextSubdued);
		padding-top: 6px;
	}

	.conv__time { opacity: 0.6; }
</style>
