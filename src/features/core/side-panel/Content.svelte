<script lang="ts">
	import { clamp } from "@lib/utilities/math";
	import { panelState } from "./panel-state.svelte";

	const SIDEBAR_CLOSING_CLASS = "abt-side-drawer-sidebar-closing";
	const SIDEBAR_ANIMATION_MS = 110;

	let {
		onClose,
		initialWidth,
		onResize,
		onResizeEnd,
	}: {
		onClose: () => void;
		initialWidth: number;
		onResize: (width: number) => void;
		onResizeEnd: (width: number) => void;
	} = $props();

	function handleClose() {
		const sidebar = document.querySelector("[data-abt-side-drawer-sidebar]") as HTMLDivElement | null;
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

	$effect(() => {
		const node = panelState.headerNode;
		if (!headerSlotEl) return;
		headerSlotEl.replaceChildren();
		if (node) headerSlotEl.appendChild(node);
	});

	$effect(() => {
		const node = panelState.bodyNode;
		if (!bodyEl) return;
		bodyEl.replaceChildren();
		if (node) bodyEl.appendChild(node);
	});

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
			}

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

<div class="abt-side-drawer-resize-handle" use:resizeHandle></div>
<div class="abt-side-drawer-content">
	<div class="abt-side-drawer-header">
		<div class="abt-side-drawer-header-slot" bind:this={headerSlotEl}></div>
		{#if !panelState.headerNode}
			<h2 class="abt-side-drawer-title">{panelState.title}</h2>
		{/if}
		<button
			class="abt-side-drawer-close-button"
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
	.abt-side-drawer-resize-handle {
		position: absolute;
		top: 0;
		left: -4px;
		width: 8px;
		height: 100%;
		cursor: col-resize;
		z-index: 1;
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
		padding: 12px 12px 10px;
		border-bottom: var(--border);
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
		background-color: var(--color-sidebarBackground);
	}

	.abt-side-drawer-close-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 2px;
		width: 28px;
		height: 28px;
		border: 0;
		padding: 0;
		border-radius: 999px;
		flex-shrink: 0;
		margin-left: auto;
		cursor: pointer;
		color: var(--color-pageText);
		background: var(--color-buttonNormalBackground);
	}
</style>
