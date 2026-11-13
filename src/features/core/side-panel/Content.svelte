<script lang="ts">
	import { clamp } from "@lib/utilities/math";
	import { panelState } from "./panel-state.svelte";

	let {
		onBack,
		onClose,
		initialWidth,
		defaultWidth,
		onResize,
		onResizeEnd,
	}: {
		/** Closes the top panel, showing the one underneath. */
		onBack: () => void;
		/** Closes every panel and the drawer with them. */
		onClose: () => void;
		initialWidth: number;
		/** What a double-click on the resize handle goes back to. */
		defaultWidth: () => number;
		onResize: (width: number) => void;
		onResizeEnd: (width: number) => void;
	} = $props();

	let headerSlotEl: HTMLDivElement | undefined;
	let bodyEl: HTMLDivElement | undefined;

	// Portal pattern: panelState carries raw DOM nodes built outside Svelte, so
	// they're attached imperatively rather than rendered from a Svelte template.
	$effect(() => {
		const node = panelState.headerNode;
		if (!headerSlotEl) {
			return;
		}
		// eslint-disable-next-line svelte/no-dom-manipulating
		headerSlotEl.replaceChildren();
		if (node) {
			// eslint-disable-next-line svelte/no-dom-manipulating
			headerSlotEl.appendChild(node);
		}
	});

	// Each stacked panel keeps its own wrapper, hidden while another is on top, so switching
	// doesn't detach it (losing its scroll) and no panel's content shares a container with another's.
	const pages = new Map<Node, HTMLElement>();
	$effect(() => {
		const bodies = panelState.bodies;
		const current = panelState.bodyNode;
		if (!bodyEl) {
			return;
		}
		const nodes = new Set(bodies.map((b) => b.node));
		for (const [node, page] of pages) {
			if (!nodes.has(node)) {
				page.remove();
				pages.delete(node);
			}
		}
		for (const { key, node } of bodies) {
			let page = pages.get(node);
			if (!page) {
				page = document.createElement("div");
				page.className = "abt-side-drawer-page";

				page.appendChild(node);
				// eslint-disable-next-line svelte/no-dom-manipulating
				bodyEl.appendChild(page);
				pages.set(node, page);
			}
			if (key) {
				page.dataset.panel = key;
			}
			page.hidden = node !== current;
		}
	});

	let dragging = $state(false);

	function resetWidth() {
		onResize(defaultWidth());
		onResizeEnd(defaultWidth());
	}

	function resizeHandle(el: HTMLElement) {
		function clampWidth(w: number) {
			return clamp(Math.round(w), 240, 640);
		}

		function onPointerDown(event: PointerEvent) {
			event.preventDefault();

			const sidebar = el.closest("[data-abt-side-drawer-sidebar]") as HTMLElement | null;
			const startX = event.clientX;
			const startWidth = sidebar?.getBoundingClientRect().width ?? initialWidth;

			function onPointerMove(e: PointerEvent) {
				onResize(clampWidth(startWidth + (startX - e.clientX)));
			}

			function onPointerUp(e: PointerEvent) {
				const nextWidth = clampWidth(startWidth + (startX - e.clientX));
				onResize(nextWidth);
				onResizeEnd(nextWidth);
				document.removeEventListener("pointermove", onPointerMove);
				document.removeEventListener("pointerup", onPointerUp);
				document.body.style.userSelect = "";
				dragging = false;
			}

			dragging = true;
			document.body.style.userSelect = "none";
			document.addEventListener("pointermove", onPointerMove);
			document.addEventListener("pointerup", onPointerUp);
		}

		el.addEventListener("pointerdown", onPointerDown);
		return {
			destroy() {
				el.removeEventListener("pointerdown", onPointerDown);
			},
		};
	}
</script>

<div
	class="abt-side-drawer-resize-handle"
	class:is-dragging={dragging}
	role="separator"
	aria-orientation="vertical"
	aria-label="Resize panel (double-click to reset)"
	use:resizeHandle
	ondblclick={resetWidth}
>
	<span class="abt-side-drawer-grip"></span>
</div>
<!-- Escape steps back out of a stacked panel; a lone panel stays open. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="abt-side-drawer-content abt-controls-quiet"
	onkeydown={(e) => {
		if (e.key === "Escape" && panelState.backTitle && !e.defaultPrevented) {
			e.preventDefault();
			onBack();
		}
	}}
