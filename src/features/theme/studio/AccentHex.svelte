<script lang="ts">
	import { accentLightness, CHROMA_CEILING, hexToOklch, LIFT_RANGE } from "./generator";
	import { followAccent } from "./recipes";
	import { studio } from "./state.svelte";

	/** The accent's swatch and hex, typed over to set it exactly (hue, vibrance and brightness). */
	const { hex }: { hex: string } = $props();

	let draft = $state<string | null>(null);

	function commit() {
		const value = (draft ?? "").trim().replace(/^#?/, "#");
		draft = null;
		if (!/^#[0-9a-f]{6}$/i.test(value)) {
			return;
		}
		const r = studio.recipe;
		const o = hexToOklch(value);
		r.accentHue = o.h;
		r.accentChroma = Math.min(CHROMA_CEILING, Math.max(0.02, o.C));
		const lift = o.L - accentLightness(r.mode, r.contrast);
		r.accentLift = Math.min(LIFT_RANGE[1], Math.max(LIFT_RANGE[0], lift));
		followAccent(r);
	}
</script>

<label class="hex" title="Type a hex code to set the accent exactly">
	<span class="swatch" style:background={hex}></span>
	<input
		spellcheck="false"
		aria-label="Accent hex"
		value={draft ?? hex}
		onfocus={(e) => e.currentTarget.select()}
		oninput={(e) => (draft = e.currentTarget.value)}
		onblur={commit}
		onkeydown={(e) => {
			if (e.key === "Enter") {
				e.currentTarget.blur();
			} else if (e.key === "Escape") {
				e.stopPropagation();
				draft = null;
				e.currentTarget.blur();
			}
		}}
	/>
</label>

<style>
	.hex {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
		padding: 1px var(--abt-space-2);
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
		cursor: text;
	}
	.hex:hover,
	.hex:focus-within {
		border-color: var(--abt-ink-5);
	}
	.swatch {
		width: 10px;
		height: 10px;
		border-radius: var(--abt-radius-pill);
	}
	input {
		width: 60px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--abt-ink);
		font:
			var(--abt-text-xs) ui-monospace,
			"SF Mono",
			Menlo,
			monospace;
		text-transform: lowercase;
		outline: none;
	}
</style>
