<script lang="ts">
	import { backgroundFromHex } from "./generator";
	import { studio } from "./state.svelte";

	const { hex }: { hex: string } = $props();

	let draft = $state<string | null>(null);

	function commit() {
		const value = (draft ?? "").trim().replace(/^#?/, "#");
		draft = null;
		if (!/^#[0-9a-f]{6}$/i.test(value)) {
			return;
		}
		const r = studio.recipe;
		const background = backgroundFromHex(r.mode, r.contrast, value, "crust");
		r.baseHue = background.baseHue ?? r.baseHue;
		r.tint = background.tint;
		r.depth = background.depth;
		r.backgroundLink = null;
	}
</script>

<label class="hex" title="Background hex" data-abt-tip-hint="Type a hex code to set the background">
	<span class="swatch" style:background={hex}></span>
	<input
		class="abt-input"
		spellcheck="false"
		aria-label="Background hex"
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
	/* Compact swatch and monospace field match the accent hex control. */
	.hex {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-2);
		padding: 1px var(--abt-space-2); /* raw: compact hex control inset */
		border: 1px solid var(--abt-line);
		border-radius: var(--abt-radius-sm);
		cursor: text;
	}
	.hex:hover,
	.hex:focus-within {
		border-color: var(--abt-ink-5);
	}
	.swatch {
		width: 10px; /* raw: hex swatch size */
		height: 10px; /* raw: hex swatch size */
		border-radius: var(--abt-radius-pill);
	}
	input {
		width: 7ch;
		height: auto;
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
