export type DragMove = (fx: number, fy: number, event: PointerEvent, box: DOMRect) => void;

/**
 * Reports the pointer as fractions of the element while a press drags over it. `start` can veto
 * the drag or say what it moves; the move handler gets that back through `event.target`.
 */
export function dragArea(
	node: HTMLElement,
	params: { move: DragMove; start?: (event: PointerEvent) => boolean },
) {
	let opts = params;
	const report = (e: PointerEvent) => {
		const box = node.getBoundingClientRect();
		opts.move((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height, e, box);
	};
	const onMove = (e: PointerEvent) => report(e);
	const onUp = (e: PointerEvent) => {
		node.releasePointerCapture(e.pointerId);
		node.removeEventListener("pointermove", onMove);
		node.removeEventListener("pointerup", onUp);
		node.removeEventListener("pointercancel", onUp);
	};
	const onDown = (e: PointerEvent) => {
		if (e.button !== 0 || (opts.start && !opts.start(e))) {
			return;
		}
		e.preventDefault();
		node.setPointerCapture(e.pointerId);
		report(e);
		node.addEventListener("pointermove", onMove);
		node.addEventListener("pointerup", onUp);
		node.addEventListener("pointercancel", onUp);
	};
	node.addEventListener("pointerdown", onDown);
	return {
		update(next: typeof params) {
			opts = next;
		},
		destroy() {
			node.removeEventListener("pointerdown", onDown);
		},
	};
}

/** Arrow keys as a step on each axis, for handles that also drag. */
export function arrowStep(e: KeyboardEvent): [number, number] | null {
	const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
		e.key
	] as [number, number] | undefined;
	if (!step) {
		return null;
	}
	e.preventDefault();
	return step;
}
