<script lang="ts">
	/** A color's swatch and hex, typed over to set it exactly. */
	const {
		hex,
		label,
		hint,
		onCommit,
	}: { hex: string; label: string; hint: string; onCommit: (hex: string) => void } = $props();

	let draft = $state<string | null>(null);

	function commit() {
		const value = (draft ?? "").trim().replace(/^#?/, "#");
		draft = null;
		if (/^#[0-9a-f]{6}$/i.test(value)) {
			onCommit(value);
		}
	}
</script>

<label class="hex" title={label} data-abt-tip-hint={hint}>
	<span class="swatch" style:background={hex}></span>
	<input
		spellcheck="false"
		aria-label={label}
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
