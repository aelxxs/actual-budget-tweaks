<script lang="ts">
	import { portal } from "@lib/utilities/svelte";
	import { X } from "@lucide/svelte";
	import type { Snippet } from "svelte";

	const {
		title,
		label = title,
		alert = false,
		busy = false,
		class: className = "",
		inPlace = false,
		onClose,
		children,
		footer,
	}: {
		title: string;
		/** The accessible name, when the title is phrased as a question. */
		label?: string;
		/** A confirmation: no close button, and announced as an alert. */
		alert?: boolean;
		/** Mid-action, so neither Escape nor the backdrop dismisses it. */
		busy?: boolean;
		class?: string;
		/** Stays where it's mounted, for openDialog's container, rather than moving onto <body>. */
		inPlace?: boolean;
		onClose: () => void;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	let dialog: HTMLDivElement;
	const place = (node: HTMLElement) => (inPlace ? undefined : portal(node));
	$effect(() => dialog.focus());

	function dismiss() {
		if (!busy) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && dismiss()} />

<div
	class="abt-dialog-backdrop"
	role="presentation"
	use:place
	onclick={(e) => e.target === e.currentTarget && dismiss()}
>
	<div
		bind:this={dialog}
		class="abt-dialog abt-popover abt-controls-quiet {className}"
		role={alert ? "alertdialog" : "dialog"}
		aria-modal="true"
		aria-label={label}
		tabindex="-1"
	>
		<header class="abt-dialog__header">
			<h3 class="abt-dialog__title">{title}</h3>
			{#if !alert}
				<button
					type="button"
					class="abt-btn abt-btn--icon abt-btn--ghost"
					aria-label="Close"
					onclick={onClose}
				>
					<X size={16} strokeWidth={1.75} />
				</button>
			{/if}
		</header>
		{@render children()}
		{#if footer}
			<footer class="abt-dialog__footer">{@render footer()}</footer>
		{/if}
	</div>
</div>
