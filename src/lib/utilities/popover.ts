export interface PopoverPositionOptions {
	/** Gap in px between anchor and popover. Default 4. */
	gap?: number;
	/** Minimum distance from viewport edges. Default 8. */
	margin?: number;
	/**
	 * Horizontal anchoring strategy. "left" (default) aligns to the anchor's left
	 * edge and flips to the left on right-edge overflow. "right" pins the popover's
	 * right edge to the anchor's right edge (no flip) — for toolbar-style dropdowns.
	 */
	align?: "left" | "right";
}

/**
 * Positions `popoverEl` (must already be in the DOM and measurable) relative to
 * `anchorEl`, preferring below/left and flipping above/clamping on viewport overflow.
 */
export function positionPopover(
	popoverEl: HTMLElement,
	anchorEl: HTMLElement,
	opts: PopoverPositionOptions = {},
): void {
	const { gap = 4, margin = 8, align = "left" } = opts;
	const anchorRect = anchorEl.getBoundingClientRect();
	const popRect = popoverEl.getBoundingClientRect();

	let top = anchorRect.bottom + gap;
	if (top + popRect.height > window.innerHeight - margin) {
		top = Math.max(margin, anchorRect.top - popRect.height - gap);
	}
	popoverEl.style.top = `${top}px`;

	if (align === "right") {
		popoverEl.style.right = `${window.innerWidth - anchorRect.right}px`;
		popoverEl.style.left = "";
		return;
	}

	let left = anchorRect.left;
	if (left + popRect.width > window.innerWidth - margin) {
		left = Math.max(margin, window.innerWidth - popRect.width - margin);
	}
	popoverEl.style.left = `${left}px`;
}

/**
 * Closes the popover on the first mousedown outside `elements` (the popover
 * itself, plus any anchors that should also not count as "outside"). The
 * listener is attached after a 0ms delay so the click that opened the popover
 * doesn't immediately close it. Returns an unsubscribe usable at any time.
 */
export function onOutsideClick(elements: HTMLElement | HTMLElement[], onClose: () => void): () => void {
	const els = Array.isArray(elements) ? elements : [elements];

	function handler(e: MouseEvent) {
		const target = e.target as Node;
		if (!els.some((el) => el.contains(target))) {
			unsubscribe();
			onClose();
		}
	}

	const timer = setTimeout(() => document.addEventListener("mousedown", handler), 0);

	function unsubscribe() {
		clearTimeout(timer);
		document.removeEventListener("mousedown", handler);
	}

	return unsubscribe;
}
