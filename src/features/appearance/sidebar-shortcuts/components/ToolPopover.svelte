<script lang="ts">
	import Icon from "@lib/components/Icon.svelte";
	import { onMount } from "svelte";
	import Calculator from "../tools/Calculator.svelte";
	import CurrencyConverter from "../tools/CurrencyConverter.svelte";
	import InterestCalculator from "../tools/InterestCalculator.svelte";
	import type { ToolId } from "../types";

	const {
		toolId,
		title,
		anchorX,
		anchorY,
		centered = false,
		onClose,
		onMoved,
	} = $props<{
		toolId: ToolId;
		title: string;
		anchorX: number;
		anchorY: number;
		/** Treats `anchorX` as the popover's middle, for opening away from any tile. */
		centered?: boolean;
		onClose: () => void;
		onMoved: (x: number, y: number) => void;
	}>();

	let popover: HTMLDivElement;
	// Set once, then the popover is the user's to move.
	// svelte-ignore state_referenced_locally
	let left = $state(anchorX);
	// svelte-ignore state_referenced_locally
	let top = $state(anchorY);
	let grab: { x: number; y: number } | null = null;

	function moveTo(x: number, y: number) {
		left = Math.max(0, Math.min(x, window.innerWidth - popover.offsetWidth));
		top = Math.max(0, Math.min(y, window.innerHeight - popover.offsetHeight));
	}

	onMount(() => {
		moveTo(centered ? anchorX - popover.offsetWidth / 2 : anchorX, anchorY);
		if (!popover.contains(document.activeElement)) {
			popover.focus({ preventScroll: true });
		}
		const keepOnScreen = () => moveTo(left, top);
		window.addEventListener("resize", keepOnScreen);
		return () => window.removeEventListener("resize", keepOnScreen);
	});

	function onGrab(e: PointerEvent) {
		if (e.button !== 0 || (e.target as Element).closest("button")) {
			return;
		}
		grab = { x: e.clientX - left, y: e.clientY - top };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onDrag(e: PointerEvent) {
		if (grab) {
			moveTo(e.clientX - grab.x, e.clientY - grab.y);
		}
	}

	function onDrop() {
		if (grab) {
			grab = null;
			onMoved(left, top);
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			e.stopPropagation();
			onClose();
		}
	}
</script>

<!-- Not modal: it's for using alongside the page, so the page stays usable behind it. -->
<div
	class="popover abt-on-sidebar"
	data-abt-tool
	role="dialog"
	aria-label={title}
	tabindex="-1"
	style="left: {left}px; top: {top}px"
	bind:this={popover}
	onkeydown={onKeydown}
>
	<div
		class="popover__hd"
		role="presentation"
		onpointerdown={onGrab}
		onpointermove={onDrag}
		onpointerup={onDrop}
		onpointercancel={onDrop}
	>
		<span class="popover__title">{title}</span>
		<button
			type="button"
			class="abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
			aria-label="Close {title}"
			onclick={onClose}
		>
			<Icon name="close" size={13} />
		</button>
	</div>
	{#if toolId === "calculator"}
		<Calculator {onClose} />
	{:else if toolId === "currency-converter"}
		<CurrencyConverter {onClose} />
	{:else if toolId === "interest-calculator"}
		<InterestCalculator {onClose} />
	{/if}
</div>

<style>
	.popover {
		position: fixed;
		/* Above the page and sidebar (1001), below Actual's dialogs (3000). */
		z-index: 2000;
		outline: none;
		background: var(--color-sidebarBackground);
		color: var(--abt-ink);
		border: 1px solid var(--abt-ink-2);
		border-radius: var(--abt-radius);
		box-shadow: var(--abt-shadow);
		overflow: hidden;
		/* Sidebar-coloured, so the tools' page colours follow the sidebar's (a theme may differ). */
		--color-pageText: var(--color-sidebarItemText);
		--color-tableBorder: var(--abt-ink-3);
		--color-cardBackground: color-mix(
			in srgb,
			var(--color-sidebarItemText) 6%,
			var(--color-sidebarBackground)
		);
	}

	.popover__hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--abt-space-3) var(--abt-space-4);
		border-bottom: 1px solid var(--abt-ink-2);
		cursor: grab;
		user-select: none;
		touch-action: none;
	}

	.popover__hd:active {
		cursor: grabbing;
	}

	.popover__title {
		font-size: var(--abt-text-base);
		font-weight: 600;
	}
</style>
