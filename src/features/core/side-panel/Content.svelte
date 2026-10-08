<script lang="ts">
	import { clamp } from "@lib/utilities/math";
	import { panelState } from "./panel-state.svelte";

	const SIDEBAR_CLOSING_CLASS = "abt-side-drawer-sidebar-closing";
	const SIDEBAR_ANIMATION_MS = 110;

	let {
		onClose,
		initialWidth,
		defaultWidth,
		onResize,
		onResizeEnd,
	}: {
		onClose: () => void;
		initialWidth: number;
		/** What a double-click on the resize handle goes back to. */
		defaultWidth: () => number;
		onResize: (width: number) => void;
		onResizeEnd: (width: number) => void;
	} = $props();

	function handleClose() {
		const sidebar = document.querySelector(
			"[data-abt-side-drawer-sidebar]",
		) as HTMLDivElement | null;
		if (!sidebar || sidebar.classList.contains(SIDEBAR_CLOSING_CLASS)) {
			onClose();
			return;
		}

		sidebar.classList.add(SIDEBAR_CLOSING_CLASS);

		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			sidebar.removeEventListener("animationend", onAnimationEnd);
			onClose();
		};

		const onAnimationEnd = (e: AnimationEvent) => {
			if (e.target === sidebar) finish();
		};

		sidebar.addEventListener("animationend", onAnimationEnd);
		window.setTimeout(finish, SIDEBAR_ANIMATION_MS + 40);
	}

	let headerSlotEl: HTMLDivElement | undefined;
	let bodyEl: HTMLDivElement | undefined;

	// Portal pattern: panelState carries raw DOM nodes built outside Svelte, so
	// they're attached imperatively rather than rendered from a Svelte template.
	$effect(() => {
		const node = panelState.headerNode;
		if (!headerSlotEl) return;
		// eslint-disable-next-line svelte/no-dom-manipulating
		headerSlotEl.replaceChildren();
		// eslint-disable-next-line svelte/no-dom-manipulating
		if (node) headerSlotEl.appendChild(node);
	});

	$effect(() => {
		const node = panelState.bodyNode;
		if (!bodyEl) return;
		// eslint-disable-next-line svelte/no-dom-manipulating
		bodyEl.replaceChildren();
		// eslint-disable-next-line svelte/no-dom-manipulating
		if (node) bodyEl.appendChild(node);
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
<div class="abt-side-drawer-content abt-controls-quiet">
	<div class="abt-side-drawer-header">
		<div class="abt-side-drawer-header-slot" bind:this={headerSlotEl}></div>
		{#if !panelState.headerNode}
			<h2 class="abt-side-drawer-title">{panelState.title}</h2>
		{/if}
		<button
			class="abt-side-drawer-close-button abt-btn abt-btn--sm abt-btn--icon abt-btn--ghost"
			type="button"
			title="Close side drawer"
			aria-label="Close side drawer"
			onclick={handleClose}
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
		inset: 0 auto 0 4px;
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
		border-radius: 999px;
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
		gap: 8px;
		box-sizing: border-box;
		min-height: var(--abt-panel-header-height);
		padding: 0 12px;
		border-bottom: 1px solid var(--abt-panel-border);
		background: var(--color-pageBackground);
	}

	.abt-side-drawer-header-slot {
		display: contents;
	}

	.abt-side-drawer-title {
		margin: 0;
		font-size: 14px;
		line-height: 1.3;
		font-weight: 700;
		color: var(--color-pageText);
	}

	.abt-side-drawer-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		background-color: var(--color-pageBackground);
	}

	.abt-side-drawer-close-button {
		flex-shrink: 0;
		margin-left: auto;
	}
</style>
