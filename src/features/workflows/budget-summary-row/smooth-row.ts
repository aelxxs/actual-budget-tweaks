const DURATION_MS = 300;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * Eases the row's cards between widths when their content resizes them. Flex layout can't be
 * transitioned, so this pins each card at its old width before the new layout paints (a
 * ResizeObserver runs between layout and paint), animates the pins to the new widths, then lets
 * flex take over again at the same widths.
 */
export function smoothRow(getItems: () => HTMLElement[]): () => void {
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	let widths = new Map<HTMLElement, number>();
	let animating = false;
	let frame = 0;
	let done: ReturnType<typeof setTimeout> | undefined;
	const observed = new Set<HTMLElement>();

	const measure = (items: HTMLElement[]) =>
		new Map(items.map((el) => [el, el.getBoundingClientRect().width]));

	function release(items: HTMLElement[]) {
		for (const el of items) {
			el.style.removeProperty("flex");
			el.style.removeProperty("min-width");
			el.style.removeProperty("transition");
		}
	}

	const resize = new ResizeObserver(() => {
		const items = getItems();
		for (const el of items) {
			if (!observed.has(el)) {
				observed.add(el);
				resize.observe(el);
			}
		}
		// Our own pinning resizes the cards too; those changes aren't new content.
		if (animating) return;

		const next = measure(items);
		const moved = items.some((el) => {
			const before = widths.get(el);
			return before !== undefined && Math.abs(before - next.get(el)!) > 0.5;
		});
		const prev = widths;
		widths = next;
		if (!moved || reducedMotion.matches) return;

		animating = true;
		for (const el of items) {
			el.style.flex = `0 0 ${prev.get(el) ?? next.get(el)}px`;
			el.style.minWidth = "0";
		}
		frame = requestAnimationFrame(() => {
			for (const el of items) {
				el.style.transition = `flex-basis ${DURATION_MS}ms ${EASE}`;
				el.style.flex = `0 0 ${next.get(el)}px`;
			}
			done = setTimeout(() => {
				release(items);
				animating = false;
			}, DURATION_MS + 20);
		});
	});

	for (const el of getItems()) {
		observed.add(el);
		resize.observe(el);
	}
	widths = measure(getItems());

	return () => {
		resize.disconnect();
		cancelAnimationFrame(frame);
		clearTimeout(done);
		release([...observed]);
	};
}
