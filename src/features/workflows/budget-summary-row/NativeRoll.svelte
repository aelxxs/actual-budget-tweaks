<script lang="ts">
	import RollingNumber from "@lib/components/RollingNumber.svelte";
	import { isBulkEditing, onBulkEditEnd } from "@lib/utilities/bulk-edit";

	/**
	 * Rolls one of Actual's own numbers. React owns `source`, so its text stays (made
	 * transparent) for clicks and screen readers, and a rolling copy is drawn over it.
	 */
	const { source, resetKey }: { source: HTMLElement; resetKey?: unknown } = $props();

	const HIDDEN_ATTR = "data-abt-rolling";

	let text = $state("");
	let box = $state({ left: 0, top: 0 });
	let look = $state("");
	let host: HTMLSpanElement;

	function read() {
		// Mid bulk edit the amount changes once per step; it rolls once, to the final value.
		if (isBulkEditing()) return;
		text = source.textContent?.trim() ?? "";
		box = { left: source.offsetLeft, top: source.offsetTop };
		// Copied each time, since Actual recolours it as the amount turns negative or positive.
		const cs = getComputedStyle(source);
		look = `font: ${cs.font}; letter-spacing: ${cs.letterSpacing}; color: ${cs.color}`;
	}

	$effect(() => {
		const parent = source.parentElement;
		if (!parent) return;
		if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
		parent.appendChild(host);
		source.setAttribute(HIDDEN_ATTR, "");
		read();

		const mutations = new MutationObserver(read);
		mutations.observe(source, {
			subtree: true,
			childList: true,
			characterData: true,
			attributes: true,
			attributeFilter: ["class"],
		});
		const sizes = new ResizeObserver(read);
		sizes.observe(source);
		const stopBulk = onBulkEditEnd(read);

		return () => {
			mutations.disconnect();
			sizes.disconnect();
			stopBulk();
			source.removeAttribute(HIDDEN_ATTR);
			host.remove();
		};
	});
</script>

<span
	bind:this={host}
	class="native-roll abt-privacy-number"
	data-abt-owned
	style="{look}; left: {box.left}px; top: {box.top}px"
	aria-hidden="true"
>
	<RollingNumber {text} {resetKey} />
</span>

<style>
	.native-roll {
		position: absolute;
		pointer-events: none;
		white-space: nowrap;
	}

	:global([data-abt-rolling]) {
		-webkit-text-fill-color: transparent;
	}

	/*
	 * Under Actual's privacy filter the amount sits in a layer that's invisible until hovered,
	 * beside a redacted copy; that copy is what should show, so the rolling copy steps aside.
	 */
	:global(.abt-privacy-enabled div:has(> div:first-child + div[aria-hidden="true"]:last-child) .native-roll) {
		display: none;
	}

	:global(.abt-privacy-enabled div:has(> div:first-child + div[aria-hidden="true"]:last-child) [data-abt-rolling]) {
		-webkit-text-fill-color: inherit;
	}
</style>
