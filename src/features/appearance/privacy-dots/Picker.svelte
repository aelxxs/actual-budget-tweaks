<script lang="ts">
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
	// "fixed" is the stored value for fixed dots, from before scribbles could be fixed too.
	const VALUES: Record<Base, [string, string]> = {
		script: ["script", "script-fixed"],
		dots: ["dots", "fixed"],
	};

	const base = $derived<Base>(selected === "dots" || selected === "fixed" ? "dots" : "script");
	const isFixed = $derived(selected === "fixed" || selected === "script-fixed");

	const pick = (b: Base, f: boolean) => onPick(VALUES[b][f ? 1 : 0]);
</script>

<div class="abt-seg abt-seg--sm" role="group" aria-label="Privacy style">
	<button type="button" aria-pressed={base === "script"} onclick={() => pick("script", isFixed)}>
		Scribbled
	</button>
	<button type="button" aria-pressed={base === "dots"} onclick={() => pick("dots", isFixed)}>
		Dots
	</button>
</div>

<label class="abt-setting pp-fixed">
	<span class="abt-setting__text">
		<span class="abt-setting__label">Same length for every amount</span>
		<span class="abt-setting__desc">Hides how big each amount is.</span>
	</span>
	<Switch checked={isFixed} onCheckedChange={(f) => pick(base, f)} />
</label>

<style>
	/* Its own line under the row, lined up with the label past the icon. */
	.pp-fixed {
		flex-basis: 100%;
		margin: 0;
		padding: var(--abt-space-3) 0 0 calc(15px + var(--abt-space-3));
		cursor: pointer;
	}
</style>