>
	<div class="abt-side-drawer-header">
		{#snippet back()}
			<button
				type="button"
				class="abt-side-drawer-back"
				title={`Back to ${panelState.backTitle}`}
				onclick={onBack}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
				</svg>
				<span class="abt-side-drawer-back-label">{panelState.backTitle}</span>
			</button>
		{/snippet}
		<!-- Stacked, the back link sits over the title, so each gets the header's full width. -->
		{#if panelState.backTitle && !panelState.headerNode}
			<div class="abt-side-drawer-heading">
				{@render back()}
				<h2 class="abt-side-drawer-title" title={panelState.title}>{panelState.title}</h2>
			</div>
		{:else if panelState.backTitle}
			{@render back()}
		{/if}
		<div class="abt-side-drawer-header-slot" bind:this={headerSlotEl}></div>
		{#if !panelState.headerNode && !panelState.backTitle}
			<h2 class="abt-side-drawer-title">{panelState.title}</h2>
		{/if}
		<button
			class="abt-side-drawer-close-button abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
			type="button"
			title={panelState.backTitle ? "Close all panels" : "Close side drawer"}
			aria-label={panelState.backTitle ? "Close all panels" : "Close side drawer"}
			onclick={onClose}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true" style="width:16px;height:16px;display:block;">
				<path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
			</svg>
		</button>
	</div>
	<div class="abt-side-drawer-body" bind:this={bodyEl}></div>
</div>

<style>
	/* Centred on the panel's border; the grip and a full-height accent line show what it does. */
	.abt-side-drawer-resize-handle {
		position: absolute;
		top: 0;
		left: -6px;
		width: 11px;
		height: 100%;
		cursor: col-resize;
		z-index: 2;
	}

	.abt-side-drawer-resize-handle::before {
		content: "";
		position: absolute;
		inset: 0 auto 0 var(--abt-space-2);
		width: 3px;
		background: var(--abt-accent);
		opacity: 0;
		transition: opacity 0.15s;
	}

	/* A pill with a column of dots, the usual "drag me" mark. */
	.abt-side-drawer-grip {
		--grip-dot: var(--abt-muted);
		position: absolute;
		top: 50%;
		left: 50%;
		box-sizing: border-box;
		width: 9px;
		height: 26px;
		border: 1px solid var(--abt-panel-border);
		border-radius: var(--abt-radius-pill);
		/* Three dots placed by proportion, so they spread apart as the pill grows. */
		background:
			radial-gradient(circle, var(--grip-dot) 1.2px, transparent 1.7px) 50% 18% / 6px 6px no-repeat,
			radial-gradient(circle, var(--grip-dot) 1.2px, transparent 1.7px) 50% 50% / 6px 6px no-repeat,
			radial-gradient(circle, var(--grip-dot) 1.2px, transparent 1.7px) 50% 82% / 6px 6px no-repeat,
			var(--color-pageBackground);
		transform: translate(-50%, -50%);
		/* Above the hover line. */
		z-index: 1;
		transition:
			border-color 0.15s,
			height 0.15s;
	}

	.abt-side-drawer-resize-handle:hover::before,
	.abt-side-drawer-resize-handle.is-dragging::before {
		opacity: 0.45;
	}

	.abt-side-drawer-resize-handle:hover .abt-side-drawer-grip,
	.abt-side-drawer-resize-handle.is-dragging .abt-side-drawer-grip {
		--grip-dot: var(--abt-accent);
		height: 32px;
		border-color: var(--abt-accent-4);
	}

	@media (prefers-reduced-motion: reduce) {
		.abt-side-drawer-resize-handle::before,
		.abt-side-drawer-grip {
			transition: none;
		}
	}

	.abt-side-drawer-content {
		position: relative;
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
		width: 100%;
	}

	.abt-side-drawer-header {
		position: sticky;
		top: 0;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--abt-space-3);
		box-sizing: border-box;
		min-height: var(--abt-panel-header-height);
		padding: 0 var(--abt-space-4);
		border-bottom: 1px solid var(--abt-panel-border);
		background: var(--color-pageBackground);
	}

	.abt-side-drawer-heading {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
	}

	/* The panel underneath, named so it's clear where back goes. */
	.abt-side-drawer-back {
		display: inline-flex;
		align-items: center;
		gap: var(--abt-space-1);
		max-width: 100%;
		margin-left: -4px;
		padding: 0 6px 0 0;
		border: none;
		border-radius: var(--abt-radius-sm);
		background: none;
		color: var(--abt-muted);
		font: inherit;
		font-size: var(--abt-text-sm);
		line-height: 1.4;
		cursor: pointer;
	}

	.abt-side-drawer-back:hover {
		color: var(--color-pageText);
	}

	.abt-side-drawer-back svg {
		flex-shrink: 0;
		width: 14px;
		height: 14px;
	}

	.abt-side-drawer-back-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.abt-side-drawer-heading .abt-side-drawer-title {
		max-width: 100%;
	}

	.abt-side-drawer-header-slot {
		display: contents;
	}

	/* One per stacked panel; its own stacking context, so one panel's layers can't sit over another's. */
	.abt-side-drawer-body :global(.abt-side-drawer-page) {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		/* Each panel scrolls on its own, so one underneath keeps its place. */
		overflow-y: auto;
		isolation: isolate;
	}

	.abt-side-drawer-body :global(.abt-side-drawer-page[hidden]) {
		display: none;
	}

	.abt-side-drawer-title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin: 0;
		font-size: var(--abt-text-lg);
		line-height: 1.3;
		font-weight: 700;
		color: var(--color-pageText);
	}

	.abt-side-drawer-body {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		min-height: 0;
		overflow-y: auto;
		background-color: var(--color-pageBackground);
	}

	.abt-side-drawer-close-button {
		flex-shrink: 0;
		margin-left: auto;
	}
</style>
