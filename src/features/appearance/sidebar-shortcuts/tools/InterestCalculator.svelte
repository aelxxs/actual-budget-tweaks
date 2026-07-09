<script lang="ts">
	const { onClose } = $props<{ onClose: () => void }>();

	let principal = $state("");
	let rate = $state("");
	let years = $state("");
	let compounding = $state("12");

	const compoundOptions = [
		{ value: "1", label: "Annually" },
		{ value: "4", label: "Quarterly" },
		{ value: "12", label: "Monthly" },
		{ value: "365", label: "Daily" },
	];

	let result = $derived.by(() => {
		const p = parseFloat(principal);
		const r = parseFloat(rate) / 100;
		const t = parseFloat(years);
		const n = parseInt(compounding);
		if (!p || !r || !t || !n) return null;

		const total = p * Math.pow(1 + r / n, n * t);
		const interest = total - p;
		return { total, interest, principal: p };
	});

	function fmt(n: number): string {
		return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<div class="ic">
	<div class="ic__fields">
		<label class="ic__field">
			<span class="ic__label">Principal</span>
			<div class="ic__input-wrap">
				<span class="ic__prefix">$</span>
				<input class="ic__input" type="number" placeholder="10,000" bind:value={principal} />
			</div>
		</label>

		<label class="ic__field">
			<span class="ic__label">Annual Rate</span>
			<div class="ic__input-wrap">
				<input class="ic__input" type="number" placeholder="5.0" step="0.1" bind:value={rate} />
				<span class="ic__suffix">%</span>
			</div>
		</label>

		<label class="ic__field">
			<span class="ic__label">Term</span>
			<div class="ic__input-wrap">
				<input class="ic__input" type="number" placeholder="5" bind:value={years} />
				<span class="ic__suffix">yrs</span>
			</div>
		</label>

		<label class="ic__field">
			<span class="ic__label">Compound</span>
			<select class="ic__select" bind:value={compounding}>
				{#each compoundOptions as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</label>
	</div>

	{#if result}
		<div class="ic__result">
			<div class="ic__row">
				<span class="ic__rlabel">Interest earned</span>
				<span class="ic__rval ic__rval--accent">${fmt(result.interest)}</span>
			</div>
			<div class="ic__row ic__row--total">
				<span class="ic__rlabel">Total value</span>
				<span class="ic__rval">${fmt(result.total)}</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.ic {
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 220px;
	}

	.ic__fields {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.ic__field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.ic__label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-pageTextSubdued);
	}

	.ic__input-wrap {
		display: flex;
		align-items: center;
		border: 1px solid var(--color-tableBorder);
		border-radius: 6px;
		background: color-mix(in srgb, var(--color-pageText) 4%, transparent);
		overflow: hidden;
	}

	.ic__input-wrap:focus-within {
		border-color: var(--color-sidebarItemAccentSelected);
	}

	.ic__prefix,
	.ic__suffix {
		font-size: 11px;
		color: var(--color-pageTextSubdued);
		padding: 0 8px;
		flex-shrink: 0;
	}

	.ic__input {
		flex: 1;
		min-width: 0;
		padding: 6px 8px;
		font-size: 13px;
		font-family: inherit;
		border: none;
		background: none;
		color: var(--color-pageText);
		outline: none;
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.ic__input::-webkit-inner-spin-button,
	.ic__input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.ic__input::placeholder {
		color: var(--color-pageTextSubdued);
		opacity: 0.5;
	}

	.ic__select {
		width: 100%;
		padding: 6px 8px;
		font-size: 12px;
		font-family: inherit;
		border: 1px solid var(--color-tableBorder);
		border-radius: 6px;
		background: color-mix(in srgb, var(--color-pageText) 4%, transparent);
		color: var(--color-pageText);
		outline: none;
		cursor: pointer;
	}

	.ic__select:focus {
		border-color: var(--color-sidebarItemAccentSelected);
	}

	.ic__result {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-sidebarItemAccentSelected) 8%, transparent);
	}

	.ic__row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 11px;
	}

	.ic__row--total {
		padding-top: 4px;
		border-top: 1px solid color-mix(in srgb, var(--color-sidebarItemAccentSelected) 15%, transparent);
		font-size: 13px;
		font-weight: 600;
	}

	.ic__rlabel {
		color: var(--color-pageTextSubdued);
	}

	.ic__rval {
		font-variant-numeric: tabular-nums;
		font-weight: 500;
	}

	.ic__rval--accent {
		color: var(--color-sidebarItemAccentSelected);
	}
</style>
