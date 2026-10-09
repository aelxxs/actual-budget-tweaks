<script lang="ts">
	import OptionPicker from "@lib/components/OptionPicker.svelte";
	import Switch from "@lib/components/Switch.svelte";

	let {
		selected,
		onPick,
	}: {
		options: { value: string; label: string }[];
		selected: string;
		onPick: (value: string) => void;
	} = $props();

	type Base = "script" | "dots";
	const BASES: { value: Base; label: string }[] = [
		{ value: "script", label: "Scribbled" },
		{ value: "dots", label: "Dots" },
	];
	// "fixed" is the stored value for fixed dots, from before scribbles could be fixed too.
	const VALUES: Record<Base, [string, string]> = {
		script: ["script", "script-fixed"],
		dots: ["dots", "fixed"],
	};

	const base = $derived<Base>(selected === "dots" || selected === "fixed" ? "dots" : "script");
	const isFixed = $derived(selected === "fixed" || selected === "script-fixed");

	const pick = (b: Base, f: boolean) => onPick(VALUES[b][f ? 1 : 0]);

	const AMOUNTS = ["1,284.50", "-62.18", "940.00"];
</script>

<OptionPicker options={BASES} selected={base} onPick={(b) => pick(b, isFixed)}>
	{#snippet preview({ value })}
		<div class="pp-rows">
			{#each AMOUNTS as amount (amount)}
				{@const text = isFixed ? "0000" : amount}
				<div class="pp-row">
					<span class="pp-bar"></span>
					{#if value === "dots"}
						<span class="pp-amount">{"•".repeat(text.length)}</span>
					{:else}
						<span class="pp-amount pp-amount--script">{text}</span>
					{/if}
				</div>
			{/each}
		</div>
	{/snippet}
</OptionPicker>

<label class="abt-setting pp-fixed">
	<span class="abt-setting__text">
		<span class="abt-setting__label">Same length for every amount</span>
		<span class="abt-setting__desc">Hides how big each amount is.</span>
	</span>
	<Switch checked={isFixed} onCheckedChange={(f) => pick(base, f)} />
</label>

<style>
	.pp-fixed {
		cursor: pointer;
		margin-bottom: calc(-1 * var(--abt-space-3));
	}

	.pp-fixed:hover {
		background: var(--abt-ink-1);
	}

	.pp-rows {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 6px;
	}

	.pp-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		height: 12px;
	}

	.pp-bar {
		width: 22px;
		height: 3px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--color-tableText) 25%, transparent);
	}

	.pp-amount {
		font-size: var(--abt-text-2xs);
		line-height: 1;
		letter-spacing: -0.04em;
		color: var(--color-tableText);
		white-space: nowrap;
		overflow: hidden;
	}

	.pp-amount--script {
		font-family: "Redacted Script", cursive;
		letter-spacing: 0;
	}
</style>
