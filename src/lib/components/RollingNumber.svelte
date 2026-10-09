<script lang="ts">
	import { fmtMoney } from "@lib/utilities/currency";
	import { onDestroy } from "svelte";

	/**
	 * A number whose changed digits roll to their new value, like a departures board. The first
	 * render, and any render after `resetKey` changes, shows the value without rolling.
	 */
	const {
		value = 0,
		text: preset,
		format = fmtMoney,
		resetKey,
		class: className = "",
		...rest
	}: {
		value?: number;
		/** Already-formatted text, used as-is instead of formatting `value`. */
		text?: string;
		format?: (value: number) => string;
		resetKey?: unknown;
		class?: string;
		/** Other attributes (data-sign, title) go on the root. */
		[attr: string]: unknown;
	} = $props();

	const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

	const text = $derived(preset ?? format(value));
	// Keyed by place from the right, so the ones digit stays the ones digit as the length changes.
	const slots = $derived.by(() => {
		const chars = [...text.replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")];
		return chars.map((char, i) => ({
			char,
			place: chars.length - 1 - i,
			digit: DIGITS.indexOf(char),
		}));
	});

	let instant = $state(true);
	let lastKey: unknown;
	let started = false;
	let frames: number[] = [];

	// A prop like `data.monthKey` re-runs this whenever `data` changes, so the key value itself
	// is compared. Runs before the DOM updates, so a new key and its value land without rolling;
	// rolling turns back on once a frame has painted that value.
	$effect.pre(() => {
		const key = resetKey;
		if (started && key === lastKey) return;
		started = true;
		lastKey = key;
		instant = true;
		frames.forEach(cancelAnimationFrame);
		frames = [
			requestAnimationFrame(() => frames.push(requestAnimationFrame(() => (instant = false)))),
		];
	});

	onDestroy(() => frames.forEach(cancelAnimationFrame));
</script>

<span {...rest} class="rn {className}" class:is-instant={instant}>
	<span class="rn__label">{text}</span>
	<span class="rn__track" aria-hidden="true">
		{#each slots as slot (slot.place)}
			{#if slot.digit >= 0}
				<span class="rn__window">
					<span class="rn__column" style:--d={slot.digit} style:--i={slot.place}>
						{#each DIGITS as d (d)}<span>{d}</span>{/each}
					</span>
				</span>
			{:else}
				<span>{slot.char}</span>
			{/if}
		{/each}
	</span>
</span>

<style>
	.rn {
		/* Whole pixels: a fractional line height snaps each digit's offset differently, so the
		   digits (and privacy dots) sit at uneven heights. */
		--rn-h: round(1lh, 1px);
		display: inline-flex;
		position: relative;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* The real value, for screen readers and copy; the track only draws it. */
	.rn__label {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.rn__track {
		display: inline-flex;
		user-select: none;
	}

	.rn__window {
		display: inline-block;
		height: var(--rn-h);
		overflow: hidden;
	}

	.rn__column {
		display: flex;
		flex-direction: column;
		/* A tenth of the column per digit, not line heights: a font swap (privacy mode) changes
		   the line height, and a length-based offset would then animate as if the digit changed. */
		transform: translateY(calc(var(--d) * -10%));
		/* The ones digit moves first, the rest follow a beat apart, like a board settling. */
		transition: transform 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) calc(var(--i) * 30ms);
	}

	.rn__column > span {
		height: var(--rn-h);
	}

	.rn.is-instant .rn__column {
		transition: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.rn__column {
			transition: none;
		}
	}
</style>
