// Firefox has no CSS-controllable overlay scrollbar once scrollbar-color or
// scrollbar-width is customized (it falls back to a real, space-reserving
// classic one — see the split .accounts rule in AccountList.svelte), so a themed,
// non-reserving scrollbar has to be drawn by hand instead of requested from
// the browser. The native scrollbar is hidden entirely; this draws and
// drives a thumb that never affects .accounts' layout width.

const MIN_THUMB = 24; // px
const HIDE_DELAY = 800; // ms after the last scroll/drag before fading out

export function overlayScrollbar(
	node: HTMLElement,
	params: { enabled: boolean } = { enabled: true },
) {
	if (!params.enabled) return {};

	// Appended to the parent (a non-scrolling positioning wrapper — see
	// .accounts-viewport in AccountList.svelte), not `node` itself: an absolutely
	// positioned child of the scrolling element still scrolls away with its
	// content, which defeats a scrollbar thumb's whole job of staying put.
	const thumb = document.createElement("div");
	thumb.className = "abt-overlay-thumb";
	(node.parentElement ?? node).appendChild(thumb);

	let dragging = false;
	let dragStartY = 0;
	let dragStartScrollTop = 0;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	function layout() {
		const { scrollHeight, clientHeight, scrollTop } = node;
		if (scrollHeight <= clientHeight + 1) {
			thumb.style.display = "none";
			return;
		}
		thumb.style.display = "";
		const thumbHeight = Math.max(MIN_THUMB, (clientHeight / scrollHeight) * clientHeight);
		const maxThumbTravel = clientHeight - thumbHeight;
		const maxScroll = scrollHeight - clientHeight;
		const top = maxScroll <= 0 ? 0 : (scrollTop / maxScroll) * maxThumbTravel;
		thumb.style.height = `${thumbHeight}px`;
		thumb.style.transform = `translateY(${top}px)`;
	}

	function show() {
		thumb.classList.add("visible");
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			if (!dragging) thumb.classList.remove("visible");
		}, HIDE_DELAY);
	}

	function onScroll() {
		layout();
		show();
	}

	function onThumbPointerDown(e: PointerEvent) {
		dragging = true;
		dragStartY = e.clientY;
		dragStartScrollTop = node.scrollTop;
		thumb.setPointerCapture(e.pointerId);
		show();
	}
	function onThumbPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const { scrollHeight, clientHeight } = node;
		const maxThumbTravel = clientHeight - thumb.clientHeight;
		const maxScroll = scrollHeight - clientHeight;
		if (maxThumbTravel <= 0) return;
		node.scrollTop = dragStartScrollTop + ((e.clientY - dragStartY) / maxThumbTravel) * maxScroll;
	}
	function onThumbPointerUp(e: PointerEvent) {
		dragging = false;
		thumb.releasePointerCapture?.(e.pointerId);
		show();
	}

	node.addEventListener("scroll", onScroll, { passive: true });
	node.addEventListener("mouseenter", show);
	thumb.addEventListener("pointerdown", onThumbPointerDown);
	thumb.addEventListener("pointermove", onThumbPointerMove);
	thumb.addEventListener("pointerup", onThumbPointerUp);
	thumb.addEventListener("pointercancel", onThumbPointerUp);

	// Content can grow/shrink (accounts added, groups expanded/collapsed)
	// without a scroll event ever firing.
	const ro = new ResizeObserver(layout);
	ro.observe(node);
	layout();

	return {
		destroy() {
			node.removeEventListener("scroll", onScroll);
			node.removeEventListener("mouseenter", show);
			ro.disconnect();
			clearTimeout(hideTimer);
			thumb.remove();
		},
	};
}
