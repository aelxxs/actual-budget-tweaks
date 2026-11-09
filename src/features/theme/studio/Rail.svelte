<script lang="ts">
	/**
	 * A labelled slider over a gradient of what it does. `allowed`, in the slider's units, hatches
	 * the rest of the track and stops the handle at its edges.
	 */
	const {
		label,
		track,
		min,
		max,
		value,
		allowed,
		blockedReason = "Not available",
		ariaLabel,
		valuetext,
		onchange,
	}: {
		label: string;
		track: string;
		min: number;
		max: number;
		value: number;
		allowed?: [number, number];
		/** Shown on hover over the hatched part. */
		blockedReason?: string;
		ariaLabel?: string;
		valuetext?: string;
		onchange: (value: number) => void;
	} = $props();

	const lo = $derived(allowed?.[0] ?? min);
	const hi = $derived(allowed?.[1] ?? max);
	const pct = (v: number) => ((v - min) / (max - min)) * 100;
	const clampTo = (v: number) => Math.min(hi, Math.max(lo, v));
	const EPS = $derived((max - min) / 1000);
</script>

<label class="row">
	<span class="row-label">{label}</span>
	<span class="rail" style:--track={track}>
		{#if lo > min + EPS}
			<span class="no-go" style:left="0" style:right="{100 - pct(lo)}%" title={blockedReason}
			></span>
		{/if}
		{#if hi < max - EPS}
			<span class="no-go" style:left="{pct(hi)}%" style:right="0" title={blockedReason}></span>
		{/if}
		<input
			type="range"
			{min}
			{max}
			step="any"
			value={clampTo(value)}
			aria-label={ariaLabel}
			aria-valuetext={valuetext}
			oninput={(e) => {
				const v = clampTo(Number(e.currentTarget.value));
				e.currentTarget.value = String(v);
				onchange(v);
			}}
		/>
	</span>
</label>

<style>
	.row {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr);
		align-items: center;
		gap: var(--abt-space-3);
	}
	.row-label {
		font-size: var(--abt-text-sm);
		color: var(--abt-muted);
	}
	/* A gradient of what the setting does, under a range input with only its thumb drawn. */
	.rail {
		position: relative;
		display: block;
		height: 18px;
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
		background: var(--track);
	}
	.no-go {
		position: absolute;
		top: 0;
		bottom: 0;
		background: repeating-linear-gradient(
			-45deg,
			color-mix(in srgb, var(--abt-ink) 30%, transparent) 0 2px,
			color-mix(in srgb, var(--color-pageBackground) 70%, transparent) 2px 5px
		);
		/* Above the input, so its tooltip shows; the handle can't go there anyway. */
		z-index: 1;
	}
	.rail input {
		position: relative;
		width: 100%;
		height: 100%;
		margin: 0;
		background: none;
		cursor: pointer;
		-webkit-appearance: none;
		appearance: none;
	}
	.rail input::-webkit-slider-runnable-track {
		height: 100%;
		background: none;
	}
	.rail input::-moz-range-track {
		background: none;
	}
	.rail input::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 6px;
		height: 22px;
		margin-top: -3px;
		border: 2px solid white;
		border-radius: var(--abt-radius-sm);
		background: transparent;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
	}
	.rail input::-moz-range-thumb {
		width: 4px;
		height: 20px;
		border: 2px solid white;
		border-radius: var(--abt-radius-sm);
		background: transparent;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
	}
</style>
