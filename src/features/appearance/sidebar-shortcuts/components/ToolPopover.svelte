<script lang="ts">
	import Calculator from "../tools/Calculator.svelte";
	import CurrencyConverter from "../tools/CurrencyConverter.svelte";
	import InterestCalculator from "../tools/InterestCalculator.svelte";
	import type { ToolId } from "../types";

	const { toolId, title, anchorX, anchorY, onClose } = $props<{
		toolId: ToolId;
		title: string;
		anchorX: number;
		anchorY: number;
		onClose: () => void;
	}>();
</script>

<div class="backdrop" role="presentation" onclick={onClose}>
	<div class="popover" role="dialog" tabindex="-1" style="left: {anchorX}px; top: {anchorY}px" onclick={(e) => e.stopPropagation()}>
		<div class="popover__hd">
			<span class="popover__title">{title}</span>
			<button class="popover__close" onclick={onClose}>✕</button>
		</div>
		{#if toolId === "calculator"}
			<Calculator {onClose} />
		{:else if toolId === "currency-converter"}
			<CurrencyConverter {onClose} />
		{:else if toolId === "interest-calculator"}
			<InterestCalculator {onClose} />
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 99998;
	}

	.popover {
		position: fixed;
		z-index: 99999;
		background: var(--color-sidebarBackground, #2a2b3d);
		color: var(--color-sidebarItemText, #e0e0e0);
		border: 1px solid color-mix(in srgb, var(--color-sidebarItemText) 10%, transparent);
		border-radius: 10px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
		overflow: hidden;
	}

	.popover__hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-sidebarItemText) 10%, transparent);
	}

	.popover__title {
		font-size: 12px;
		font-weight: 600;
	}

	.popover__close {
		background: none;
		border: none;
		color: var(--color-sidebarItemText);
		opacity: 0.5;
		cursor: pointer;
		font-size: 12px;
		padding: 2px 4px;
		border-radius: 4px;
		line-height: 1;
	}

	.popover__close:hover {
		background: color-mix(in srgb, var(--color-sidebarItemText) 15%, transparent);
	}
</style>
