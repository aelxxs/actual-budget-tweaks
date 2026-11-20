<script lang="ts">
	import { clamp } from "@lib/math";
	import { X } from "@lucide/svelte";
	import { panelState } from "./panel-state.svelte";

	let {
		onClose,
		initialWidth,
		defaultWidth,
		onResize,
		onResizeEnd,
	}: {
		/** Closes the top panel, bringing back the one underneath, or the drawer with the last. */
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

	let titleClipped = $state(false);
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
<!-- Escape closes a panel opened over another; a lone panel stays open. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="abt-side-drawer-content abt-controls-quiet"
	onkeydown={(e) => {
		if (e.key === "Escape" && panelState.stacked && !e.defaultPrevented) {
			e.preventDefault();
			onClose();
		}
	}}
>
	<div class="abt-side-drawer-header">
		<div class="abt-side-drawer-header-slot" bind:this={headerSlotEl}></div>
		{#if !panelState.headerNode}
			<!-- The full title on hover only when it's cut short. -->
			<h2
				class="abt-side-drawer-title"
				title={titleClipped ? panelState.title : undefined}
				onpointerenter={(e) =>
					(titleClipped = e.currentTarget.scrollWidth > e.currentTarget.clientWidth)}
			>
				{panelState.title}
			</h2>
		{/if}
		<button
			class="abt-side-drawer-close-button abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
			type="button"
			aria-label="Close"
			onclick={onClose}
		>
			<X size={16} aria-hidden="true" />
		</button>
	</div>
	<div class="abt-side-drawer-body" bind:this={bodyEl}></div>
</div>

<style>
	/* Centred on the panel's border; on hover, the grip and a full-height accent line show what it does. */
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
		position: absolute;
		top: 50%;
		left: 50%;
		box-sizing: border-box;
		width: 9px;
		height: 26px;
		border: 1px solid var(--abt-accent-4);
		border-radius: var(--abt-radius-pill);
		/* Three dots placed by proportion, so they spread apart as the pill grows. */
		background:
			radial-gradient(circle, var(--abt-accent) 1.2px, transparent 1.7px) 50% 18% / 6px 6px
				no-repeat,
			radial-gradient(circle, var(--abt-accent) 1.2px, transparent 1.7px) 50% 50% / 6px 6px
				no-repeat,
			radial-gradient(circle, var(--abt-accent) 1.2px, transparent 1.7px) 50% 82% / 6px 6px
				no-repeat,
			var(--color-pageBackground);
		transform: translate(-50%, -50%);
		opacity: 0;
		/* Above the hover line. */
		z-index: 1;
		transition:
			opacity 0.15s,
			height 0.15s;
	}

	.abt-side-drawer-resize-handle:hover::before,
	.abt-side-drawer-resize-handle.is-dragging::before {
		opacity: 0.45;
	}

	.abt-side-drawer-resize-handle:hover .abt-side-drawer-grip,
	.abt-side-drawer-resize-handle.is-dragging .abt-side-drawer-grip {
		height: 32px;
		opacity: 1;
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
		background: var(--abt-panel-bg);
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
		background-color: var(--abt-panel-bg);
		--abt-tabs-bg: var(--abt-panel-bg);
	}

	.abt-side-drawer-close-button {
		flex-shrink: 0;
		margin-left: auto;
	}
</style>
